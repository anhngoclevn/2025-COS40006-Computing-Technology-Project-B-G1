<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

include "../db.php";

if ($_SERVER["REQUEST_METHOD"] != "POST") {
    echo json_encode(["success" => false, "error" => "Method not allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$studentId = isset($data["studentId"]) ? intval($data["studentId"]) : 0;
$sessionId = isset($data["sessionId"]) ? intval($data["sessionId"]) : 0;
$status = isset($data["status"]) ? trim($data["status"]) : "";
$activePoint = isset($data["activePoint"]) ? intval($data["activePoint"]) : 0;

if ($studentId <= 0 || $sessionId <= 0 || empty($status)) {
    echo json_encode(["success" => false, "error" => "Missing required fields"]);
    exit;
}

// Validate status
$validStatuses = ['present', 'absent', 'late', 'excused', 'unknown'];
if (!in_array($status, $validStatuses)) {
    echo json_encode(["success" => false, "error" => "Invalid status"]);
    exit;
}

// Check if attendance record exists
$checkSql = "SELECT AttendanceID FROM attendance WHERE StudentID = ? AND SessionID = ?";
$checkStmt = $conn->prepare($checkSql);
$checkStmt->bind_param("ii", $studentId, $sessionId);
$checkStmt->execute();
$checkResult = $checkStmt->get_result();

if ($checkResult->num_rows > 0) {
    // Update existing record
    $updateSql = "UPDATE attendance SET Status = ?, ActivePoint = ? WHERE StudentID = ? AND SessionID = ?";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->bind_param("siii", $status, $activePoint, $studentId, $sessionId);

    if ($updateStmt->execute()) {
        echo json_encode(["success" => true, "message" => "Attendance updated successfully"]);
    } else {
        echo json_encode(["success" => false, "error" => "Failed to update attendance"]);
    }
    $updateStmt->close();
} else {
    // Insert new record
    $insertSql = "INSERT INTO attendance (StudentID, SessionID, Status, ActivePoint) VALUES (?, ?, ?, ?)";
    $insertStmt = $conn->prepare($insertSql);
    $insertStmt->bind_param("iisi", $studentId, $sessionId, $status, $activePoint);

    if ($insertStmt->execute()) {
        echo json_encode(["success" => true, "message" => "Attendance recorded successfully"]);
    } else {
        echo json_encode(["success" => false, "error" => "Failed to record attendance"]);
    }
    $insertStmt->close();
}

$checkStmt->close();
$conn->close();
?>