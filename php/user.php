<?php
session_start();
header('Content-Type: application/json');

require_once 'database.php';

class User {
    private $conn;
    private $table = 'users';

    public function __construct() {
        $database = new Database();
        $this->conn = $database->connect();
    }

    public function login($email, $password) {
        $query = "SELECT id, full_name, email, password, role FROM " . $this->table . " WHERE email = :email";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();

        if($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if(password_verify($password, $row['password'])) {
                $_SESSION['user_id'] = $row['id'];
                $_SESSION['role'] = $row['role'];
                return array(
                    "success" => true,
                    "role" => $row['role']
                );
            }
        }
        return array("success" => false, "message" => "Invalid credentials");
    }

    public function signup($fullName, $email, $password, $phone, $role) {
        // Check if email already exists
        $query = "SELECT id FROM " . $this->table . " WHERE email = :email";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();

        if($stmt->rowCount() > 0) {
            return array("success" => false, "message" => "Email already exists");
        }

        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        // Insert new user
        $query = "INSERT INTO " . $this->table . " 
                (full_name, email, password, phone, role) 
                VALUES (:fullName, :email, :password, :phone, :role)";

        try {
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':fullName', $fullName);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':password', $hashedPassword);
            $stmt->bindParam(':phone', $phone);
            $stmt->bindParam(':role', $role);

            if($stmt->execute()) {
                return array("success" => true);
            }
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Registration failed");
        }
    }
}

// Handle incoming requests
$user = new User();
$data = json_decode(file_get_contents("php://input"), true);

if(isset($data['action'])) {
    switch($data['action']) {
        case 'login':
            echo json_encode($user->login($data['email'], $data['password']));
            break;
        case 'signup':
            echo json_encode($user->signup(
                $data['fullName'],
                $data['email'],
                $data['password'],
                $data['phone'],
                $data['role']
            ));
            break;
        default:
            echo json_encode(array("success" => false, "message" => "Invalid action"));
    }
}