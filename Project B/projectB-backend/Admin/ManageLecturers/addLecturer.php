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

    $firstName = $conn->real_escape_string($data['firstName']);
    $lastName = $conn->real_escape_string($data['lastName']);
    $email = $conn->real_escape_string($data['email']);
    $courseID = intval($data['courseID']);
    $password = $conn->real_escape_string($data['password']); // Store as plain text (not recommended)
    $roleID = 2; // Lecturer role

    // Check if email already exists
    $checkQuery = "SELECT UserID FROM users WHERE Email = '$email'";
    $checkResult = $conn->query($checkQuery);

    if ($checkResult->num_rows > 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Email already exists'
        ]);
        exit;
    }

    $query = "
        INSERT INTO users (FirstName, LastName, Email, Password, RoleID, CourseID)
        VALUES ('$firstName', '$lastName', '$email', '$password', $roleID, $courseID)
    ";

    if ($conn->query($query)) {
        echo json_encode([
            'success' => true,
            'message' => 'Lecturer added successfully',
            'userID' => $conn->insert_id
        ]);
    } else {
        throw new Exception($conn->error);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error adding lecturer: ' . $e->getMessage()
    ]);
}

$conn->close();
?>