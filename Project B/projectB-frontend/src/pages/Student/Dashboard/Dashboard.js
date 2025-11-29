import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import StudentSidebar from "../../../components/StudentSidebar/StudentSidebar";
import Footer from "../../../components/Footer/Footer";
import "./Dashboard.css";

function Dashboard() {
  const { user, logout } = useAuth();

  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    totalSessions: 0,
    attended: 0,
    absent: 0,
    attendanceRate: 0,
  });

  useEffect(() => {
    if (user) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError("");

      // StudentID là chính, fallback UserID nếu cần
      const sid = user?.StudentID || user?.UserID;

      const response = await fetch(
        `http://localhost/project B/projectB-backend/Student/getAttendance.php?studentId=${encodeURIComponent(
          sid
        )}`
      );
      const data = await response.json();

      if (data.success) {
        const arr = data.data || [];
        setAttendanceData(arr);
        calculateStats(arr);
      } else {
        setError(data.error || "Failed to fetch attendance data");
      }
    } catch (err) {
      console.error(err);
      setError("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  const normalizeStatus = (item) => {
    // Ưu tiên Attendance, fallback Status
    const raw = item.Attendance ?? item.Status ?? "";
    return String(raw).toLowerCase();
  };

  const calculateStats = (data) => {
    const total = data.length;

    const attended = data.filter((item) => {
      const s = normalizeStatus(item);
      return s === "present" || s === "late";
    }).length;

    const absent = data.filter((item) => {
      const s = normalizeStatus(item);
      return s === "absent";
    }).length;

    const rate = total > 0 ? ((attended / total) * 100).toFixed(1) : 0;

    setStats({
      totalSessions: total,
      attended,
      absent,
      attendanceRate: rate,
    });
  };

  const getStatusBadge = (status) => {
    const key = String(status || "").toLowerCase();

    const badges = {
      present: { text: "Present", class: "status-present" },
      absent: { text: "Absent", class: "status-absent" },
      late: { text: "Late", class: "status-late" },
      excused: { text: "Excused", class: "status-excused" },
      unknown: { text: "Unknown", class: "status-unknown" },
    };

    return badges[key] || badges.unknown;
  };

  return (
    <div className="student-dashboard-page">
      <Navbar user={user} />
      <StudentSidebar activePage="dashboard" onLogout={logout} />

      <div className="student-main-content">
        <div className="student-container">
          {/* Header */}
          <div className="student-header">
            <h1>Student Dashboard</h1>
            <p className="welcome-text">
              Welcome back, <strong>{user?.FirstName || "Student"}</strong>!
            </p>
          </div>

          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card stat-total">
              <div className="stat-icon">📚</div>
              <div className="stat-info">
                <h3>{stats.totalSessions}</h3>
                <p>Total Sessions</p>
              </div>
            </div>

            <div className="stat-card stat-attended">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <h3>{stats.attended}</h3>
                <p>Attended</p>
              </div>
            </div>

            <div className="stat-card stat-absent">
              <div className="stat-icon">❌</div>
              <div className="stat-info">
                <h3>{stats.absent}</h3>
                <p>Absent</p>
              </div>
            </div>

            <div className="stat-card stat-rate">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <h3>{stats.attendanceRate}%</h3>
                <p>Attendance Rate</p>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="attendance-section">
            <h2>My Attendance Records</h2>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading attendance data...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p className="error-message">⚠️ {error}</p>
                <button onClick={fetchAttendanceData} className="retry-btn">
                  Retry
                </button>
              </div>
            ) : attendanceData.length === 0 ? (
              <div className="empty-state">
                <p>📭 No attendance records found</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th>Unit Code</th>
                      <th>Unit Name</th>
                      <th>Session Date</th>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Active Point</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map((record, index) => {
                      const statusKey = normalizeStatus(record);
                      const badge = getStatusBadge(statusKey);

                      return (
                        <tr key={index}>
                          <td className="unit-code">{record.UnitCode}</td>
                          <td>{record.UnitName}</td>
                          <td>{record.Date}</td>
                          <td>
                            {record.Start} - {record.End}
                          </td>
                          <td>
                            <span className={`status-badge ${badge.class}`}>
                              {badge.text}
                            </span>
                          </td>
                          <td className="active-point">
                            {record.ActivePoint || 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}

export default Dashboard;
