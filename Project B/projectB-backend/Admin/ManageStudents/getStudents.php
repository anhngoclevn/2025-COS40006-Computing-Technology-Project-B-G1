<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

include '../../db.php';

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

try {
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $courseId = isset($_GET['courseId']) ? $_GET['courseId'] : '';

    $sql = "SELECT 
                s.StudentID,
                s.RegistrationID,
                s.FirstName,
                s.LastName,
                s.Email,
                c.CourseName,
                m.MajorName
            FROM students s
            LEFT JOIN course c ON s.CourseID = c.CourseID
            LEFT JOIN major m ON s.MajorID = m.MajorID
            WHERE 1=1";

    // Add search filter
    if (!empty($search)) {
        $searchParam = "%" . $conn->real_escape_string($search) . "%";
        $sql .= " AND (s.RegistrationID LIKE '$searchParam' OR s.FirstName LIKE '$searchParam' OR s.LastName LIKE '$searchParam' OR s.Email LIKE '$searchParam')";
    }

    // Add course filter
    if (!empty($courseId)) {
        $courseId = $conn->real_escape_string($courseId);
        $sql .= " AND s.CourseID = '$courseId'";
    }

    $sql .= " ORDER BY s.RegistrationID";

    $result = $conn->query($sql);

    if ($result) {
        $students = [];
        while ($row = $result->fetch_assoc()) {
            $students[] = $row;
        }

        echo json_encode([
            'success' => true,
            'data' => $students
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Error executing query: ' . $conn->error
        ]);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching students: ' . $e->getMessage()
    ]);
}
?>