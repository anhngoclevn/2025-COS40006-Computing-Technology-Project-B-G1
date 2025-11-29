import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import Navbar from "../../../components/Navbar/Navbar";
import StudentSidebar from "../../../components/StudentSidebar/StudentSidebar";
import Footer from "../../../components/Footer/Footer";
import "./Query.css";

function Query() {
  const { user, logout } = useAuth();

  const [queries, setQueries] = useState([]);
  const [newQuery, setNewQuery] = useState({
    subject: "",
    message: "",
  });

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ----------- helpers ------------

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewQuery((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newQuery.subject.trim() || !newQuery.message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      setLoadingSubmit(true);

      const res = await fetch(
        "http://localhost/project B/projectB-backend/Student/submitQuery.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: user?.StudentID,
            subject: newQuery.subject.trim(),
            message: newQuery.message.trim(),
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        setSuccess("Query submitted successfully! Your lecturer will respond here.");
        setNewQuery({ subject: "", message: "" });
        await fetchQueries(); // reload list
      } else {
        setError(data.error || "Failed to submit query.");
      }
    } catch (err) {
      console.error("Submit query error:", err);
      setError("Error connecting to server.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const fetchQueries = async () => {
    if (!user?.StudentID) return;
    setLoadingList(true);
    try {
      const res = await fetch(
        `http://localhost/project B/projectB-backend/Student/getQueries.php?studentId=${user.StudentID}`
      );
      const data = await res.json();

      if (data.success) {
        let list = data.data || [];
        // sort mới nhất lên trước
        list = list.sort((a, b) => {
          const da = new Date(a.CreatedAt || 0);
          const db = new Date(b.CreatedAt || 0);
          return db - da;
        });
        setQueries(list);
      } else {
        console.warn("getQueries.php error:", data.error);
      }
    } catch (err) {
      console.error("Error fetching queries:", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (user?.StudentID) {
      fetchQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const getStatusClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "responded") return "status-badge status-responded";
    if (s === "resolved") return "status-badge status-resolved";
    return "status-badge status-pending";
  };

  const getStatusLabel = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "responded") return "Responded";
    if (s === "resolved") return "Resolved";
    return "Pending";
  };

  return (
    <div className="view-attendance-container">
      {/* Navbar */}
      <Navbar user={user} />

      {/* Layout với sidebar giống các trang khác */}
      <div className="main-layout">
        <StudentSidebar activePage="query" onLogout={logout} />

        <div className="main-content">
          <div className="content-area">
            {/* Header */}
            <h1 className="page-title">Attendance Query</h1>
            <p className="page-subtitle">
              If you think there is an issue with your attendance, submit a query
              and check your lecturer&apos;s response here.
            </p>

            {/* Form gửi query */}
            <div className="query-form-card">
              <h2 className="section-title">Submit New Query</h2>

              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <form className="query-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="subject">
                    Subject <span className="required">*</span>
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    value={newQuery.subject}
                    onChange={handleInputChange}
                    placeholder="E.g., Missing attendance on 15/11/2025"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="message">
                    Message <span className="required">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    value={newQuery.message}
                    onChange={handleInputChange}
                    placeholder="Describe your attendance issue in detail..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loadingSubmit}
                >
                  {loadingSubmit ? "Submitting..." : "Submit Query"}
                </button>
              </form>
            </div>

            {/* List query + response */}
            <div className="queries-section">
              <h2 className="section-title">My Queries & Responses</h2>

              {loadingList ? (
                <div className="loading">Loading your queries...</div>
              ) : queries.length === 0 ? (
                <div className="no-data">
                  You haven&apos;t submitted any queries yet.
                </div>
              ) : (
                <div className="queries-list">
                  {queries.map((q) => {
                    const hasResponse =
                      q.Response && q.Response.trim().length > 0;
                    const status = q.Status || "pending";

                    return (
                      <div key={q.QueryID} className="query-card">
                        <div className="query-header">
                          <div>
                            <h3>{q.Subject}</h3>
                            <div className="query-meta">
                              <span>📅 {q.CreatedAt}</span>
                            </div>
                          </div>
                          <span className={getStatusClass(status)}>
                            {getStatusLabel(status)}
                          </span>
                        </div>

                        <p className="query-message">{q.Message}</p>

                        {hasResponse ? (
                          <div className="query-response">
                            <strong>Lecturer response</strong>
                            <p>{q.Response}</p>
                            {q.RespondedAt && (
                              <small>Responded at: {q.RespondedAt}</small>
                            )}
                          </div>
                        ) : (
                          <div className="query-response pending-response">
                            <strong>No response yet</strong>
                            <p>
                              Your lecturer has not replied to this query yet.
                              Please check again later.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default Query;
