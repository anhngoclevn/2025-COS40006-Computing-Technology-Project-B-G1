import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Footer from "../../../components/Footer/Footer";

import "./StudentQueries.css";


function StudentQueries() {
  const { user, logout } = useAuth();

  const [queries, setQueries] = useState([]);
  const [filteredQueries, setFilteredQueries] = useState([]);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // text trả lời theo từng QueryID
  const [replyText, setReplyText] = useState({});

  // ================= FETCH ==================

  useEffect(() => {
    fetchQueries();
  }, []);

  const fetchQueries = async () => {
    setLoading(true);
    setError("");

    try {
      // Nếu user có CourseID thì gửi lên để filter theo course
      const courseId = user?.CourseID ? `?courseId=${user.CourseID}` : "";
      const response = await fetch(
        `http://localhost/project B/projectB-backend/Lecturer/getStudentQueries.php${courseId}`
      );
      const data = await response.json();

      if (data.success) {
        const list = data.data || [];
        setQueries(list);
        setFilteredQueries(list);
      } else {
        setError(data.error || "Failed to fetch student queries");
      }
    } catch (err) {
      console.error("Error fetching student queries:", err);
      setError("Error fetching student queries");
    } finally {
      setLoading(false);
    }
  };

  // ================= FILTER & SEARCH ==================

  useEffect(() => {
    let data = [...queries];

    if (statusFilter !== "all") {
      data = data.filter(
        (q) => String(q.Status || "").toLowerCase() === statusFilter
      );
    }

    if (searchTerm.trim() !== "") {
      const t = searchTerm.toLowerCase();
      data = data.filter(
        (q) =>
          (q.RegistrationID || "").toLowerCase().includes(t) ||
          (q.StudentName || "").toLowerCase().includes(t) ||
          (q.Subject || "").toLowerCase().includes(t)
      );
    }

    setFilteredQueries(data);
  }, [queries, statusFilter, searchTerm]);

  // ================= REPLY ==================

  const handleReplyChange = (queryId, value) => {
    setReplyText((prev) => ({
      ...prev,
      [queryId]: value,
    }));
  };

  const handleSubmitReply = async (query) => {
    const queryId = query.QueryID;
    const body =
      (replyText[queryId] !== undefined ? replyText[queryId] : query.Response) ||
      "";

    if (!body.trim()) {
      setError("Please enter a response message");
      return;
    }

    setError("");
    setSavingId(queryId);

    try {
      const response = await fetch(
        "http://localhost/project B/projectB-backend/Lecturer/respondQuery.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queryId,
            response: body,
            // mặc định sau khi trả lời là "responded"
            status: "responded",
            // nếu muốn lưu lecturerID thì gửi thêm
            lecturerId: user?.UserID || null,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        const respondedAt =
          data.respondedAt ||
          new Date().toISOString().slice(0, 19).replace("T", " ");

        // Cập nhật lại list queries
        setQueries((prev) =>
          prev.map((q) =>
            q.QueryID === queryId
              ? {
                  ...q,
                  Response: body,
                  Status: data.status || "responded",
                  RespondedAt: respondedAt,
                }
              : q
          )
        );

        // Clear text reply (tuỳ, có thể giữ lại nếu bạn muốn)
        setReplyText((prev) => ({
          ...prev,
          [queryId]: "",
        }));
      } else {
        setError(data.error || "Failed to respond to query");
      }
    } catch (err) {
      console.error("Error responding query:", err);
      setError("Error responding query");
    } finally {
      setSavingId(null);
    }
  };

  const renderStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    return (
      <span className={`status-badge status-${s}`}>
        {s || "pending"}
      </span>
    );
  };

  // ================= RENDER ==================

  return (
    <div className="students-container">
      <Navbar user={user} />

      <div className="main-layout">
        <Sidebar activePage="queries" onLogout={logout} />

        <div className="main-content">
          <div className="content-area">
            <h1 className="page-title">Student Queries</h1>
            <p className="page-subtitle">
              Review and respond to attendance queries submitted by your
              students.
            </p>

            {error && <div className="error">{error}</div>}

            {/* Controls: search + filter */}
            <div className="controls-section">
              <div className="search-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by student ID, name, or subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="filter-container">
                <label htmlFor="statusFilter">Status:</label>
                <select
                  id="statusFilter"
                  className="status-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="responded">Responded</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button
                  className="export-button"
                  type="button"
                  onClick={fetchQueries}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* List queries */}
            {loading ? (
              <div className="loading">Loading queries...</div>
            ) : filteredQueries.length === 0 ? (
              <div className="no-data">
                No student queries found for your classes.
              </div>
            ) : (
              <div className="queries-section">
                <h2>Queries</h2>
                <div className="queries-list">
                  {filteredQueries.map((q) => {
                    const currentReply =
                      replyText[q.QueryID] !== undefined
                        ? replyText[q.QueryID]
                        : q.Response || "";

                    return (
                      <div key={q.QueryID} className="query-card">
                        <div className="query-header">
                          <h3>{q.Subject}</h3>
                          <div className="query-meta">
                            <span>
                              👨‍🎓 {q.RegistrationID} – {q.StudentName}
                            </span>
                            <span>📅 {q.CreatedAt}</span>
                            {renderStatusBadge(q.Status)}
                          </div>
                        </div>

                        <p className="query-message">{q.Message}</p>

                        {q.Response && (
                          <div className="query-response">
                            <strong>Your previous response</strong>
                            <p>{q.Response}</p>
                            {q.RespondedAt && (
                              <small>Responded at: {q.RespondedAt}</small>
                            )}
                          </div>
                        )}

                        <div className="response-form">
                          <label>
                            Reply to this query:
                            <textarea
                              rows="3"
                              value={currentReply}
                              onChange={(e) =>
                                handleReplyChange(q.QueryID, e.target.value)
                              }
                              placeholder="Type your response to the student..."
                            />
                          </label>
                          <button
                            type="button"
                            className="submit-btn"
                            onClick={() => handleSubmitReply(q)}
                            disabled={savingId === q.QueryID}
                          >
                            {savingId === q.QueryID
                              ? "Saving..."
                              : q.Response
                              ? "Update response"
                              : "Send response"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default StudentQueries;
