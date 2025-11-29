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
    $query = "
        SELECT 
            u.UserID,
            u.FirstName,
            u.LastName,
            u.Email,
            u.RoleID,
            u.CourseID,
            c.CourseName
        FROM users u
        LEFT JOIN course c ON u.CourseID = c.CourseID
        WHERE u.RoleID = 2
        ORDER BY u.UserID DESC
    ";

    $result = $conn->query($query);

    if (!$result) {
        throw new Exception($conn->error);
    }

    $lecturers = [];
    while ($row = $result->fetch_assoc()) {
        $lecturers[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $lecturers
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching lecturers: ' . $e->getMessage()
    ]);
}

$conn->close();
?>