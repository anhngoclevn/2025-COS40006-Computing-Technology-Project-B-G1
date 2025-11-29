<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

include '../../db.php';

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    $userID = intval($data['userID']);

    // Check if lecturer has any related data (courses, units, etc.)
    // You may want to add more checks here based on your database structure

    $query = "DELETE FROM users WHERE UserID = $userID AND RoleID = 2";

    if ($conn->query($query)) {
        if ($conn->affected_rows > 0) {
            echo json_encode([
                'success' => true,
                'message' => 'Lecturer deleted successfully'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Lecturer not found'
            ]);
        }
    } else {
        throw new Exception($conn->error);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error deleting lecturer: ' . $e->getMessage()
    ]);
}

$conn->close();
?>