import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import StudentSidebar from "../../../components/StudentSidebar/StudentSidebar";
import Footer from "../../../components/Footer/Footer";
import "./Attendance.css";

// Giống BEHAVIOR_WEIGHTS bên Python
const BEHAVIOR_WEIGHTS = {
  "hand-raising": 2.0,
  writing: 1.5,
  reading: 1.0,
  upright: 0.5,
  raise_head: 0.3,
  turn_head: 0.0,
  book: 0.0,
  bow_head: -0.2,
  bend: -0.5,
  phone: -2.0,
  Using_phone: -2.0,
  sleep: -3.0,
};

function Attendance() {
  const { user, logout } = useAuth();
  const [units, setUnits] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState({
    unit: false,
    date: false,
  });

  // More information (per session)
  const [expandedSessionId, setExpandedSessionId] = useState(null); // SessionID đang mở
  const [activeDetails, setActiveDetails] = useState({}); // { [SessionID]: detailObject | null }
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Violation videos (per session cho student đang login)
  const [violationVideos, setViolationVideos] = useState({}); // { [SessionID]: videos[] }
  const [violationLoading, setViolationLoading] = useState(false);

  // Fetch attendance data on mount to get unique units
  useEffect(() => {
    if (user?.StudentID) {
      fetchAllAttendance();
    }
  }, [user]);

  // Fetch sessions when unit selected
  useEffect(() => {
    if (selectedUnit && user?.StudentID) {
      fetchSessions(selectedUnit.UnitID);
      setSelectedDate("");
      setAttendanceData([]);
      setExpandedSessionId(null);
      setActiveDetails({});
      setViolationVideos({});
    }
  }, [selectedUnit, user]);

  // Fetch specific attendance when date selected
  useEffect(() => {
    if (selectedDate && selectedUnit) {
      fetchAttendanceForSession(selectedUnit.UnitID, selectedDate.SessionID);
    }
  }, [selectedDate, selectedUnit]);

  const fetchAllAttendance = async () => {
    try {
      const response = await fetch(
        `http://localhost/project B/projectB-backend/Student/getAttendance.php?studentId=${
          user.StudentID
        }`
      );
      const data = await response.json();
      if (data.success) {
        // Extract unique units
        const uniqueUnits = [];
        const unitMap = new Map();
        data.data.forEach((record) => {
          if (!unitMap.has(record.UnitID)) {
            unitMap.set(record.UnitID, {
              UnitID: record.UnitID,
              UnitCode: record.UnitCode,
              UnitName: record.UnitName,
            });
            uniqueUnits.push(unitMap.get(record.UnitID));
          }
        });
        setUnits(uniqueUnits);
      } else {
        setError("Failed to fetch attendance data");
      }
    } catch {
      setError("Error fetching attendance data");
    }
  };

  const fetchSessions = async (unitId) => {
    try {
      const response = await fetch(
        `http://localhost/project B/projectB-backend/Student/getSessions.php?unitId=${unitId}&studentId=${user.StudentID}`
      );
      const data = await response.json();
      if (data.success) {
        setSessions(data.data);
        setError("");
      } else {
        setError(data.error || "Failed to fetch sessions");
      }
    } catch (err) {
      setError("Error fetching sessions: " + err.message);
      console.error("Fetch sessions error:", err);
    }
  };

  const fetchAttendanceForSession = async (unitId, sessionId) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost/project B/projectB-backend/Student/getAttendance.php?studentId=${user.StudentID}`
      );
      const data = await response.json();
      if (data.success) {
        const filtered = data.data.filter(
          (record) => record.UnitID === unitId && record.SessionID === sessionId
        );
        setAttendanceData(filtered);
      } else {
        setError("Failed to fetch attendance data");
      }
    } catch {
      setError("Error fetching attendance data");
    } finally {
      setLoading(false);
    }
  };

  // Lấy chi tiết active cho 1 session (của chính student này)
  const fetchActiveDetail = async (sessionId) => {
    if (!user?.StudentID) return;
    setDetailsLoading(true);
    try {
      const response = await fetch(
        `http://localhost/project B/projectB-backend/Student/getStudentActiveDetail.php?sessionId=${encodeURIComponent(
          sessionId
        )}&studentId=${encodeURIComponent(user.StudentID)}`
      );
      const data = await response.json();
      if (data.success) {
        setActiveDetails((prev) => ({
          ...prev,
          [sessionId]: data.data ?? null,
        }));
      } else {
        setActiveDetails((prev) => ({
          ...prev,
          [sessionId]: null,
        }));
      }
    } catch (e) {
      console.error("Error fetching active detail:", e);
      setError("Error fetching active detail");
      setActiveDetails((prev) => ({
        ...prev,
        [sessionId]: null,
      }));
    } finally {
      setDetailsLoading(false);
    }
  };

  // Lấy violation videos cho 1 session (dựa vào RegistrationID vì AI dùng ID đó)
  const fetchViolationVideos = async (sessionId, rawIdFromRecord) => {
    if (!sessionId) return;

    // Ưu tiên ID theo thứ tự: RegistrationID (record) -> RegistrationID (user) -> StudentID (user) -> StudentID (record)
    const bestId =
      rawIdFromRecord ||
      user?.RegistrationID ||
      user?.StudentID ||
      null;

    console.log("[Student] fetchViolationVideos - sessionId:", sessionId);
    console.log("[Student] bestId (studentId gửi lên Flask):", bestId);

    if (!bestId) {
      console.warn("[Student] Không có ID hợp lệ để query violation videos");
      setViolationVideos((prev) => ({
        ...prev,
        [sessionId]: [],
      }));
      return;
    }

    setViolationLoading(true);
    try {
      const url = `http://localhost:5001/api/get-violation-videos?sessionId=${encodeURIComponent(
        sessionId
      )}&studentId=${encodeURIComponent(bestId)}`;
      console.log("[Student] Fetching violation videos URL:", url);

      const response = await fetch(url);
      const data = await response.json();
      console.log("[Student] Violation videos response:", data);

      if (data.success) {
        setViolationVideos((prev) => ({
          ...prev,
          [sessionId]: data.videos || [],
        }));
      } else {
        setViolationVideos((prev) => ({
          ...prev,
          [sessionId]: [],
        }));
        console.warn("[Student] No violation videos:", data.error);
      }
    } catch (e) {
      console.error("[Student] Error fetching violation videos:", e);
      setViolationVideos((prev) => ({
        ...prev,
        [sessionId]: [],
      }));
    } finally {
      setViolationLoading(false);
    }
  };

  const toggleDropdown = (dropdown) => {
    setDropdownOpen((prev) => ({ ...prev, [dropdown]: !prev[dropdown] }));
  };

  const closeAllDropdowns = () => {
    setDropdownOpen({ unit: false, date: false });
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
    return date.toLocaleDateString("en-GB"); // DD/MM/YYYY format
  };

  // Helper: render 1 behavior với màu theo đóng góp (+ xanh, - đỏ)
  const renderBehaviorTime = (label, key, seconds, totalSec) => {
    const sec = Number(seconds ?? 0);
    if (!sec) return null; // 0s thì không hiển thị

    const total = Number(totalSec ?? 0);
    const w = BEHAVIOR_WEIGHTS[key] ?? 0;

    let contribution = 0;
    if (total > 0) {
      const proportion = sec / total;
      contribution = w * proportion;
    }

    let extraClass = "";
    const eps = 1e-6;
    if (contribution > eps) extraClass = " positive";
    else if (contribution < -eps) extraClass = " negative";

    return (
      <div className={`behavior-item${extraClass}`} key={label}>
        <span className="behavior-label">{label}</span>
        <span className="behavior-value">{sec.toFixed(1)}s</span>
      </div>
    );
  };

  return (
    <div className="view-attendance-container" onClick={closeAllDropdowns}>
      {/* Navbar */}
      <Navbar user={user} />

      {/* Main Layout */}
      <div className="main-layout">
        <StudentSidebar activePage="attendance" onLogout={logout} />

        {/* Main Content */}
        <div className="main-content">
          <div className="content-area">
            <h1 className="page-title">My Attendance</h1>
            <p className="page-subtitle">
              Select unit and date to view your attendance record
            </p>

            {error && <div className="error">{error}</div>}

            {/* Controls Section */}
            <div className="controls-section">
              {/* Unit Dropdown */}
              <div className="dropdown">
                <button
                  className="dropdown-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown("unit");
                  }}
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

              {/* Date Dropdown */}
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
                    {selectedDate ? formatDate(selectedDate.Date) : "Select Date"}
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
            </div>

            {/* Attendance Preview */}
            {attendanceData.length > 0 && (
              <div className="attendance-preview">
                <h2 className="preview-title">Your Attendance Record</h2>
                <div className="attendance-table">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Unit Code</th>
                        <th>Unit Name</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Attendance</th>
                        <th>ALS</th>
                        <th>More</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.map((record, index) => {
                        const alsScore = Number(record.ActivePoint ?? 0);
                        const detail = activeDetails[record.SessionID];
                        const isExpanded =
                          expandedSessionId === record.SessionID;
                        const sessionVideos =
                          violationVideos[record.SessionID] || [];

                        return (
                          <React.Fragment key={index}>
                            <tr>
                              <td>{record.UnitCode}</td>
                              <td>{record.UnitName}</td>
                              <td>{formatDate(record.Date)}</td>
                              <td>
                                {record.Start} - {record.End}
                              </td>
                              <td>
                                <span
                                  className={getAttendanceBadgeClass(
                                    record.Attendance
                                  )}
                                >
                                  {record.Attendance || "Unknown"}
                                </span>
                              </td>
                              <td>{alsScore}</td>
                              <td>
                                <button
                                  className="more-info-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isExpanded) {
                                      setExpandedSessionId(null);
                                    } else {
                                      setExpandedSessionId(record.SessionID);

                                      if (
                                        typeof detail === "undefined" &&
                                        !detailsLoading
                                      ) {
                                        fetchActiveDetail(record.SessionID);
                                      }

                                      // ID thô lấy từ record (nếu có)
                                      const rawReg =
                                        record.RegistrationID ||
                                        record.student_id ||
                                        null;

                                      if (
                                        !violationVideos[record.SessionID]
                                      ) {
                                        fetchViolationVideos(
                                          record.SessionID,
                                          rawReg
                                        );
                                      }
                                    }
                                  }}
                                >
                                  {isExpanded ? "Hide" : "More information"}
                                </button>
                              </td>
                            </tr>

                            {/* Details row */}
                            {isExpanded && (
                              <tr className="details-row">
                                <td colSpan={7}>
                                  {detailsLoading &&
                                  typeof detail === "undefined" ? (
                                    <div>Loading active details...</div>
                                  ) : detail === null ? (
                                    <div>
                                      No active-learning data for this session.
                                    </div>
                                  ) : detail ? (
                                    <div className="active-details">
                                      <div className="als-summary">
                                        <span>
                                          <strong>ALS score:</strong>{" "}
                                          {alsScore}
                                        </span>
                                        {typeof detail.total_labeled_seconds ===
                                          "number" && (
                                          <div>
                                            <strong>Total labeled time:</strong>{" "}
                                            {Number(
                                              detail.total_labeled_seconds
                                            ).toFixed(1)}
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

                                      {/* Violation Videos */}
                                      <div
                                        style={{
                                          marginTop: "20px",
                                          paddingTop: "20px",
                                          borderTop: "1px solid #ddd",
                                        }}
                                      >
                                        {violationLoading &&
                                        !sessionVideos.length ? (
                                          <div>
                                            Loading violation videos...
                                          </div>
                                        ) : sessionVideos.length > 0 ? (
                                          <>
                                            <h4>Violation Videos</h4>
                                            <div
                                              style={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                  "repeat(auto-fill, minmax(260px, 1fr))",
                                                gap: "15px",
                                                marginTop: "10px",
                                              }}
                                            >
                                              {sessionVideos.map(
                                                (video, idx) => (
                                                  <div
                                                    key={idx}
                                                    style={{
                                                      border:
                                                        "1px solid #ddd",
                                                      borderRadius: "8px",
                                                      padding: "10px",
                                                      backgroundColor:
                                                        "#f9f9f9",
                                                    }}
                                                  >
                                                    <h5
                                                      style={{
                                                        margin: "0 0 8px 0",
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
                                                        backgroundColor:
                                                          "#000",
                                                      }}
                                                    >
                                                      <source
                                                        src={`http://localhost:5001${video.url}`}
                                                        type="video/mp4"
                                                      />
                                                      Your browser does not
                                                      support the video tag.
                                                    </video>
                                                    {video.size && (
                                                      <p
                                                        style={{
                                                          fontSize: "11px",
                                                          color: "#666",
                                                          margin:
                                                            "5px 0 0 0",
                                                        }}
                                                      >
                                                        {(
                                                          video.size /
                                                          1024 /
                                                          1024
                                                        ).toFixed(2)}{" "}
                                                        MB
                                                      </p>
                                                    )}
                                                  </div>
                                                )
                                              )}
                                            </div>
                                          </>
                                        ) : (
                                          <div>
                                            No violation videos for this
                                            session.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div>No data loaded.</div>
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
                No attendance record found for the selected date.
              </div>
            )}

            {!selectedUnit && !loading && (
              <div className="no-data">
                Please select a unit to view your attendance records.
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

export default Attendance;
