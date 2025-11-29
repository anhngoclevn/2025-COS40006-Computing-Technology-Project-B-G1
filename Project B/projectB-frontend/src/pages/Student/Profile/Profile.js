import React from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import StudentSidebar from "../../../components/StudentSidebar/StudentSidebar";
import Footer from "../../../components/Footer/Footer";
import "./Profile.css";

function Profile() {
    const { user, logout } = useAuth();

    return (
        <div className="student-profile-page">
            <Navbar user={user} />
            <StudentSidebar activePage="profile" onLogout={logout} />

            <div className="student-main-content">
                <div className="student-container">
                    <div className="student-header">
                        <h1>My Profile</h1>
                        <p className="subtitle">View and manage your profile</p>
                    </div>

                    <div className="profile-card">
                        <div className="profile-section">
                            <h3>Personal Information</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>Registration ID:</label>
                                    <p>{user?.RegistrationID || "N/A"}</p>
                                </div>
                                <div className="info-item">
                                    <label>First Name:</label>
                                    <p>{user?.FirstName || "N/A"}</p>
                                </div>
                                <div className="info-item">
                                    <label>Last Name:</label>
                                    <p>{user?.LastName || "N/A"}</p>
                                </div>
                                <div className="info-item">
                                    <label>Email:</label>
                                    <p>{user?.Email || "N/A"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        </div>
    );
}

export default Profile;
