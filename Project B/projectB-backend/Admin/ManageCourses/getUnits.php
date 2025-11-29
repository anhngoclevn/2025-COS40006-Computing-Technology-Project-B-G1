<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

include '../../db.php';

if ($conn->connect_error) {
    echo json_encode([
        "success" => false,
        "message" => "DB connection error"
    ]);
    exit;
}

$sql = "SELECT UnitID, CourseID, UnitCode, UnitName FROM `unit` ORDER BY UnitCode";
$result = $conn->query($sql);

$units = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $units[] = $row;
    }
}

echo json_encode([
    "success" => true,
    "data" => $units
]);
