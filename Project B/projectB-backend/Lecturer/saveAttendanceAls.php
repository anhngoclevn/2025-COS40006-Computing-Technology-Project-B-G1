<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

include "../db.php";

// =========================
// READ JSON INPUT
// =========================
$raw = file_get_contents("php://input");
$input = json_decode($raw, true);

if (!is_array($input)) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid JSON payload"
    ]);
    exit;
}

$sessionId = isset($input["sessionId"]) ? intval($input["sessionId"]) : 0;
$studentId = isset($input["studentId"]) ? intval($input["studentId"]) : 0;
$alsScore = isset($input["alsScore"]) ? floatval($input["alsScore"]) : 0.0;
$totalLabeledSeconds = isset($input["totalLabeledSeconds"]) ? intval($input["totalLabeledSeconds"]) : 0;
$seconds = (isset($input["seconds"]) && is_array($input["seconds"]))
    ? $input["seconds"]
    : [];

// basic validation
if ($sessionId <= 0 || $studentId <= 0) {
    echo json_encode([
        "success" => false,
        "error" => "Missing or invalid sessionId / studentId"
    ]);
    exit;
}

// =========================
// BUILD Proportions (nếu có Seconds)
// =========================
$proportions = [];
if ($totalLabeledSeconds > 0 && !empty($seconds)) {
    foreach ($seconds as $label => $sec) {
        $secVal = floatval($sec);
        if ($secVal < 0)
            $secVal = 0;
        $proportions[$label] = $secVal / $totalLabeledSeconds;
    }
}

// JSON encode
$propsJson = json_encode($proportions, JSON_UNESCAPED_UNICODE);
$secondsJson = json_encode($seconds, JSON_UNESCAPED_UNICODE);

if ($propsJson === false)
    $propsJson = "{}";
if ($secondsJson === false)
    $secondsJson = "{}";

// =========================
// UPSERT INTO attendance_active
// =========================
//
// Bảng attendance_active:
// ActiveID (PK, AI)
// StudentID INT
// SessionID INT
// ALSScore DECIMAL(5,2)
// TotalLabeledSeconds INT
// Proportions LONGTEXT (JSON)
// Seconds LONGTEXT (JSON)
// UNIQUE KEY (StudentID, SessionID)
//
// => Dùng INSERT ... ON DUPLICATE KEY UPDATE
//
$sql = "
    INSERT INTO attendance_active
        (StudentID, SessionID, ALSScore, TotalLabeledSeconds, Proportions, Seconds)
    VALUES
        (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        ALSScore            = VALUES(ALSScore),
        TotalLabeledSeconds = VALUES(TotalLabeledSeconds),
        Proportions         = VALUES(Proportions),
        Seconds             = VALUES(Seconds),
        CreatedAt           = CURRENT_TIMESTAMP
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode([
        "success" => false,
        "error" => "Prepare failed: " . $conn->error
    ]);
    exit;
}

// 2 int, 1 float, 1 int, 2 string => "iidiss"
$stmt->bind_param(
    "iidiss",
    $studentId,
    $sessionId,
    $alsScore,
    $totalLabeledSeconds,
    $propsJson,
    $secondsJson
);

if (!$stmt->execute()) {
    echo json_encode([
        "success" => false,
        "error" => "Execute failed: " . $stmt->error
    ]);
    $stmt->close();
    $conn->close();
    exit;
}

$stmt->close();
$conn->close();

echo json_encode([
    "success" => true,
    "message" => "Attendance active (ALS) saved successfully"
]);
