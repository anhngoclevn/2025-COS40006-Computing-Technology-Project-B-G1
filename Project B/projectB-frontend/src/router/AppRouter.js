import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login/Login";
import LecturerRouter from "./LecturerRouter";
import AdminRouter from "./AdminRouter";
import StudentRouter from "./StudentRouter";
import RoleProtectedRoute from "../components/ProtectedRoute/ProtectedRoute";

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/lecturer/*"
          element={
            <RoleProtectedRoute allowedRoles={['lecturer', 'Lecturer']}>
              <LecturerRouter />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RoleProtectedRoute allowedRoles={['admin', 'Admin']}>
              <AdminRouter />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/*"
          element={
            <RoleProtectedRoute allowedRoles={['student', 'Student']}>
              <StudentRouter />
            </RoleProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default AppRouter;
