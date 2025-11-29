<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

include "../db.php";

// OPTIONAL: filter theo CourseID của lecturer
$courseId = isset($_GET["courseId"]) ? intval($_GET["courseId"]) : 0;

$sql = "SELECT 
            q.QueryID,
            q.StudentID,
            s.RegistrationID,
            CONCAT(COALESCE(s.FirstName,''), ' ', COALESCE(s.LastName,'')) AS StudentName,
            q.Subject,
            q.Message,
            q.Status,
            q.Response,
            DATE_FORMAT(q.CreatedAt, '%Y-%m-%d %H:%i') AS CreatedAt,
            DATE_FORMAT(q.RespondedAt, '%Y-%m-%d %H:%i') AS RespondedAt
        FROM student_queries q
        JOIN students s ON q.StudentID = s.StudentID";

$params = [];
$types = "";

if ($courseId > 0) {
    $sql .= " WHERE s.CourseID = ?";
    $types .= "i";
    $params[] = $courseId;
}

$sql .= " ORDER BY q.CreatedAt DESC";

$stmt = $conn->prepare($sql);
if ($stmt === false) {
    echo json_encode([
        "success" => false,
        "error" => "Prepare failed: " . $conn->error
    ]);
    exit;
}

if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}

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
