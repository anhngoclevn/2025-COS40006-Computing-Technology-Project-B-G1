import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "../pages/Admin/Dashboard/Dashboard";
import ManageLecturers from "../pages/Admin/ManageLecturers/ManageLecturers";
import ManageStudents from "../pages/Admin/ManageStudents/ManageStudents";
import ManageCourses from "../pages/Admin/ManageCourses/ManageCourses";

function AdminRouter() {
  return (
    <Routes>
      {/* Default route redirect to dashboard */}
      <Route path="/" element={<Navigate to="dashboard" replace />} />

      <Route path="dashboard" element={<Dashboard />} />
      <Route path="manage-lecturers" element={<ManageLecturers />} />
      <Route path="manage-students" element={<ManageStudents />} />
      <Route path="manage-courses" element={<ManageCourses />} />
    </Routes>
  );
}

export default AdminRouter;
