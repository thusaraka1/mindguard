"""
Risk Analyzer Module
Performs risk gap calculation, conflict detection, and consistency evaluation
"""

import logging
from typing import Dict, Tuple, Optional, Any
from enum import Enum

try:
    from .config import RISK_THRESHOLDS, CONFLICT_THRESHOLDS
except ImportError:
    from config import RISK_THRESHOLDS, CONFLICT_THRESHOLDS

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class RiskLevel(Enum):
    """Risk level classification"""
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    UNCERTAIN = "Uncertain"


class ConflictType(Enum):
    """Types of conflicts detected"""
    CONSISTENT = "Consistent"
    PARTIAL_INCONSISTENCY = "Partial Inconsistency"
    HIGH_INCONSISTENCY = "High Inconsistency"


class ConflictReason(Enum):
    """Reasons for high conflict"""
    HIDDEN_BEHAVIOUR = "Hidden Behaviour Risk"
    UNOBSERVED_EXPOSURE = "Unobserved Online Exposure"
    TEMPORAL_SHIFT = "Temporal Behaviour Shift"
    PARENT_OVERREACTION = "Parental Overreaction"
    MEDIA_UNDERESTIMATION = "Media Risk Underestimation"


class RiskAnalyzer:
    """
    Analyzes risk scores from both reports and detects conflicts
    """
    
    def __init__(self):
        """Initialize the Risk Analyzer"""
        logger.info("Initializing RiskAnalyzer")
        self.risk_thresholds = RISK_THRESHOLDS
        self.conflict_thresholds = CONFLICT_THRESHOLDS
    
    def normalize_score(self, raw_score: Optional[int]) -> float:
        """
        Normalize raw score (0-100) to 0-10 scale
        
        Args:
            raw_score: Risk score from 0-100, or None
            
        Returns:
            Normalized score from 0-10 (returns 0.0 if None)
        """
        if raw_score is None:
            return 0.0
        
        normalized = round((raw_score / 100) * 10, 1)
        return max(0.0, min(10.0, normalized))  # Clamp between 0-10
    
    def classify_risk_level(self, raw_score: Optional[int]) -> RiskLevel:
        """
        Classify risk level based on raw score
        
        Args:
            raw_score: Risk score from 0-100, or None for uncertain
            
        Returns:
            RiskLevel enum value
        """
        if raw_score is None:
            return RiskLevel.UNCERTAIN
        
        if self.risk_thresholds['low'][0] <= raw_score <= self.risk_thresholds['low'][1]:
            return RiskLevel.LOW
        elif self.risk_thresholds['medium'][0] <= raw_score <= self.risk_thresholds['medium'][1]:
            return RiskLevel.MEDIUM
        elif self.risk_thresholds['high'][0] <= raw_score <= self.risk_thresholds['high'][1]:
            return RiskLevel.HIGH
        else:
            return RiskLevel.UNCERTAIN
    
    def calculate_risk_gap(self, media_score: int, complaint_score: int) -> int:
        """
        Calculate absolute risk gap between two scores
        
        Args:
            media_score: Media Analysis risk score
            complaint_score: Complaint Analysis risk score
            
        Returns:
            Absolute difference between scores
        """
        if media_score is None or complaint_score is None:
            logger.warning("Missing risk scores, cannot calculate gap")
            return 999  # Invalid gap indicator
        
        gap = abs(media_score - complaint_score)
        logger.info(f"Risk Gap calculated: {gap} (Media: {media_score}, Complaint: {complaint_score})")
        return gap
    
    def classify_conflict(self, risk_gap: int) -> ConflictType:
        """
        Classify conflict type based on risk gap
        
        Args:
            risk_gap: Absolute difference between risk scores
            
        Returns:
            ConflictType enum value
        """
        if risk_gap <= self.conflict_thresholds['consistent'][1]:
            return ConflictType.CONSISTENT
        elif risk_gap <= self.conflict_thresholds['partial_inconsistency'][1]:
            return ConflictType.PARTIAL_INCONSISTENCY
        else:
            return ConflictType.HIGH_INCONSISTENCY
    
    def determine_conflict_reason(
        self, 
        media_data: Dict[str, Any], 
        complaint_data: Dict[str, Any],
        risk_gap: int
    ) -> ConflictReason:
        """
        Determine the most likely reason for high conflict
        
        Args:
            media_data: Parsed media report data
            complaint_data: Parsed complaint report data
            risk_gap: Risk gap value
            
        Returns:
            ConflictReason enum value
        """
        media_score = media_data.get('risk_score', 0)
        complaint_score = complaint_data.get('risk_score', 0)
        
        # Case 1: Complaint score much higher than media score
        if complaint_score > media_score + 30:
            # Check if parent reports severe issues but media seems mild
            severe_indicators = sum([
                complaint_data.get('sleep_issues', False),
                complaint_data.get('school_avoidance', False),
                complaint_data.get('previous_complaints', 0) > 2,
                complaint_data.get('trend') == 'Worsening'
            ])
            
            if severe_indicators >= 3:
                return ConflictReason.HIDDEN_BEHAVIOUR
            else:
                return ConflictReason.PARENT_OVERREACTION
        
        # Case 2: Media score much higher than complaint score
        elif media_score > complaint_score + 30:
            # High-risk media but parent doesn't see severe symptoms
            high_risk_media = any([
                media_data.get('drugs_detected', False),
                media_data.get('weapon_detected', False),
                media_data.get('fight_detected', False),
                media_data.get('obsession_level') == 'High'
            ])
            
            if high_risk_media:
                return ConflictReason.UNOBSERVED_EXPOSURE
            else:
                return ConflictReason.MEDIA_UNDERESTIMATION
        
        # Case 3: Moderate gap with trend change
        elif complaint_data.get('trend') in ['Worsening', 'Improving']:
            return ConflictReason.TEMPORAL_SHIFT
        
        # Default: Hidden behaviour
        return ConflictReason.HIDDEN_BEHAVIOUR
    
    def calculate_unified_risk_score(
        self, 
        media_score: int, 
        complaint_score: int,
        conflict_type: ConflictType
    ) -> Optional[int]:
        """
        Calculate unified risk score with conflict-aware weighting
        
        Args:
            media_score: Media Analysis risk score
            complaint_score: Complaint Analysis risk score
            conflict_type: Type of conflict detected
            
        Returns:
            Unified risk score or None if high conflict (requires manual review)
        """
        # If high inconsistency, suspend automatic scoring
        if conflict_type == ConflictType.HIGH_INCONSISTENCY:
            logger.warning("High inconsistency detected - unified score suspended")
            return None
        
        # For consistent or partial inconsistency: weighted average
        if conflict_type == ConflictType.CONSISTENT:
            # Equal weighting for consistent reports
            weight_media = 0.5
            weight_complaint = 0.5
        else:  # Partial inconsistency
            # Give higher weight to complaint (parent observation more critical)
            weight_media = 0.4
            weight_complaint = 0.6
        
        unified_score = int(
            (media_score * weight_media) + (complaint_score * weight_complaint)
        )
        
        logger.info(f"Unified risk score calculated: {unified_score}")
        return unified_score
    
    def calculate_confidence_level(
        self, 
        conflict_type: ConflictType,
        media_data: Dict[str, Any],
        complaint_data: Dict[str, Any]
    ) -> float:
        """
        Calculate confidence level of the assessment
        
        Args:
            conflict_type: Type of conflict detected
            media_data: Parsed media report data
            complaint_data: Parsed complaint report data
            
        Returns:
            Confidence level (0.0 - 1.0)
        """
        base_confidence = {
            ConflictType.CONSISTENT: 0.95,
            ConflictType.PARTIAL_INCONSISTENCY: 0.75,
            ConflictType.HIGH_INCONSISTENCY: 0.40
        }
        
        confidence = base_confidence[conflict_type]
        
        # Reduce confidence if critical data is missing
        if media_data.get('risk_score') is None:
            confidence -= 0.2
        if complaint_data.get('risk_score') is None:
            confidence -= 0.2
        
        # Increase confidence if historical data is available
        if complaint_data.get('previous_complaints', 0) > 0:
            confidence = min(1.0, confidence + 0.05)
        
        return round(max(0.0, min(1.0, confidence)), 2)
    
    def analyze(
        self, 
        media_data: Dict[str, Any], 
        complaint_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Complete risk analysis of both reports
        
        Args:
            media_data: Parsed media report data
            complaint_data: Parsed complaint report data
            
        Returns:
            Dictionary containing comprehensive risk analysis:
            {
                'media_risk': {...},
                'complaint_risk': {...},
                'risk_gap': int,
                'conflict_type': str,
                'conflict_reason': str,
                'unified_risk_score': int or None,
                'confidence_level': float,
                'requires_manual_review': bool,
                'analysis_summary': str
            }
        """
        logger.info("Starting comprehensive risk analysis")
        
        # Extract risk scores
        media_score = media_data.get('risk_score')
        complaint_score = complaint_data.get('risk_score')
        
        # Normalize and classify
        media_normalized = self.normalize_score(media_score)
        complaint_normalized = self.normalize_score(complaint_score)
        
        media_risk_level = self.classify_risk_level(media_score)
        complaint_risk_level = self.classify_risk_level(complaint_score)
        
        # Calculate risk gap and classify conflict
        risk_gap = self.calculate_risk_gap(media_score, complaint_score)
        conflict_type = self.classify_conflict(risk_gap)
        
        # Determine conflict reason if high inconsistency
        conflict_reason = None
        if conflict_type == ConflictType.HIGH_INCONSISTENCY:
            conflict_reason = self.determine_conflict_reason(
                media_data, complaint_data, risk_gap
            )
        
        # Calculate unified score
        unified_score = self.calculate_unified_risk_score(
            media_score, complaint_score, conflict_type
        )
        
        # Calculate confidence
        confidence = self.calculate_confidence_level(
            conflict_type, media_data, complaint_data
        )
        
        # Determine if manual review required
        requires_review = (
            conflict_type == ConflictType.HIGH_INCONSISTENCY or
            unified_score is None or
            confidence < 0.6
        )
        
        # Generate analysis summary
        summary = self._generate_analysis_summary(
            conflict_type, conflict_reason, media_risk_level, 
            complaint_risk_level, risk_gap
        )
        
        result = {
            'media_risk': {
                'raw_score': media_score,
                'normalized_score': media_normalized,
                'risk_level': media_risk_level.value
            },
            'complaint_risk': {
                'raw_score': complaint_score,
                'normalized_score': complaint_normalized,
                'risk_level': complaint_risk_level.value
            },
            'risk_gap': risk_gap,
            'conflict_type': conflict_type.value,
            'conflict_reason': conflict_reason.value if conflict_reason else None,
            'unified_risk_score': unified_score,
            'unified_risk_level': self.classify_risk_level(unified_score).value if unified_score else "Uncertain",
            'confidence_level': confidence,
            'requires_manual_review': requires_review,
            'analysis_summary': summary
        }
        
        logger.info(f"Risk analysis complete - Conflict: {conflict_type.value}, "
                   f"Unified Score: {unified_score}, Confidence: {confidence}")
        
        return result
    
    def _generate_analysis_summary(
        self,
        conflict_type: ConflictType,
        conflict_reason: Optional[ConflictReason],
        media_risk: RiskLevel,
        complaint_risk: RiskLevel,
        risk_gap: int
    ) -> str:
        """
        Generate human-readable analysis summary
        
        Args:
            conflict_type: Type of conflict detected
            conflict_reason: Reason for conflict (if high inconsistency)
            media_risk: Media risk level
            complaint_risk: Complaint risk level
            risk_gap: Risk gap value
            
        Returns:
            Summary text
        """
        if conflict_type == ConflictType.CONSISTENT:
            return (
                f"The Media Analysis and Complaint Analysis reports show consistent risk assessment "
                f"(gap: {risk_gap} points). Both reports indicate {media_risk.value} risk level. "
                f"The system has high confidence in this assessment and recommends proceeding with "
                f"standard intervention protocols."
            )
        
        elif conflict_type == ConflictType.PARTIAL_INCONSISTENCY:
            return (
                f"The reports show partial inconsistency with a risk gap of {risk_gap} points. "
                f"Media Analysis indicates {media_risk.value} risk while Complaint Analysis "
                f"indicates {complaint_risk.value} risk. This moderate discrepancy suggests "
                f"careful consideration of both evidence sources. Extended observation may be warranted."
            )
        
        else:  # High inconsistency
            reason_text = conflict_reason.value if conflict_reason else "Unknown factors"
            return (
                f"ALERT: High inconsistency detected (gap: {risk_gap} points). "
                f"Media Analysis shows {media_risk.value} risk while Complaint Analysis shows "
                f"{complaint_risk.value} risk. Probable cause: {reason_text}. "
                f"Manual expert review is required before proceeding with any intervention. "
                f"Automatic risk scoring has been suspended to prevent inappropriate escalation."
            )