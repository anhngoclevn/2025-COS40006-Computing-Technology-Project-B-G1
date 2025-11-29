"""
Video Processing API for Attendance System - MERGED VERSION
Features:
- Flask API for video upload and processing
- Auto processor with watchdog for monitoring uploads folder
- Database synchronization with PHP backend
- PDF evidence report generation
- Real-time progress monitoring
- Comprehensive error handling
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import subprocess
from pathlib import Path
from datetime import datetime
import threading
import time
import csv
import requests
import logging
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Setup logging with UTF-8 encoding for Windows
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('video_api.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# Fix Windows console encoding for emoji
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Configuration
UPLOAD_FOLDER = Path(__file__).parent / 'uploads'
OUTPUT_FOLDER = Path(__file__).parent / 'outputs'
GALLERY_FOLDER = Path(__file__).parent / 'students_gallery'
MODEL_FOLDER = Path(__file__).parent / 'models'
REPORTS_FOLDER = Path(__file__).parent / 'reports'
PROCESSING_FOLDER = Path(__file__).parent / 'processing'

# Backend API URLs
BACKEND_BASE_URL = "http://localhost/project B/projectB-backend"
UPDATE_ATTENDANCE_URL = f"{BACKEND_BASE_URL}/Lecturer/updateAttendance.php"
GET_STUDENTS_URL = f"{BACKEND_BASE_URL}/Lecturer/getStudentsAttendance.php"
SAVE_REPORT_URL = f"{BACKEND_BASE_URL}/Lecturer/saveReportUrl.php"

# Create folders if they don't exist
UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)
REPORTS_FOLDER.mkdir(exist_ok=True)
PROCESSING_FOLDER.mkdir(exist_ok=True)

# Allowed video extensions
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}

# Store processing status for async operations
processing_status = {}

# Auto processor state
processing_lock = threading.Lock()
current_processing = None
processing_queue = []
auto_processor_enabled = False


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_metadata_from_filename(filename):
    """Extract unitId and sessionId from filename (format: video_{unitId}_{sessionId}_{timestamp}.mp4)"""
    try:
        parts = Path(filename).stem.split('_')
        if len(parts) >= 3 and parts[0] == 'video':
            return parts[1], parts[2]
        return "unknown", Path(filename).stem
    except Exception as e:
        logger.warning(f"Cannot parse filename {filename}: {e}")
        return "unknown", Path(filename).stem


# ============================================================================
# AUTO PROCESSOR - WATCHDOG
# ============================================================================

class VideoFileHandler(FileSystemEventHandler):
    """Handler for watchdog to detect new files in uploads folder"""
    
    def __init__(self):
        self.last_modified = {}
        self.stable_wait = 2.0
    
    def is_video_file(self, filepath):
        return Path(filepath).suffix.lower() in {f'.{ext}' for ext in ALLOWED_EXTENSIONS}
    
    def on_created(self, event):
        if event.is_directory:
            return
        
        filepath = event.src_path
        if not self.is_video_file(filepath):
            logger.info(f"⏭️ Skipping non-video file: {filepath}")
            return
        
        logger.info(f"📥 Detected new file: {filepath}")
        time.sleep(self.stable_wait)
        
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            logger.info(f"✅ File ready: {filepath} ({os.path.getsize(filepath) / (1024*1024):.2f} MB)")
            add_to_queue(filepath)
        else:
            logger.warning(f"⚠️ Invalid or incomplete file: {filepath}")
    
    def on_modified(self, event):
        if event.is_directory:
            return
        
        filepath = event.src_path
        if not self.is_video_file(filepath):
            return
        
        current_time = time.time()
        last_time = self.last_modified.get(filepath, 0)
        
        if current_time - last_time > 5:
            logger.info(f"📝 File uploading: {os.path.basename(filepath)}")
            self.last_modified[filepath] = current_time


def add_to_queue(video_path):
    """Add video to processing queue"""
    global processing_queue
    
    with processing_lock:
        if video_path not in processing_queue:
            processing_queue.append(video_path)
            logger.info(f"📋 Added to queue: {os.path.basename(video_path)}")
            logger.info(f"📊 Queue size: {len(processing_queue)}")


# ============================================================================
# DATABASE UPDATE FUNCTIONS
# ============================================================================

def read_ai_results(output_dir):
    """Read AI results from output directory - prioritizes CSV for attendance, enriches with JSON for ALS"""
    try:
        output_path = Path(output_dir)
        
        # ALWAYS read CSV first for complete attendance list
        csv_file = output_path / 'attendance_summary.csv'
        if not csv_file.exists():
            logger.warning(f"⚠️ No attendance data found in {output_dir}")
            return []
        
        import csv
        students = []
        student_dict = {}  # For merging with JSON
        
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                student_id = row['student_id']
                
                # Skip unknown tracks
                if student_id.startswith('Track#'):
                    continue
                
                # Calculate ALS from duration (assume 60 sec = 100% ALS)
                duration_sec = float(row['total_duration_sec'])
                als_score = min(100, (duration_sec / 60) * 100)
                
                student_data = {
                    'id': student_id,
                    'ALS': round(als_score, 2),
                    'behavior_breakdown': {
                        'duration_sec': duration_sec,
                        'intervals': int(row['intervals'])
                    }
                }
                students.append(student_data)
                student_dict[student_id] = student_data
        
        logger.info(f"📊 Read {len(students)} students from CSV (skipped unknown tracks)")
        
        # Now enrich with JSON if available (for more accurate ALS scores)
        als_student_json = output_path / 'als_per_student.json'
        if als_student_json.exists():
            with open(als_student_json, 'r', encoding='utf-8') as f:
                als_data = json.load(f)
                if als_data:
                    enriched_count = 0
                    for student_id, data in als_data.items():
                        # Skip tracks
                        if student_id.startswith('Track#'):
                            continue
                        
                        # If student exists in CSV, update with JSON ALS
                        if student_id in student_dict:
                            student_dict[student_id]['ALS'] = data.get('ALS', student_dict[student_id]['ALS'])
                            student_dict[student_id]['behavior_breakdown']['als_data'] = data
                            enriched_count += 1
                        else:
                            # Student in JSON but not CSV (shouldn't happen but handle it)
                            logger.warning(f"⚠️ Student {student_id} in JSON but not in CSV")
                    
                    logger.info(f"✅ Enriched {enriched_count} students with JSON ALS data")
        
        return students
    except Exception as e:
        logger.error(f"❌ Error reading AI results: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


def get_unit_id_from_session(session_id):
    """Get UnitID from SessionID by querying database"""
    try:
        import pymysql
        connection = pymysql.connect(
            host='localhost',
            user='root',
            password='',
            database='projectb',
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT UnitID FROM session WHERE SessionID = %s", (session_id,))
            result = cursor.fetchone()
            connection.close()
            
            if result:
                logger.info(f"📍 Session {session_id} → Unit {result[0]}")
                return result[0]
            else:
                logger.warning(f"⚠️ Session {session_id} not found in database")
                return None
    except Exception as e:
        logger.error(f"❌ Error querying session: {e}")
        return None


def get_students_from_db(unit_id, session_id):
    """Get student list from database"""
    try:
        params = {'unitId': unit_id, 'sessionId': session_id}
        response = requests.get(GET_STUDENTS_URL, params=params, timeout=10)
        data = response.json()
        
        if data.get('success'):
            students = data.get('data', [])
            logger.info(f"📥 Retrieved {len(students)} students from database")
            return students
        else:
            logger.error(f"❌ Error getting students: {data.get('error')}")
            return []
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}")
        return []


def update_student_attendance(student_id, session_id, status, active_point):
    """Update attendance for one student"""
    try:
        payload = {
            'studentId': student_id,
            'sessionId': session_id,
            'status': status,
            'activePoint': int(active_point) if active_point else 0
        }
        
        response = requests.post(
            UPDATE_ATTENDANCE_URL,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        data = response.json()
        return data.get('success', False)
    except Exception as e:
        logger.error(f"❌ Error updating attendance for student {student_id}: {e}")
        return False


def generate_evidence_pdf_internal(student_row, session_id, output_dir):
    """Generate PDF evidence for student"""
    try:
        student_id = student_row.get('RegistrationID')
        pdf_filename = f"{student_id}.pdf"
        pdf_path = REPORTS_FOLDER / pdf_filename
        
        # Read ALS data - try JSON first, fallback to CSV
        student_als_data = None
        als_file = Path(output_dir) / 'als_per_student.json'
        
        if als_file.exists():
            with open(als_file, 'r', encoding='utf-8') as f:
                als_data = json.load(f)
                student_als_data = als_data.get(str(student_id))
        
        # Fallback to CSV if JSON is empty
        if not student_als_data:
            csv_file = Path(output_dir) / 'attendance_summary.csv'
            if csv_file.exists():
                import csv
                with open(csv_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        if row['student_id'] == str(student_id):
                            duration_sec = float(row['total_duration_sec'])
                            als_score = min(100, (duration_sec / 60) * 100)
                            student_als_data = {
                                'ALS': als_score,
                                'behavior_breakdown': {
                                    'Active': int(row['intervals']),
                                    'Observed': 1
                                }
                            }
                            break
        
        if not student_als_data:
            logger.warning(f"⚠️ No ALS data for student {student_id} in JSON or CSV")
            return None
        
        # Create PDF
        doc = SimpleDocTemplate(str(pdf_path), pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        title = Paragraph("📊 Attendance Evidence Report", title_style)
        story.append(title)
        story.append(Spacer(1, 0.3*inch))
        
        # Student info
        info_data = [
            ['Student ID:', str(student_id)],
            ['Name:', str(student_row.get('Name'))],
            ['Unit:', str(student_row.get('UnitCode', 'unknown'))],
            ['Session ID:', str(session_id)],
            ['Date:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            ['Active Learning Score:', f"{float(student_als_data.get('ALS', 0)):.2f}"]
        ]
        
        info_table = Table(info_data, colWidths=[2.5*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e3f2fd')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ]))
        
        story.append(info_table)
        story.append(Spacer(1, 0.5*inch))
        
        # Behavior breakdown
        if 'behavior_breakdown' in student_als_data:
            story.append(Paragraph("<b>Behavior Analysis:</b>", styles['Heading2']))
            story.append(Spacer(1, 0.2*inch))
            
            behavior_data = [['Behavior', 'Count', 'Percentage']]
            behaviors = student_als_data['behavior_breakdown']
            
            for behavior, count in behaviors.items():
                total = sum(behaviors.values())
                percentage = (count / total * 100) if total > 0 else 0
                behavior_data.append([
                    behavior.replace('_', ' ').title(),
                    str(count),
                    f"{percentage:.1f}%"
                ])
            
            behavior_table = Table(behavior_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch])
            behavior_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            
            story.append(behavior_table)
        
        # Footer
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.grey,
            alignment=TA_CENTER
        )
        story.append(Spacer(1, 0.5*inch))
        footer_text = f"Generated by Active Learning System | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        story.append(Paragraph(footer_text, footer_style))
        
        doc.build(story)
        
        url = f"/reports/{pdf_filename}"
        logger.info(f"✅ Generated PDF: {url}")
        
        # Save URL to database
        save_payload = {
            'sessionId': session_id,
            'studentId': student_row.get('StudentID'),
            'name': student_row.get('Name'),
            'unit': student_row.get('UnitCode', 'unknown'),
            'url': url
        }
        
        response = requests.post(
            SAVE_REPORT_URL,
            json=save_payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        result = response.json()
        if not result.get('success'):
            logger.error(f"❌ Failed to save PDF URL to database: {result.get('message', 'Unknown error')}")
            # Still return URL even if DB save fails - PDF exists
            return url
        
        logger.info(f"✅ PDF URL saved to database for student {student_row.get('StudentID')}")
        return url
    except Exception as e:
        logger.error(f"❌ Error generating PDF: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


def update_database_with_results(output_dir, unit_id, session_id):
    """Update database with AI results"""
    try:
        logger.info("="*80)
        logger.info("📤 STARTING DATABASE UPDATE")
        logger.info("="*80)
        
        ai_students = read_ai_results(output_dir)
        if not ai_students:
            logger.warning("⚠️ No AI data to update")
            return False
        
        db_students = get_students_from_db(unit_id, session_id)
        if not db_students:
            logger.warning("⚠️ No students in database")
            return False
        
        # Create mapping
        norm = lambda v: str(v or "").strip()
        student_id_set = set(norm(s.get('StudentID')) for s in db_students)
        registration_id_set = set(norm(s.get('RegistrationID')) for s in db_students)
        reg_to_student = {norm(s.get('RegistrationID')): s for s in db_students}
        
        success_count = 0
        evidence_count = 0
        
        for detected in ai_students:
            raw_id = norm(detected['id'])
            als = float(detected.get('ALS', 0))
            active_point = int(round(als))
            
            target_student = None
            if raw_id in student_id_set:
                target_student = next((s for s in db_students if norm(s.get('StudentID')) == raw_id), None)
            elif raw_id in registration_id_set:
                target_student = reg_to_student.get(raw_id)
            
            if target_student:
                student_id = target_student.get('StudentID')
                logger.info(f"✅ Updating {raw_id} → StudentID={student_id}, ALS={als:.2f}, ActivePoint={active_point}")
                
                if update_student_attendance(student_id, session_id, 'present', active_point):
                    success_count += 1
                    
                    # Generate PDF evidence
                    logger.info(f"📄 Generating evidence PDF for {raw_id}...")
                    pdf_url = generate_evidence_pdf_internal(target_student, session_id, output_dir)
                    if pdf_url:
                        evidence_count += 1
                        logger.info(f"✅ Evidence PDF generated: {pdf_url}")
                    else:
                        logger.warning(f"⚠️ Could not generate PDF for {raw_id}")
            else:
                logger.warning(f"⚠️ ID {raw_id} not found in database")
        
        logger.info("="*80)
        logger.info("✅ DATABASE UPDATE COMPLETED")
        logger.info(f"📊 Summary: {success_count}/{len(ai_students)} students updated")
        logger.info(f"📄 Evidence: {evidence_count}/{success_count} PDFs generated")
        logger.info("="*80)
        
        return success_count > 0
    except Exception as e:
        logger.error(f"❌ Error updating database: {e}")
        return False


# ============================================================================
# AUTO PROCESSOR - VIDEO PROCESSING
# ============================================================================

def process_video_auto(video_path):
    """Process video automatically (for auto processor)"""
    global current_processing
    
    try:
        video_path = Path(video_path)
        if not video_path.exists():
            logger.error(f"❌ Video not found: {video_path}")
            return False
        
        current_processing = str(video_path)
        logger.info("="*80)
        logger.info(f"🎬 STARTING VIDEO PROCESSING: {video_path.name}")
        logger.info(f"📦 Size: {video_path.stat().st_size / (1024*1024):.2f} MB")
        logger.info("="*80)
        
        # Extract metadata
        filename_unit_id, session_id = extract_metadata_from_filename(video_path.name)
        
        # Get actual unit_id from database (more reliable than filename)
        unit_id = get_unit_id_from_session(session_id)
        if not unit_id:
            logger.error(f"❌ Cannot find unit for session {session_id}, falling back to filename")
            unit_id = filename_unit_id
        
        # Create unique session name
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_name = f'session_{session_id}_{timestamp}'
        
        # Move to processing folder
        processing_path = PROCESSING_FOLDER / video_path.name
        video_path.rename(processing_path)
        logger.info(f"🔄 Moved to processing folder: {processing_path}")
        
        # Prepare AI command
        cmd = [
            'python',
            str(Path(__file__).parent / 'classroom_attendance_activelearning.py'),
            '--source', str(processing_path),
            '--outdir', str(OUTPUT_FOLDER),
            '--students_dir', str(GALLERY_FOLDER),
            '--person', str(MODEL_FOLDER / 'yolov8n.pt'),
            '--behavior', str(MODEL_FOLDER / 'student_behaviour_best.pt'),
            '--device', 'auto',
            '--half',
            '--frame_stride', '2',
            '--save_video', session_name,
            '--no_show',
            '--appearance'
        ]
        
        logger.info(f"🚀 Running AI: {' '.join(cmd)}")
        
        start_time = time.time()
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(Path(__file__).parent)
        )
        
        stdout, stderr = process.communicate()  # No timeout - unlimited processing time
        elapsed_time = time.time() - start_time
        
        if process.returncode == 0:
            logger.info("="*80)
            logger.info("✅ AI PROCESSING SUCCESS!")
            logger.info(f"⏱️ Time: {elapsed_time:.1f}s ({elapsed_time/60:.1f}min)")
            logger.info(f"📁 Results: outputs/{session_name}/")
            logger.info("="*80)
            
            # Find output directory
            output_folders = sorted(
                [f for f in OUTPUT_FOLDER.iterdir() if f.is_dir() and session_name in f.name],
                key=lambda x: x.stat().st_ctime,
                reverse=True
            )
            
            if output_folders:
                latest_output = output_folders[0]
                logger.info(f"📂 Output: {latest_output}")
                
                # Update database
                logger.info("🔄 Starting database update...")
                if update_database_with_results(latest_output, unit_id, session_id):
                    logger.info("✅ Database updated successfully!")
                else:
                    logger.warning("⚠️ Database update failed (check connection)")
            
            # Delete processed video
            if processing_path.exists():
                processing_path.unlink()
                logger.info(f"🗑️ Deleted video: {processing_path.name}")
            
            return True
        else:
            logger.error("="*80)
            logger.error("❌ AI PROCESSING FAILED!")
            logger.error(f"⏱️ Time: {elapsed_time:.1f}s")
            logger.error(f"🔴 Error: {stderr[:500]}")
            logger.error("="*80)
            
            # Move back to uploads
            processing_path.rename(video_path)
            logger.warning("↩️ Moved video back to uploads for retry")
            
            return False
            
    except Exception as e:
        logger.error(f"❌ PROCESSING ERROR: {str(e)}")
        
        try:
            if processing_path.exists():
                processing_path.rename(video_path)
        except:
            pass
        
        return False
    
    finally:
        current_processing = None


def process_queue_worker():
    """Worker thread to process video queue"""
    global processing_queue, current_processing
    
    logger.info("🔧 Worker thread started")
    
    while True:
        try:
            video_to_process = None
            
            with processing_lock:
                if processing_queue and current_processing is None:
                    video_to_process = processing_queue.pop(0)
            
            if video_to_process:
                logger.info(f"📤 Processing from queue: {os.path.basename(video_to_process)}")
                logger.info(f"📊 Queue remaining: {len(processing_queue)}")
                
                process_video_auto(video_to_process)
                
                time.sleep(2)
            else:
                time.sleep(1)
                
        except Exception as e:
            logger.error(f"❌ Worker thread error: {e}")
            time.sleep(5)


def process_existing_videos():
    """Process existing videos in uploads folder"""
    logger.info("🔍 Checking for existing videos...")
    
    existing_videos = []
    for ext in ALLOWED_EXTENSIONS:
        existing_videos.extend(UPLOAD_FOLDER.glob(f'*.{ext}'))
    
    if existing_videos:
        logger.info(f"📦 Found {len(existing_videos)} existing videos")
        for video in sorted(existing_videos):
            logger.info(f"   ➜ {video.name} ({video.stat().st_size / (1024*1024):.2f} MB)")
            add_to_queue(str(video))
    else:
        logger.info("✨ No existing videos")


def start_auto_processor():
    """Start auto processor monitoring"""
    global auto_processor_enabled
    
    logger.info("="*80)
    logger.info("🤖 AUTO PROCESSOR STARTING")
    logger.info("="*80)
    logger.info(f"📂 Monitoring: {UPLOAD_FOLDER}")
    logger.info(f"📂 Output: {OUTPUT_FOLDER}")
    logger.info(f"📂 Gallery: {GALLERY_FOLDER}")
    logger.info(f"🎯 Formats: {', '.join(ALLOWED_EXTENSIONS)}")
    logger.info("="*80)
    
    # Process existing videos
    process_existing_videos()
    
    # Start worker thread
    worker_thread = threading.Thread(target=process_queue_worker, daemon=True)
    worker_thread.start()
    logger.info("✅ Worker thread started")
    
    # Setup watchdog
    event_handler = VideoFileHandler()
    observer = Observer()
    observer.schedule(event_handler, str(UPLOAD_FOLDER), recursive=False)
    observer.start()
    
    logger.info("✅ Watchdog started")
    logger.info("👀 Waiting for new videos...")
    logger.info("="*80)
    
    auto_processor_enabled = True
    
    return observer


# ============================================================================
# FLASK API ENDPOINTS
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    queue_size = 0
    current = None
    
    if auto_processor_enabled:
        try:
            with processing_lock:
                queue_size = len(processing_queue)
                current = current_processing
        except:
            pass
    
    return jsonify({
        'status': 'ok',
        'message': 'Video Processing API is running',
        'timestamp': datetime.now().isoformat(),
        'upload_folder': str(UPLOAD_FOLDER),
        'output_folder': str(OUTPUT_FOLDER),
        'reports_folder': str(REPORTS_FOLDER),
        'active_jobs': len([j for j in processing_status.values() if j.get('status') == 'processing']),
        'auto_processor': {
            'enabled': auto_processor_enabled,
            'queue_size': queue_size,
            'current_processing': os.path.basename(current) if current else None
        }
    })


def process_video_async(video_path, job_id, unit_id, session_id):
    """Process video in background thread"""
    try:
        processing_status[job_id] = {
            'status': 'processing',
            'progress': 0,
            'message': 'Processing video...',
            'unit_id': unit_id,
            'session_id': session_id
        }
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_name = f'session_{session_id}_{timestamp}'
        
        cmd = [
            'python',
            str(Path(__file__).parent / 'classroom_attendance_activelearning.py'),
            '--source', video_path,
            '--outdir', str(OUTPUT_FOLDER),
            '--students_dir', str(GALLERY_FOLDER),
            '--person', str(MODEL_FOLDER / 'yolov8n.pt'),
            '--behavior', str(MODEL_FOLDER / 'student_behaviour_best.pt'),
            '--device', 'auto',
            '--half',
            '--frame_stride', '2',
            '--save_video', session_name,
            '--no_show',
            '--appearance'
        ]
        
        print(f"[{job_id}] Running: {' '.join(cmd)}")
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(Path(__file__).parent)
        )
        
        stdout, stderr = process.communicate()  # No timeout - unlimited processing time
        
        if process.returncode == 0:
            output_folders = sorted(
                [f for f in OUTPUT_FOLDER.iterdir() if f.is_dir()],
                key=lambda x: x.stat().st_ctime,
                reverse=True
            )
            
            if output_folders:
                latest_output = output_folders[0]
                print(f"[{job_id}] Output folder: {latest_output}")
                
                attendance_data = read_attendance_results(latest_output)
                
                # Update database
                if update_database_with_results(latest_output, unit_id, session_id):
                    print(f"[{job_id}] Database updated successfully")
                
                processing_status[job_id] = {
                    'status': 'completed',
                    'progress': 100,
                    'message': 'Processing complete!',
                    'output_dir': str(latest_output.name),
                    'results': attendance_data,
                    'completed_at': datetime.now().isoformat()
                }
                
                print(f"[{job_id}] Processing completed")
            else:
                processing_status[job_id] = {
                    'status': 'error',
                    'message': 'No output folder found'
                }
        else:
            processing_status[job_id] = {
                'status': 'error',
                'message': f'Processing failed: {stderr[:500]}',
                'error_details': stderr
            }
            
    except Exception as e:
        processing_status[job_id] = {
            'status': 'error',
            'message': f'Error: {str(e)}'
        }


@app.route('/api/process-video', methods=['POST'])
def process_video():
    """Process uploaded video"""
    try:
        if 'video' not in request.files:
            return jsonify({'success': False, 'error': 'No video file provided'}), 400

        video_file = request.files['video']
        
        if video_file.filename == '':
            return jsonify({'success': False, 'error': 'No video file selected'}), 400

        if not allowed_file(video_file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type'}), 400

        unit_id = request.form.get('unitId', 'unknown')
        session_id = request.form.get('sessionId', 'unknown')
        is_async = request.form.get('async', 'false').lower() == 'true'
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"video_{unit_id}_{session_id}_{timestamp}.mp4"
        video_path = UPLOAD_FOLDER / filename
        
        video_file.save(str(video_path))
        
        job_id = f"job_{timestamp}"
        
        if is_async:
            thread = threading.Thread(
                target=process_video_async,
                args=(str(video_path), job_id, unit_id, session_id)
            )
            thread.start()
            
            return jsonify({
                'success': True,
                'job_id': job_id,
                'message': 'File uploaded and processing',
                'status_url': f'/api/status/{job_id}'
            })
        else:
            result = process_with_ai_model(
                video_path=str(video_path),
                unit_id=unit_id,
                session_id=session_id
            )
            
            return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error: {str(e)}'}), 500


@app.route('/api/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Get processing status"""
    if job_id in processing_status:
        return jsonify(processing_status[job_id])
    return jsonify({'status': 'not_found', 'message': 'Job not found'}), 404


def process_with_ai_model(video_path, unit_id, session_id):
    """Process video synchronously"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_name = f'session_{session_id}_{timestamp}'
        
        cmd = [
            'python',
            str(Path(__file__).parent / 'classroom_attendance_activelearning.py'),
            '--source', video_path,
            '--outdir', str(OUTPUT_FOLDER),
            '--students_dir', str(GALLERY_FOLDER),
            '--person', str(MODEL_FOLDER / 'yolov8n.pt'),
            '--behavior', str(MODEL_FOLDER / 'student_behaviour_best.pt'),
            '--device', 'auto',
            '--half',
            '--frame_stride', '2',
            '--save_video', session_name,
            '--no_show',
            '--appearance'
        ]
        
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(Path(__file__).parent)
        )
        
        if result.returncode != 0:
            return {'success': False, 'error': f'AI processing failed: {result.stderr}'}
        
        output_folders = sorted(
            [f for f in OUTPUT_FOLDER.iterdir() if f.is_dir()],
            key=lambda x: x.stat().st_ctime,
            reverse=True
        )
        
        if not output_folders:
            return {'success': False, 'error': 'No output folder created'}
        
        latest_output = output_folders[0]
        print(f"Output folder: {latest_output}")
        
        attendance_data = read_attendance_results(latest_output)
        
        # Find processed video file
        processed_video_url = None
        video_files = list(latest_output.glob('*.mp4')) + list(latest_output.glob('*.avi'))
        if video_files:
            video_file = video_files[0]
            processed_video_url = f'/outputs/{latest_output.name}/{video_file.name}'
            print(f"Processed video URL: {processed_video_url}")
        
        # Update database
        if update_database_with_results(latest_output, unit_id, session_id):
            print("Database updated successfully")
        
        return {
            'success': True,
            'message': 'Video processed successfully',
            'data': attendance_data,
            'output_dir': str(latest_output.name),
            'processed_video_url': processed_video_url,
            'processed_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        return {'success': False, 'error': f'Error: {str(e)}'}


def read_attendance_results(output_dir):
    """
    Read ALS results (full info: ALS, proportions, seconds).
    Return JSON:
    {
      "students": [
        {
          "id": "104221559",
          "ALS": 81.23,
          "proportions": {...},
          "seconds": {...},
          "total_labeled_seconds": 1857.0
        },
        ...
      ]
    }
    """
    from pathlib import Path
    import json

    try:
        output_path = Path(output_dir)
        result = {"students": []}

        als_student_json = output_path / "als_per_student.json"

        if als_student_json.exists():
            with open(als_student_json, "r", encoding="utf-8") as f:
                per_student = json.load(f)

            for sid, info in per_student.items():
                als_score   = info.get("ALS", 0.0)
                seconds     = info.get("seconds", {}) or {}
                proportions = info.get("proportions", {}) or {}

                # tự tính tổng giây nếu cần
                total_secs = sum(float(v) for v in seconds.values()) if seconds else 0.0

                result["students"].append({
                    "id": sid,
                    "ALS": als_score,
                    "seconds": seconds,
                    "proportions": proportions,
                    "total_labeled_seconds": total_secs,
                })
        else:
            print(f"No als_per_student.json found in {output_path}")

        return result

    except Exception as e:
        print(f"Error reading ALS results: {e}")
        return {"students": [], "error": str(e)}



def parse_summary_csv(csv_path):
    """Parse attendance summary CSV"""
    students = []
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                students.append({
                    'trackId': row.get('trackID', ''),
                    'name': row.get('name', 'Unknown'),
                    'firstSeen': row.get('first_seen_sec', '0'),
                    'lastSeen': row.get('last_seen_sec', '0'),
                    'totalTime': row.get('total_time_sec', '0'),
                    'confidence': row.get('avg_face_conf', '0'),
                    'intervals': row.get('num_intervals', '0')
                })
    except Exception as e:
        print(f"Error parsing CSV: {e}")
    return students


def parse_stable_csv(csv_path):
    """Parse stable behavior CSV"""
    behaviors = {}
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                track_id = row.get('trackID', '')
                if track_id not in behaviors:
                    behaviors[track_id] = []
                behaviors[track_id].append({
                    'frame': row.get('frame', '0'),
                    'time': row.get('time_sec', '0'),
                    'behavior': row.get('stableBehavior', 'unknown'),
                    'confidence': row.get('stableConf', '0')
                })
    except Exception as e:
        print(f"Error parsing CSV: {e}")
    return behaviors


def parse_events_csv(csv_path):
    """Parse attendance events CSV"""
    events = []
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                events.append({
                    'trackId': row.get('trackID', ''),
                    'name': row.get('name', 'Unknown'),
                    'event': row.get('event', ''),
                    'time': row.get('time_sec', '0'),
                    'timestamp': row.get('timestamp', '')
                })
    except Exception as e:
        print(f"Error parsing CSV: {e}")
    return events


@app.route('/api/get-results/<session_id>', methods=['GET'])
def get_results(session_id):
    """Get results for session"""
    try:
        output_dirs = list(OUTPUT_FOLDER.glob(f"session_{session_id}_*"))
        
        if not output_dirs:
            return jsonify({'success': False, 'error': 'No results found'}), 404
        
        latest_dir = max(output_dirs, key=os.path.getctime)
        attendance_data = read_attendance_results(latest_dir)
        
        return jsonify({
            'success': True,
            'data': attendance_data,
            'output_dir': str(latest_dir.name)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    """Generate PDF evidence report"""
    try:
        data = request.json
        session_id = data.get('sessionId')
        student_id = data.get('studentId')
        name = data.get('name', 'Unknown')
        unit = data.get('unit', 'Unknown')
        
        if not session_id or not student_id:
            return jsonify({'success': False, 'error': 'Missing sessionId or studentId'}), 400
        
        # Find session folder
        session_folders = sorted(
            [f for f in OUTPUT_FOLDER.iterdir() if f.is_dir() and f.name.startswith(f'session_{session_id}')],
            key=lambda x: x.stat().st_ctime,
            reverse=True
        )
        
        if not session_folders:
            return jsonify({'success': False, 'error': f'No session folder found'}), 404
        
        session_folder = session_folders[0]
        
        # Create student row for PDF generation
        student_row = {
            'RegistrationID': student_id,
            'Name': name,
            'UnitCode': unit,
            'StudentID': data.get('internalStudentId', student_id)
        }
        
        url = generate_evidence_pdf_internal(student_row, session_id, session_folder)
        
        if url:
            return jsonify({'success': True, 'url': url, 'message': 'PDF generated'})
        else:
            return jsonify({'success': False, 'error': 'Failed to generate PDF'}), 500
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'Error: {str(e)}'}), 500


@app.route('/reports/<filename>', methods=['GET'])
def serve_report(filename):
    """Serve PDF reports"""
    try:
        return send_from_directory(str(REPORTS_FOLDER), filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 404


@app.route('/outputs/<session>/<filename>', methods=['GET'])
@app.route('/outputs/<session>/<path:subfolder>/<filename>', methods=['GET'])
def serve_output_video(session, filename, subfolder=None):
    """Serve processed videos from outputs folder (including subfolders like violations)"""
    try:
        session_folder = OUTPUT_FOLDER / session
        if not session_folder.exists():
            return jsonify({'error': 'Session folder not found'}), 404
        
        # Build the file path (with optional subfolder)
        if subfolder:
            file_path = session_folder / subfolder / filename
        else:
            file_path = session_folder / filename
        
        if not file_path.exists():
            return jsonify({'error': f'File not found: {filename}'}), 404
        
        response = send_from_directory(str(file_path.parent), filename)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Content-Type'] = 'video/mp4'
        return response
    except Exception as e:
        logger.error(f"Error serving video: {e}")
        return jsonify({'error': str(e)}), 404


@app.route('/api/list-sessions', methods=['GET'])
def list_sessions():
    """List all sessions"""
    try:
        sessions = []
        for folder in OUTPUT_FOLDER.iterdir():
            if folder.is_dir() and folder.name.startswith('session_'):
                sessions.append({
                    'name': folder.name,
                    'created': datetime.fromtimestamp(folder.stat().st_ctime).isoformat(),
                    'size_mb': sum(f.stat().st_size for f in folder.rglob('*') if f.is_file()) / (1024 * 1024)
                })
        
        sessions.sort(key=lambda x: x['created'], reverse=True)
        
        return jsonify({'success': True, 'sessions': sessions, 'total': len(sessions)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/get-processed-video', methods=['GET'])
def get_processed_video():
    """Get processed video URL for a specific session"""
    try:
        session_id = request.args.get('sessionId')
        if not session_id:
            return jsonify({'success': False, 'error': 'Missing sessionId parameter'}), 400
        
        # Find session folder
        session_folders = sorted(
            [f for f in OUTPUT_FOLDER.iterdir() if f.is_dir() and f.name.startswith(f'session_{session_id}')],
            key=lambda x: x.stat().st_ctime,
            reverse=True
        )
        
        if not session_folders:
            return jsonify({'success': False, 'error': f'No session folder found for session {session_id}'}), 404
        
        session_folder = session_folders[0]
        
        # Look for processed video (main video file, not in violations folder)
        video_files = [
            f for f in session_folder.iterdir() 
            if f.is_file() and f.suffix.lower() in ['.mp4', '.avi', '.mov', '.mkv'] 
            and 'violations' not in str(f)
        ]
        
        if not video_files:
            return jsonify({'success': False, 'error': 'No processed video found'}), 404
        
        # Use the first video file (usually the main processed video)
        video_file = video_files[0]
        video_url = f'/outputs/{session_folder.name}/{video_file.name}'
        
        return jsonify({
            'success': True, 
            'videoUrl': video_url,
            'sessionFolder': session_folder.name,
            'filename': video_file.name
        })
        
    except Exception as e:
        logger.error(f"Error getting processed video: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/get-violation-videos', methods=['GET'])
def get_violation_videos():
    """Get violation videos for a specific student in a session"""
    try:
        session_id = request.args.get('sessionId')
        student_id = request.args.get('studentId')
        
        if not session_id or not student_id:
            return jsonify({'success': False, 'error': 'Missing sessionId or studentId parameter'}), 400
        
        # Find session folder
        session_folders = sorted(
            [f for f in OUTPUT_FOLDER.iterdir() if f.is_dir() and f.name.startswith(f'session_{session_id}')],
            key=lambda x: x.stat().st_ctime,
            reverse=True
        )
        
        if not session_folders:
            return jsonify({'success': False, 'error': f'No session folder found for session {session_id}'}), 404
        
        session_folder = session_folders[0]
        violations_folder = session_folder / 'violations'
        
        if not violations_folder.exists():
            return jsonify({'success': True, 'videos': [], 'message': 'No violations folder found'})
        
        # Find all violation videos for this student
        # Format: {studentId}_{behavior}.mp4 or Track#{id}_{behavior}.mp4
        violation_videos = []
        for video_file in violations_folder.iterdir():
            if video_file.is_file() and video_file.suffix.lower() in ['.mp4', '.avi', '.mov', '.mkv']:
                filename = video_file.name
                # Check if filename starts with studentId
                if filename.startswith(f'{student_id}_'):
                    behavior = filename.replace(f'{student_id}_', '').replace(video_file.suffix, '')
                    violation_videos.append({
                        'behavior': behavior,
                        'filename': filename,
                        'url': f'/outputs/{session_folder.name}/violations/{filename}',
                        'size': video_file.stat().st_size
                    })
        
        return jsonify({
            'success': True,
            'videos': violation_videos,
            'total': len(violation_videos),
            'sessionFolder': session_folder.name
        })
        
    except Exception as e:
        logger.error(f"Error getting violation videos: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("="*80)
    print("🎓 Video Processing API - API MODE ONLY")
    print("="*80)
    print(f"📂 Upload: {UPLOAD_FOLDER}")
    print(f"📂 Output: {OUTPUT_FOLDER}")
    print(f"📂 Gallery: {GALLERY_FOLDER}")
    print(f"📂 Models: {MODEL_FOLDER}")
    print(f"📂 Reports: {REPORTS_FOLDER}")
    print(f"📂 Processing: {PROCESSING_FOLDER}")
    print("="*80)
    
    # Auto processor DISABLED - using Web UI upload only
    print("ℹ️  Auto Processor: DISABLED (Web UI mode)")
    observer = None
    
    print("="*80)
    print("🌐 Server: http://localhost:5001")
    print("📡 Health: http://localhost:5001/health")
    print("="*80)
    print("\n🔧 Endpoints:")
    print("  POST /api/process-video           - Upload and process")
    print("  GET  /api/status/<job_id>         - Check status")
    print("  GET  /api/get-results/<id>        - Get results")
    print("  POST /api/generate-report         - Generate PDF")
    print("  GET  /reports/<filename>          - Download PDF")
    print("  GET  /api/list-sessions           - List sessions")
    print("  GET  /api/get-processed-video     - Get processed video by sessionId")
    print("  GET  /api/get-violation-videos    - Get violation videos by sessionId & studentId")
    print("  GET  /outputs/<session>/<file>    - Serve output videos")
    print("  GET  /health                      - Health check")
    print("="*80)
    
    try:
        app.run(host='0.0.0.0', port=5001, debug=True, threaded=True, use_reloader=False)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        if observer:
            observer.stop()
            observer.join()
        print("✅ Stopped")
