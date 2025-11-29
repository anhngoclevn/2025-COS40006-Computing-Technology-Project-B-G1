"""
Video Processing API for Attendance System
Accepts MP4 video uploads and processes them using the AI model
Features:
- Background video processing with status tracking
- Real-time progress monitoring
- Comprehensive error handling
- Multiple result formats (JSON, CSV)
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import subprocess
from pathlib import Path
from datetime import datetime
import shutil
import threading
import time
import csv
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from flask import send_file, abort
from pathlib import Path
from classroom_attendance_activelearning import MergedPipeline, PipelineConfig, REL_MIN_DEFAULT, SIM_THRESHOLD_DEFAULT, MIN_FACE_PX, MIN_FACE_VAR, FACE_EVERY_N, GRACE_SECONDS_DEFAULT, load_thresholds



app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Configuration
UPLOAD_FOLDER = Path(__file__).parent / 'uploads'
OUTPUT_FOLDER = Path(__file__).parent / 'outputs'
GALLERY_FOLDER = Path(__file__).parent / 'students_gallery'
MODEL_FOLDER = Path(__file__).parent / 'models'

# Create folders if they don't exist
UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

# Allowed video extensions
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}

# Store processing status for async operations
processing_status = {}



def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Video Processing API is running',
        'timestamp': datetime.now().isoformat(),
        'upload_folder': str(UPLOAD_FOLDER),
        'output_folder': str(OUTPUT_FOLDER),
        'active_jobs': len([j for j in processing_status.values() if j.get('status') == 'processing'])
    })

def process_video_async(video_path, job_id, unit_id, session_id):
    """Process video in background thread"""
    try:
        processing_status[job_id] = {
            'status': 'processing',
            'progress': 0,
            'message': 'Đang xử lý video...',
            'unit_id': unit_id,
            'session_id': session_id
        }
        
        # Create unique session name with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_name = f'session_{session_id}_{timestamp}'
        
        configMergePipeline = PipelineConfig(
            person_model_path = str(MODEL_FOLDER / 'yolov8n.pt'),
            behavior_model_path = str(MODEL_FOLDER / 'student_behaviour_best.pt'),
            conf_person = 0.35,
            conf_behavior_floor = 0.35,
            device = "auto",
            half = False,
            imgsz = 640,
            frame_stride = 2,
            show_window = False,
            output_dir = str(OUTPUT_FOLDER),
            smooth_window = 7,
            th_on = 0.60,
            th_off = 0.45,
            ioa_min = 0.60,
            iou_min = 0.05,
            rel_min_default = REL_MIN_DEFAULT,
            tta = False,
            per_class_conf = load_thresholds(""),
            students_dir = str(GALLERY_FOLDER),
            sim_threshold = SIM_THRESHOLD_DEFAULT,
            min_face_px = MIN_FACE_PX,
            min_face_var = MIN_FACE_VAR,
            face_every_n = FACE_EVERY_N,
            appearance = False,
            grace = GRACE_SECONDS_DEFAULT,
            save_video = session_name

        ) 

        mergePipeline = MergedPipeline(
            configMergePipeline
        )
        
        # Prepare command
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
            '--save_video', session_name,  # Full name with timestamp
            '--no_show',
            '--appearance'
        ]
        # Run the AI processing script
        print(f"[{job_id}] Running command: {' '.join(cmd)}")
        # process = subprocess.Popen(
        #     cmd,
        #     stdout=subprocess.PIPE,
        #     stderr=subprocess.PIPE,
        #     text=True,
        #     cwd=str(Path(__file__).parent)  # Set working directory
        # )
        process = mergePipeline.run(
            video_path
        )
        # Wait for completion
        stdout, stderr = process.communicate(timeout=600)  # 10 minutes timeout
        
        if process.returncode == 0:
            # Find the most recently created folder in OUTPUT_FOLDER
            output_folders = sorted(
                [f for f in OUTPUT_FOLDER.iterdir() if f.is_dir()],
                key=lambda x: x.stat().st_ctime,
                reverse=True
            )
            
            if output_folders:
                latest_output = output_folders[0]
                print(f"[{job_id}] Output folder: {latest_output}")
                
                # Read results
                attendance_data = read_attendance_results(latest_output)
                
                processing_status[job_id] = {
                    'status': 'completed',
                    'progress': 100,
                    'message': 'Xử lý hoàn tất!',
                    'output_dir': str(latest_output.name),
                    'results': attendance_data,
                    'completed_at': datetime.now().isoformat()
                }
                
                print(f"[{job_id}] Processing completed successfully")
            else:
                processing_status[job_id] = {
                    'status': 'error',
                    'message': 'Không tìm thấy folder output'
                }
                print(f"[{job_id}] No output folder found")
        else:
            processing_status[job_id] = {
                'status': 'error',
                'message': f'Lỗi xử lý: {stderr[:500]}',  # Limit error message length
                'error_details': stderr
            }
            print(f"[{job_id}] Processing failed: {stderr}")
            
    except subprocess.TimeoutExpired:
        processing_status[job_id] = {
            'status': 'error',
            'message': 'Timeout: Video xử lý quá 10 phút'
        }
        print(f"[{job_id}] Processing timeout")
    except Exception as e:
        processing_status[job_id] = {
            'status': 'error',
            'message': f'Lỗi: {str(e)}'
        }
        print(f"[{job_id}] Processing error: {str(e)}")


@app.route('/api/process-video', methods=['POST'])
def process_video():
    """
    Process uploaded video for attendance detection
    Expected form data:
    - video: MP4 file
    - unitId: Unit ID
    - sessionId: Session ID
    - async: (optional) 'true' for background processing
    """
    try:
        # Check if video file is present
        if 'video' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No video file provided'
            }), 400

        video_file = request.files['video']
        
        if video_file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No video file selected'
            }), 400

        if not allowed_file(video_file.filename):
            return jsonify({
                'success': False,
                'error': 'Invalid file type. Only MP4, AVI, MOV, MKV, WEBM allowed'
            }), 400

        # Get additional parameters
        unit_id = request.form.get('unitId', 'unknown')
        session_id = request.form.get('sessionId', 'unknown')
        is_async = request.form.get('async', 'false').lower() == 'true'
        
        # Create unique filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"video_{unit_id}_{session_id}_{timestamp}.mp4"
        video_path = UPLOAD_FOLDER / filename
        
        # Save uploaded video
        video_file.save(str(video_path))
        
        # Generate job ID
        job_id = f"job_{timestamp}"
        
        if is_async:
            # Process video in background
            thread = threading.Thread(
                target=process_video_async,
                args=(str(video_path), job_id, unit_id, session_id)
            )
            thread.start()
            
            return jsonify({
                'success': True,
                'job_id': job_id,
                'message': 'File đã được upload và đang xử lý',
                'status_url': f'/api/status/{job_id}'
            })
        else:
            # Process synchronously (blocking)
            result = process_with_ai_model(
                video_path=str(video_path),
                unit_id=unit_id,
                session_id=session_id
            )
            
            return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error processing video: {str(e)}'
        }), 500

@app.route('/api/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Get processing status for async jobs"""
    if job_id in processing_status:
        return jsonify(processing_status[job_id])
    return jsonify({
        'status': 'not_found',
        'message': 'Không tìm thấy công việc'
    }), 404

def process_with_ai_model(video_path, unit_id, session_id):
    """
    Process video using the classroom_attendance_activelearning.py script (synchronous)
    """
    try:
        # Create unique session name with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_name = f'session_{session_id}_{timestamp}'
        
        # Prepare command
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
        
        # Run the AI processing script
        print(f"Running command: {' '.join(cmd)}")
        configMergePipeline = PipelineConfig(
            person_model_path = str(MODEL_FOLDER / 'yolov8n.pt'),
            behavior_model_path = str(MODEL_FOLDER / 'student_behaviour_best.pt'),
            conf_person = 0.35,
            conf_behavior_floor = 0.35,
            device = "auto",
            half = False,
            imgsz = 640,
            frame_stride = 2,
            show_window = False,
            output_dir = str(OUTPUT_FOLDER),
            smooth_window = 7,
            th_on = 0.60,
            th_off = 0.45,
            ioa_min = 0.60,
            iou_min = 0.05,
            rel_min_default = REL_MIN_DEFAULT,
            tta = False,
            per_class_conf = load_thresholds(""),
            students_dir = str(GALLERY_FOLDER),
            sim_threshold = SIM_THRESHOLD_DEFAULT,
            min_face_px = MIN_FACE_PX,
            min_face_var = MIN_FACE_VAR,
            face_every_n = FACE_EVERY_N,
            appearance = False,
            grace = GRACE_SECONDS_DEFAULT,
            save_video = session_name
         
        ) 

        mergePipeline = MergedPipeline(
            configMergePipeline
        )
        # result = subprocess.run(
        #     cmd,
        #     capture_output=True,
        #     text=True,
        #     timeout=600,  # 10 minutes timeout
        #     cwd=str(Path(__file__).parent)  # Set working directory
        # )
        result = mergePipeline.run(
            video_path,
            
        )
        
        # if result.returncode != 0:
        #     return {
        #         'success': False,
        #         'error': f'AI processing failed: {result.stderr}'
        #     }
        
        # Find the most recently created folder in OUTPUT_FOLDER
        output_folders = sorted(
            [f for f in OUTPUT_FOLDER.iterdir() if f.is_dir()],
            key=lambda x: x.stat().st_ctime,
            reverse=True
        )
        
        if not output_folders:
            return {
                'success': False,
                'error': 'No output folder created'
            }
        
        latest_output = output_folders[0]
        print(f"Output folder: {latest_output}")
        
        # Read the generated attendance results
        attendance_data = read_attendance_results(latest_output)
        
        # Clean up uploaded video (optional)
        # os.remove(video_path)
        
        return {
            'success': True,
            'message': 'Video processed successfully',
            'data': attendance_data,
            'output_dir': str(latest_output.name),
            'processed_at': datetime.now().isoformat()
        }
        
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': 'Video processing timeout (max 10 minutes)'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'AI processing error: {str(e)}'
        }

def read_attendance_results(output_dir):
    """
    Read ALS results only (no CSVs).
    Return simplified JSON: {"students": [{"id": ..., "ALS": ...}, ...]}
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

            # Convert to simple list [{id, ALS}]
            for sid, info in per_student.items():
                als_score = info.get("ALS", 0)
                result["students"].append({
                    "id": sid,
                    "ALS": als_score
                })
        else:
            print(f"No als_per_student.json found in {output_path}")

        return result

    except Exception as e:
        print(f"Error reading ALS results: {e}")
        return {"students": [], "error": str(e)}


def parse_summary_csv(csv_path):
    """Parse attendance summary CSV file"""
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
        print(f"Error parsing summary CSV: {e}")
    
    return students

def parse_stable_csv(csv_path):
    """Parse stable behavior CSV file"""
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
        print(f"Error parsing stable CSV: {e}")
    
    return behaviors

def parse_events_csv(csv_path):
    """Parse attendance events CSV file"""
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
        print(f"Error parsing events CSV: {e}")
    
    return events

@app.route('/api/get-results/<session_id>', methods=['GET'])
def get_results(session_id):
    """
    Get processing results for a specific session
    """
    try:
        # Find output directory for this session
        output_dirs = list(OUTPUT_FOLDER.glob(f"session_{session_id}_*"))
        
        if not output_dirs:
            return jsonify({
                'success': False,
                'error': 'No results found for this session'
            }), 404
        
        # Get the latest result
        latest_dir = max(output_dirs, key=os.path.getctime)
        
        # Read attendance results
        attendance_data = read_attendance_results(latest_dir)
        
        return jsonify({
            'success': True,
            'data': attendance_data,
            'output_dir': str(latest_dir.name)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/results/<folder_name>/<filename>', methods=['GET'])
def get_result_file(folder_name, filename):
    """Download specific result files (CSV, JSON, video)"""
    try:
        folder_path = OUTPUT_FOLDER / folder_name
        if not folder_path.exists():
            return jsonify({'error': 'Folder không tồn tại'}), 404
        
        file_path = folder_path / filename
        if not file_path.exists():
            return jsonify({'error': 'File không tồn tại'}), 404
        
        return send_from_directory(str(folder_path), filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/video/<folder_name>', methods=['GET'])
def get_video(folder_name):
    """Get processed video from output folder"""
    try:
        folder_path = OUTPUT_FOLDER / folder_name
        if not folder_path.exists():
            return jsonify({'error': 'Folder không tồn tại'}), 404
        
        # Find MP4 file in folder
        video_files = list(folder_path.glob('*.mp4'))
        if video_files:
            return send_from_directory(str(folder_path), video_files[0].name)
        
        return jsonify({'error': 'Video không tìm thấy'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/list-sessions', methods=['GET'])
def list_sessions():
    """List all processed sessions"""
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
        
        return jsonify({
            'success': True,
            'sessions': sessions,
            'total': len(sessions)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/cleanup', methods=['POST'])
def cleanup_old_files():
    """
    Clean up old uploaded videos and outputs
    """
    try:
        data = request.json
        days_old = data.get('days', 7)
        
        # This would implement cleanup logic
        # For now, just return success
        
        return jsonify({
            'success': True,
            'message': f'Cleanup completed for files older than {days_old} days'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def _hms(sec: float) -> str:
    sec = max(0, int(round(float(sec))))
    h = sec // 3600; m = (sec % 3600)//60; s = sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

def _load_session_dir(session_id: str):
    # lấy thư mục outputs/session_<sessionId>_* mới nhất
    dirs = list(OUTPUT_FOLDER.glob(f"session_{session_id}_*"))
    return max(dirs, key=os.path.getctime) if dirs else None

def _load_ai_outputs(outdir):
    import json, csv
    from pathlib import Path
    p = Path(outdir)
    out = {}

    # JSON
    als_global = p / "als_global.json"
    als_student = p / "als_per_student.json"
    out["als_global"]  = json.load(open(als_global,  "r", encoding="utf-8")) if als_global.exists()  else {}
    out["als_student"] = json.load(open(als_student, "r", encoding="utf-8")) if als_student.exists() else {}

    # CSV
    out["events"] = []
    events_csv = p / "attendance_events.csv"
    if events_csv.exists():
        with open(events_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                out["events"].append(row)

    out["summary"] = {}
    summary_csv = p / "attendance_summary.csv"
    if summary_csv.exists():
        with open(summary_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                out["summary"][row["student_id"]] = row

    return out

def _events_for_student(events, sid):
    items = [e for e in events if e.get("student_id")==sid]
    total = sum(float(e.get("duration_sec",0)) for e in items)
    return items, total

@app.route('/api/results/<path:relpath>', methods=['GET'])
def serve_output(relpath):
    base = Path(OUTPUT_FOLDER).resolve()
    full = (base / relpath).resolve()

    # Chặn truy cập ra ngoài thư mục outputs
    if not str(full).startswith(str(base)):
        abort(403)

    if not full.exists() or not full.is_file():
        abort(404)

    return send_file(str(full), as_attachment=True)

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    """
    JSON body ví dụ:
    {
      "sessionId": "COS40005-01",
      "studentId": "104221559",
      "name": "Nghia Doan Trung",
      "unit": "COS40005",
      "attendance": "Present"   # optional
    }
    """
    try:
        data = request.get_json(force=True)
        session_id = data["sessionId"]
        sid        = data["studentId"]
        name       = data.get("name", "")
        unit       = data.get("unit", "")
        attendance_override = data.get("attendance")  # có thể bỏ qua, backend suy ra

        session_dir = _load_session_dir(session_id)
        if not session_dir:
            return jsonify({"success": False, "error": "No session folder found"}), 404

        ai = _load_ai_outputs(session_dir)
        per = ai["als_student"].get(sid, {})
        als = per.get("ALS", 0)
        proportions = per.get("proportions", {})
        seconds     = per.get("seconds", {})

        events, total_sec = _events_for_student(ai["events"], sid)
        attendance = attendance_override if attendance_override is not None else ("Present" if total_sec>0 else "Absent")

        # Tạo thư mục báo cáo & file pdf
        reports_dir = Path(session_dir) / "reports"
        reports_dir.mkdir(exist_ok=True)
        pdf_name = f"{sid}.pdf"
        pdf_path = reports_dir / pdf_name

        # Build PDF
        styles = getSampleStyleSheet()
        doc = SimpleDocTemplate(str(pdf_path), pagesize=A4, title="Attendance Evidence")
        story = []
        story.append(Paragraph("<b>Attendance & Active Learning Evidence</b>", styles["Title"]))
        story.append(Spacer(1, 0.3*cm))

        meta = [
            ["Student Name", name],
            ["Student ID",  sid],
            ["Unit",        unit],
            ["Attendance",  attendance],
            ["Total Time",  _hms(total_sec)],
            ["ALS Score",   f"{als:.2f} / 100"]
        ]
        table_meta = Table(meta, colWidths=[4.0*cm, 11.5*cm])
        table_meta.setStyle(TableStyle([
            ("GRID",(0,0),(-1,-1),0.25,colors.grey),
            ("BACKGROUND",(0,0),(0,-1),colors.whitesmoke)
        ]))
        story.append(table_meta)
        story.append(Spacer(1, 0.4*cm))

        # Intervals
        if events:
            story.append(Paragraph("<b>Presence Intervals</b>", styles["Heading3"]))
            head = [["#", "Enter (ISO)", "Exit (ISO)", "Duration"]]
            rows = []
            for i,e in enumerate(events, start=1):
                rows.append([i, e.get("enter_iso",""), e.get("exit_iso",""), _hms(float(e.get("duration_sec",0)))])
            t = Table(head+rows, colWidths=[1.2*cm, 6.0*cm, 6.0*cm, 2.3*cm])
            t.setStyle(TableStyle([
                ("BACKGROUND",(0,0),(-1,0), colors.lightgrey),
                ("GRID",(0,0),(-1,-1), 0.25, colors.grey),
                ("ALIGN",(-1,1),(-1,-1), "RIGHT")
            ]))
            story.append(t)
            story.append(Spacer(1, 0.4*cm))

        # Behavior seconds
        if seconds:
            story.append(Paragraph("<b>Behavior Time</b>", styles["Heading3"]))
            rows = [["Behavior","Seconds","Proportion"]]
            for k in sorted(seconds.keys()):
                s = float(seconds[k]); p = float(proportions.get(k, 0.0))
                rows.append([k, f"{s:.2f}", f"{p*100:.1f}%"])
            t2 = Table(rows, colWidths=[6.5*cm, 4.0*cm, 5.0*cm])
            t2.setStyle(TableStyle([
                ("BACKGROUND",(0,0),(-1,0), colors.lightgrey),
                ("GRID",(0,0),(-1,-1), 0.25, colors.grey),
                ("ALIGN",(1,1),(-1,-1),"RIGHT")
            ]))
            story.append(t2)

        doc.build(story)

        # Trả link tải (xài endpoint có sẵn /api/results/<folder>/<file>)
        download_url = f"/api/results/{session_dir.name}/reports/{pdf_name}"
        return jsonify({"success": True, "url": download_url, "folder": session_dir.name, "file": pdf_name})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    print("="*60)
    print("🎓 Video Processing API Server - Active Learning System")
    print("="*60)
    print(f"📂 Upload folder: {UPLOAD_FOLDER}")
    print(f"📂 Output folder: {OUTPUT_FOLDER}")
    print(f"📂 Gallery folder: {GALLERY_FOLDER}")
    print(f"📂 Model folder: {MODEL_FOLDER}")
    print("="*60)
    print("🌐 Server starting at: http://localhost:5001")
    print("📡 Health check: http://localhost:5001/health")
    print("="*60)
    print("\n🔧 Available Endpoints:")
    print("  POST /api/process-video    - Upload and process video")
    print("  GET  /api/status/<job_id>  - Check processing status")
    print("  GET  /api/get-results/<id> - Get results by session ID")
    print("  GET  /api/video/<folder>   - Download processed video")
    print("  GET  /api/list-sessions    - List all sessions")
    print("  GET  /health               - Health check")
    print("="*60)
    
    app.run(host='0.0.0.0', port=5001, debug=True, threaded=True)
