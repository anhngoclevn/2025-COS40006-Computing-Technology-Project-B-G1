<?php
$host = "localhost";
$user = "root";
$pass = "";
$db = "projectb";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
  die(json_encode(["error" => $conn->connect_error]));
}
$conn->set_charset("utf8mb4");
?>