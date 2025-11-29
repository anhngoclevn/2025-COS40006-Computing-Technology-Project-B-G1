import React from "react";
import { useNavigate } from "react-router-dom";
import "./StudentSidebar.css";

function StudentSidebar({ activePage, onLogout }) {
    const navigate = useNavigate();

    const handleNavigation = (path) => {
        console.log("Navigating to:", path);
        navigate(path);
    };

    const handleLogout = () => {
        const confirmLogout = window.confirm("Are you sure you want to logout?");
        if (confirmLogout) {
            console.log("Student logging out...");
            if (onLogout) {
                onLogout();
            }
            navigate("/login");
        }
    };

    return (
        <div className="student-sidebar">
            <div className="nav-menu">
                <div
                    className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
                    onClick={() => handleNavigation("/student/dashboard")}
                >
                    <span className="nav-icon">📊</span> Dashboard
                </div>
                <div
                    className={`nav-item ${activePage === "attendance" ? "active" : ""}`}
                    onClick={() => handleNavigation("/student/attendance")}
                >
                    <span className="nav-icon">📋</span> My Attendance
                </div>
                <div
                    className={`nav-item ${activePage === "query" ? "active" : ""}`}
                    onClick={() => handleNavigation("/student/query")}
                >
                    <span className="nav-icon">💬</span> Query
                </div>
            </div>

            <div className="logout-section">
                <button className="nav-item" onClick={handleLogout}>
                    <span className="nav-icon">🚪</span> Logout
                </button>
            </div>
        </div>
    );
}

export default StudentSidebar;
