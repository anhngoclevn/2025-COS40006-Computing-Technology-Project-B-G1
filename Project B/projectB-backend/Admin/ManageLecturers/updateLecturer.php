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
    $firstName = $conn->real_escape_string($data['firstName']);
    $lastName = $conn->real_escape_string($data['lastName']);
    $email = $conn->real_escape_string($data['email']);
    $courseID = intval($data['courseID']);

    // Check if email already exists for other users
    $checkQuery = "SELECT UserID FROM users WHERE Email = '$email' AND UserID != $userID";
    $checkResult = $conn->query($checkQuery);

    if ($checkResult->num_rows > 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Email already exists'
        ]);
        exit;
    }

    // Build update query
    $query = "
        UPDATE users 
        SET FirstName = '$firstName',
            LastName = '$lastName',
            Email = '$email',
            CourseID = $courseID
    ";

    // Update password if provided
    if (!empty($data['password'])) {
        $password = $conn->real_escape_string($data['password']);
        $query .= ", Password = '$password'";
    }

    $query .= " WHERE UserID = $userID";

    if ($conn->query($query)) {
        echo json_encode([
            'success' => true,
            'message' => 'Lecturer updated successfully'
        ]);
    } else {
        throw new Exception($conn->error);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error updating lecturer: ' . $e->getMessage()
    ]);
}

$conn->close();
?>