import React from "react";
import { useNavigate } from "react-router-dom";
import "./Sidebar.css";

function Sidebar({ activePage, onLogout }) {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    console.log("Navigating to:", path);
    navigate(path);
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");
    if (confirmLogout) {
      console.log("Logging out...");
      if (onLogout) {
        onLogout();
      }
      navigate("/login");
    }
  };

  return (
    <div className="sidebar">
      <div className="nav-menu">
        <div
          className={`nav-item ${activePage === "take" ? "active" : ""}`}
          onClick={() => handleNavigation("/lecturer/take-attendance")}
        >
          <span className="nav-icon">📊</span> Take Attendance
        </div>

        <div
          className={`nav-item ${activePage === "view" ? "active" : ""}`}
          onClick={() => handleNavigation("/lecturer/view-attendance")}
        >
          <span className="nav-icon">👁️</span> View Attendance
        </div>

        <div
          className={`nav-item ${activePage === "queries" ? "active" : ""}`}
          onClick={() => handleNavigation("/lecturer/queries")}
        >
          <span className="nav-icon">💬</span> Student Queries
        </div>

        <div
          className={`nav-item ${activePage === "students" ? "active" : ""}`}
          onClick={() => handleNavigation("/lecturer/students")}
        >
          <span className="nav-icon">👥</span> Students
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

export default Sidebar;
