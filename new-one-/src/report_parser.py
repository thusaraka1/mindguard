"""
Report Parser Module
Extracts structured information from PDF reports using LLM-based extraction
"""

import re
import logging
from typing import Dict, Optional, Any
from PyPDF2 import PdfReader
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ReportParser:
    """
    Parses Media Analysis Report (Report 1) and Complaint Analysis Report (Report 2)
    using hybrid approach: Regex + LLM-based extraction
    """
    
    def __init__(self, model_name: str = "google/flan-t5-base", use_gpu: bool = False):
        """
        Initialize the parser with FLAN-T5 model
        
        Args:
            model_name: Hugging Face model identifier
            use_gpu: Whether to use GPU acceleration
        """
        logger.info(f"Initializing ReportParser with model: {model_name}")
        
        self.device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")
        
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
            self.model.to(self.device)
            self.model.eval()  # Set to evaluation mode
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def extract_from_pdf(self, pdf_path: str) -> str:
        """
        Extract text content from PDF file
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text as string
        """
        logger.info(f"Extracting text from PDF: {pdf_path}")
        
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            
            logger.info(f"Successfully extracted {len(text)} characters from PDF")
            return text.strip()
        
        except Exception as e:
            logger.error(f"Failed to extract PDF: {e}")
            raise ValueError(f"Could not read PDF file: {e}")
    
    def _extract_with_llm(self, text: str, prompt: str) -> str:
        """
        Use FLAN-T5 to extract specific information from text
        
        Args:
            text: Source text to extract from
            prompt: Instruction prompt for the model
            
        Returns:
            Extracted information as string
        """
        # Prepare input with prompt and context
        input_text = f"{prompt}\n\nContext: {text[:1500]}"  # Limit context to avoid token limit
        
        inputs = self.tokenizer(
            input_text, 
            return_tensors="pt", 
            max_length=512, 
            truncation=True
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_length=50,
                num_beams=4,
                early_stopping=True,
                temperature=0.3  # Lower temperature for more consistent extraction
            )
        
        result = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return result.strip()
    
    def _extract_risk_score(self, text: str, report_type: str = "Media") -> Optional[int]:
        """
        Extract risk score using regex with fallback to LLM
        
        Args:
            text: Report text
            report_type: "Media" or "Complaint"
            
        Returns:
            Risk score (0-100) or None if not found
        """
        # Pattern 1: "Final [Type] Risk Score: XX / 100"
        pattern1 = rf"Final {report_type} Risk Score:\s*(\d+)\s*/\s*100"
        match = re.search(pattern1, text, re.IGNORECASE)
        
        if match:
            return int(match.group(1))
        
        # Pattern 2: "Risk Score: XX"
        pattern2 = r"Risk Score:\s*(\d+)"
        match = re.search(pattern2, text, re.IGNORECASE)
        
        if match:
            return int(match.group(1))
        
        # Fallback to LLM extraction
        logger.warning(f"Regex failed, using LLM to extract {report_type} risk score")
        prompt = f"What is the {report_type} Risk Score mentioned in this report? Answer with just the number."
        result = self._extract_with_llm(text, prompt)
        
        try:
            score = int(re.search(r'\d+', result).group())
            return score
        except:
            logger.error(f"Could not extract {report_type} risk score")
            return None
    
    def parse_media_report(self, text: str) -> Dict[str, Any]:
        """
        Parse Report 1 - Media Analysis
        
        Args:
            text: Extracted report text
            
        Returns:
            Dictionary with structured data:
            {
                'risk_score': int,
                'category': str,
                'drugs_detected': bool,
                'weapon_detected': bool,
                'fight_detected': bool,
                'obsession_level': str,
                'environment': str,
                'community_type': str,
                'interpretation': str,
                'raw_text': str
            }
        """
        logger.info("Parsing Media Analysis Report (Report 1)")
        
        result = {
            'risk_score': None,
            'category': None,
            'drugs_detected': False,
            'weapon_detected': False,
            'fight_detected': False,
            'obsession_level': None,
            'environment': None,
            'community_type': None,
            'interpretation': None,
            'raw_text': text
        }
        
        # Extract risk score
        result['risk_score'] = self._extract_risk_score(text, "Media")
        
        # Extract detected category
        category_pattern = r"Primary Detected Category:\s*(.+?)(?:\n|$)"
        match = re.search(category_pattern, text, re.IGNORECASE)
        if match:
            result['category'] = match.group(1).strip()
        
        # Extract boolean detections
        result['drugs_detected'] = bool(re.search(r"Drugs Detected:\s*Yes", text, re.IGNORECASE))
        result['weapon_detected'] = bool(re.search(r"Weapon Detected:\s*Yes", text, re.IGNORECASE))
        result['fight_detected'] = bool(re.search(r"Fight Scene Detected:\s*Yes", text, re.IGNORECASE))
        
        # Extract obsession level
        obsession_pattern = r"Obsession Indicator:\s*(\w+)"
        match = re.search(obsession_pattern, text, re.IGNORECASE)
        if match:
            result['obsession_level'] = match.group(1).strip()
        
        # Extract environment
        env_pattern = r"Environment:\s*(.+?)(?:\n|$)"
        match = re.search(env_pattern, text, re.IGNORECASE)
        if match:
            result['environment'] = match.group(1).strip()
        
        # Extract community type
        community_pattern = r"Community Type:\s*(.+?)(?:\n|$)"
        match = re.search(community_pattern, text, re.IGNORECASE)
        if match:
            result['community_type'] = match.group(1).strip()
        
        # Extract interpretation (last part of Report 1)
        interp_pattern = r"(?:Interpretation|System Interpretation):\s*(.+?)(?:\n\n|\Z)"
        match = re.search(interp_pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            result['interpretation'] = match.group(1).strip()
        
        logger.info(f"Media report parsed - Risk Score: {result['risk_score']}, Category: {result['category']}")
        return result
    
    def parse_complaint_report(self, text: str) -> Dict[str, Any]:
        """
        Parse Report 2 - Complaint Analysis
        
        Args:
            text: Extracted report text
            
        Returns:
            Dictionary with structured data:
            {
                'risk_score': int,
                'sleep_issues': bool,
                'school_avoidance': bool,
                'device_usage': bool,
                'behavioral_reaction': str,
                'previous_complaints': int,
                'frequency': str,
                'trend': str,
                'interpretation': str,
                'recommended_action': str,
                'raw_text': str
            }
        """
        logger.info("Parsing Complaint Analysis Report (Report 2)")
        
        result = {
            'risk_score': None,
            'sleep_issues': False,
            'school_avoidance': False,
            'device_usage': False,
            'behavioral_reaction': None,
            'previous_complaints': 0,
            'frequency': None,
            'trend': None,
            'interpretation': None,
            'recommended_action': None,
            'raw_text': text
        }
        
        # Extract risk score
        result['risk_score'] = self._extract_risk_score(text, "Complaint")
        
        # Extract boolean indicators
        result['sleep_issues'] = bool(re.search(r"Sleep-related issues:\s*Yes", text, re.IGNORECASE))
        result['school_avoidance'] = bool(re.search(r"School avoidance behaviour:\s*Yes", text, re.IGNORECASE))
        result['device_usage'] = bool(re.search(r"Excessive device usage:\s*Yes", text, re.IGNORECASE))
        
        # Extract behavioral reaction
        reaction_pattern = r"Behavioural reaction to restriction:\s*(\w+)"
        match = re.search(reaction_pattern, text, re.IGNORECASE)
        if match:
            result['behavioral_reaction'] = match.group(1).strip()
        
        # Extract previous complaints count
        complaints_pattern = r"Number of previous complaints:\s*(\d+)"
        match = re.search(complaints_pattern, text, re.IGNORECASE)
        if match:
            result['previous_complaints'] = int(match.group(1))
        
        # Extract behavior frequency
        freq_pattern = r"Behaviour frequency:\s*(\w+)"
        match = re.search(freq_pattern, text, re.IGNORECASE)
        if match:
            result['frequency'] = match.group(1).strip()
        
        # Extract behavior trend
        trend_pattern = r"Behaviour trend over time:\s*(\w+)"
        match = re.search(trend_pattern, text, re.IGNORECASE)
        if match:
            result['trend'] = match.group(1).strip()
        
        # Extract interpretation
        interp_pattern = r"(?:System Interpretation|Interpretation):\s*(.+?)(?:\n\n|Recommended Action|\Z)"
        match = re.search(interp_pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            result['interpretation'] = match.group(1).strip()
        
        # Extract recommended action
        action_pattern = r"Recommended Action:\s*(.+?)(?:\n\n|\Z)"
        match = re.search(action_pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            result['recommended_action'] = match.group(1).strip()
        
        logger.info(f"Complaint report parsed - Risk Score: {result['risk_score']}, Trend: {result['trend']}")
        return result
    
    def parse_both_reports(self, media_pdf_path: str, complaint_pdf_path: str) -> Dict[str, Dict]:
        """
        Parse both reports from PDF files
        
        Args:
            media_pdf_path: Path to Media Analysis Report PDF
            complaint_pdf_path: Path to Complaint Analysis Report PDF
            
        Returns:
            Dictionary containing both parsed reports:
            {
                'media_report': {...},
                'complaint_report': {...}
            }
        """
        logger.info("Parsing both reports...")
        
        # Extract text from PDFs
        media_text = self.extract_from_pdf(media_pdf_path)
        complaint_text = self.extract_from_pdf(complaint_pdf_path)
        
        # Parse both reports
        media_data = self.parse_media_report(media_text)
        complaint_data = self.parse_complaint_report(complaint_text)
        
        logger.info("Both reports parsed successfully")
        
        return {
            'media_report': media_data,
            'complaint_report': complaint_data
        }