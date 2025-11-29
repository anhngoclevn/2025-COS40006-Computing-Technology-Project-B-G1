<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// // Xử lý CORS preflight request
// if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
//     http_response_code(200);
//     exit;
// }
//Lý do: Khi JavaScript gửi POST với Content-Type: application/json, browser sẽ gửi OPTIONS request trước để kiểm tra CORS. Nếu server không trả 200 cho OPTIONS, request chính sẽ bị chặn.

include "db.php";

if ($_SERVER["REQUEST_METHOD"] != "POST") {
    echo json_encode(["success" => false, "error" => "Method not allowed"]);
    exit;
}

// Nhận dữ liệu từ frontend
$data = json_decode(file_get_contents("php://input"), true);
$email = isset($data["email"]) ? trim($data["email"]) : "";
$password = isset($data["password"]) ? trim($data["password"]) : "";
$role = isset($data["role"]) ? trim($data["role"]) : "";

if (empty($email) || empty($password) || empty($role)) {
    echo json_encode(["success" => false, "error" => "Please fill in all fields"]);
    exit;
}

// Kiểm tra role Student - query từ bảng students
if (strcasecmp($role, "Student") === 0) {
    $sql = "SELECT StudentID, RegistrationID, FirstName, LastName, Email, CourseID, MajorID
            FROM students
            WHERE TRIM(Email) = TRIM(?)";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(["success" => false, "error" => "Database error: " . $conn->error]);
        exit;
    }

    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();

        // So sánh password với RegistrationID
        if ($password === $user["RegistrationID"]) {
            // Thêm RoleName cho frontend
            $user["RoleName"] = "Student";

            echo json_encode([
                "success" => true,
                "message" => "Login successful",
                "user" => $user
            ]);
        } else {
            echo json_encode(["success" => false, "error" => "Invalid password (use your Registration ID)"]);
        }
    } else {
        echo json_encode(["success" => false, "error" => "Student not found with this email"]);
    }

    $stmt->close();
    $conn->close();
    exit;
}

// Query từ table users (cho Admin và Lecturer)
$sql = "SELECT u.UserID, u.FirstName, u.LastName, u.Email, u.Password, u.RoleID, r.Name AS RoleName
        FROM users u
        INNER JOIN role r ON u.RoleID = r.RoleID
        WHERE u.Email = ?";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(["success" => false, "error" => "Database error: " . $conn->error]);
    exit;
}

$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();

    // Kiểm tra mật khẩu - so sánh trực tiếp vì password trong DB là plain text
    if ($password === $user["Password"]) {
        // Kiểm tra role khớp không
        if (strcasecmp($user["RoleName"], $role) !== 0) {
            echo json_encode([
                "success" => false,
                "error" => "Role mismatch! You selected '$role' but your account is registered as '{$user['RoleName']}'."
            ]);
        } else {
            // Loại bỏ password khỏi response
            unset($user["Password"]);
            echo json_encode([
                "success" => true,
                "message" => "Login successful",
                "user" => $user
            ]);
        }
    } else {
        echo json_encode(["success" => false, "error" => "Invalid password"]);
    }
} else {
    echo json_encode(["success" => false, "error" => "User not found with this email"]);
}

$stmt->close();
$conn->close();
?>