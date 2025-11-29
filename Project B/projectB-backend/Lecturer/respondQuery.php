<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

include "../db.php";

$input = json_decode(file_get_contents("php://input"), true);

$queryId = isset($input["queryId"]) ? intval($input["queryId"]) : 0;
$response = isset($input["response"]) ? trim($input["response"]) : "";
$status = isset($input["status"]) ? trim($input["status"]) : "responded";

// tuỳ bạn có dùng hay không, ở đây chưa lưu lecturerId vào DB
//$lecturerId = isset($input["lecturerId"]) ? intval($input["lecturerId"]) : null;

if ($queryId <= 0 || $response === "") {
    echo json_encode([
        "success" => false,
        "error" => "Missing queryId or response"
    ]);
    exit;
}

// validate status
$allowed = ["pending", "responded", "resolved"];
if (!in_array($status, $allowed, true)) {
    $status = "responded";
}

$sql = "UPDATE student_queries
        SET Response = ?, Status = ?, RespondedAt = NOW()
        WHERE QueryID = ?";

$stmt = $conn->prepare($sql);
if ($stmt === false) {
    echo json_encode([
        "success" => false,
        "error" => "Prepare failed: " . $conn->error
    ]);
    exit;
}

$stmt->bind_param("ssi", $response, $status, $queryId);

if ($stmt->execute()) {
    $respondedAt = date("Y-m-d H:i"); // để update lại UI

    echo json_encode([
        "success" => true,
        "status" => $status,
        "respondedAt" => $respondedAt
    ]);
} else {
    echo json_encode([
        "success" => false,
        "error" => "Execute failed: " . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
