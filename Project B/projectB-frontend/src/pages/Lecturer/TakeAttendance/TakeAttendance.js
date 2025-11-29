import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Footer from "../../../components/Footer/Footer";
import "./TakeAttendance.css";

function TakeAttendance() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [units, setUnits] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState({
    course: false,
    unit: false,
    session: false,
  });

  // Video upload states
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("");
  const [videoPreview, setVideoPreview] = useState(null);

  // ============================
  // FETCH DATA
  // ============================

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchUnits(selectedCourse.CourseID);
      setSelectedUnit("");
      setSelectedSession("");
      setStudents([]);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedUnit) {
      fetchSessions(selectedUnit.UnitID);
      setSelectedSession("");
      setStudents([]);
    }
  }, [selectedUnit]);

  useEffect(() => {
    if (selectedSession && selectedUnit) {
      fetchStudents(selectedUnit.UnitID, selectedSession.SessionID);
    }
  }, [selectedSession, selectedUnit]);

  const fetchCourses = async () => {
    try {
      const response = await fetch(
        "http://localhost/project B/projectB-backend/Lecturer/getCourses.php"
      );
      const data = await response.json();
      if (data.success) setCourses(data.data);
      else setError("Failed to fetch courses");
    } catch {
      setError("Error fetching courses");
    }
  };

  const fetchUnits = async (courseId) => {
    try {
      const response = await fetch(
        `http://localhost/project B/projectB-backend/Lecturer/getUnits.php?courseId=${courseId}`
      );
      const data = await response.json();
      if (data.success) setUnits(data.data);
      else setError("Failed to fetch units");
    } catch {
      setError("Error fetching units");
    }
  };

  const fetchSessions = async (unitId) => {
    try {
      const response = await fetch(
        `http://localhost/project B/projectB-backend/Lecturer/getVenues.php?unitId=${unitId}`
      );
      const data = await response.json();
      if (data.success) setSessions(data.data);
      else setError("Failed to fetch sessions");
    } catch {
      setError("Error fetching sessions");
    }
  };

  const fetchStudents = async (unitId, sessionId) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost/project B/projectB-backend/Lecturer/getStudentsAttendance.php?unitId=${unitId}&sessionId=${sessionId}`
      );
      const data = await response.json();
      if (data.success) {
        setStudents(data.data);
      } else {
        setError("Failed to fetch students");
      }
    } catch {
      setError("Error fetching students");
    } finally {
      setLoading(false);
    }
  };

  // ============================
  // ATTENDANCE + ALS UPDATE
  // ============================

  const updateAttendance = async (studentId, newStatus, activePoint = 0) => {
    try {
      const response = await fetch(
        "http://localhost/project B/projectB-backend/Lecturer/updateAttendance.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            sessionId: selectedSession.SessionID,
            status: newStatus,
            activePoint: Number.isFinite(activePoint)
              ? Math.round(activePoint)
              : 0, // gửi ALS (int) vào bảng attendance
          }),
        }
      );
      const data = await response.json();
      console.log("updateAttendance.php response:", data);
      return data;
    } catch (e) {
      console.error("Update error:", e);
      return { success: false, error: e.message };
    }
  };

  // lưu chi tiết ALS + thời gian hành vi vào bảng attendance_als (PHP: saveAttendanceAls.php)
  const saveAlsDetails = async ({
    sessionId,
    studentId,
    alsScore,
    totalLabeledSeconds,
    seconds,
  }) => {
    try {
      const response = await fetch(
        "http://localhost/project B/projectB-backend/Lecturer/saveAttendanceAls.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            studentId,
            alsScore,
            totalLabeledSeconds,
            seconds, // object: {upright: 370, writing: 862, ...}
          }),
        }
      );
      const data = await response.json();
      console.log("saveAttendanceAls.php response:", data);
      return data.success;
    } catch (e) {
      console.error("saveAlsDetails error:", e);
      return false;
    }
  };

  // ============================
  // UI helpers
  // ============================

  const toggleDropdown = (dropdown) => {
    setDropdownOpen((prev) => ({ ...prev, [dropdown]: !prev[dropdown] }));
  };

  const closeAllDropdowns = () => {
    setDropdownOpen({ course: false, unit: false, session: false });
  };

  const getAttendanceBadgeClass = (status) => {
    switch (status) {
      case "present":
        return "attendance-badge present";
      case "absent":
        return "attendance-badge absent";
      case "late":
        return "attendance-badge late";
      default:
        return "attendance-badge unknown";
    }
  };

  // ============================
  // VIDEO handlers
  // ============================

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        setError("Please select a valid video file (MP4, AVI, MOV, MKV)");
        return;
      }
      setSelectedVideo(file);
      setError("");

      const videoUrl = URL.createObjectURL(file);
      setVideoPreview(videoUrl);
    }
  };

  const handleVideoUpload = async () => {
    if (!selectedVideo) {
      setError("Please select a video file first");
      return;
    }

    if (!selectedUnit || !selectedSession) {
      setError("Please select unit and session first");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setProcessingMessage("Uploading video...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("video", selectedVideo);
      formData.append("unitId", selectedUnit.UnitID);
      formData.append("sessionId", selectedSession.SessionID);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentage = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentage);
          if (percentage < 100) {
            setProcessingMessage(`Uploading: ${percentage}%`);
          }
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            setProcessingMessage("Processing complete! Updating attendance...");

            // JSON từ Flask (aiData) -> update attendance + ALS table
            processAIResults(response.data);

            // Refresh student list
            fetchStudents(selectedUnit.UnitID, selectedSession.SessionID);

            setProcessingMessage("Attendance updated successfully!");
            setTimeout(() => {
              setProcessingMessage("");
              setUploading(false);
              setSelectedVideo(null);
              setVideoPreview(null);
            }, 3000);
          } else {
            setError(response.error || "Failed to process video");
            setUploading(false);
          }
        } else {
          setError("Upload failed. Please try again.");
          setUploading(false);
        }
      });

      xhr.addEventListener("error", () => {
        setError("Network error. Please check if the AI service is running.");
        setUploading(false);
      });

      setProcessingMessage("Processing video with AI...");
      xhr.open("POST", "http://localhost:5001/api/process-video");
      xhr.send(formData);
    } catch (err) {
      setError("Error uploading video: " + err.message);
      setUploading(false);
    }
  };

  // aiData format giả định:
  // {
  //   students: [
  //     {
  //       id: "104221559",
  //       ALS: 93.5,
  //       total_labeled_seconds: 2846.0,
  //       seconds: { upright: 370.0, writing: 862.0, ... }
  //     }, ...
  //   ]
  // }
  const processAIResults = async (aiData) => {
    try {
      if (!aiData || !Array.isArray(aiData.students) || aiData.students.length === 0) {
        console.warn("No AI data received");
        return;
      }

      const norm = (v) => String(v ?? "").trim();
      const studentIdSet = new Set(students.map((s) => norm(s.StudentID)));
      const registrationIdSet = new Set(students.map((s) => norm(s.RegistrationID)));
      const regToStudent = new Map(
        students.map((s) => [norm(s.RegistrationID), norm(s.StudentID)])
      );

      let ok = 0,
        miss = 0;

      for (const detected of aiData.students) {
        const rawId = norm(detected.id);
        const als = Number(detected.ALS ?? 0);
        const totalSeconds = Number(
          detected.total_labeled_seconds ?? detected.total_labelled_seconds ?? 0
        );
        const secondsObj = detected.seconds || detected.behavior_seconds || {};

        let targetStudentId = null;
        if (studentIdSet.has(rawId)) targetStudentId = rawId;
        else if (registrationIdSet.has(rawId) && regToStudent.has(rawId)) {
          targetStudentId = regToStudent.get(rawId);
        }

        if (targetStudentId) {
          const ap = Number.isFinite(als) ? Math.round(als) : 0;
          console.log(
            `✅ Marking ${targetStudentId} as present (ALS=${als} → ActivePoint=${ap})`
          );
          const res = await updateAttendance(targetStudentId, "present", ap);

          // nếu updateAttendance thành công thì lưu luôn ALS chi tiết
          if (res?.success) {
            ok++;
            await saveAlsDetails({
              sessionId: selectedSession.SessionID,
              studentId: targetStudentId,
              alsScore: als,
              totalLabeledSeconds: totalSeconds,
              seconds: secondsObj,
            });
          } else {
            miss++;
          }
        } else {
          console.warn(
            `⚠️ ID ${rawId} không khớp StudentID/RegistrationID của phiên hiện tại`
          );
          miss++;
        }
      }

      console.log(`Batch done: ${ok} updated, ${miss} skipped`);
      await fetchStudents(selectedUnit.UnitID, selectedSession.SessionID); // refresh 1 lần sau batch
    } catch (error) {
      console.error("Error processing AI results:", error);
      setError("Failed to apply AI results");
    }
  };

  const clearVideo = () => {
    setSelectedVideo(null);
    setVideoPreview(null);
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
  };

  // ============================
  // RENDER
  // ============================

  return (
    <div className="take-attendance-container" onClick={closeAllDropdowns}>
      <Navbar user={user} />

      <div className="main-layout">
        <Sidebar activePage="take" onLogout={logout} />

        <div className="main-content">
          <div className="content-area">
            <h1 className="page-title">Take Attendance</h1>
            <p className="page-subtitle">
              Please select course, unit, and session first before checking attendance
            </p>

            {error && <div className="error">{error}</div>}

            {/* Dropdown Controls */}
            <div className="controls-section">
              {/* Course */}
              <div className="dropdown">
                <button
                  className="dropdown-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown("course");
                  }}
                >
                  <span>
                    {selectedCourse ? selectedCourse.CourseName : "Select Course"}
                  </span>
                  <span>▼</span>
                </button>
                {dropdownOpen.course && (
                  <div className="dropdown-content">
                    {courses.map((course) => (
                      <div
                        key={course.CourseID}
                        className="dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourse(course);
                          setDropdownOpen((prev) => ({ ...prev, course: false }));
                        }}
                      >
                        {course.CourseName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unit */}
              <div className="dropdown">
                <button
                  className="dropdown-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown("unit");
                  }}
                  disabled={!selectedCourse}
                >
                  <span>
                    {selectedUnit ? selectedUnit.UnitCode : "Select Unit"}
                  </span>
                  <span>▼</span>
                </button>
                {dropdownOpen.unit && (
                  <div className="dropdown-content">
                    {units.map((unit) => (
                      <div
                        key={unit.UnitID}
                        className="dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUnit(unit);
                          setDropdownOpen((prev) => ({ ...prev, unit: false }));
                        }}
                      >
                        {unit.UnitCode} - {unit.UnitName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Session */}
              <div className="dropdown">
                <button
                  className="dropdown-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown("session");
                  }}
                  disabled={!selectedUnit}
                >
                  <span>
                    {selectedSession
                      ? `${selectedSession.Date} ${selectedSession.Start}`
                      : "Select Session"}
                  </span>
                  <span>▼</span>
                </button>
                {dropdownOpen.session && (
                  <div className="dropdown-content">
                    {sessions.map((session) => (
                      <div
                        key={session.SessionID}
                        className="dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSession(session);
                          setDropdownOpen((prev) => ({ ...prev, session: false }));
                        }}
                      >
                        {session.Date} - {session.Start} to {session.End}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Video Upload Section */}
            <div className="video-section">
              <div className="upload-container">
                <h3>Upload Video for AI Processing</h3>

                {!selectedVideo ? (
                  <div className="upload-area">
                    <input
                      type="file"
                      id="video-upload"
                      accept="video/mp4,video/avi,video/mov,video/mkv"
                      onChange={handleVideoSelect}
                      style={{ display: "none" }}
                      disabled={!selectedSession}
                    />
                    <label
                      htmlFor="video-upload"
                      className={`upload-label ${
                        !selectedSession ? "disabled" : ""
                      }`}
                    >
                      <div className="upload-icon">📹</div>
                      <p>Click to select video file</p>
                      <p className="upload-hint">
                        Supported: MP4, AVI, MOV, MKV (Max: 100MB)
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="video-preview-container">
                    {videoPreview && (
                      <video
                        src={videoPreview}
                        controls
                        className="video-preview"
                        style={{ maxWidth: "100%", maxHeight: "400px" }}
                      />
                    )}
                    <div className="video-info">
                      <p>
                        <strong>File:</strong> {selectedVideo.name}
                      </p>
                      <p>
                        <strong>Size:</strong>{" "}
                        {(selectedVideo.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="video-actions">
                      <button
                        className="process-button"
                        onClick={handleVideoUpload}
                        disabled={uploading}
                      >
                        {uploading ? "Processing..." : "🚀 Process with AI"}
                      </button>
                      <button
                        className="clear-button"
                        onClick={clearVideo}
                        disabled={uploading}
                      >
                        ✖ Clear
                      </button>
                    </div>
                  </div>
                )}

                {uploading && (
                  <div className="processing-status">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="processing-message">{processingMessage}</p>
                  </div>
                )}

                {!selectedSession && (
                  <p className="warning-message">
                    ⚠️ Please select Course, Unit, and Session first
                  </p>
                )}
              </div>
            </div>

            {/* Attendance Table */}
            {students.length > 0 && (
              <div className="attendance-table">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student Id</th>
                      <th>Name</th>
                      <th>Unit</th>
                      <th>Attendance</th>
                      <th>Active Point</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.StudentID}>
                        <td>{student.RegistrationID}</td>
                        <td>{student.Name}</td>
                        <td>{student.UnitCode}</td>
                        <td>
                          <span
                            className={getAttendanceBadgeClass(
                              student.Attendance
                            )}
                          >
                            {student.Attendance}
                          </span>
                        </td>
                        <td>{Number(student.ActivePoint ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {loading && <div className="loading">Loading students...</div>}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default TakeAttendance;
