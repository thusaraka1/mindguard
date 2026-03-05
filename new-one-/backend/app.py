"""
Flask Backend API for AI Risk Assessment System
Handles file uploads, report analysis, and PDF generation
"""

import os
import sys
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Add src to Python path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from config import DATABASE_URL, EMAIL_CONFIG
from models import db, Report
from report_parser import ReportParser
from risk_analyzer import RiskAnalyzer
from report_generator import ReportGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Configuration
UPLOAD_FOLDER = PROJECT_ROOT / 'uploads'
OUTPUT_FOLDER = PROJECT_ROOT / 'outputs'
ALLOWED_EXTENSIONS = {'pdf'}

UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['OUTPUT_FOLDER'] = str(OUTPUT_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()

# Initialize AI components
logger.info("Initializing AI models...")
parser = ReportParser(model_name="google/flan-t5-base", use_gpu=False)
analyzer = RiskAnalyzer()
generator = ReportGenerator(model_name="google/flan-t5-base", use_gpu=False)
logger.info("AI models initialized successfully!")


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'AI Risk Assessment System is running',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/analyze', methods=['POST'])
def analyze_reports():
    """
    Main endpoint to analyze uploaded reports
    Expects: 'media_report' and 'complaint_report' files
    Returns: Analysis results and generated report
    """
    try:
        # Validate files
        if 'media_report' not in request.files or 'complaint_report' not in request.files:
            return jsonify({
                'error': 'Both media_report and complaint_report files are required'
            }), 400

        media_file = request.files['media_report']
        complaint_file = request.files['complaint_report']

        if media_file.filename == '' or complaint_file.filename == '':
            return jsonify({
                'error': 'Both files must have valid filenames'
            }), 400

        if not (allowed_file(media_file.filename) and allowed_file(complaint_file.filename)):
            return jsonify({
                'error': 'Only PDF files are allowed'
            }), 400

        # Save uploaded files
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        media_filename = secure_filename(f'media_{timestamp}_{media_file.filename}')
        complaint_filename = secure_filename(f'complaint_{timestamp}_{complaint_file.filename}')
        
        media_path = Path(app.config['UPLOAD_FOLDER']) / media_filename
        complaint_path = Path(app.config['UPLOAD_FOLDER']) / complaint_filename
        
        media_file.save(str(media_path))
        complaint_file.save(str(complaint_path))
        
        logger.info(f"Files uploaded: {media_filename}, {complaint_filename}")

        # Step 1: Parse both reports
        logger.info("Parsing reports...")
        parsed_data = parser.parse_both_reports(
            str(media_path),
            str(complaint_path)
        )
        
        media_data = parsed_data['media_report']
        complaint_data = parsed_data['complaint_report']

        # Step 2: Analyze risk
        logger.info("Analyzing risk...")
        analysis_results = analyzer.analyze(media_data, complaint_data)

        # Step 3: Generate final report
        logger.info("Generating final report...")
        output_filename = f'final_report_{timestamp}.pdf'
        output_path = Path(app.config['OUTPUT_FOLDER']) / output_filename
        
        generator.generate_report(
            media_data=media_data,
            complaint_data=complaint_data,
            analysis_results=analysis_results,
            output_path=str(output_path)
        )

        # Generate text report
        text_report = generator.generate_text_report(
            media_data=media_data,
            complaint_data=complaint_data,
            analysis_results=analysis_results
        )

        logger.info(f"Report generated successfully: {output_filename}")

        # Save to database
        try:
            report = Report(
                filename=output_filename,
                media_analysis_content=str(media_data),
                complaint_analysis_content=str(complaint_data),
                final_report_content=str(analysis_results),
                risk_score=analysis_results.get('unified_risk_score'),
                conflict_level=analysis_results.get('conflict_type')
            )
            db.session.add(report)
            db.session.commit()
            logger.info(f"Report saved to database: {report.id}")
        except Exception as db_error:
            logger.error(f"Failed to save report to database: {str(db_error)}")

        # Send notification emails to relevant authorized personnel
        send_notification_email(output_filename, analysis_results)

        # Prepare response
        response_data = {
            'success': True,
            'message': 'Analysis completed successfully',
            'timestamp': timestamp,
            'analysis': {
                'media_risk_score': analysis_results['media_risk']['raw_score'],
                'complaint_risk_score': analysis_results['complaint_risk']['raw_score'],
                'media_risk_level': analysis_results['media_risk']['risk_level'],
                'complaint_risk_level': analysis_results['complaint_risk']['risk_level'],
                'risk_gap': analysis_results['risk_gap'],
                'conflict_type': analysis_results['conflict_type'],
                'unified_risk_score': analysis_results['unified_risk_score'],
                'confidence_level': analysis_results['confidence_level'],
                'requires_manual_review': analysis_results['requires_manual_review'],
                'summary': analysis_results['analysis_summary']
            },
            'report_url': f'/api/download/{output_filename}',
            'text_report': text_report
        }

        # Clean up uploaded files (optional)
        # media_path.unlink()
        # complaint_path.unlink()

        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Error during analysis: {str(e)}", exc_info=True)
        return jsonify({
            'error': f'Analysis failed: {str(e)}'
        }), 500


@app.route('/api/reports', methods=['GET'])
def get_reports():
    """
    Get list of all reports from database
    """
    try:
        reports = Report.query.order_by(Report.created_at.desc()).all()
        reports_data = [{
            'id': r.id,
            'filename': r.filename,
            'risk_score': r.risk_score,
            'conflict_level': r.conflict_level,
            'created_at': r.created_at.isoformat()
        } for r in reports]
        return jsonify({'reports': reports_data}), 200
    except Exception as e:
        logger.error(f"Error fetching reports: {str(e)}")
        return jsonify({'error': f'Failed to fetch reports: {str(e)}'}), 500


@app.route('/api/download/<filename>', methods=['GET'])
def download_report(filename):
    """Download generated report"""
    try:
        file_path = Path(app.config['OUTPUT_FOLDER']) / filename
        
        if not file_path.exists():
            return jsonify({
                'error': 'Report not found'
            }), 404
        
        return send_file(
            str(file_path),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        logger.error(f"Error downloading report: {str(e)}")
        return jsonify({
            'error': f'Download failed: {str(e)}'
        }), 500



def send_notification_email(report_filename, analysis_results):
    """Send notification email to only the relevant authorized personnel based on analysis results"""
    try:
        # Determine recipients based on risk score and analysis
        recipients = []
        score = analysis_results.get('unified_risk_score', 0)
        authority_notify = analysis_results.get('authority_notify', 'No')
        # Email mapping
        email_map = {
            'psychologist': 'sliityasindu@gmail.com',
            'cert': 'yasiutube2000@gmail.com',
            'police': 'pixel001pixel@gmail.com'
        }
        # Logic: Police (score>=80 or authority_notify==Yes), CERT (70<=score<80), Psychologist (else)
        if score is not None:
            if score >= 80 or authority_notify == 'Yes':
                recipients.append(email_map['police'])
            elif score >= 70:
                recipients.append(email_map['cert'])
            else:
                recipients.append(email_map['psychologist'])
        else:
            recipients.append(email_map['psychologist'])

        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['Subject'] = f"New Risk Assessment Report Generated: {report_filename}"
        body = f"""
A new risk assessment report has been generated.\n\nReport: {report_filename}\nSummary: {analysis_results.get('analysis_summary', '')}\n\nTo access this report, please log in to the system with your authorized credentials.\n\nThis is an automated notification.\n"""
        msg.attach(MIMEText(body, 'plain'))
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()
        server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
        for email in recipients:
            msg['To'] = email
            server.sendmail(EMAIL_CONFIG['sender_email'], email, msg.as_string())
        server.quit()
        logger.info(f"Notification email sent to: {recipients}")
    except Exception as e:
        logger.error(f"Failed to send notification emails: {str(e)}")


if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 AI Risk Assessment System - Backend Server")
    print("="*60)
    print("Server starting on: http://localhost:5004")
    print("Health check: http://localhost:5004/health")
    print("="*60 + "\n")
    
    app.run(
        host='0.0.0.0',
        port=5004,
        debug=True
    )

