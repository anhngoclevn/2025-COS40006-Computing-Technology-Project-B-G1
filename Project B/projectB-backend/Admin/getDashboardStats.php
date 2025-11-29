<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

include '../db.php';

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

try {
    // Get total students
    $studentQuery = "SELECT COUNT(*) as total_students FROM students";
    $studentResult = $conn->query($studentQuery);
    $totalStudents = $studentResult->fetch_assoc()['total_students'];

    // Get total lecturers
    $lecturerQuery = "SELECT COUNT(*) as total_lecturers FROM users WHERE RoleID = 2";
    $lecturerResult = $conn->query($lecturerQuery);
    $totalLecturers = $lecturerResult->fetch_assoc()['total_lecturers'];

    // Get total courses
    $courseQuery = "SELECT COUNT(*) as total_courses FROM course";
    $courseResult = $conn->query($courseQuery);
    $totalCourses = $courseResult->fetch_assoc()['total_courses'];

    // Get total units
    $unitQuery = "SELECT COUNT(*) as total_units FROM unit";
    $unitResult = $conn->query($unitQuery);
    $totalUnits = $unitResult->fetch_assoc()['total_units'];

    // Get attendance statistics
    $attendanceQuery = "
        SELECT 
            Status,
            COUNT(*) as count
        FROM attendance 
        WHERE Status != 'unknown'
        GROUP BY Status
    ";
    $attendanceResult = $conn->query($attendanceQuery);
    $attendanceStats = [];
    while ($row = $attendanceResult->fetch_assoc()) {
        $attendanceStats[$row['Status']] = $row['count'];
    }

    // Get recent attendance data
    $recentAttendanceQuery = "
        SELECT 
            s.FirstName,
            s.LastName,
            s.RegistrationID,
            u.UnitCode,
            se.Date,
            a.Status
        FROM attendance a
        JOIN students s ON a.StudentID = s.StudentID
        JOIN session se ON a.SessionID = se.SessionID
        JOIN unit u ON se.UnitID = u.UnitID
        ORDER BY se.Date DESC, se.SessionID DESC
        LIMIT 10
    ";
    $recentResult = $conn->query($recentAttendanceQuery);
    $recentAttendance = [];
    while ($row = $recentResult->fetch_assoc()) {
        $recentAttendance[] = $row;
    }

    // Get students by course
    $studentsByCourseQuery = "
        SELECT 
            c.CourseName,
            COUNT(s.StudentID) as student_count
        FROM course c
        LEFT JOIN students s ON c.CourseID = s.CourseID
        GROUP BY c.CourseID, c.CourseName
        ORDER BY student_count DESC
    ";
    $courseResult = $conn->query($studentsByCourseQuery);
    $studentsByCourse = [];
    while ($row = $courseResult->fetch_assoc()) {
        $studentsByCourse[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'totals' => [
                'students' => (int) $totalStudents,
                'lecturers' => (int) $totalLecturers,
                'courses' => (int) $totalCourses,
                'units' => (int) $totalUnits
            ],
            'attendance_stats' => $attendanceStats,
            'recent_attendance' => $recentAttendance,
            'students_by_course' => $studentsByCourse
        ]
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching dashboard data: ' . $e->getMessage()
    ]);
}
?>