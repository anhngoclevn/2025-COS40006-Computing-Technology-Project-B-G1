import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./Login.module.css";
import logo from "../../assets/images/logo_swin.jpeg";
import building from "../../assets/images/background_login.jpg";

export default function Login() {
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const userRole = (user.RoleName || user.role || user.Role || '').toLowerCase();
      if (userRole === 'admin') {
        navigate("/admin/dashboard", { replace: true });
      } else if (userRole === 'lecturer') {
        navigate("/lecturer/take-attendance", { replace: true });
      } else if (userRole === 'student') {
        navigate("/student/dashboard", { replace: true });
      }
    }
  }, [user, navigate]);

  const testLocalStorage = () => {
    const testData = { test: "data", timestamp: Date.now() };
    localStorage.setItem('test', JSON.stringify(testData));
    const retrieved = localStorage.getItem('test');
    console.log("LocalStorage test - Saved:", testData, "Retrieved:", JSON.parse(retrieved));
    alert(`LocalStorage test successful: ${retrieved}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // clear lỗi cũ

    if (!role || !email || !password) {
      setError("Please fill in all fields!");
      return;
    }

    try {
      console.log("Sending login request...");
      const response = await fetch("http://localhost/project B/projectB-backend/login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        // Đọc response body để xem lỗi chi tiết
        let errorText = "";
        try {
          errorText = await response.text();
          console.error("Error response body:", errorText);
        } catch (e) {
          console.error("Cannot read error response:", e);
        }
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log("Response from backend:", data);

      if (data.success) {
        console.log("Login successful, user data:", data.user);
        login(data.user); // lưu vào AuthContext

        // Test localStorage immediately after login
        const testSave = localStorage.getItem('user');
        console.log("Immediately after login, localStorage contains:", testSave);

        // Điều hướng theo RoleName (trả về từ PHP)
        if (data.user.RoleName === "Lecturer") {
          navigate("/lecturer/take-attendance");
        } else if (data.user.RoleName === "Admin") {
          navigate("/admin/dashboard");
        } else if (data.user.RoleName === "Student") {
          navigate("/student/dashboard");
        }
      } else {
        setError(data.error || "Login failed!");
      }
    } catch (err) {
      console.error("Login error:", err);
      if (err.message.includes("Failed to fetch")) {
        setError("Cannot connect to server! Check if XAMPP is running.");
      } else {
        setError(err.message || "Login failed!");
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* LEFT SECTION */}
      <div className={styles.left}>
        <div className={styles.formBox}>
          <img src={logo} alt="Swinburne logo" className={styles.logo} />

          {error && <div className={styles.errorBox}>{error}</div>}

          <form className={styles.form} onSubmit={handleSubmit}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={styles.input}
            >
              <option value="">Choose your role</option>
              <option value="Lecturer">Lecturer</option>
              <option value="Admin">Admin</option>
              <option value="Student">Student</option>
            </select>

            <input
              type="email"
              placeholder="Email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className={styles.recover}>
              <a href="#">Recover password</a>
            </div>

            <button type="submit" className={styles.signinBtn}>
              Sign In
            </button>


          </form>
          <footer className={styles.footer}>2025 © Swinburne</footer>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className={styles.right}>
        <img src={building} alt="Swinburne campus" />
      </div>
    </div >
  );
}
