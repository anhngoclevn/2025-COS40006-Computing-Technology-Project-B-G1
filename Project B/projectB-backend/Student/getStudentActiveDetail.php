<?php
header('Content-Type: application/json; charset=utf-8');

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

include "../db.php";

// Lấy param
$sessionId = isset($_GET['sessionId']) ? (int)$_GET['sessionId'] : 0;
$studentId = isset($_GET['studentId']) ? (int)$_GET['studentId'] : 0;

if ($sessionId <= 0 || $studentId <= 0) {
    echo json_encode([
        "success" => false,
        "error" => "Missing or invalid sessionId / studentId"
    ]);
    exit;
}

// Đọc từ attendance_active (cùng bảng với bên lecturer)
$sql = "SELECT ALSScore, TotalLabeledSeconds, Seconds
        FROM attendance_active
        WHERE SessionID = ? AND StudentID = ?
        LIMIT 1";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode([
        "success" => false,
        "error" => "Prepare failed: " . $conn->error
    ]);
    exit;
}

$stmt->bind_param("ii", $sessionId, $studentId);
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
    $alsScore = (float)$row['ALSScore'];
    $totalSec = (int)$row['TotalLabeledSeconds'];

    $secondsJson = $row['Seconds'];
    $secondsArr = json_decode($secondsJson, true);
    if (!is_array($secondsArr)) {
        $secondsArr = [];
    }

    $getSec = function($key) use ($secondsArr) {
        return isset($secondsArr[$key]) ? (float)$secondsArr[$key] : 0.0;
    };

    $data = [
        "als_score"              => $alsScore,
        "total_labeled_seconds"  => $totalSec,

        "upright_seconds"        => $getSec("upright"),
        "reading_seconds"        => $getSec("reading"),
        "writing_seconds"        => $getSec("writing"),
        "hand_raising_seconds"   => $getSec("hand-raising"),
        "raise_head_seconds"     => $getSec("raise_head"),
        "turn_head_seconds"      => $getSec("turn_head"),
        "book_seconds"           => $getSec("book"),
        "phone_seconds"          => $getSec("phone"),
        "using_phone_seconds"    => $getSec("Using_phone"),
        "sleep_seconds"          => $getSec("sleep"),
        "bend_seconds"           => $getSec("bend"),
        "bow_head_seconds"       => $getSec("bow_head"),
    ];

    echo json_encode([
        "success" => true,
        "data" => $data
    ]);
} else {
    // Không có dữ liệu active cho session này
    echo json_encode([
        "success" => true,
        "data" => null
    ]);
}

$stmt->close();
$conn->close();
