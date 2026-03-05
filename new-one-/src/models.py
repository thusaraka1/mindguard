"""
Database models for the AI Risk Assessment System
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Report(db.Model):
    __tablename__ = 'reports'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    media_analysis_content = db.Column(db.Text, nullable=True)
    complaint_analysis_content = db.Column(db.Text, nullable=True)
    final_report_content = db.Column(db.Text, nullable=True)
    risk_score = db.Column(db.Float, nullable=True)
    conflict_level = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Report {self.id}: {self.filename}>'