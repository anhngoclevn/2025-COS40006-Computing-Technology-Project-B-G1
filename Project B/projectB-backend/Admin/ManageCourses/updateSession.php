<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

include '../../db.php';

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "Invalid JSON"]);
    exit;
}

$sessionID = isset($data["sessionID"]) ? intval($data["sessionID"]) : 0;
$date      = isset($data["date"]) ? $data["date"] : null;      // yyyy-mm-dd
$startTime = isset($data["startTime"]) ? $data["startTime"] : null; // HH:MM
$endTime   = isset($data["endTime"]) ? $data["endTime"] : null;     // HH:MM

if (!$sessionID || !$date || !$startTime || !$endTime) {
    echo json_encode(["success" => false, "message" => "Missing fields"]);
    exit;
}

$start = $startTime . ":00";
$end   = $endTime . ":00";

$sql = "UPDATE `session` 
        SET Date = ?, Start = ?, End = ?
        WHERE SessionID = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("sssi", $date, $start, $end, $sessionID);

if ($stmt->execute()) {
    echo json_encode(["success" => true]);
} else {
    echo json_encode([
        "success" => false,
        "message" => "DB error: " . $conn->error
    ]);
}
