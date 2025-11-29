<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// require file kết nối DB
include '../../db.php';

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON payload"
    ]);
    exit;
}

$courseID = isset($data["courseID"]) ? intval($data["courseID"]) : 0;
$unitCode = isset($data["unitCode"]) ? trim($data["unitCode"]) : "";
$unitName = isset($data["unitName"]) ? trim($data["unitName"]) : "";

if (!$courseID || $unitCode === "" || $unitName === "") {
    echo json_encode([
        "success" => false,
        "message" => "Missing courseID, unitCode or unitName"
    ]);
    exit;
}

if ($conn->connect_error) {
    echo json_encode([
        "success" => false,
        "message" => "DB connection error"
    ]);
    exit;
}

try {
    $stmt = $conn->prepare("
        INSERT INTO `unit` (CourseID, UnitCode, UnitName)
        VALUES (?, ?, ?)
    ");
    $stmt->bind_param("iss", $courseID, $unitCode, $unitName);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Unit inserted successfully"
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Insert failed: " . $conn->error
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "Exception: " . $e->getMessage()
    ]);
}
