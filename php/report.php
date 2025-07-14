<?php
session_start();
require_once 'database.php';
require_once 'role-check.php';

// Enable error reporting for debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Enable CORS for development
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

class Report {
    private $conn;
    private $sales_table = 'sales';
    private $inventory_table = 'inventory';
    private $users_table = 'users';
    private $reports_table = 'reports';

    public function __construct() {
        $database = new Database();
        $this->conn = $database->connect();
    }

    private function getDateRange($range, $startDate = null, $endDate = null) {
        $end = date('Y-m-d H:i:s');
        switch($range) {
            case 'today':
                $start = date('Y-m-d 00:00:00');
                break;
            case 'week':
                $start = date('Y-m-d 00:00:00', strtotime('-7 days'));
                break;
            case 'month':
                $start = date('Y-m-d 00:00:00', strtotime('-30 days'));
                break;
            case 'custom':
                $start = date('Y-m-d 00:00:00', strtotime($startDate));
                $end = date('Y-m-d 23:59:59', strtotime($endDate));
                break;
            default:
                $start = date('Y-m-d 00:00:00', strtotime('-30 days'));
        }
        return array($start, $end);
    }

    public function generateSalesReport($dateRange, $startDate = null, $endDate = null) {
        list($start, $end) = $this->getDateRange($dateRange, $startDate, $endDate);

        $query = "SELECT s.*, i.name as product_name, u.full_name as customer_name
                FROM " . $this->sales_table . " s
                JOIN " . $this->inventory_table . " i ON s.product_id = i.id
                JOIN " . $this->users_table . " u ON s.user_id = u.id
                WHERE s.transaction_date BETWEEN :start AND :end
                ORDER BY s.transaction_date DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':start', $start);
        $stmt->bindParam(':end', $end);
        $stmt->execute();

        $sales = array();
        $total_revenue = 0;

        while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $sales[] = $row;
            $total_revenue += $row['total_amount'];
        }

        return array(
            'sales' => $sales,
            'total_revenue' => $total_revenue,
            'period' => array('start' => $start, 'end' => $end)
        );
    }

    public function generateInventoryReport() {
        $query = "SELECT i.*, 
                COALESCE(SUM(s.quantity), 0) as total_sales,
                COALESCE(SUM(s.total_amount), 0) as revenue
                FROM " . $this->inventory_table . " i
                LEFT JOIN " . $this->sales_table . " s ON i.id = s.product_id
                GROUP BY i.id
                ORDER BY i.name";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        $products = array();
        while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $products[] = $row;
        }

        return array('products' => $products);
    }

    public function generateUserActivityReport($dateRange, $startDate = null, $endDate = null) {
        if(!isMasterAdmin()) {
            return array("success" => false, "message" => "Unauthorized access");
        }

        list($start, $end) = $this->getDateRange($dateRange, $startDate, $endDate);

        $query = "SELECT u.id, u.full_name, u.role, u.created_at,
                COUNT(s.id) as total_purchases,
                MAX(s.transaction_date) as last_activity,
                CASE WHEN MAX(s.transaction_date) > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END as is_active
                FROM " . $this->users_table . " u
                LEFT JOIN " . $this->sales_table . " s ON u.id = s.user_id
                GROUP BY u.id
                ORDER BY u.full_name";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        $users = array();
        while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $users[] = $row;
        }

        return array('users' => $users);
    }

    public function exportReport($type, $dateRange, $startDate = null, $endDate = null) {
        switch($type) {
            case 'sales':
                $data = $this->generateSalesReport($dateRange, $startDate, $endDate);
                break;
            case 'inventory':
                $data = $this->generateInventoryReport();
                break;
            case 'user_activity':
                if(!isMasterAdmin()) {
                    return array("success" => false, "message" => "Unauthorized access");
                }
                $data = $this->generateUserActivityReport($dateRange, $startDate, $endDate);
                break;
            default:
                return array("success" => false, "message" => "Invalid report type");
        }

        // Store report in database
        $query = "INSERT INTO " . $this->reports_table . "
                (title, type, data, generated_by)
                VALUES (:title, :type, :data, :generated_by)";

        $stmt = $this->conn->prepare($query);
        $title = ucfirst($type) . " Report - " . date('Y-m-d H:i:s');
        $jsonData = json_encode($data);

        $stmt->bindParam(':title', $title);
        $stmt->bindParam(':type', $type);
        $stmt->bindParam(':data', $jsonData);
        $stmt->bindParam(':generated_by', $_SESSION['user_id']);
        $stmt->execute();

        return array(
            "success" => true,
            "report" => $data
        );
    }
}

// Handle incoming requests
$report = new Report();
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['action'])) {
    echo json_encode(['success' => false, 'message' => 'No action specified']);
    exit();
}

switch ($data['action']) {
    case 'generateReport':
        generateReport($report, $data);
        break;
    case 'exportReport':
        exportReport($report, $data);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}

function generateReport($report, $data) {
    try {
        $type = $data['type'];
        $dateRange = $data['dateRange'];
        $startDate = isset($data['startDate']) ? $data['startDate'] : null;
        $endDate = isset($data['endDate']) ? $data['endDate'] : null;

        // Build date condition
        $dateCondition = '';
        switch ($dateRange) {
            case 'today':
                $dateCondition = "DATE(transaction_date) = CURDATE()";
                break;
            case 'week':
                $dateCondition = "transaction_date >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)";
                break;
            case 'month':
                $dateCondition = "transaction_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)";
                break;
            case 'year':
                $dateCondition = "transaction_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)";
                break;
            case 'custom':
                if ($startDate && $endDate) {
                    $dateCondition = "DATE(transaction_date) BETWEEN '$startDate' AND '$endDate'";
                }
                break;
            default:
                $dateCondition = "1=1"; // No date filter
        }

        $reportData = [];
        switch ($type) {
            case 'sales':
                $reportData = $report->generateSalesReport($dateRange, $startDate, $endDate);
                break;
            case 'inventory':
                $reportData = $report->generateInventoryReport();
                break;
            case 'user_activity':
                $reportData = $report->generateUserActivityReport($dateRange, $startDate, $endDate);
                break;
        }

        echo json_encode(['success' => true, 'report' => $reportData]);
    } catch (PDOException $e) {
        error_log($e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error occurred']);
    }
}

function exportReport($report, $data) {
    try {
        // Generate the report data
        $type = $data['type'];
        $dateRange = $data['dateRange'];
        $startDate = isset($data['startDate']) ? $data['startDate'] : null;
        $endDate = isset($data['endDate']) ? $data['endDate'] : null;

        // Build date condition
        $dateCondition = '';
        switch ($dateRange) {
            case 'today':
                $dateCondition = "DATE(transaction_date) = CURDATE()";
                break;
            case 'week':
                $dateCondition = "transaction_date >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)";
                break;
            case 'month':
                $dateCondition = "transaction_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)";
                break;
            case 'year':
                $dateCondition = "transaction_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)";
                break;
            case 'custom':
                if ($startDate && $endDate) {
                    $dateCondition = "DATE(transaction_date) BETWEEN '$startDate' AND '$endDate'";
                }
                break;
            default:
                $dateCondition = "1=1"; // No date filter
        }

        $filename = $type . '_report_' . date('Y-m-d') . '.csv';
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $output = fopen('php://output', 'w');

        switch ($type) {
            case 'sales':
                fputcsv($output, ['Date', 'Product', 'Customer', 'Quantity', 'Total Amount']);
                
                $query = "SELECT s.transaction_date, 
                         i.name as product_name,
                         u.full_name as customer_name,
                         s.quantity,
                         s.total_amount
                         FROM sales s
                         JOIN inventory i ON s.product_id = i.id
                         JOIN users u ON s.user_id = u.id
                         WHERE $dateCondition
                         ORDER BY s.transaction_date DESC";
                
                $stmt = $report->conn->prepare($query);
                $stmt->execute();
                
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    fputcsv($output, [
                        $row['transaction_date'],
                        $row['product_name'],
                        $row['customer_name'],
                        $row['quantity'],
                        $row['total_amount']
                    ]);
                }
                break;

            case 'inventory':
                fputcsv($output, ['Product', 'Description', 'Current Stock', 'Total Sales', 'Revenue']);
                
                $query = "SELECT i.name,
                         i.description,
                         i.quantity as current_stock,
                         COALESCE(SUM(s.quantity), 0) as total_sales,
                         COALESCE(SUM(s.total_amount), 0) as revenue
                         FROM inventory i
                         LEFT JOIN sales s ON i.id = s.product_id
                         AND $dateCondition
                         GROUP BY i.id
                         ORDER BY revenue DESC";
                
                $stmt = $report->conn->prepare($query);
                $stmt->execute();
                
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    fputcsv($output, [
                        $row['name'],
                        $row['description'],
                        $row['current_stock'],
                        $row['total_sales'],
                        $row['revenue']
                    ]);
                }
                break;

            case 'user_activity':
                fputcsv($output, ['User', 'Email', 'Role', 'Total Purchases', 'Total Spent', 'Last Purchase']);
                
                $query = "SELECT u.full_name,
                         u.email,
                         u.role,
                         COUNT(s.id) as total_purchases,
                         COALESCE(SUM(s.total_amount), 0) as total_spent,
                         MAX(s.transaction_date) as last_purchase
                         FROM users u
                         LEFT JOIN sales s ON u.id = s.user_id
                         AND $dateCondition
                         GROUP BY u.id
                         ORDER BY total_spent DESC";
                
                $stmt = $report->conn->prepare($query);
                $stmt->execute();
                
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    fputcsv($output, [
                        $row['full_name'],
                        $row['email'],
                        $row['role'],
                        $row['total_purchases'],
                        $row['total_spent'],
                        $row['last_purchase']
                    ]);
                }
                break;
        }

        fclose($output);
        exit();
    } catch (PDOException $e) {
        error_log($e->getMessage());
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Database error occurred']);
    }
}
?>