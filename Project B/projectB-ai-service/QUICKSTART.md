# Quick Start Guide - ProjectB AI Service

## 🚀 Khởi động nhanh

### 1. Khởi động server
```bash
start_video_api.bat
```

Server sẽ chạy tại: **http://localhost:5001**

### 2. Kiểm tra server
Mở trình duyệt và truy cập:
```
http://localhost:5001/health
```

## 📡 Test API

### Sử dụng Python Script
```bash
# Test cơ bản (không upload video)
python test_api.py

# Test đầy đủ với video
python test_api.py "path/to/video.mp4"
```

### Sử dụng cURL (Windows PowerShell)
```powershell
# Health check
Invoke-WebRequest -Uri "http://localhost:5001/health" | Select-Object -Expand Content

# Upload video (async)
$video = "C:\path\to\video.mp4"
$form = @{
    video = Get-Item -Path $video
    unitId = "101"
    sessionId = "test_001"
    async = "true"
}
Invoke-RestMethod -Uri "http://localhost:5001/api/process-video" -Method Post -Form $form
```

### Sử dụng Postman
1. **Endpoint:** `POST http://localhost:5001/api/process-video`
2. **Body:** `form-data`
   - Key: `video` | Type: `File` | Value: chọn file video
   - Key: `unitId` | Type: `Text` | Value: `101`
   - Key: `sessionId` | Type: `Text` | Value: `session_001`
   - Key: `async` | Type: `Text` | Value: `true`
3. **Send**

## 📝 Các endpoint quan trọng

```
GET  /health                      - Kiểm tra server
POST /api/process-video           - Upload và xử lý video
GET  /api/status/{job_id}         - Kiểm tra trạng thái job
GET  /api/get-results/{session}   - Lấy kết quả theo session
GET  /api/list-sessions           - Liệt kê tất cả sessions
GET  /api/video/{folder_name}     - Download video đã xử lý
```

## 🎓 Setup Face Gallery

Để hệ thống nhận diện sinh viên, tạo folder trong `students_gallery/`:

```
students_gallery/
├── 104221795_NguyenVanA/
│   └── photo.jpg
├── 104221796_TranThiB/
│   └── photo.jpg
└── 104221797_LeVanC/
    └── photo.jpg
```

**Lưu ý:**
- Tên folder: `{mã_sinh_viên}_{tên}`
- File ảnh phải rõ mặt, chất lượng tốt
- Format: JPG hoặc PNG

## 🔧 Troubleshooting

### Server không khởi động
```bash
# Kiểm tra Python
python --version

# Kiểm tra dependencies
pip list | findstr Flask

# Cài đặt lại
pip install -r requirements.txt
```

### CUDA Out of Memory
Edit `classroom_attendance_activelearning.py`:
- Tăng `--frame_stride` (2 → 3)
- Xóa `--half` flag

### Port 5001 đã được sử dụng
Edit `video_processing_api.py` dòng cuối:
```python
app.run(host='0.0.0.0', port=5002, debug=True)
```

## 📊 Kết quả Output

Mỗi session tạo folder: `outputs/session_{sessionId}_{timestamp}/`

**Các file được tạo:**
- `annotated_output.mp4` - Video có annotations
- `attendance_summary.csv` - Tổng hợp điểm danh
- `attendance_events.csv` - Timeline vào/ra
- `behaviors_stable.csv` - Hành vi ổn định
- `als_global.json` - ALS score toàn lớp
- `als_per_student.json` - ALS score từng sinh viên

## 🔗 Tích hợp với Frontend (React)

```javascript
// Upload và xử lý video
const handleUpload = async (videoFile) => {
  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('unitId', unitId);
  formData.append('sessionId', sessionId);
  formData.append('async', 'true');

  const response = await fetch('http://localhost:5001/api/process-video', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  const jobId = data.job_id;

  // Poll status
  const interval = setInterval(async () => {
    const statusRes = await fetch(`http://localhost:5001/api/status/${jobId}`);
    const status = await statusRes.json();

    if (status.status === 'completed') {
      clearInterval(interval);
      console.log('Results:', status.results);
      // Cập nhật UI với kết quả
    }
  }, 2000);
};
```

## ⚡ Performance Tips

1. **Tối ưu video trước khi upload:**
   - Resolution: 1280x720 hoặc thấp hơn
   - FPS: 25-30 FPS
   - Format: MP4 (H.264)

2. **Điều chỉnh processing:**
   - Video ngắn (< 5 phút): sync mode
   - Video dài (> 5 phút): async mode
   - Frame stride = 2 cho video 30fps

3. **Hardware:**
   - Có GPU CUDA: Nhanh gấp 5-10x
   - Không có GPU: Tăng frame_stride lên 3-4

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra console output của server
2. Xem file log trong folder outputs
3. Đọc README.md để biết thêm chi tiết
4. Kiểm tra MIGRATION_SUMMARY.md để hiểu các thay đổi

---
**Ready to go!** 🎉
