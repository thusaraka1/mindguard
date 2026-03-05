"""
Configuration settings for the AI Risk Assessment System
"""

import os
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
UPLOADS_DIR = PROJECT_ROOT / "uploads"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
MODELS_DIR = PROJECT_ROOT / "models"

# Create directories if they don't exist
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://mindguard:mindguard123@localhost:5434/ai_risk_assessment")
MODEL_CONFIG = {
    "parser_model": "google/flan-t5-base",
    "generator_model": "google/flan-t5-base",
    "use_gpu": False,  # Set to True if you have CUDA-capable GPU
    "cache_dir": str(MODELS_DIR)
}

# Risk assessment thresholds
RISK_THRESHOLDS = {
    "low": (0, 40),
    "medium": (41, 70),
    "high": (71, 100)
}

# Conflict detection thresholds
CONFLICT_THRESHOLDS = {
    "consistent": (0, 15),
    "partial_inconsistency": (16, 40),
    "high_inconsistency": (41, 100)
}

# Report metadata
SYSTEM_VERSION = "v2.1"
EVALUATION_MODE = "Automated Conflict-Aware Decision System"

# Email configuration for notifications
EMAIL_CONFIG = {
    "smtp_server": "smtp.gmail.com",  # Change to your SMTP server
    "smtp_port": 587,
    "sender_email": "weerahasindu@gmail.com",  # Replace with your email
    "sender_password": "coztnmptydujszxn",  # Use app password for Gmail
    "authorized_emails": {
        "yasi20000422@gmail.com": "psych_pass",  # Psychologist
        "hasinduweerakkodi453@gmail.com": "cert_pass",  # CERT / Cybercrime Analyst
        "it22279484@my.sliit.lk": "police_pass"  # Police
    }
}