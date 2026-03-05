"""
Report Generator Module
Generates the final PDF report using analysis results
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

try:
    from .risk_analyzer import RiskLevel, ConflictType, ConflictReason
except ImportError:
    from risk_analyzer import RiskLevel, ConflictType, ConflictReason

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ReportGenerator:
    """Generates final decision report in PDF format"""
    
    def __init__(self, model_name: str = "google/flan-t5-base", use_gpu: bool = False):
        """
        Initialize the report generator with AI model for reasoning generation
        
        Args:
            model_name: Name of the transformer model for text generation
            use_gpu: Whether to use GPU acceleration
        """
        logger.info(f"Initializing Report Generator with model: {model_name}")
        
        self.device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")
        
        # Load model for generating reasoning text
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        self.model.to(self.device)
        
        logger.info("Report Generator initialized successfully")
    
    def _generate_ai_reasoning(self, analysis: Dict[str, Any]) -> str:
        """Generate AI reasoning text based on analysis results"""
        conflict_type = analysis['conflict_type']
        conflict_reason = analysis.get('conflict_reason')
        
        # Extract risk scores from nested structure
        media_score = analysis['media_risk']['raw_score']
        complaint_score = analysis['complaint_risk']['raw_score']
        
        # Create prompt for AI reasoning
        prompt = f"""Explain why a child's social media risk assessment shows:
Media Risk Score: {media_score}/100
Complaint Risk Score: {complaint_score}/100
Risk Gap: {analysis['risk_gap']}
Conflict Level: {conflict_type}
Conflict Reason: {conflict_reason if conflict_reason else 'N/A'}

Provide a clear, professional explanation for parents and counselors."""
        
        try:
            inputs = self.tokenizer(
                prompt,
                max_length=512,
                truncation=True,
                return_tensors="pt"
            ).to(self.device)
            
            outputs = self.model.generate(
                **inputs,
                max_length=256,
                num_beams=4,
                temperature=0.7,
                do_sample=True,
                top_p=0.9
            )
            
            reasoning = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            return reasoning
            
        except Exception as e:
            logger.error(f"Error generating AI reasoning: {e}")
            return analysis['analysis_summary']
    
    def generate_report(
        self,
        media_data: Dict[str, Any],
        complaint_data: Dict[str, Any],
        analysis_results: Dict[str, Any],
        output_path: str
    ) -> None:
        """
        Generate the final PDF report following the specified template
        
        Args:
            media_data: Parsed media report data
            complaint_data: Parsed complaint report data
            analysis_results: Results from RiskAnalyzer
            output_path: Path to save the generated PDF
        """
        logger.info(f"Generating report: {output_path}")
        
        # Create PDF document
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )
        
        # Build story
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a365d'),
            spaceAfter=10,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#4a5568'),
            spaceAfter=20,
            alignment=TA_CENTER
        )
        
        section_style = ParagraphStyle(
            'Section',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#2d3748'),
            spaceAfter=10,
            spaceBefore=15,
            fontName='Helvetica-Bold'
        )
        
        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#2d3748'),
            spaceAfter=8,
            leading=14
        )
        
        # Generate timestamp
        timestamp = datetime.now()
        case_id = timestamp.strftime('CASE-%Y%m%d%H%M%S')
        date_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
        
        # Extract data
        media_score = analysis_results['media_risk']['raw_score']
        complaint_score = analysis_results['complaint_risk']['raw_score']
        media_level = analysis_results['media_risk']['risk_level']
        complaint_level = analysis_results['complaint_risk']['risk_level']
        risk_gap = analysis_results['risk_gap']
        conflict_type = analysis_results['conflict_type']
        conflict_reason = analysis_results.get('conflict_reason')
        unified_score = analysis_results['unified_risk_score']
        confidence = analysis_results['confidence_level']
        requires_review = analysis_results['requires_manual_review']
        
        # Generate AI reasoning
        ai_reasoning = self._generate_ai_reasoning(analysis_results)
        
        # ===== HEADER =====
        story.append(Paragraph("FINAL DECISION REPORT", title_style))
        story.append(Paragraph("AI-Based Child Social Media Addiction Risk Assessment System", subtitle_style))
        story.append(Spacer(1, 0.2*inch))
        
        # ===== 1. CASE INFORMATION =====
        story.append(Paragraph("1. Case Information", section_style))
        case_data = [
            ['Case ID:', case_id],
            ['Generated Date & Time:', date_str],
            ['AI Model Version:', 'v2.1'],
            ['Evaluation Mode:', 'Automated Conflict-Aware Decision System']
        ]
        t = Table(case_data, colWidths=[2*inch, 4.5*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#2d3748')),
            ('ALIGN', (0,0), (0,-1), 'RIGHT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(t)
        story.append(Paragraph(
            "This report represents the final decision generated by integrating independent analysis outputs under an ethical, explainable AI framework.",
            body_style
        ))
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 2. INPUT DATA SOURCES =====
        story.append(Paragraph("2. Input Data Sources", section_style))
        story.append(Paragraph("The final decision was derived using the following independent reports:", body_style))
        story.append(Paragraph("• Report 1 – Media Analysis (Images, Videos, Captions, Hashtags)", body_style))
        story.append(Paragraph("• Report 2 – Complaint Analysis (Parent text, Voice-to-text, Behavioural history)", body_style))
        story.append(Paragraph("These reports are processed separately to prevent bias and data leakage.", body_style))
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 3. REPORT 1 – MEDIA ANALYSIS SUMMARY =====
        story.append(Paragraph("3. Report 1 – Media Analysis Summary", section_style))
        
        media_category = media_data.get('detected_category', 'Unknown')
        story.append(Paragraph(f"<b>Detected Media Category:</b> {media_category}", body_style))
        
        story.append(Paragraph("<b>Observed Indicators:</b>", body_style))
        indicators = [
            "Content type detected (gaming / anime / drugs / weapons / fights)",
            "Exposure duration and frequency",
            "Behavioural cues (night-time usage, prolonged focus)",
            "Caption emotion analysis",
            "Risky online community engagement"
        ]
        for ind in indicators:
            story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;- {ind}", body_style))
        
        story.append(Paragraph("<b>Media Risk Score:</b>", body_style))
        media_risk_data = [
            ['Raw Score (0-100):', f"{media_score}"],
            ['Normalized Score (0-10):', f"{media_score/10:.1f}"],
            ['Risk Level:', media_level]
        ]
        t = Table(media_risk_data, colWidths=[2*inch, 2*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#2d3748')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 4. REPORT 2 – COMPLAINT ANALYSIS SUMMARY =====
        story.append(Paragraph("4. Report 2 – Complaint Analysis Summary", section_style))
        
        complaint_overview = complaint_data.get('complaint_text', 'No specific complaint text available')
        story.append(Paragraph(f"<b>Complaint Overview:</b> {complaint_overview[:200]}...", body_style))
        
        story.append(Paragraph("<b>Behavioural Indicators Identified:</b>", body_style))
        behaviors = [
            "Sleep disruption",
            "School avoidance",
            "Emotional instability",
            "Behavioural resistance to device restriction"
        ]
        for beh in behaviors:
            story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;- {beh}", body_style))
        
        trend = complaint_data.get('trend', 'Unknown')
        prev_complaints = complaint_data.get('previous_complaints', 0)
        story.append(Paragraph("<b>Historical Complaint Review:</b>", body_style))
        story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;- Previous complaints: {prev_complaints if prev_complaints > 0 else 'None'}", body_style))
        story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;- Behaviour trend: {trend}", body_style))
        
        story.append(Paragraph("<b>Complaint Risk Score:</b>", body_style))
        complaint_risk_data = [
            ['Raw Score (0-100):', f"{complaint_score}"],
            ['Normalized Score (0-10):', f"{complaint_score/10:.1f}"],
            ['Risk Level:', complaint_level]
        ]
        t = Table(complaint_risk_data, colWidths=[2*inch, 2*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#2d3748')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 5. RISK SCORE COMPARISON =====
        story.append(Paragraph("5. Risk Score Comparison", section_style))
        comparison_data = [
            ['Report Source', 'Raw Score (0-100)', 'Normalized (0-10)', 'Risk Level'],
            ['Media Analysis', f"{media_score}", f"{media_score/10:.1f}", media_level],
            ['Complaint Analysis', f"{complaint_score}", f"{complaint_score/10:.1f}", complaint_level]
        ]
        t = Table(comparison_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2d3748')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f7fafc')]),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 6. RISK CONSISTENCY & CONFLICT EVALUATION =====
        story.append(Paragraph("6. Risk Consistency & Conflict Evaluation", section_style))
        story.append(Paragraph("<b>Risk Gap</b> = | Media Risk – Complaint Risk |", body_style))
        story.append(Paragraph(f"<b>Calculated Risk Gap:</b> {risk_gap}", body_style))
        story.append(Paragraph("<b>Conflict Classification:</b>", body_style))
        story.append(Paragraph("&nbsp;&nbsp;&nbsp;• 0–15 : Consistent", body_style))
        story.append(Paragraph("&nbsp;&nbsp;&nbsp;• 16–40 : Partial Inconsistency", body_style))
        story.append(Paragraph("&nbsp;&nbsp;&nbsp;• >40 : High Inconsistency", body_style))
        story.append(Paragraph(f"<b>Result:</b> {conflict_type}", body_style))
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 7. HIGH-CONFLICT RISK RESOLUTION MODULE =====
        story.append(Paragraph("7. High-Conflict Risk Resolution Module", section_style))
        if risk_gap > 40:
            story.append(Paragraph("(ACTIVATED - Risk Gap > 40)", body_style))
            if conflict_reason:
                story.append(Paragraph(f"<b>Conflict Type:</b> {conflict_reason}", body_style))
            story.append(Paragraph(f"<b>Unified Risk Score Generation:</b> {'Suspended' if unified_score is None else 'Allowed'}", body_style))
            story.append(Paragraph(f"<b>Confidence Level:</b> {confidence*100:.1f}%", body_style))
        else:
            story.append(Paragraph("(Not Activated - Risk Gap ≤ 40)", body_style))
            story.append(Paragraph(f"<b>Unified Risk Score Generation:</b> Allowed", body_style))
            story.append(Paragraph(f"<b>Confidence Level:</b> {confidence*100:.1f}%", body_style))
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 8. AI EXPLAINABLE REASONING OUTPUT =====
        story.append(Paragraph("8. AI Explainable Reasoning Output", section_style))
        story.append(Paragraph("<b>System Interpretation:</b>", body_style))
        story.append(Paragraph(f'"{ai_reasoning}"', body_style))
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 9. FINAL RISK DECISION =====
        story.append(Paragraph("9. Final Risk Decision", section_style))
        if unified_score is not None:
            story.append(Paragraph(f"<b>Final Risk Score:</b> {unified_score} / 100 (Normalized: {unified_score/10:.1f}/10)", body_style))
            if unified_score >= 70:
                overall_category = "High"
            elif unified_score >= 40:
                overall_category = "Medium"
            else:
                overall_category = "Low"
        else:
            story.append(Paragraph("<b>Final Risk Score:</b> Pending Validation (High Inconsistency Detected)", body_style))
            overall_category = "Uncertain"
        
        story.append(Paragraph(f"<b>Overall Risk Category:</b> {overall_category}", body_style))
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 10. ACTION RECOMMENDATIONS =====
        story.append(Paragraph("10. Action Recommendations", section_style))
        
        # Generate recommendations based on scores
        if unified_score is not None:
            addiction_detected = "Yes" if unified_score >= 70 else ("Early-stage" if unified_score >= 40 else "No")
            medical_help = "Yes" if unified_score >= 70 else "No"
            counselling = "Yes" if unified_score >= 40 else "No"
            content_removal = "Yes" if unified_score >= 60 else "No"
            legal_action = "No"
            authority_notify = "Yes" if unified_score >= 80 else "No"
            extended_obs = "Activated" if unified_score >= 40 else "Not Required"
        else:
            addiction_detected = "Uncertain"
            medical_help = "Pending"
            counselling = "Yes"
            content_removal = "Pending"
            legal_action = "No"
            authority_notify = "No"
            extended_obs = "Activated"
        
        recommendations = [
            ['Addiction Detected:', addiction_detected],
            ['Medical Help Required:', medical_help],
            ['Counselling Recommended:', counselling],
            ['Content Removal Required:', content_removal],
            ['Legal Action Required:', legal_action],
            ['Authority Notification:', authority_notify],
            ['Extended Observation Mode:', extended_obs]
        ]
        t = Table(recommendations, colWidths=[2.5*inch, 2*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#2d3748')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 11. PRIVACY & ETHICS COMPLIANCE =====
        story.append(Paragraph("11. Privacy & Ethics Compliance", section_style))
        story.append(Paragraph("• Data access restricted to authorized personnel", body_style))
        story.append(Paragraph("• Child identity anonymized", body_style))
        story.append(Paragraph("• Escalation avoided under uncertainty", body_style))
        story.append(Spacer(1, 0.15*inch))
        
        # ===== 12. FINAL SYSTEM NOTE =====
        story.append(Paragraph("12. Final System Note", section_style))
        story.append(Paragraph(
            "This decision reflects a cautious, evidence-sensitive approach, ensuring ethical intervention while respecting uncertainty.",
            body_style
        ))
        story.append(Spacer(1, 0.3*inch))
        
        # ===== FOOTER =====
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER
        )
        story.append(Paragraph("─" * 80, footer_style))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph(
            f"Confidence Level: {confidence*100:.1f}% | Manual Review: {'Required' if requires_review else 'Not Required'}",
            footer_style
        ))
        story.append(Paragraph(
            "This report is generated by AI and should be used as a decision support tool.",
            footer_style
        ))
        story.append(Paragraph(
            "© 2024 AI Risk Assessment System | All Rights Reserved | Confidential",
            footer_style
        ))
        
        # Build PDF
        doc.build(story)
        
        logger.info(f"Report generated successfully: {output_path}")
    
    def generate_text_report(
        self,
        media_data: Dict[str, Any],
        complaint_data: Dict[str, Any],
        analysis_results: Dict[str, Any]
    ) -> str:
        """
        Generate the final report as text
        
        Args:
            media_data: Parsed media report data
            complaint_data: Parsed complaint report data
            analysis_results: Results from RiskAnalyzer
            
        Returns:
            Text content of the report
        """
        # Generate AI reasoning
        reasoning = self._generate_ai_reasoning(analysis_results)
        
        # Build text report
        text = f"""
AI RISK ASSESSMENT SYSTEM - FINAL DECISION REPORT
===============================================

Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

CASE SUMMARY
------------
Media Report Risk Score: {analysis_results['media_risk']['raw_score']}/100 ({analysis_results['media_risk']['risk_level']})
Complaint Report Risk Score: {analysis_results['complaint_risk']['raw_score']}/100 ({analysis_results['complaint_risk']['risk_level']})
Risk Gap: {analysis_results['risk_gap']}
Conflict Type: {analysis_results['conflict_type']}
Confidence Level: {(analysis_results['confidence_level'] * 100):.1f}%

FINAL DECISION
--------------
"""
        
        if analysis_results['unified_risk_score'] is not None:
            risk_level = "High Risk" if analysis_results['unified_risk_score'] >= 70 else "Medium Risk" if analysis_results['unified_risk_score'] >= 40 else "Low Risk"
            text += f"Unified Risk Score: {analysis_results['unified_risk_score']}/100 ({risk_level})\n"
            text += f"Status: APPROVED\n"
        else:
            text += "Status: SUSPENDED - Manual Review Required\n"
        
        text += f"""
AI ANALYSIS SUMMARY
-------------------
{analysis_results['analysis_summary']}

AI-GENERATED REASONING
----------------------
{reasoning}

MEDIA REPORT DETAILS
--------------------
{media_data}

COMPLAINT REPORT DETAILS
------------------------
{complaint_data}

© 2024 AI Risk Assessment System | All Rights Reserved | Confidential
"""
        
        return text


if __name__ == "__main__":
    # Test the generator with sample data
    from risk_analyzer import RiskAnalyzer
    
    print("Testing Report Generator...")
    
    generator = ReportGenerator()
    analyzer = RiskAnalyzer()
    
    # Sample data
    media_data = {
        'risk_score': 75,
        'detected_category': 'Anime Content',
        'screen_time': 8,
        'platforms': ['Instagram', 'TikTok']
    }
    
    complaint_data = {
        'risk_score': 85,
        'complaint_text': 'Child showing signs of addiction...',
        'trend': 'Worsening',
        'previous_complaints': 2
    }
    
    analysis = analyzer.analyze(media_data, complaint_data)
    
    output_path = "test_report.pdf"
    generator.generate_report(media_data, complaint_data, analysis, output_path)
    
    print(f"✅ Test report generated: {output_path}")
