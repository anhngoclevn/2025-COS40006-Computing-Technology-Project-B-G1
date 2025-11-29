// src/router/LecturerRouter.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import TakeAttendance from "../pages/Lecturer/TakeAttendance/TakeAttendance";
import ViewAttendance from "../pages/Lecturer/ViewAttendance/ViewAttendance";
import Students from "../pages/Lecturer/Students/Students";
import StudentQueries from "../pages/Lecturer/StudentQueries/StudentQueries";

function LecturerRouter() {
  return (
    <Routes>
      {/* Default route redirect to take-attendance */}
      <Route path="/" element={<Navigate to="take-attendance" replace />} />

      {/* Trang giảng viên thực hiện điểm danh */}
      <Route path="take-attendance" element={<TakeAttendance />} />

      {/* Trang xem lại kết quả điểm danh */}
      <Route path="view-attendance" element={<ViewAttendance />} />

      {/* Trang phản hồi query của sinh viên */}
      <Route path="queries" element={<StudentQueries />} />

      {/* Trang quản lý danh sách sinh viên */}
      <Route path="students" element={<Students />} />
    </Routes>
  );
}

export default LecturerRouter;
