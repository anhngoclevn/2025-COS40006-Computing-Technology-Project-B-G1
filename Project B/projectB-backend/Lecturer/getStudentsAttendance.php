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
$sessionId = isset($_GET['sessionId']) ? intval($_GET['sessionId']) : 0;

if ($unitId <= 0) {
    echo json_encode(["success" => false, "error" => "Invalid unit ID"]);
    exit;
}

// Get students enrolled in the unit with their attendance status
$sql = "SELECT 
            s.StudentID,
            s.RegistrationID,
            CONCAT(s.FirstName, ' ', s.LastName) as Name,
            u.UnitCode,
            COALESCE(a.Status, 'unknown') as Attendance,
            COALESCE(a.ActivePoint, 0) as ActivePoint      -- 👈 THÊM DÒNG NÀY
        FROM studentunitmap sum
        INNER JOIN students s ON sum.StudentID = s.StudentID
        INNER JOIN unit u ON sum.UnitID = u.UnitID
        LEFT JOIN session ses ON ses.UnitID = u.UnitID AND ses.SessionID = ?
        LEFT JOIN attendance a ON a.StudentID = s.StudentID AND a.SessionID = ?
        WHERE sum.UnitID = ?
        ORDER BY s.RegistrationID";


$stmt = $conn->prepare($sql);
$stmt->bind_param("iii", $sessionId, $sessionId, $unitId);
$stmt->execute();
$result = $stmt->get_result();
$data = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    echo json_encode(["success" => true, "data" => $data]);
} else {
    echo json_encode(["success" => false, "error" => "Database error: " . $conn->error]);
}

$stmt->close();
$conn->close();
?>