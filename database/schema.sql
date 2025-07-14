-- Create the database
CREATE DATABASE IF NOT EXISTS water_vending;
USE water_vending;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role ENUM('customer', 'admin', 'master_admin') DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX email_idx (email)
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX name_idx (name)
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES inventory(id),
    INDEX user_id_idx (user_id),
    INDEX product_id_idx (product_id)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    type ENUM('sales', 'inventory', 'user_activity') NOT NULL,
    data JSON,
    generated_by INT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by) REFERENCES users(id),
    INDEX type_idx (type),
    INDEX generated_by_idx (generated_by)
);

-- Cart table
CREATE TABLE IF NOT EXISTS cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES inventory(id),
    UNIQUE KEY unique_cart_item (user_id, product_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
    delivery_address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price_per_unit DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES inventory(id)
);

-- Order tracking table
CREATE TABLE IF NOT EXISTS order_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    status ENUM('order_placed', 'payment_received', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled') NOT NULL,
    location VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- M-Pesa transactions table
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    transaction_id VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    result_code VARCHAR(10),
    result_desc TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    UNIQUE INDEX transaction_idx (transaction_id)
);

-- Insert default master admin account
INSERT INTO users (full_name, email, password, phone, role) 
VALUES (
    'Master Admin',
    'admin@watervending.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: 'password'
    '1234567890',
    'master_admin'
);

-- Insert sample users
INSERT INTO users (full_name, email, password, phone, role) VALUES
('John Smith', 'john@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '1234567891', 'customer'),
('Jane Doe', 'jane@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '1234567892', 'customer'),
('Admin User', 'admin2@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '1234567893', 'admin');

-- Insert sample products
INSERT INTO inventory (name, description, price, quantity, image) VALUES
('20L Water Bottle', 'Large mineral water bottle for office or home use', 15.99, 100, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=400'),
('10L Water Dispenser', 'Medium-sized water dispenser perfect for small offices', 10.99, 150, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=400'),
('5L Water Bottle', 'Convenient size for home use', 7.99, 200, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=400'),
('1L Mineral Water', 'Premium mineral water in convenient size', 2.99, 500, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=400');

-- Insert sample sales (last 30 days)
INSERT INTO sales (user_id, product_id, quantity, total_amount, transaction_date) VALUES
(2, 1, 2, 31.98, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 3, 3, 23.97, DATE_SUB(NOW(), INTERVAL 2 DAY)),
(3, 2, 4, 43.96, DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2, 4, 10, 29.90, DATE_SUB(NOW(), INTERVAL 4 DAY)),
(3, 1, 1, 15.99, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2, 2, 2, 21.98, DATE_SUB(NOW(), INTERVAL 6 DAY)),
(3, 3, 5, 39.95, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(2, 4, 8, 23.92, DATE_SUB(NOW(), INTERVAL 8 DAY)),
(3, 1, 3, 47.97, DATE_SUB(NOW(), INTERVAL 9 DAY)),
(2, 2, 1, 10.99, DATE_SUB(NOW(), INTERVAL 10 DAY));