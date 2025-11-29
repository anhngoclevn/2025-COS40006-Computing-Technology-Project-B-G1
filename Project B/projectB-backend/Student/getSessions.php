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

$unitId = isset($_GET['unitId']) ? intval($_GET['unitId']) : 0;
$studentId = isset($_GET['studentId']) ? intval($_GET['studentId']) : 0;

if ($unitId <= 0 || $studentId <= 0) {
    echo json_encode(["success" => false, "error" => "Invalid unit ID or student ID"]);
    exit;
}

try {
    // Get sessions for the unit where the student has attendance records
    $sql = "SELECT DISTINCT s.SessionID, s.Date, s.Start, s.End 
            FROM session s
            INNER JOIN attendance a ON s.SessionID = a.SessionID
            WHERE s.UnitID = ? AND a.StudentID = ?
            ORDER BY s.Date DESC, s.Start";

    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        throw new Exception("Database error: " . $conn->error);
    }

    $stmt->bind_param("ii", $unitId, $studentId);
    $stmt->execute();
    $result = $stmt->get_result();

    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    echo json_encode(["success" => true, "data" => $data]);

    $stmt->close();
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}

$conn->close();
?>