import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Footer from "../../../components/Footer/Footer";
import "./Students.css";

function Students() {
    const { user, logout } = useAuth();
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Fetch students on component mount
    useEffect(() => {
        fetchStudents();
    }, []);

    // Filter students when search term changes
    useEffect(() => {
        if (searchTerm.trim() === "") {
            setFilteredStudents(students);
        } else {
            const filtered = students.filter(student =>
                student.RegistrationID.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.FirstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.LastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.Email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (student.CourseName && student.CourseName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (student.MajorName && student.MajorName.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setFilteredStudents(filtered);
        }
    }, [searchTerm, students]);

    const fetchStudents = async () => {
        setLoading(true);
        setError("");
        try {
            console.log("Fetching students from API...");
            const response = await fetch(
                "http://localhost/project B/projectB-backend/Admin/getStudents.php"
            );

            console.log("Response status:", response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("API Response:", data);

            if (data.success) {
                setStudents(data.data);
                setFilteredStudents(data.data);
                console.log("Students loaded successfully:", data.data.length);
            } else {
                setError(data.message || "Failed to fetch students");
                console.error("API Error:", data.message);
            }
        } catch (err) {
            const errorMsg = `Error fetching students: ${err.message}`;
            setError(errorMsg);
            console.error("Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const exportToCSV = () => {
        if (!filteredStudents.length) {
            alert("No data to export");
            return;
        }

        // Create CSV content
        let csv = "Student ID,First Name,Last Name,Email,Course,Major\n";
        filteredStudents.forEach(student => {
            csv += `"${student.RegistrationID}","${student.FirstName}","${student.LastName}","${student.Email}","${student.CourseName || ''}","${student.MajorName || ''}"\n`;
        });

        // Download CSV file
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `students_list_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="students-container">
            {/* Navbar */}
            <Navbar user={user} />

            {/* Main Layout */}
            <div className="main-layout">
                <Sidebar activePage="students" onLogout={logout} />

                {/* Main Content */}
                <div className="main-content">
                    <div className="content-area">
                        <h1 className="page-title">Students List</h1>

                        {error && <div className="error">{error}</div>}

                        {/* Search and Controls */}
                        <div className="controls-section">
                            <div className="search-container">
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search ....."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                />
                                <span className="search-icon"></span>
                            </div>

                            <div className="action-buttons">
                                <button
                                    className="export-button"
                                    onClick={exportToCSV}
                                    disabled={!filteredStudents.length}
                                >
                                    Export as CSV
                                </button>
                                <button
                                    className="refresh-button"
                                    onClick={fetchStudents}
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {/* Students Table */}
                        {loading ? (
                            <div className="loading">Loading students...</div>
                        ) : (
                            <div className="students-table-container">
                                <table className="students-table">
                                    <thead>
                                        <tr>
                                            <th>Student Id</th>
                                            <th>First Name</th>
                                            <th>Last Name</th>
                                            <th>Email</th>
                                            <th>Course</th>
                                            <th>Major</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.length > 0 ? (
                                            filteredStudents.map((student) => (
                                                <tr key={student.StudentID}>
                                                    <td>{student.RegistrationID}</td>
                                                    <td>{student.FirstName}</td>
                                                    <td>{student.LastName}</td>
                                                    <td>{student.Email}</td>
                                                    <td>{student.CourseName || '-'}</td>
                                                    <td>{student.MajorName || '-'}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="6" className="no-data">
                                                    {searchTerm ? "No students found matching your search." : "No students found."}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Results Info */}
                        {!loading && (
                            <div className="results-info">
                                Showing {filteredStudents.length} of {students.length} students
                                {searchTerm && ` (filtered by "${searchTerm}")`}
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

export default Students;