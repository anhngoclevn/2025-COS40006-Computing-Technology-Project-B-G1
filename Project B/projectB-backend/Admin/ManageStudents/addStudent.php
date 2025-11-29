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

    $registrationID = $conn->real_escape_string($data['registrationID']);
    $firstName = $conn->real_escape_string($data['firstName']);
    $lastName = $conn->real_escape_string($data['lastName']);
    $email = $conn->real_escape_string($data['email']);
    $courseID = intval($data['courseID']);
    $majorID = intval($data['majorID']);
    $password = $conn->real_escape_string($data['password']);

    // Check if registration ID already exists
    $checkQuery = "SELECT StudentID FROM students WHERE RegistrationID = '$registrationID'";
    $checkResult = $conn->query($checkQuery);

    if ($checkResult->num_rows > 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Registration ID already exists'
        ]);
        exit;
    }

    // Check if email already exists
    $checkEmailQuery = "SELECT StudentID FROM students WHERE Email = '$email'";
    $checkEmailResult = $conn->query($checkEmailQuery);

    if ($checkEmailResult->num_rows > 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Email already exists'
        ]);
        exit;
    }

    $query = "
        INSERT INTO students (RegistrationID, FirstName, LastName, Email, Password, CourseID, MajorID)
        VALUES ('$registrationID', '$firstName', '$lastName', '$email', '$password', $courseID, $majorID)
    ";

    if ($conn->query($query)) {
        echo json_encode([
            'success' => true,
            'message' => 'Student added successfully',
            'studentID' => $conn->insert_id
        ]);
    } else {
        throw new Exception($conn->error);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error adding student: ' . $e->getMessage()
    ]);
}

$conn->close();
?>