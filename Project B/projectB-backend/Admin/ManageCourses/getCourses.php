<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// require file kết nối DB
include '../../db.php';

if ($conn->connect_error) {
    echo json_encode([
        "success" => false,
        "message" => "DB connection error"
    ]);
    exit;
}

$sql = "SELECT CourseID, CourseName FROM `course` ORDER BY CourseName";
$result = $conn->query($sql);

$courses = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $courses[] = $row;
    }
}

echo json_encode([
    "success" => true,
    "data" => $courses
]);
