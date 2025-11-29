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
    $query = "SELECT MajorID, CourseID, MajorName FROM major ORDER BY MajorName ASC";
    $result = $conn->query($query);

    if (!$result) {
        throw new Exception($conn->error);
    }

    $majors = [];
    while ($row = $result->fetch_assoc()) {
        $majors[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $majors
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching majors: ' . $e->getMessage()
    ]);
}

$conn->close();
?>