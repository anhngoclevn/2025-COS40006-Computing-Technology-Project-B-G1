import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "../pages/Student/Dashboard/Dashboard";
import Attendance from "../pages/Student/Attendance/Attendance";
import Query from "../pages/Student/Query/Query";

function StudentRouter() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="query" element={<Query />} />
        </Routes>
    );
}

export default StudentRouter;