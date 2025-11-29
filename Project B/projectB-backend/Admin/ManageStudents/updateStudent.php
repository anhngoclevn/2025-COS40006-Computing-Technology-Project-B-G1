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

    $studentID = intval($data['studentID']);
    $firstName = $conn->real_escape_string($data['firstName']);
    $lastName = $conn->real_escape_string($data['lastName']);
    $email = $conn->real_escape_string($data['email']);
    $courseID = intval($data['courseID']);
    $majorID = intval($data['majorID']);

    // Check if email already exists for other students
    $checkQuery = "SELECT StudentID FROM students WHERE Email = '$email' AND StudentID != $studentID";
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
        UPDATE students 
        SET FirstName = '$firstName',
            LastName = '$lastName',
            Email = '$email',
            CourseID = $courseID,
            MajorID = $majorID
    ";

    // Update password if provided
    if (!empty($data['password'])) {
        $password = $conn->real_escape_string($data['password']);
        $query .= ", Password = '$password'";
    }

    $query .= " WHERE StudentID = $studentID";

    if ($conn->query($query)) {
        echo json_encode([
            'success' => true,
            'message' => 'Student updated successfully'
        ]);
    } else {
        throw new Exception($conn->error);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error updating student: ' . $e->getMessage()
    ]);
}

$conn->close();
?>