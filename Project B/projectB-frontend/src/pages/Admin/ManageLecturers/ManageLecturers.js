import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import AdminSidebar from "../../../components/AdminSidebar/AdminSidebar";
import Footer from "../../../components/Footer/Footer";
import "./ManageLecturers.css";

function ManageLecturers() {
    const { user, logout } = useAuth();
    const [lecturers, setLecturers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingLecturer, setEditingLecturer] = useState(null);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        courseID: "",
        password: ""
    });
    const [courses, setCourses] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    useEffect(() => {
        fetchLecturers();
        fetchCourses();
    }, []);

    const fetchLecturers = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageLecturers/getLecturers.php"
            );
            const data = await response.json();

            if (data.success) {
                setLecturers(data.data);
            } else {
                setError("Failed to load lecturers");
            }
        } catch (err) {
            setError("Error loading lecturers");
            console.error("Lecturers error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCourses = async () => {
        try {
            const response = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageLecturers/getCourses_lecturer.php"
            );
            const data = await response.json();
            if (data.success) {
                setCourses(data.data);
            }
        } catch (err) {
            console.error("Error loading courses:", err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const url = editingLecturer
                ? "http://localhost/project%20B/projectB-backend/Admin/ManageLecturers/updateLecturer.php"
                : "http://localhost/project%20B/projectB-backend/Admin/ManageLecturers/addLecturer.php";

            const submitData = editingLecturer
                ? { ...formData, userID: editingLecturer.UserID }
                : formData;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(submitData),
            });

            const data = await response.json();

            if (data.success) {
                setSuccessMessage(editingLecturer ? "Lecturer updated successfully!" : "Lecturer added successfully!");
                setShowModal(false);
                setFormData({
                    firstName: "",
                    lastName: "",
                    email: "",
                    courseID: "",
                    password: ""
                });
                setEditingLecturer(null);
                fetchLecturers();

                setTimeout(() => setSuccessMessage(""), 3000);
            } else {
                setError(data.message || "Failed to save lecturer");
            }
        } catch (err) {
            setError("Error saving lecturer");
            console.error("Save error:", err);
        }
    };

    const handleEdit = (lecturer) => {
        setEditingLecturer(lecturer);
        setFormData({
            firstName: lecturer.FirstName,
            lastName: lecturer.LastName,
            email: lecturer.Email,
            courseID: lecturer.CourseID || "",
            password: ""
        });
        setShowModal(true);
    };

    const handleDelete = async (userID) => {
        if (!window.confirm("Are you sure you want to delete this lecturer?")) {
            return;
        }

        try {
            const response = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageLecturers/deleteLecturer.php",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ userID }),
                }
            );

            const data = await response.json();

            if (data.success) {
                setSuccessMessage("Lecturer deleted successfully!");
                fetchLecturers();
                setTimeout(() => setSuccessMessage(""), 3000);
            } else {
                setError(data.message || "Failed to delete lecturer");
            }
        } catch (err) {
            setError("Error deleting lecturer");
            console.error("Delete error:", err);
        }
    };

    const handleAddNew = () => {
        setEditingLecturer(null);
        setFormData({
            firstName: "",
            lastName: "",
            email: "",
            courseID: "",
            password: ""
        });
        setShowModal(true);
        setError("");
    };

    const filteredLecturers = lecturers.filter(lecturer =>
        lecturer.FirstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lecturer.LastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lecturer.Email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lecturer.CourseName && lecturer.CourseName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    if (loading) {
        return (
            <div className="dashboard-container">
                <Navbar user={user} />
                <div className="main-layout">
                    <AdminSidebar activePage="manage-lecturers" onLogout={logout} />
                    <div className="main-content">
                        <div className="loading">Loading lecturers...</div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <Navbar user={user} />

            <div className="main-layout">
                <AdminSidebar activePage="manage-lecturers" onLogout={logout} />

                <div className="main-content">
                    <div className="content-area">
                        <div className="page-header">
                            <div>
                                <h1 className="page-title">Manage Lecturers</h1>
                                <p className="page-subtitle">
                                    Add, edit, or remove lecturers from the system
                                </p>
                            </div>
                            <button className="btn-primary" onClick={handleAddNew}>
                                + Add New Lecturer
                            </button>
                        </div>

                        {error && <div className="error">{error}</div>}
                        {successMessage && <div className="success">{successMessage}</div>}

                        {/* Stats Cards */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <span className="stat-title">Total Lecturers</span>
                                    <span className="stat-icon">👨‍🏫</span>
                                </div>
                                <div className="stat-number">{lecturers.length}</div>
                                <div className="stat-change">Active lecturers</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <span className="stat-title">Courses</span>
                                    <span className="stat-icon">📚</span>
                                </div>
                                <div className="stat-number">{courses.length}</div>
                                <div className="stat-change">Available courses</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <span className="stat-title">This Month</span>
                                    <span className="stat-icon">📅</span>
                                </div>
                                <div className="stat-number">
                                    {lecturers.length > 0 ? lecturers.length : 0}
                                </div>
                                <div className="stat-change">Total records</div>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="search-section">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search by name, email, or course..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Lecturers Table */}
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Course</th>
                                        <th>User ID</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLecturers.map((lecturer) => (
                                        <tr key={lecturer.UserID}>
                                            <td>
                                                <div className="user-info">
                                                    <div className="user-avatar">
                                                        {lecturer.FirstName[0]}{lecturer.LastName[0]}
                                                    </div>
                                                    <div>
                                                        <div className="user-name">
                                                            {lecturer.FirstName} {lecturer.LastName}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{lecturer.Email}</td>
                                            <td>
                                                <span className="faculty-badge">
                                                    {lecturer.CourseName || 'No Course'}
                                                </span>
                                            </td>
                                            <td>#{lecturer.UserID}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-edit"
                                                        onClick={() => handleEdit(lecturer)}
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="btn-delete"
                                                        onClick={() => handleDelete(lecturer.UserID)}
                                                        title="Delete"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {filteredLecturers.length === 0 && (
                                <div className="no-data">
                                    No lecturers found matching your search.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Footer />

            {/* Modal for Add/Edit */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingLecturer ? "Edit Lecturer" : "Add New Lecturer"}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>First Name *</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Last Name *</label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Course *</label>
                                    <select
                                        name="courseID"
                                        value={formData.courseID}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map((course) => (
                                            <option key={course.CourseID} value={course.CourseID}>
                                                {course.CourseName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>
                                        Password {editingLecturer ? "(leave blank to keep current)" : "*"}
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        required={!editingLecturer}
                                        minLength="3"
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingLecturer ? "Update" : "Add"} Lecturer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManageLecturers;

