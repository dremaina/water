<?php
session_start();
header('Content-Type: application/json');

require_once 'database.php';
require_once 'role-check.php';

class Inventory {
    private $conn;
    private $products_table = 'inventory';
    private $sales_table = 'sales';

    public function __construct() {
        $database = new Database();
        $this->conn = $database->connect();
    }

    public function getProducts() {
        $query = "SELECT * FROM " . $this->products_table;
        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        $products = array();
        while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $products[] = $row;
        }

        return array("success" => true, "products" => $products);
    }

    public function addProduct($name, $price, $quantity, $description, $image = null) {
        if(!isAdmin()) {
            return array("success" => false, "message" => "Unauthorized access");
        }

        $query = "INSERT INTO " . $this->products_table . "
                (name, price, quantity, description, image) 
                VALUES (:name, :price, :quantity, :description, :image)";

        try {
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':price', $price);
            $stmt->bindParam(':quantity', $quantity);
            $stmt->bindParam(':description', $description);
            $stmt->bindParam(':image', $image);

            if($stmt->execute()) {
                return array("success" => true);
            }
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Failed to add product");
        }
    }

    public function updateProduct($id, $name, $price, $quantity, $description, $image = null) {
        if(!isAdmin()) {
            return array("success" => false, "message" => "Unauthorized access");
        }

        $query = "UPDATE " . $this->products_table . "
                SET name = :name, price = :price, quantity = :quantity, 
                    description = :description" . 
                ($image ? ", image = :image" : "") . "
                WHERE id = :id";

        try {
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':price', $price);
            $stmt->bindParam(':quantity', $quantity);
            $stmt->bindParam(':description', $description);
            if ($image) {
                $stmt->bindParam(':image', $image);
            }

            if($stmt->execute()) {
                return array("success" => true);
            }
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Failed to update product");
        }
    }

    public function deleteProduct($id) {
        if(!isAdmin()) {
            return array("success" => false, "message" => "Unauthorized access");
        }

        try {
            $this->conn->beginTransaction();

            // Check if product has any sales records
            $query = "SELECT COUNT(*) FROM " . $this->sales_table . " WHERE product_id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            
            if ($stmt->fetchColumn() > 0) {
                $this->conn->rollBack();
                return array("success" => false, "message" => "Cannot delete product with sales history");
            }

            // Delete the product
            $query = "DELETE FROM " . $this->products_table . " WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id);

            if($stmt->execute()) {
                $this->conn->commit();
                return array("success" => true);
            }
        } catch(PDOException $e) {
            $this->conn->rollBack();
            return array("success" => false, "message" => "Failed to delete product");
        }
    }

    public function purchase($productId, $quantity) {
        if(!isset($_SESSION['user_id'])) {
            return array("success" => false, "message" => "Please login to make a purchase");
        }

        try {
            $this->conn->beginTransaction();

            // Check product availability
            $query = "SELECT quantity, price FROM " . $this->products_table . "
                    WHERE id = :id FOR UPDATE";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $productId);
            $stmt->execute();
            $product = $stmt->fetch(PDO::FETCH_ASSOC);

            if(!$product) {
                $this->conn->rollBack();
                return array("success" => false, "message" => "Product not found");
            }

            if($product['quantity'] < $quantity) {
                $this->conn->rollBack();
                return array("success" => false, "message" => "Insufficient quantity available");
            }

            // Update inventory
            $newQuantity = $product['quantity'] - $quantity;
            $query = "UPDATE " . $this->products_table . "
                    SET quantity = :quantity WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':quantity', $newQuantity);
            $stmt->bindParam(':id', $productId);
            $stmt->execute();

            // Record sale
            $totalAmount = $product['price'] * $quantity;
            $query = "INSERT INTO " . $this->sales_table . "
                    (user_id, product_id, quantity, total_amount, transaction_date)
                    VALUES (:user_id, :product_id, :quantity, :total_amount, NOW())";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            $stmt->bindParam(':product_id', $productId);
            $stmt->bindParam(':quantity', $quantity);
            $stmt->bindParam(':total_amount', $totalAmount);
            $stmt->execute();

            $this->conn->commit();
            return array("success" => true);
        } catch(PDOException $e) {
            $this->conn->rollBack();
            return array("success" => false, "message" => "Transaction failed");
        }
    }
}

// Handle incoming requests
$inventory = new Inventory();
$data = json_decode(file_get_contents("php://input"), true);

if(isset($data['action'])) {
    switch($data['action']) {
        case 'getProducts':
            echo json_encode($inventory->getProducts());
            break;
        case 'addProduct':
            echo json_encode($inventory->addProduct(
                $data['name'],
                $data['price'],
                $data['quantity'],
                $data['description'],
                $data['image'] ?? null
            ));
            break;
        case 'updateProduct':
            echo json_encode($inventory->updateProduct(
                $data['id'],
                $data['name'],
                $data['price'],
                $data['quantity'],
                $data['description'],
                $data['image'] ?? null
            ));
            break;
        case 'deleteProduct':
            echo json_encode($inventory->deleteProduct($data['productId']));
            break;
        case 'purchase':
            echo json_encode($inventory->purchase($data['productId'], $data['quantity']));
            break;
        default:
            echo json_encode(array("success" => false, "message" => "Invalid action"));
    }
}