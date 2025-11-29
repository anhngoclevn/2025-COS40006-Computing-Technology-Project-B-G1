import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import AdminSidebar from "../../../components/AdminSidebar/AdminSidebar";
import Footer from "../../../components/Footer/Footer";
import "./Dashboard.css";

function Dashboard() {
    const { user, logout } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/Dashboard/getDashboardStats.php"
            );
            const data = await response.json();

            if (data.success) {
                setDashboardData(data.data);
            } else {
                setError("Failed to load dashboard data");
            }
        } catch (err) {
            setError("Error loading dashboard data");
            console.error("Dashboard error:", err);
        } finally {
            setLoading(false);
        }
    };

    const getAttendancePercentage = (status, stats) => {
        if (!stats) return 0;
        const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
        return total > 0 ? ((stats[status] || 0) / total) * 100 : 0;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    if (loading) {
        return (
            <div className="dashboard-container">
                <Navbar user={user} />
                <div className="main-layout">
                    <AdminSidebar activePage="dashboard" onLogout={logout} />
                    <div className="main-content">
                        <div className="loading">Loading dashboard...</div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            {/* Navbar */}
            <Navbar user={user} />

            {/* Main Layout */}
            <div className="main-layout">
                <AdminSidebar activePage="dashboard" onLogout={logout} />

                {/* Main Content */}
                <div className="main-content">
                    <div className="content-area">
                        <h1 className="page-title">Admin Dashboard</h1>
                        <p className="page-subtitle">
                            Overview of system statistics and recent activity
                        </p>

                        {error && <div className="error">{error}</div>}

                        {dashboardData && (
                            <>
                                {/* Stats Cards */}
                                <div className="stats-grid">
                                    <div className="stat-card">
                                        <div className="stat-card-header">
                                            <span className="stat-title">Total Students</span>
                                            <span className="stat-icon">👥</span>
                                        </div>
                                        <div className="stat-number">{dashboardData.totals.students}</div>
                                        <div className="stat-change">Active students</div>
                                    </div>

                                    <div className="stat-card">
                                        <div className="stat-card-header">
                                            <span className="stat-title">Total Lecturers</span>
                                            <span className="stat-icon">👨‍🏫</span>
                                        </div>
                                        <div className="stat-number">{dashboardData.totals.lecturers}</div>
                                        <div className="stat-change">Active lecturers</div>
                                    </div>

                                    <div className="stat-card">
                                        <div className="stat-card-header">
                                            <span className="stat-title">Total Courses</span>
                                            <span className="stat-icon">📚</span>
                                        </div>
                                        <div className="stat-number">{dashboardData.totals.courses}</div>
                                        <div className="stat-change">Available courses</div>
                                    </div>

                                    <div className="stat-card">
                                        <div className="stat-card-header">
                                            <span className="stat-title">Total Units</span>
                                            <span className="stat-icon">📖</span>
                                        </div>
                                        <div className="stat-number">{dashboardData.totals.units}</div>
                                        <div className="stat-change">Active units</div>
                                    </div>
                                </div>

                                {/* Charts Section */}
                                <div className="charts-section">
                                    {/* Attendance Statistics */}
                                    <div className="chart-card">
                                        <h3 className="chart-title">Attendance Overview</h3>
                                        <div className="attendance-chart">
                                            {Object.entries(dashboardData.attendance_stats || {}).map(([status, count]) => (
                                                <div key={status} className="attendance-bar">
                                                    <span className="attendance-label">{status}</span>
                                                    <div className="attendance-progress">
                                                        <div
                                                            className={`attendance-fill ${status}`}
                                                            style={{
                                                                width: `${getAttendancePercentage(status, dashboardData.attendance_stats)}%`
                                                            }}
                                                        ></div>
                                                    </div>
                                                    <span className="attendance-count">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Students by Course */}
                                    <div className="chart-card">
                                        <h3 className="chart-title">Students by Course</h3>
                                        <div className="course-list">
                                            {dashboardData.students_by_course?.map((course, index) => (
                                                <div key={index} className="course-item">
                                                    <span className="course-name">{course.CourseName}</span>
                                                    <span className="course-count">{course.student_count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Activity */}
                                <div className="recent-activity">
                                    <h3 className="activity-title">Recent Attendance Activity</h3>
                                    <table className="activity-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Unit</th>
                                                <th>Date</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dashboardData.recent_attendance?.map((record, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        {record.FirstName} {record.LastName}
                                                        <br />
                                                        <small style={{ color: '#666' }}>{record.RegistrationID}</small>
                                                    </td>
                                                    <td>{record.UnitCode}</td>
                                                    <td>{formatDate(record.Date)}</td>
                                                    <td>
                                                        <span className={`status-badge ${record.Status}`}>
                                                            {record.Status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <Footer />
        </div>
    );
}

export default Dashboard;