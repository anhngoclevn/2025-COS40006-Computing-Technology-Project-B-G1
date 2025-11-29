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

$courseId = isset($_GET['courseId']) ? intval($_GET['courseId']) : 0;

if ($courseId <= 0) {
    echo json_encode(["success" => false, "error" => "Invalid course ID"]);
    exit;
}

$sql = "SELECT UnitID, UnitCode, UnitName FROM unit WHERE CourseID = ? ORDER BY UnitCode";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $courseId);
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