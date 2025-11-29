<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

include "../db.php";

if ($_SERVER["REQUEST_METHOD"] != "GET") {
    echo json_encode(["success" => false, "error" => "Method not allowed"]);
    exit;
}

$studentId = isset($_GET["studentId"]) ? intval($_GET["studentId"]) : 0;

if ($studentId <= 0) {
    echo json_encode(["success" => false, "error" => "Invalid student ID"]);
    exit;
}

try {
    // Query to get attendance with unit and session details
    $sql = "SELECT 
                a.AttendanceID,
                a.Status as Attendance,
                a.ActivePoint,
                u.UnitID,
                u.UnitCode,
                u.UnitName,
                s.Date,
                s.Start,
                s.End,
                s.SessionID
            FROM attendance a
            INNER JOIN session s ON a.SessionID = s.SessionID
            INNER JOIN unit u ON s.UnitID = u.UnitID
            WHERE a.StudentID = ?
            ORDER BY s.Date DESC, s.Start DESC";

    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        throw new Exception("Database error: " . $conn->error);
    }

    $stmt->bind_param("i", $studentId);
    $stmt->execute();
    $result = $stmt->get_result();

    $attendanceRecords = [];
    while ($row = $result->fetch_assoc()) {
        $attendanceRecords[] = $row;
    }

    echo json_encode([
        "success" => true,
        "data" => $attendanceRecords,
        "total" => count($attendanceRecords)
    ]);

    $stmt->close();
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}

$conn->close();
?>