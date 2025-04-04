<?php
session_start();
require_once 'database.php';
require_once 'role-check.php';

class Cart {
    private $conn;
    private $cart_table = 'cart';
    private $orders_table = 'orders';
    private $order_items_table = 'order_items';
    private $tracking_table = 'order_tracking';
    private $mpesa_table = 'mpesa_transactions';

    public function __construct() {
        $database = new Database();
        $this->conn = $database->connect();
    }

    public function addToCart($productId, $quantity) {
        checkAuthentication();
        
        try {
            // Check if item already exists in cart
            $query = "SELECT id, quantity FROM " . $this->cart_table . 
                    " WHERE user_id = :user_id AND product_id = :product_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            $stmt->bindParam(':product_id', $productId);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                // Update existing cart item
                $cartItem = $stmt->fetch(PDO::FETCH_ASSOC);
                $newQuantity = $cartItem['quantity'] + $quantity;
                
                $query = "UPDATE " . $this->cart_table . 
                        " SET quantity = :quantity, updated_at = NOW() 
                         WHERE id = :id";
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':quantity', $newQuantity);
                $stmt->bindParam(':id', $cartItem['id']);
            } else {
                // Insert new cart item
                $query = "INSERT INTO " . $this->cart_table . 
                        " (user_id, product_id, quantity) 
                         VALUES (:user_id, :product_id, :quantity)";
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':user_id', $_SESSION['user_id']);
                $stmt->bindParam(':product_id', $productId);
                $stmt->bindParam(':quantity', $quantity);
            }
            
            if ($stmt->execute()) {
                return array("success" => true);
            }
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Database error occurred");
        }
    }

    public function getCart() {
        checkAuthentication();
        
        try {
            $query = "SELECT c.*, i.name, i.price, i.image
                    FROM " . $this->cart_table . " c
                    JOIN inventory i ON c.product_id = i.id
                    WHERE c.user_id = :user_id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            $stmt->execute();
            
            $items = array();
            $total = 0;
            
            while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $subtotal = $row['quantity'] * $row['price'];
                $total += $subtotal;
                $row['subtotal'] = $subtotal;
                $items[] = $row;
            }
            
            return array(
                "success" => true,
                "items" => $items,
                "total" => $total
            );
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Database error occurred");
        }
    }

    public function updateCartItem($cartId, $quantity) {
        checkAuthentication();
        
        try {
            $query = "UPDATE " . $this->cart_table . "
                    SET quantity = :quantity, updated_at = NOW()
                    WHERE id = :id AND user_id = :user_id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':quantity', $quantity);
            $stmt->bindParam(':id', $cartId);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            
            if ($stmt->execute()) {
                return array("success" => true);
            }
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Database error occurred");
        }
    }

    public function removeFromCart($cartId) {
        checkAuthentication();
        
        try {
            $query = "DELETE FROM " . $this->cart_table . "
                    WHERE id = :id AND user_id = :user_id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $cartId);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            
            if ($stmt->execute()) {
                return array("success" => true);
            }
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Database error occurred");
        }
    }

    public function checkout($deliveryAddress) {
        checkAuthentication();
        
        try {
            $this->conn->beginTransaction();
            
            // Get cart items
            $cart = $this->getCart();
            if (!$cart['success'] || empty($cart['items'])) {
                throw new Exception("Cart is empty");
            }
            
            // Create order
            $query = "INSERT INTO " . $this->orders_table . "
                    (user_id, total_amount, delivery_address)
                    VALUES (:user_id, :total_amount, :delivery_address)";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            $stmt->bindParam(':total_amount', $cart['total']);
            $stmt->bindParam(':delivery_address', $deliveryAddress);
            $stmt->execute();
            
            $orderId = $this->conn->lastInsertId();
            
            // Create order items
            foreach ($cart['items'] as $item) {
                $query = "INSERT INTO " . $this->order_items_table . "
                        (order_id, product_id, quantity, price_per_unit, subtotal)
                        VALUES (:order_id, :product_id, :quantity, :price, :subtotal)";
                
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':order_id', $orderId);
                $stmt->bindParam(':product_id', $item['product_id']);
                $stmt->bindParam(':quantity', $item['quantity']);
                $stmt->bindParam(':price', $item['price']);
                $stmt->bindParam(':subtotal', $item['subtotal']);
                $stmt->execute();
            }
            
            // Add initial tracking status
            $query = "INSERT INTO " . $this->tracking_table . "
                    (order_id, status, notes)
                    VALUES (:order_id, 'order_placed', 'Order has been placed successfully')";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':order_id', $orderId);
            $stmt->execute();
            
            // Clear cart
            $query = "DELETE FROM " . $this->cart_table . " WHERE user_id = :user_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            $stmt->execute();
            
            $this->conn->commit();
            
            return array(
                "success" => true,
                "order_id" => $orderId,
                "total_amount" => $cart['total']
            );
        } catch(Exception $e) {
            $this->conn->rollBack();
            return array("success" => false, "message" => $e->getMessage());
        }
    }

    public function initiatePayment($orderId, $phoneNumber) {
        try {
            // Generate unique transaction ID
            $transactionId = 'WV' . time() . rand(1000, 9999);
            
            // Get order details
            $query = "SELECT total_amount FROM " . $this->orders_table . "
                    WHERE id = :order_id AND user_id = :user_id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':order_id', $orderId);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            $stmt->execute();
            
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                return array("success" => false, "message" => "Order not found");
            }
            
            // Insert M-Pesa transaction record
            $query = "INSERT INTO " . $this->mpesa_table . "
                    (order_id, transaction_id, phone_number, amount)
                    VALUES (:order_id, :transaction_id, :phone_number, :amount)";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':order_id', $orderId);
            $stmt->bindParam(':order_id', $orderId);
            $stmt->bindParam(':phone_number', $phoneNumber);
            $stmt->bindParam(':amount', $order['total_amount']);
            $stmt->execute();
            
            // TODO: Integrate with actual M-Pesa API here
            // For now, simulating successful payment
            $this->simulatePaymentSuccess($orderId);
            
            return array(
                "success" => true,
                "order_id" => $orderId
            );
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Database error occurred");
        }
    }

    private function simulatePaymentSuccess($orderid) {
        // This is a placeholder for M-Pesa API integration
        // In production, this would be replaced with actual M-Pesa API calls
        
        try {
            $query = "UPDATE " . $this->order_items . "
                    SET status = 'completed',
                        result_code = '0',
                        result_desc = 'Success',
                        completed_at = NOW()
                    WHERE order_id = :order_id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':order_id', $orderid);
            $stmt->execute();
            
            // Update order status
            $query = "UPDATE " . $this->orders_table . " o
                    SET o.status = 'processing'
                    WHERE m.transaction_id = :id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':order_id', $orderid);
            $stmt->execute();
            
            // Add tracking status
            $query = "INSERT INTO " . $this->tracking_table . "
                    (order_id, status, notes)
                    SELECT order_id, 'payment_received', 'Payment confirmed via M-Pesa'
                    FROM " . $this->order_items . "
                    WHERE order_id = :order_id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':order_id', $orderid);
            $stmt->execute();
            
        } catch(PDOException $e) {
            error_log($e->getMessage());
        }
    }

    public function getUserOrders() {
        checkAuthentication();
        
        try {
            $query = "SELECT o.*, 
                    (SELECT status FROM " . $this->tracking_table . "
                     WHERE order_id = o.id 
                     ORDER BY created_at DESC LIMIT 1) as current_status
                    FROM " . $this->orders_table . " o
                    WHERE o.user_id = :user_id
                    ORDER BY o.created_at DESC";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            $stmt->execute();
            
            $orders = array();
            while($order = $stmt->fetch(PDO::FETCH_ASSOC)) {
                // Get order items
                $query = "SELECT oi.*, i.name, i.image
                        FROM " . $this->order_items_table . " oi
                        JOIN inventory i ON oi.product_id = i.id
                        WHERE oi.order_id = :order_id";
                
                $itemStmt = $this->conn->prepare($query);
                $itemStmt->bindParam(':order_id', $order['id']);
                $itemStmt->execute();
                
                $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Get tracking history
                $query = "SELECT * FROM " . $this->tracking_table . "
                        WHERE order_id = :order_id
                        ORDER BY created_at DESC";
                
                $trackStmt = $this->conn->prepare($query);
                $trackStmt->bindParam(':order_id', $order['id']);
                $trackStmt->execute();
                
                $order['tracking'] = $trackStmt->fetchAll(PDO::FETCH_ASSOC);
                
                $orders[] = $order;
            }
            
            return array("success" => true, "orders" => $orders);
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Database error occurred");
        }
    }

    public function generateReceipt($orderId) {
        checkAuthentication();
        
        try {
            // Get order details
            $query = "SELECT o.*, u.full_name, u.email, u.phone,
                    m.transaction_id as transaction
                    FROM " . $this->orders_table . " o
                    JOIN users u ON o.user_id = u.id
                    LEFT JOIN " . $this->mpesa_table . " m ON o.id = m.order_id
                    WHERE o.id = :order_id AND o.user_id = :user_id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':order_id', $orderId);
            $stmt->bindParam(':user_id', $_SESSION['user_id']);
            $stmt->execute();
            
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                return array("success" => false, "message" => "Order not found");
            }
            
            // Get order items
            $query = "SELECT oi.*, i.name
                    FROM " . $this->order_items_table . " oi
                    JOIN inventory i ON oi.product_id = i.id
                    WHERE oi.order_id = :order_id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':order_id', $orderId);
            $stmt->execute();
            
            $order['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return array(
                "success" => true,
                "receipt" => $order
            );
        } catch(PDOException $e) {
            return array("success" => false, "message" => "Database error occurred");
        }
    }
}

// Handle incoming requests
$cart = new Cart();
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['action'])) {
    echo json_encode(array("success" => false, "message" => "No action specified"));
    exit();
}

switch($data['action']) {
    case 'addToCart':
        echo json_encode($cart->addToCart($data['productId'], $data['quantity']));
        break;
    case 'getCart':
        echo json_encode($cart->getCart());
        break;
    case 'updateCart':
        echo json_encode($cart->updateCartItem($data['cartId'], $data['quantity']));
        break;
    case 'removeFromCart':
        echo json_encode($cart->removeFromCart($data['cartId']));
        break;
    case 'checkout':
        echo json_encode($cart->checkout($data['deliveryAddress']));
        break;
    case 'initiatePayment':
        echo json_encode($cart->initiatePayment($data['orderId'], $data['phoneNumber']));
        break;
    case 'getUserOrders':
        echo json_encode($cart->getUserOrders());
        break;
    case 'generateReceipt':
        echo json_encode($cart->generateReceipt($data['orderId']));
        break;
    default:
        echo json_encode(array("success" => false, "message" => "Invalid action"));
}
?>