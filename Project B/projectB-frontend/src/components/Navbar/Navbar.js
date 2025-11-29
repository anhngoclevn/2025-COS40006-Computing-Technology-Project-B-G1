import React from "react";
import "./Navbar.css";
import logoSwin from "../../assets/images/SwinMonitor.png"; 

function Navbar({ user }) {
  return (
    <nav className="navbar">
      {/* Left side */}
      <div className="navbar-left">
        <button className="menu-btn">☰</button>
        <img src={logoSwin} alt="Swinburne logo" className="navbar-logo" />
      </div>

      {/* Right side */}
      <div className="navbar-right">
        <span className="navbar-username">@{user?.FirstName || "Name"}</span>
        <div className="navbar-avatar">👤</div>
      </div>
    </nav>
  );
}

export default Navbar;
