# ProjectB AI Service - Video Processing APIcd "c:\xampp\htdocs\project B\projectB-ai-service"; python video_processing_api.py

## Overview
This service provides AI-powered video processing for classroom attendance tracking and active learning system (ALS) scoring using YOLOv8 and face recognition.

## Features
- ✅ **Background Video Processing** - Asynchronous processing with job tracking
- ✅ **Attendance Detection** - Face recognition with gallery matching
- ✅ **Behavior Analysis** - 12 student behaviors (reading, writing, phone usage, etc.)
- ✅ **Active Learning Score (ALS)** - Time-weighted behavior scoring per student
- ✅ **Multiple Output Formats** - JSON, CSV, annotated video
- ✅ **RESTful API** - Easy integration with frontend/backend

## Prerequisites
- Python 3.10+
- CUDA-capable GPU (recommended)
- PyTorch with CUDA support

## Installation

### 1. Install PyTorch (GPU version)
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Verify Models
Ensure these files exist in `models/` folder:
- `yolov8n.pt` - Person detection model
- `student_behaviour_best.onnx` - Behavior classification model

## Usage

### Start the Server
#### Windows:
```bash
start_video_api.bat
```

#### Manual:
```bash
python video_processing_api.py
```

The server will start on: **http://localhost:5001**

## API Endpoints

### 1. Health Check
```http
GET /health
```
Returns server status and configuration.

### 2. Process Video (Synchronous)
```http
POST /api/process-video
Content-Type: multipart/form-data

Parameters:
- video: Video file (MP4, AVI, MOV, MKV, WEBM)
- unitId: Unit identifier
- sessionId: Session identifier
```

### 3. Process Video (Asynchronous)
```http
POST /api/process-video
Content-Type: multipart/form-data

Parameters:
- video: Video file
- unitId: Unit identifier
- sessionId: Session identifier
- async: "true" (enable background processing)
```

Returns `job_id` for status tracking.

### 4. Check Processing Status
```http
GET /api/status/{job_id}
```

Response:
```json
{
  "status": "processing|completed|error",
  "progress": 50,
  "message": "Processing...",
  "results": {...}
}
```

### 5. Get Results by Session ID
```http
GET /api/get-results/{session_id}
```

Returns attendance data, behaviors, and ALS scores.

### 6. Download Result Files
```http
GET /api/results/{folder_name}/{filename}
```

Download specific CSV, JSON, or video files.

### 7. Get Processed Video
```http
GET /api/video/{folder_name}
```

### 8. List All Sessions
```http
GET /api/list-sessions
```

## Output Structure

Each processing session creates a folder: `outputs/session_{sessionId}_{timestamp}/`

### Files Generated:
- `annotated_output.mp4` - Video with bounding boxes and labels
- `attendance_summary.csv` - Student attendance summary
- `attendance_events.csv` - Enter/exit events timeline
- `behaviors_raw.csv` - Frame-by-frame behavior detections
- `behaviors_stable.csv` - Stabilized behavior labels
- `als_global.json` - Overall class ALS score
- `als_per_student.json` - Per-student ALS scores

### Example Output (JSON):
```json
{
  "students": [
    {
      "trackId": "1",
      "name": "Nguyen Van A",
      "firstSeen": "12.5",
      "lastSeen": "125.3",
      "totalTime": "112.8",
      "confidence": "0.92"
    }
  ],
  "als_data": {
    "global": {
      "overall_als": 1.25,
      "total_frames": 1500,
      "avg_students": 25
    },
    "per_student": {
      "1": {
        "name": "Nguyen Van A",
        "als_score": 1.85,
        "engagement_level": "High"
      }
    }
  }
}
```

## Configuration

### Folder Structure:
```
projectB-ai-service/
├── video_processing_api.py       # Main API server
├── classroom_attendance_activelearning.py  # AI processing script
├── requirements.txt              # Python dependencies
├── start_video_api.bat          # Windows start script
├── models/                      # AI models
│   ├── yolov8n.pt
│   └── student_behaviour_best.onnx
├── students_gallery/            # Face recognition gallery
│   └── {student_id}_name/
│       └── photo.jpg
├── uploads/                     # Uploaded videos (temp)
└── outputs/                     # Processing results
    └── session_*/
```

### Environment Variables:
- `FLASK_ENV`: Set to `production` for production deployment
- `CUDA_VISIBLE_DEVICES`: Specify GPU device (e.g., `0,1`)

## Integration with Frontend

### Example (React/JavaScript):
```javascript
const formData = new FormData();
formData.append('video', videoFile);
formData.append('unitId', '101');
formData.append('sessionId', 'session_001');
formData.append('async', 'true');

const response = await fetch('http://localhost:5001/api/process-video', {
  method: 'POST',
  body: formData
});

const data = await response.json();
const jobId = data.job_id;

// Poll for status
const statusInterval = setInterval(async () => {
  const statusRes = await fetch(`http://localhost:5001/api/status/${jobId}`);
  const status = await statusRes.json();
  
  if (status.status === 'completed') {
    clearInterval(statusInterval);
    console.log('Results:', status.results);
  }
}, 2000);
```

## Troubleshooting

### CUDA Out of Memory
- Reduce batch size in processing script
- Use `--frame_stride 3` to process fewer frames
- Disable half-precision: remove `--half` flag

### Models Not Found
```bash
# Verify models exist
dir models\
```

### Port Already in Use
Change port in `video_processing_api.py`:
```python
app.run(host='0.0.0.0', port=5002, debug=True)
```

## Performance Tips
- Use SSD for faster I/O
- Enable GPU half-precision (`--half`) for 2x speedup
- Adjust `--frame_stride` based on video FPS
- Pre-populate face gallery for faster recognition

## Development
```bash
# Run in debug mode
python video_processing_api.py

# Test health endpoint
curl http://localhost:5001/health
```

## Migrated from Testing Folder
This service now includes all the video processing capabilities from the `testing` folder with enhanced features:
- Better error handling
- Background processing with job tracking
- More comprehensive API endpoints
- Improved documentation

## License
Proprietary - Active Learning System Project B

## Contact
For support, contact the development team.
