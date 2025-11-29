import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Footer from "../../../components/Footer/Footer";
import "./ViewAttendance.css";

// Cùng logic với BEHAVIOR_WEIGHTS bên Python
const BEHAVIOR_WEIGHTS = {
    "hand-raising": 2.0,
    "writing": 1.5,
    "reading": 1.0,
    "upright": 0.5,
    "raise_head": 0.3,
    "turn_head": 0.0,
    "book": 0.0,
    "bow_head": -0.2,
    "bend": -0.5,
    "phone": -2.0,
    "Using_phone": -2.0,
    "sleep": -3.0,
};

function ViewAttendance() {
    const { user, logout } = useAuth();

    const [courses, setCourses] = useState([]);
    const [units, setUnits] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [attendanceData, setAttendanceData] = useState([]);

    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedUnit, setSelectedUnit] = useState("");
    const [selectedDate, setSelectedDate] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState({
        course: false,
        unit: false,
        date: false,
    });

    // More information
    const [expandedStudentId, setExpandedStudentId] = useState(null); // StudentID đang mở
    const [activeDetails, setActiveDetails] = useState({}); // { [StudentID]: detailObject | null }
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Processed video
    const [processedVideoUrl, setProcessedVideoUrl] = useState(null);
    const [videoError, setVideoError] = useState("");

    // Violation videos
    const [violationVideos, setViolationVideos] = useState({}); // { [StudentID]: videos[] }
    const [violationLoading, setViolationLoading] = useState(false);

    // Fetch courses on mount
    useEffect(() => {
        fetchCourses();
    }, []);

    // Fetch units when course selected
    useEffect(() => {
        if (selectedCourse) {
            fetchUnits(selectedCourse.CourseID);
            setSelectedUnit("");
            setSelectedDate("");
            setAttendanceData([]);
            setExpandedStudentId(null);
            setActiveDetails({});
        }
    }, [selectedCourse]);

    // Fetch sessions when unit selected
    useEffect(() => {
        if (selectedUnit) {
            fetchSessions(selectedUnit.UnitID);
            setSelectedDate("");
            setAttendanceData([]);
            setExpandedStudentId(null);
            setActiveDetails({});
        }
    }, [selectedUnit]);

    // Fetch attendance when date selected
    useEffect(() => {
        if (selectedDate && selectedUnit) {
            fetchAttendanceData(selectedUnit.UnitID, selectedDate.SessionID);
            fetchProcessedVideo(selectedDate.SessionID);
        } else {
            setProcessedVideoUrl(null);
            setVideoError("");
        }
    }, [selectedDate, selectedUnit]);

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

    const fetchAttendanceData = async (unitId, sessionId) => {
        setLoading(true);
        try {
            const response = await fetch(
                `http://localhost/project B/projectB-backend/Lecturer/getStudentsAttendance.php?unitId=${unitId}&sessionId=${sessionId}`
            );
            const data = await response.json();
            if (data.success) {
                setAttendanceData(data.data);
            } else {
                setError("Failed to fetch attendance data");
            }
        } catch {
            setError("Error fetching attendance data");
        } finally {
            setLoading(false);
        }
    };

    const fetchProcessedVideo = async (sessionId) => {
        setVideoError("");
        try {
            const response = await fetch(
                `http://localhost:5001/api/get-processed-video?sessionId=${sessionId}`
            );
            const data = await response.json();
            if (data.success && data.videoUrl) {
                setProcessedVideoUrl(data.videoUrl);
            } else {
                setProcessedVideoUrl(null);
                setVideoError("No processed video found for this session");
            }
        } catch (err) {
            console.error("Error fetching processed video:", err);
            setProcessedVideoUrl(null);
            setVideoError("Unable to load processed video");
        }
    };

    // Lấy chi tiết active cho 1 student + session
    const fetchActiveDetail = async (studentId, registrationId) => {
        if (!selectedDate) return;
        setDetailsLoading(true);
        try {
            // Fetch active learning details
            const response = await fetch(
                `http://localhost/project B/projectB-backend/Lecturer/getStudentActiveDetail.php?sessionId=${encodeURIComponent(
                    selectedDate.SessionID
                )}&studentId=${encodeURIComponent(studentId)}`
            );
            const data = await response.json();
            if (data.success) {
                setActiveDetails((prev) => ({
                    ...prev,
                    [studentId]: data.data ?? null,
                }));
            } else {
                setActiveDetails((prev) => ({
                    ...prev,
                    [studentId]: null,
                }));
            }

            // Fetch violation videos
            await fetchViolationVideos(studentId, registrationId);
        } catch (e) {
            console.error("Error fetching active detail:", e);
            setError("Error fetching active detail");
            setActiveDetails((prev) => ({
                ...prev,
                [studentId]: null,
            }));
        } finally {
            setDetailsLoading(false);
        }
    };

    const fetchViolationVideos = async (studentId, registrationId) => {
        if (!selectedDate) return;
        setViolationLoading(true);
        try {
            const url = `http://localhost:5001/api/get-violation-videos?sessionId=${encodeURIComponent(
                selectedDate.SessionID
            )}&studentId=${encodeURIComponent(registrationId)}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                setViolationVideos((prev) => ({
                    ...prev,
                    [studentId]: data.videos || [],
                }));
            } else {
                setViolationVideos((prev) => ({
                    ...prev,
                    [studentId]: [],
                }));
            }
        } catch (e) {
            console.error("Error fetching violation videos:", e);
            setViolationVideos((prev) => ({
                ...prev,
                [studentId]: [],
            }));
        } finally {
            setViolationLoading(false);
        }
    };

    const exportToExcel = () => {
        if (!attendanceData.length) {
            alert("No data to export");
            return;
        }

        let csv = "Student ID,Name,Date,Attendance,ALS\n";
        attendanceData.forEach((student) => {
            const als = Number(student.ActivePoint ?? 0);
            csv += `${student.RegistrationID},"${student.Name}",${selectedDate.Date},${student.Attendance},${als}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_${selectedUnit.UnitCode}_${selectedDate.Date}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const toggleDropdown = (dropdown) => {
        setDropdownOpen((prev) => ({ ...prev, [dropdown]: !prev[dropdown] }));
    };

    const closeAllDropdowns = () => {
        setDropdownOpen({ course: false, unit: false, date: false });
    };

    const getAttendanceBadgeClass = (status) => {
        switch ((status || "").toLowerCase()) {
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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-GB"); // DD/MM/YYYY
    };

    // Helper: render 1 behavior với màu theo đóng góp
    const renderBehaviorTime = (label, key, seconds, totalSec) => {
        const sec = Number(seconds ?? 0);
        if (!sec) return null; // 0s thì bỏ

        const total = Number(totalSec ?? 0);
        const w = BEHAVIOR_WEIGHTS[key] ?? 0;

        let contribution = 0;
        const eps = 1e-6;
        if (total > 0) {
            const proportion = sec / total;
            contribution = w * proportion;
        }

        let extraClass = "";
        if (contribution > eps) extraClass = " positive";
        else if (contribution < -eps) extraClass = " negative";

        return (
            <div className={`behavior-item${extraClass}`} key={label}>
                <span className="behavior-label">{label}</span>
                <span className="behavior-value">{sec.toFixed(1)}s</span>
            </div>
        );
    };

    // Helper: render 1 block violation video cho 1 student
    const renderViolationSection = (studentId) => {
        const videos = violationVideos[studentId];

        if (violationLoading && !videos) {
            return <div style={{ marginTop: "20px" }}>Loading violation videos...</div>;
        }

        if (videos && videos.length > 0) {
            return (
                <div
                    style={{
                        marginTop: "20px",
                        paddingTop: "20px",
                        borderTop: "1px solid #ddd",
                    }}
                >
                    <h4>Violation Videos</h4>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                            gap: "15px",
                            marginTop: "10px",
                        }}
                    >
                        {videos.map((video, idx) => (
                            <div
                                key={idx}
                                style={{
                                    border: "1px solid #ddd",
                                    borderRadius: "8px",
                                    padding: "10px",
                                    backgroundColor: "#f9f9f9",
                                }}
                            >
                                <h5
                                    style={{
                                        margin: "0 0 10px 0",
                                        color: "#333",
                                    }}
                                >
                                    {video.behavior}
                                </h5>
                                <video
                                    controls
                                    style={{
                                        width: "100%",
                                        borderRadius: "4px",
                                        backgroundColor: "#000",
                                    }}
                                >
                                    <source
                                        src={`http://localhost:5001${video.url}`}
                                        type="video/mp4"
                                    />
                                    Your browser does not support the video tag.
                                </video>
                                <p
                                    style={{
                                        fontSize: "11px",
                                        color: "#666",
                                        margin: "5px 0 0 0",
                                    }}
                                >
                                    {(video.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="view-attendance-container" onClick={closeAllDropdowns}>
            {/* Navbar */}
            <Navbar user={user} />

            {/* Main Layout */}
            <div className="main-layout">
                <Sidebar activePage="view" onLogout={logout} />

                {/* Main Content */}
                <div className="main-content">
                    <div className="content-area">
                        <h1 className="page-title">View Attendance</h1>
                        <p className="page-subtitle">
                            Select course, unit, and date to view attendance records
                        </p>

                        {error && <div className="error">{error}</div>}

                        {/* Controls Section */}
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
                                        {selectedCourse
                                            ? selectedCourse.CourseName
                                            : "Select Course"}
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
                                                    setDropdownOpen((prev) => ({
                                                        ...prev,
                                                        course: false,
                                                    }));
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
                                                    setDropdownOpen((prev) => ({
                                                        ...prev,
                                                        unit: false,
                                                    }));
                                                }}
                                            >
                                                {unit.UnitCode} - {unit.UnitName}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Date */}
                            <div className="dropdown">
                                <button
                                    className="dropdown-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDropdown("date");
                                    }}
                                    disabled={!selectedUnit}
                                >
                                    <span>
                                        {selectedDate
                                            ? formatDate(selectedDate.Date)
                                            : "Select Date"}
                                    </span>
                                    <span>▼</span>
                                </button>
                                {dropdownOpen.date && (
                                    <div className="dropdown-content">
                                        {sessions.map((session) => (
                                            <div
                                                key={session.SessionID}
                                                className="dropdown-item"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDate(session);
                                                    setDropdownOpen((prev) => ({
                                                        ...prev,
                                                        date: false,
                                                    }));
                                                }}
                                            >
                                                {formatDate(session.Date)} - {session.Start} to{" "}
                                                {session.End}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Export */}
                            <button
                                className="export-button"
                                onClick={exportToExcel}
                                disabled={!attendanceData.length}
                            >
                                Export Attendance as Excel
                            </button>
                        </div>

                        {/* Processed Video Section */}
                        {selectedDate && (
                            <div
                                className="video-section"
                                style={{ marginTop: "20px", marginBottom: "20px" }}
                            >
                                <h2 className="preview-title">Session Video</h2>
                                {processedVideoUrl ? (
                                    <div
                                        className="video-container"
                                        style={{
                                            maxWidth: "800px",
                                            margin: "0 auto",
                                        }}
                                    >
                                        <video
                                            controls
                                            preload="metadata"
                                            style={{
                                                width: "100%",
                                                maxHeight: "500px",
                                                borderRadius: "8px",
                                                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                                                backgroundColor: "#000",
                                            }}
                                            onError={(e) => {
                                                console.error("Video load error:", e);
                                                setVideoError(
                                                    "Failed to load video. The video format may not be supported by your browser."
                                                );
                                            }}
                                        >
                                            <source
                                                src={`http://localhost:5001${processedVideoUrl}`}
                                                type="video/mp4"
                                            />
                                            Your browser does not support the video tag.
                                        </video>
                                        <p
                                            style={{
                                                textAlign: "center",
                                                marginTop: "10px",
                                                color: "#666",
                                            }}
                                        >
                                            Processed video for Session {selectedDate.SessionID}
                                        </p>
                                        <p
                                            style={{
                                                textAlign: "center",
                                                fontSize: "12px",
                                                color: "#999",
                                            }}
                                        >
                                            {processedVideoUrl}
                                        </p>
                                    </div>
                                ) : videoError ? (
                                    <div
                                        style={{
                                            textAlign: "center",
                                            padding: "20px",
                                            color: "#999",
                                        }}
                                    >
                                        <p>📹 {videoError}</p>
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            textAlign: "center",
                                            padding: "20px",
                                        }}
                                    >
                                        <p>Loading video...</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Attendance Preview */}
                        {attendanceData.length > 0 && (
                            <div className="attendance-preview">
                                <h2 className="preview-title">Attendance Preview</h2>
                                <div className="attendance-table">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Student Id</th>
                                                <th>Name</th>
                                                <th>
                                                    {selectedDate
                                                        ? formatDate(selectedDate.Date)
                                                        : "Date"}
                                                </th>
                                                <th>ALS</th>
                                                <th>More</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendanceData.map((student) => {
                                                const alsScore = Number(student.ActivePoint ?? 0);
                                                const detail = activeDetails[student.StudentID];
                                                const isExpanded =
                                                    expandedStudentId === student.StudentID;

                                                return (
                                                    <React.Fragment key={student.StudentID}>
                                                        <tr>
                                                            <td>{student.RegistrationID}</td>
                                                            <td>{student.Name}</td>
                                                            <td>
                                                                <span
                                                                    className={getAttendanceBadgeClass(
                                                                        student.Attendance
                                                                    )}
                                                                >
                                                                    {student.Attendance}
                                                                </span>
                                                            </td>
                                                            <td>{alsScore}</td>
                                                            <td>
                                                                <button
                                                                    className="more-info-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isExpanded) {
                                                                            setExpandedStudentId(
                                                                                null
                                                                            );
                                                                        } else {
                                                                            setExpandedStudentId(
                                                                                student.StudentID
                                                                            );
                                                                            if (
                                                                                typeof detail ===
                                                                                    "undefined" &&
                                                                                !detailsLoading
                                                                            ) {
                                                                                fetchActiveDetail(
                                                                                    student.StudentID,
                                                                                    student.RegistrationID
                                                                                );
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    {isExpanded
                                                                        ? "Hide"
                                                                        : "More information"}
                                                                </button>
                                                            </td>
                                                        </tr>

                                                        {/* Details row */}
                                                        {isExpanded && (
                                                            <tr className="details-row">
                                                                <td colSpan={5}>
                                                                    {detailsLoading &&
                                                                    typeof detail ===
                                                                        "undefined" ? (
                                                                        <div>
                                                                            Loading active details...
                                                                        </div>
                                                                    ) : detail === null ? (
                                                                        <div>
                                                                            No active-learning
                                                                            data for this student.
                                                                        </div>
                                                                    ) : detail ? (
                                                                        <div className="active-details">
                                                                            <div className="als-summary">
                                                                                <span>
                                                                                    <strong>
                                                                                        ALS score:
                                                                                    </strong>{" "}
                                                                                    {alsScore}
                                                                                </span>
                                                                                {typeof detail.total_labeled_seconds ===
                                                                                    "number" && (
                                                                                    <div>
                                                                                        <strong>
                                                                                            Total
                                                                                            labeled
                                                                                            time:
                                                                                        </strong>{" "}
                                                                                        {Number(
                                                                                            detail.total_labeled_seconds
                                                                                        ).toFixed(
                                                                                            1
                                                                                        )}
                                                                                        s
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <div className="behavior-grid">
                                                                                {renderBehaviorTime(
                                                                                    "Upright",
                                                                                    "upright",
                                                                                    detail.upright_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Reading",
                                                                                    "reading",
                                                                                    detail.reading_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Writing",
                                                                                    "writing",
                                                                                    detail.writing_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Hand-raising",
                                                                                    "hand-raising",
                                                                                    detail.hand_raising_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Raise head",
                                                                                    "raise_head",
                                                                                    detail.raise_head_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Turn head",
                                                                                    "turn_head",
                                                                                    detail.turn_head_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Book",
                                                                                    "book",
                                                                                    detail.book_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Phone",
                                                                                    "phone",
                                                                                    detail.phone_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Using phone",
                                                                                    "Using_phone",
                                                                                    detail.using_phone_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Sleep",
                                                                                    "sleep",
                                                                                    detail.sleep_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Bend",
                                                                                    "bend",
                                                                                    detail.bend_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                                {renderBehaviorTime(
                                                                                    "Bow head",
                                                                                    "bow_head",
                                                                                    detail.bow_head_seconds,
                                                                                    detail.total_labeled_seconds
                                                                                )}
                                                                            </div>

                                                                            {/* Violation Videos Section */}
                                                                            {renderViolationSection(
                                                                                student.StudentID
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div>
                                                                            No active-learning data
                                                                            for this student.
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="loading">Loading attendance data...</div>
                        )}

                        {!loading && selectedDate && attendanceData.length === 0 && (
                            <div className="no-data">
                                No attendance data found for the selected date.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <Footer />
        </div>
    );
}

export default ViewAttendance;
