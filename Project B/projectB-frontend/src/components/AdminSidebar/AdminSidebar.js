import React from "react";
import { useNavigate } from "react-router-dom";
import "./AdminSidebar.css";

function AdminSidebar({ activePage, onLogout }) {
    const navigate = useNavigate();

    const handleNavigation = (path) => {
        console.log("Navigating to:", path);
        navigate(path);
    };

    const handleLogout = () => {
        const confirmLogout = window.confirm("Are you sure you want to logout?");

        if (confirmLogout) {
            console.log("Admin logging out...");
            if (onLogout) {
                onLogout();
            }
            navigate("/login");
        }
    };

    return (
        <div className="admin-sidebar">
            <div className="nav-menu">
                <div
                    className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
                    onClick={() => handleNavigation("/admin/dashboard")}
                >
                    <span className="nav-icon">📊</span> Dashboard
                </div>
                <div
                    className={`nav-item ${activePage === "manage-lecturers" ? "active" : ""}`}
                    onClick={() => handleNavigation("/admin/manage-lecturers")}
                >
                    <span className="nav-icon">👨‍🏫</span> Manage Lecturers
                </div>
                <div
                    className={`nav-item ${activePage === "manage-students" ? "active" : ""}`}
                    onClick={() => handleNavigation("/admin/manage-students")}
                >
                    <span className="nav-icon">👥</span> Manage Students
                </div>
                <div
                    className={`nav-item ${activePage === "manage-courses" ? "active" : ""}`}
                    onClick={() => handleNavigation("/admin/manage-courses")}
                >
                    <span className="nav-icon">📚</span> Manage Courses
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

export default AdminSidebar;