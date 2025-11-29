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

if ($unitId <= 0) {
    echo json_encode(["success" => false, "error" => "Invalid unit ID"]);
    exit;
}

// Get sessions for the unit
$sql = "SELECT SessionID, Date, Start, End 
        FROM session 
        WHERE UnitID = ? 
        ORDER BY Date DESC, Start";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $unitId);
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