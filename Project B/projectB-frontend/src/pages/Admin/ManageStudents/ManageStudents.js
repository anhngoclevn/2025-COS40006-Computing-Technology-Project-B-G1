import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import AdminSidebar from "../../../components/AdminSidebar/AdminSidebar";
import Footer from "../../../components/Footer/Footer";
import "./ManageStudents.css";

function ManageStudents() {
    const { user, logout } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({
        registrationID: "",
        firstName: "",
        lastName: "",
        email: "",
        courseID: "",
        majorID: "",
        password: ""
    });
    const [courses, setCourses] = useState([]);
    const [majors, setMajors] = useState([]);
    const [filteredMajors, setFilteredMajors] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    useEffect(() => {
        fetchStudents();
        fetchCourses();
        fetchMajors();
    }, []);

    useEffect(() => {
        // Filter majors based on selected course
        if (formData.courseID) {
            const filtered = majors.filter(m => m.CourseID === parseInt(formData.courseID));
            setFilteredMajors(filtered);
        } else {
            setFilteredMajors([]);
        }
    }, [formData.courseID, majors]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageStudents/getStudents.php"
            );
            const data = await response.json();

            if (data.success) {
                setStudents(data.data);
            } else {
                setError("Failed to load students");
            }
        } catch (err) {
            setError("Error loading students");
            console.error("Students error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCourses = async () => {
        try {
            const response = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageStudents/getCourses.php"
            );
            const data = await response.json();
            if (data.success) {
                setCourses(data.data);
            }
        } catch (err) {
            console.error("Error loading courses:", err);
        }
    };

    const fetchMajors = async () => {
        try {
            const response = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageStudents/getMajors.php"
            );
            const data = await response.json();
            if (data.success) {
                setMajors(data.data);
            }
        } catch (err) {
            console.error("Error loading majors:", err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
            // Reset major when course changes
            ...(name === 'courseID' && { majorID: '' })
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const url = editingStudent
                ? "http://localhost/project%20B/projectB-backend/Admin/ManageStudents/updateStudent.php"
                : "http://localhost/project%20B/projectB-backend/Admin/ManageStudents/addStudent.php";

            const submitData = editingStudent
                ? { ...formData, studentID: editingStudent.StudentID }
                : {
                    ...formData,
                    password: formData.registrationID // Use Registration ID as default password for new students
                };

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(submitData),
            });

            const data = await response.json();

            if (data.success) {
                setSuccessMessage(editingStudent ? "Student updated successfully!" : "Student added successfully!");
                setShowModal(false);
                setFormData({
                    registrationID: "",
                    firstName: "",
                    lastName: "",
                    email: "",
                    courseID: "",
                    majorID: "",
                    password: ""
                });
                setEditingStudent(null);
                fetchStudents();

                setTimeout(() => setSuccessMessage(""), 3000);
            } else {
                setError(data.message || "Failed to save student");
            }
        } catch (err) {
            setError("Error saving student");
            console.error("Save error:", err);
        }
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            registrationID: student.RegistrationID,
            firstName: student.FirstName,
            lastName: student.LastName,
            email: student.Email,
            courseID: student.CourseID || "",
            majorID: student.MajorID || "",
            password: ""
        });
        setShowModal(true);
    };

    const handleDelete = async (studentID) => {
        if (!window.confirm("Are you sure you want to delete this student?")) {
            return;
        }

        try {
            const response = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageStudents/deleteStudent.php",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ studentID }),
                }
            );

            const data = await response.json();

            if (data.success) {
                setSuccessMessage("Student deleted successfully!");
                fetchStudents();
                setTimeout(() => setSuccessMessage(""), 3000);
            } else {
                setError(data.message || "Failed to delete student");
            }
        } catch (err) {
            setError("Error deleting student");
            console.error("Delete error:", err);
        }
    };

    const handleAddNew = () => {
        setEditingStudent(null);
        setFormData({
            registrationID: "",
            firstName: "",
            lastName: "",
            email: "",
            courseID: "",
            majorID: "",
            password: ""
        });
        setShowModal(true);
        setError("");
    };

    const filteredStudents = students.filter(student =>
        student.FirstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.LastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.Email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.RegistrationID.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.CourseName && student.CourseName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (student.MajorName && student.MajorName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="dashboard-container">
                <Navbar user={user} />
                <div className="main-layout">
                    <AdminSidebar activePage="manage-students" onLogout={logout} />
                    <div className="main-content">
                        <div className="loading">Loading students...</div>
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
                <AdminSidebar activePage="manage-students" onLogout={logout} />

                <div className="main-content">
                    <div className="content-area">
                        <div className="page-header">
                            <div>
                                <h1 className="page-title">Manage Students</h1>
                                <p className="page-subtitle">
                                    Add, edit, or remove students from the system
                                </p>
                            </div>
                            <button className="btn-primary" onClick={handleAddNew}>
                                + Add New Student
                            </button>
                        </div>

                        {error && <div className="error">{error}</div>}
                        {successMessage && <div className="success">{successMessage}</div>}

                        {/* Stats Cards */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <span className="stat-title">Total Students</span>
                                    <span className="stat-icon">👥</span>
                                </div>
                                <div className="stat-number">{students.length}</div>
                                <div className="stat-change">Active students</div>
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
                                    <span className="stat-title">Majors</span>
                                    <span className="stat-icon">🎓</span>
                                </div>
                                <div className="stat-number">{majors.length}</div>
                                <div className="stat-change">Available majors</div>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="search-section">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search by name, email, registration ID, course, or major..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Students Table */}
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Registration ID</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Course</th>
                                        <th>Major</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((student) => (
                                        <tr key={student.StudentID}>
                                            <td>
                                                <span className="registration-id">
                                                    {student.RegistrationID}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="user-info">
                                                    <div className="user-avatar">
                                                        {student.FirstName[0]}{student.LastName[0]}
                                                    </div>
                                                    <div>
                                                        <div className="user-name">
                                                            {student.FirstName} {student.LastName}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{student.Email}</td>
                                            <td>
                                                <span className="course-badge">
                                                    {student.CourseName || 'No Course'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="major-badge">
                                                    {student.MajorName || 'No Major'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-edit"
                                                        onClick={() => handleEdit(student)}
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="btn-delete"
                                                        onClick={() => handleDelete(student.StudentID)}
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

                            {filteredStudents.length === 0 && (
                                <div className="no-data">
                                    No students found matching your search.
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
                            <h2>{editingStudent ? "Edit Student" : "Add New Student"}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Registration ID *</label>
                                    <input
                                        type="text"
                                        name="registrationID"
                                        value={formData.registrationID}
                                        onChange={handleInputChange}
                                        required
                                        disabled={editingStudent}
                                    />
                                </div>

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
                                    <label>Major *</label>
                                    <select
                                        name="majorID"
                                        value={formData.majorID}
                                        onChange={handleInputChange}
                                        required
                                        disabled={!formData.courseID}
                                    >
                                        <option value="">Select Major</option>
                                        {filteredMajors.map((major) => (
                                            <option key={major.MajorID} value={major.MajorID}>
                                                {major.MajorName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {editingStudent && (
                                    <div className="form-group">
                                        <label>
                                            New Password (leave blank to keep current)
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            minLength="3"
                                            placeholder="Enter new password"
                                        />
                                    </div>
                                )}
                            </div>

                            {!editingStudent && (
                                <div style={{
                                    background: '#e3f2fd',
                                    padding: '12px 15px',
                                    borderRadius: '4px',
                                    marginBottom: '15px',
                                    fontSize: '14px',
                                    color: '#1976d2',
                                    border: '1px solid #90caf9'
                                }}>
                                    <strong>ℹ️ Note:</strong> Default password will be set to the Registration ID
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingStudent ? "Update" : "Add"} Student
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManageStudents;
