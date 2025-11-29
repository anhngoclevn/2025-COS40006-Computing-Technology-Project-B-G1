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

$courseID = isset($data["courseID"]) ? intval($data["courseID"]) : 0; // hiện chưa dùng
$unitID = isset($data["unitID"]) ? intval($data["unitID"]) : 0;
$sections = isset($data["sections"]) ? $data["sections"] : [];

$startTime = isset($data["startTime"]) ? $data["startTime"] : null; // "HH:MM"
$endTime = isset($data["endTime"]) ? $data["endTime"] : null;

if (!$unitID || empty($sections)) {
    echo json_encode([
        "success" => false,
        "message" => "Missing unitID or sections"
    ]);
    exit;
}

if (!$startTime || !$endTime) {
    echo json_encode([
        "success" => false,
        "message" => "Missing startTime or endTime"
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

$conn->begin_transaction();

try {
    // bảng `session`: SessionID, UnitID, Date, Start, End
    $stmt = $conn->prepare("
        INSERT INTO `session` (UnitID, Date, Start, End)
        VALUES (?, ?, ?, ?)
    ");

    foreach ($sections as $s) {
        $dateStr = $s["date"]; // yyyy-mm-dd
        // thêm :00 để thành HH:MM:SS
        $start = $startTime . ":00";
        $end = $endTime . ":00";

        $stmt->bind_param("isss", $unitID, $dateStr, $start, $end);
        $stmt->execute();
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Sections inserted into `session` successfully"
    ]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode([
        "success" => false,
        "message" => "DB error: " . $e->getMessage()
    ]);
}
