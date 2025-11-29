<?php
// CORS + preflight cho React dev server
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header("Content-Type: application/json; charset=utf-8");

// Lấy sessionId
$sessionId = $_GET['sessionId'] ?? '';
if ($sessionId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing sessionId']);
    exit;
}

// Kết nối DB (MySQLi)
require_once __DIR__ . '/../db.php'; // tạo $conn (MySQLi)
if (!isset($conn)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB connection not initialized']);
    exit;
}

// Query: map student_id -> url
$out = [];
try {
    $sql = "SELECT student_id, url FROM student_reports WHERE session_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $sessionId);   // dùng "s" cho an toàn (sessionId có thể là chuỗi)
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $out[$row['student_id']] = $row['url'];
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $out], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'detail' => $e->getMessage()]);
} finally {
    $conn->close();
}
