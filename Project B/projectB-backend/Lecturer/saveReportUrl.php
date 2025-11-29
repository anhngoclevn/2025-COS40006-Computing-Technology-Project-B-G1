<?php
// CORS + preflight cho React dev server
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Đọc JSON body
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$sessionId = $input['sessionId'] ?? '';
$studentId = $input['studentId'] ?? '';
$url       = $input['url'] ?? '';
$name      = $input['name'] ?? null;
$unit      = $input['unit'] ?? null;

if ($sessionId === '' || $studentId === '' || $url === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing params']);
    exit;
}

// Kết nối DB (MySQLi)
require_once __DIR__ . '/../db.php'; // tạo $conn (MySQLi)
if (!isset($conn)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB connection not initialized']);
    exit;
}

/*
 * YÊU CẦU: bảng student_reports cần UNIQUE KEY (session_id, student_id)
 *
 * CREATE TABLE student_reports (
 *   session_id  VARCHAR(64) NOT NULL,
 *   student_id  VARCHAR(64) NOT NULL,
 *   name        VARCHAR(255) NULL,
 *   unit        VARCHAR(64) NULL,
 *   url         TEXT NOT NULL,
 *   generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   PRIMARY KEY (session_id, student_id)  -- hoặc UNIQUE KEY
 * );
 */

try {
    $sql = "INSERT INTO student_reports (session_id, student_id, name, unit, url, generated_at)
            VALUES (?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              unit = VALUES(unit),
              url  = VALUES(url),
              generated_at = NOW()";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sssss", $sessionId, $studentId, $name, $unit, $url);
    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode(['success' => $ok ? true : false]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'detail' => $e->getMessage()]);
} finally {
    $conn->close();
}
