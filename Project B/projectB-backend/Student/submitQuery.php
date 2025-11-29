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
$subject = isset($data["subject"]) ? trim($data["subject"]) : "";
$message = isset($data["message"]) ? trim($data["message"]) : "";

if ($studentId <= 0 || empty($subject) || empty($message)) {
    echo json_encode(["success" => false, "error" => "Missing required fields"]);
    exit;
}

try {
    $sql = "INSERT INTO student_queries (StudentID, Subject, Message, CreatedAt)
            VALUES (?, ?, ?, NOW())";

    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        throw new Exception("Database error: " . $conn->error);
    }

    $stmt->bind_param("iss", $studentId, $subject, $message);

    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Query submitted successfully",
            "queryId" => $stmt->insert_id
        ]);
    } else {
        throw new Exception("Failed to insert query");
    }

    $stmt->close();
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}

$conn->close();
?>