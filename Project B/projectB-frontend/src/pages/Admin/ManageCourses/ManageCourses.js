import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import AdminSidebar from "../../../components/AdminSidebar/AdminSidebar";
import Footer from "../../../components/Footer/Footer";
import "./ManageCourses.css";

function ManageCourses() {
    const { user, logout } = useAuth();

    const [courses, setCourses] = useState([]);
    const [units, setUnits] = useState([]);
    const [filteredUnits, setFilteredUnits] = useState([]);
    const [sessions, setSessions] = useState([]);

    const [loading, setLoading] = useState(true);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [selectedCourseID, setSelectedCourseID] = useState("");
    const [selectedUnitID, setSelectedUnitID] = useState("");

    // --- Modal states ---
    const [showUnitModal, setShowUnitModal] = useState(false);      // modal Add Unit
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [showEditSectionModal, setShowEditSectionModal] = useState(false);

    // Add Unit form
    const [unitForm, setUnitForm] = useState({
        courseID: "",
        unitCode: "",
        unitName: "",
    });

    // Add Section (generate 12) form
    const [term, setTerm] = useState("Spring");
    const [year, setYear] = useState(new Date().getFullYear());
    const [weekday, setWeekday] = useState("Monday");
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("11:00");
    const [generatedSections, setGeneratedSections] = useState([]);
    const [isSavingGenerated, setIsSavingGenerated] = useState(false);

    // Edit one Section form
    const [sectionEditForm, setSectionEditForm] = useState({
        sessionID: "",
        date: "",
        start: "",
        end: "",
    });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Khi chọn course → filter unit
    useEffect(() => {
        if (selectedCourseID) {
            const filtered = units.filter(
                (u) => String(u.CourseID) === String(selectedCourseID)
            );
            setFilteredUnits(filtered);
        } else {
            setFilteredUnits([]);
        }
        setSelectedUnitID("");
        setSessions([]);
    }, [selectedCourseID, units]);

    // Khi chọn unit → load session của Unit đó
    useEffect(() => {
        if (selectedUnitID) {
            fetchSessions(selectedUnitID);
        } else {
            setSessions([]);
    }
    }, [selectedUnitID]);

    // --------- Helpers ---------
    const weekdayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];

    const weekdayToIndex = (day) => {
        switch (day) {
            case "Sunday": return 0;
            case "Monday": return 1;
            case "Tuesday": return 2;
            case "Wednesday": return 3;
            case "Thursday": return 4;
            case "Friday": return 5;
            case "Saturday": return 6;
            default: return 1;
        }
    };

    const getTermStartDate = (termName, yearValue) => {
        let month = 1;
        if (termName === "Spring") month = 1;
        if (termName === "Summer") month = 5;
        if (termName === "Fall") month = 9;

        return new Date(yearValue, month - 1, 1);
    };

    const formatDateDisplay = (dateStrOrObj) => {
        if (!dateStrOrObj) return "";
        const d = dateStrOrObj instanceof Date ? dateStrOrObj : new Date(dateStrOrObj);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString("en-GB"); // dd/mm/yyyy
    };

    const formatTimeDisplay = (timeStr) => {
        if (!timeStr) return "";
        return timeStr.slice(0, 5); // "HH:MM:SS" -> "HH:MM"
    };

    // --------- Fetch initial data (course/unit) ----------
    const fetchInitialData = async () => {
        setLoading(true);
        setError("");

        try {
            const coursesRes = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageCourses/getCourses.php"
            );
            const coursesData = await coursesRes.json();
            if (!coursesData.success) {
                throw new Error(coursesData.message || "Failed to load courses");
            }
            setCourses(coursesData.data || []);

            const unitsRes = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageCourses/getUnits.php"
            );
            const unitsData = await unitsRes.json();
            if (!unitsData.success) {
                throw new Error(unitsData.message || "Failed to load units");
            }
            setUnits(unitsData.data || []);
        } catch (err) {
            console.error("ManageCourses init error:", err);
            setError(err.message || "Error loading data");
        } finally {
            setLoading(false);
        }
    };

    // --------- Fetch sessions for selected Unit ----------
    const fetchSessions = async (unitID) => {
        setLoadingSessions(true);
        setError("");
        try {
            const res = await fetch(
                `http://localhost/project%20B/projectB-backend/Admin/ManageCourses/getSessions.php?unitID=${unitID}`
            );
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || "Failed to load sections");
            }
            setSessions(data.data || []);
        } catch (err) {
            console.error("fetchSessions error:", err);
            setError(err.message || "Error loading sections");
        } finally {
            setLoadingSessions(false);
        }
    };

    // --------- Add UNIT ----------
    const handleUnitFormChange = (e) => {
        setUnitForm({ ...unitForm, [e.target.name]: e.target.value });
    };

    const handleSubmitUnit = async (e) => {
        e.preventDefault();
        setError("");

        if (!unitForm.courseID) {
            setError("Please select a Course for this Unit.");
            return;
        }
        if (!unitForm.unitCode.trim() || !unitForm.unitName.trim()) {
            setError("Unit Code and Unit Name are required.");
            return;
        }

        try {
            const res = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageCourses/addUnit.php",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(unitForm),
                }
            );
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || "Failed to add unit");
            }

            setSuccessMessage("Unit added successfully!");
            setShowUnitModal(false);
            setUnitForm({ courseID: "", unitCode: "", unitName: "" });
            fetchInitialData();
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("addUnit error:", err);
            setError(err.message || "Error adding unit");
        }
    };

    // --------- Generate 12 sections (for Add Section modal) ----------
    const handleGenerateSections = () => {
        setError("");
        setGeneratedSections([]);

        if (!selectedCourseID || !selectedUnitID) {
            setError("Please select Course and Unit first.");
            return;
        }

        if (!term || !weekday || !year) {
            setError("Please select term, year, and weekday.");
            return;
        }

        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            setError("Please enter a valid year.");
            return;
        }

        if (!startTime || !endTime) {
            setError("Please select start and end time.");
            return;
        }
        if (startTime >= endTime) {
            setError("Start time must be earlier than end time.");
            return;
        }

        const NUMBER_OF_SECTIONS = 12;
        const startDate = getTermStartDate(term, yearNum);
        const targetDow = weekdayToIndex(weekday);

        let firstClassDate = new Date(startDate);
        while (firstClassDate.getDay() !== targetDow) {
            firstClassDate.setDate(firstClassDate.getDate() + 1);
        }

        const list = [];
        const tempDate = new Date(firstClassDate);

        for (let i = 0; i < NUMBER_OF_SECTIONS; i++) {
            list.push({
                index: i + 1,
                date: new Date(tempDate),
            });
            tempDate.setDate(tempDate.getDate() + 7);
        }

        setGeneratedSections(list);
    };

    const handleSaveGeneratedSections = async () => {
        if (generatedSections.length === 0) {
            setError("Please generate sections first.");
            return;
        }

        setIsSavingGenerated(true);
        setError("");
        try {
            const payload = {
                courseID: selectedCourseID,
                unitID: selectedUnitID,
                term,
                year,
                weekday,
                startTime,
                endTime,
                sections: generatedSections.map((s) => ({
                    index: s.index,
                    date: s.date.toISOString().split("T")[0],
                })),
            };

            const res = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageCourses/addSections.php",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || "Failed to save sections");
            }

            setSuccessMessage("Sections added successfully!");
            setShowSectionModal(false);
            setGeneratedSections([]);
            fetchSessions(selectedUnitID);
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("saveGenerated error:", err);
            setError(err.message || "Error saving sections");
        } finally {
            setIsSavingGenerated(false);
        }
    };

    // --------- Edit one section ----------
    const openEditSectionModal = (session) => {
        setSectionEditForm({
            sessionID: session.SessionID,
            date: session.Date,
            start: session.Start ? session.Start.slice(0, 5) : "09:00",
            end: session.End ? session.End.slice(0, 5) : "11:00",
        });
        setShowEditSectionModal(true);
    };

    const handleEditSectionChange = (e) => {
        setSectionEditForm({
            ...sectionEditForm,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmitEditSection = async (e) => {
        e.preventDefault();
        setError("");

        if (!sectionEditForm.date || !sectionEditForm.start || !sectionEditForm.end) {
            setError("Please fill in date, start, and end time.");
            return;
        }
        if (sectionEditForm.start >= sectionEditForm.end) {
            setError("Start time must be earlier than end time.");
            return;
        }

        setIsSavingEdit(true);
        try {
            const payload = {
                sessionID: sectionEditForm.sessionID,
                date: sectionEditForm.date,
                startTime: sectionEditForm.start,
                endTime: sectionEditForm.end,
            };

            const res = await fetch(
                "http://localhost/project%20B/projectB-backend/Admin/ManageCourses/updateSession.php",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || "Failed to update section");
            }

            setSuccessMessage("Section updated successfully!");
            setShowEditSectionModal(false);
            fetchSessions(selectedUnitID);
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("updateSession error:", err);
            setError(err.message || "Error updating section");
        } finally {
            setIsSavingEdit(false);
        }
    };

    // --------- Render ----------
    if (loading) {
        return (
            <div className="dashboard-container">
                <Navbar user={user} />
                <div className="main-layout">
                    <AdminSidebar activePage="manage-courses" onLogout={logout} />
                    <div className="main-content">
                        <div className="loading">Loading courses...</div>
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
                <AdminSidebar activePage="manage-courses" onLogout={logout} />

                <div className="main-content">
                    <div className="content-area">
                        {/* Header */}
                        <div className="page-header">
                            <div>
                                <h1 className="page-title">Manage Courses & Sections</h1>
                                <p className="page-subtitle">
                                    Select a course & unit to view and edit its teaching sections.
                                </p>
                            </div>
                            <div className="header-actions">
                                {/* Add Unit – nút xanh biển */}
                                <button
                                    className="btn-blue"
                                    onClick={() => setShowUnitModal(true)}
                                >
                                    + Add Unit
                                </button>
                            </div>
                        </div>

                        {error && <div className="error">{error}</div>}
                        {successMessage && (
                            <div className="success">{successMessage}</div>
                        )}

                        {/* Stats */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <span className="stat-title">Total Courses</span>
                                    <span className="stat-icon">📚</span>
                                </div>
                                <div className="stat-number">{courses.length}</div>
                                <div className="stat-change">Available course</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <span className="stat-title">Total Units</span>
                                    <span className="stat-icon">📖</span>
                                </div>
                                <div className="stat-number">{units.length}</div>
                                <div className="stat-change">Available unit</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <span className="stat-title">Sections (this unit)</span>
                                    <span className="stat-icon">📅</span>
                                </div>
                                <div className="stat-number">{sessions.length}</div>
                                <div className="stat-change">
                                    Available sections
                                </div>
                            </div>
                        </div>

                        {/* Select Course & Unit */}
                        <div className="section-card">
                            <h2 className="section-title">1. Select Course & Unit</h2>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Course *</label>
                                    <select
                                        value={selectedCourseID}
                                        onChange={(e) =>
                                            setSelectedCourseID(e.target.value)
                                        }
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map((course) => (
                                            <option
                                                key={course.CourseID}
                                                value={course.CourseID}
                                            >
                                                {course.CourseName} 
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Unit Code *</label>
                                    <select
                                        value={selectedUnitID}
                                        onChange={(e) =>
                                            setSelectedUnitID(e.target.value)
                                        }
                                        disabled={!selectedCourseID}
                                    >
                                        <option value="">
                                            {selectedCourseID
                                                ? "Select Unit"
                                                : "Select course first"}
                                        </option>
                                        {filteredUnits.map((unit) => (
                                            <option key={unit.UnitID} value={unit.UnitID}>
                                                {unit.UnitCode} - {unit.UnitName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Sections Preview */}
                        <div className="section-card">
                            <div className="section-card-header">
                                <h2 className="section-title">2. Sections Preview</h2>

                                {/* Nút Add Section(s) – chỉ hiện khi đã chọn Unit và chưa có section */}
                                {selectedUnitID &&
                                    !loadingSessions &&
                                    sessions.length === 0 && (
                                        <button
                                            className="btn-green"
                                            onClick={() => setShowSectionModal(true)}
                                        >
                                            + Add Section(s)
                                        </button>
                                    )}
                            </div>

                            {!selectedUnitID && (
                                <div className="no-data">
                                    Please select Course and Unit to see its sections.
                                </div>
                            )}

                            {selectedUnitID && loadingSessions && (
                                <div className="loading">
                                    Loading sections for this unit...
                                </div>
                            )}

                            {selectedUnitID &&
                                !loadingSessions &&
                                sessions.length === 0 && (
                                    <div className="no-data">
                                        This unit has no sections yet.  
                                        Use the <strong>+ Add Section(s)</strong> button to
                                        create 12 weeks.
                                    </div>
                                )}

                            {selectedUnitID &&
                                !loadingSessions &&
                                sessions.length > 0 && (
                                    <div className="table-container">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Date</th>
                                                    <th>Weekday</th>
                                                    <th>Start</th>
                                                    <th>End</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sessions.map((s, idx) => {
                                                    const weekdayLabel = (() => {
                                                        const d = new Date(s.Date);
                                                        if (Number.isNaN(d.getTime())) return "-";
                                                        return weekdayNames[d.getDay()];
                                                    })();

                                                    return (
                                                        <tr key={s.SessionID}>
                                                            <td>{idx + 1}</td>
                                                            <td>{formatDateDisplay(s.Date)}</td>
                                                            <td>{weekdayLabel}</td>
                                                            <td>{formatTimeDisplay(s.Start)}</td>
                                                            <td>{formatTimeDisplay(s.End)}</td>
                                                            <td>
                                                                <div className="action-buttons">
                                                                    <button
                                                                        className="btn-edit"
                                                                        type="button"
                                                                        onClick={() =>
                                                                            openEditSectionModal(s)
                                                                        }
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                </div>
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
                </div>
            </div>

            <Footer />

            {/* ---------- Add UNIT Modal ---------- */}
            {showUnitModal && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowUnitModal(false)}
                >
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2 className="modal-title">Add Unit</h2>
                            <button
                                className="modal-close"
                                onClick={() => setShowUnitModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmitUnit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Course *</label>
                                    <select
                                        name="courseID"
                                        value={unitForm.courseID}
                                        onChange={handleUnitFormChange}
                                        required
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map((course) => (
                                            <option
                                                key={course.CourseID}
                                                value={course.CourseID}
                                            >
                                                {course.CourseName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Unit Code *</label>
                                    <input
                                        type="text"
                                        name="unitCode"
                                        value={unitForm.unitCode}
                                        onChange={handleUnitFormChange}
                                        placeholder="e.g. COS30043"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Unit Name *</label>
                                    <input
                                        type="text"
                                        name="unitName"
                                        value={unitForm.unitName}
                                        onChange={handleUnitFormChange}
                                        placeholder="Interface Design and Development"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowUnitModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-blue">
                                    Add Unit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ---------- Add Section(s) Modal (generate 12) ---------- */}
            {showSectionModal && (
                <div
                    className="modal-overlay"
                    onClick={() => {
                        setShowSectionModal(false);
                        setGeneratedSections([]);
                    }}
                >
                    <div
                        className="modal-content large"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2 className="modal-title">Add Sections for Unit</h2>
                            <button
                                className="modal-close"
                                onClick={() => {
                                    setShowSectionModal(false);
                                    setGeneratedSections([]);
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label>Term *</label>
                                <select
                                    value={term}
                                    onChange={(e) => setTerm(e.target.value)}
                                >
                                    <option value="Spring">Spring (start Jan)</option>
                                    <option value="Summer">Summer (start May)</option>
                                    <option value="Fall">Fall (start Sep)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Year *</label>
                                <input
                                    type="number"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    min="2000"
                                    max="2100"
                                />
                            </div>

                            <div className="form-group">
                                <label>Weekday *</label>
                                <select
                                    value={weekday}
                                    onChange={(e) => setWeekday(e.target.value)}
                                >
                                    <option value="Monday">Monday</option>
                                    <option value="Tuesday">Tuesday</option>
                                    <option value="Wednesday">Wednesday</option>
                                    <option value="Thursday">Thursday</option>
                                    <option value="Friday">Friday</option>
                                    <option value="Saturday">Saturday</option>
                                    <option value="Sunday">Sunday</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Start time *</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>End time *</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="section-actions">
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleGenerateSections}
                            >
                                Generate 12 Sections
                            </button>
                        </div>

                        {generatedSections.length > 0 && (
                            <>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Date</th>
                                                <th>Weekday</th>
                                                <th>Start</th>
                                                <th>End</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {generatedSections.map((s) => {
                                                const d = s.date;
                                                const weekdayLabel =
                                                    weekdayNames[d.getDay()];
                                                return (
                                                    <tr key={s.index}>
                                                        <td>{s.index}</td>
                                                        <td>{formatDateDisplay(d)}</td>
                                                        <td>{weekdayLabel}</td>
                                                        <td>{startTime}</td>
                                                        <td>{endTime}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => {
                                            setShowSectionModal(false);
                                            setGeneratedSections([]);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={handleSaveGeneratedSections}
                                        disabled={isSavingGenerated}
                                    >
                                        {isSavingGenerated
                                            ? "Saving..."
                                            : "Save to Database"}
                                    </button>
                                </div>
                            </>
                        )}

                        {generatedSections.length === 0 && (
                            <p className="helper-text">
                                Configure term, year, weekday and time, then click{" "}
                                <strong>Generate 12 Sections</strong>.  
                                It’s OK if last section crosses into the next month.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ---------- Edit Section Modal ---------- */}
            {showEditSectionModal && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowEditSectionModal(false)}
                >
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2 className="modal-title">Edit Section</h2>
                            <button
                                className="modal-close"
                                onClick={() => setShowEditSectionModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmitEditSection}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Date *</label>
                                    <input
                                        type="date"
                                        name="date"
                                        value={sectionEditForm.date}
                                        onChange={handleEditSectionChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Start time *</label>
                                    <input
                                        type="time"
                                        name="start"
                                        value={sectionEditForm.start}
                                        onChange={handleEditSectionChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End time *</label>
                                    <input
                                        type="time"
                                        name="end"
                                        value={sectionEditForm.end}
                                        onChange={handleEditSectionChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowEditSectionModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={isSavingEdit}
                                >
                                    {isSavingEdit ? "Saving..." : "Save changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManageCourses;
