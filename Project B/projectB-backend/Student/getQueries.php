<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

include "../db.php";


$studentId = isset($_GET["studentId"]) ? intval($_GET["studentId"]) : 0;

if ($studentId <= 0) {
    echo json_encode([
        "success" => false,
        "error" => "Missing or invalid studentId"
    ]);
    exit;
}

$sql = "
    SELECT 
        q.QueryID,
        q.StudentID,
        q.Subject,
        q.Message,
        q.Status,
        COALESCE(q.Response, '') AS Response,
        DATE_FORMAT(q.CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt,
        DATE_FORMAT(q.RespondedAt, '%Y-%m-%d %H:%i') AS RespondedAt
    FROM student_queries q
    WHERE q.StudentID = ?
    ORDER BY q.CreatedAt DESC
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode([
        "success" => false,
        "error" => "Prepare failed: " . $conn->error
    ]);
    exit;
}

$stmt->bind_param("i", $studentId);
$stmt->execute();
$result = $stmt->get_result();

$data = [];
while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode([
    "success" => true,
    "data" => $data
]);
