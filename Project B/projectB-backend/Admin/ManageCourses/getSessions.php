<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// require file kết nối DB
include '../../db.php';

$unitID = isset($_GET["unitID"]) ? intval($_GET["unitID"]) : 0;

if (!$unitID) {
    echo json_encode(["success" => false, "message" => "Missing unitID"]);
    exit;
}

$sql = "SELECT SessionID, UnitID, Date, Start, End 
        FROM `session`
        WHERE UnitID = ?
        ORDER BY Date ASC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $unitID);
$stmt->execute();
$result = $stmt->get_result();

$data = [];
while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode(["success" => true, "data" => $data]);
