CREATE DATABASE IF NOT EXISTS saucedemo_qa;
USE saucedemo_qa;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    user_type VARCHAR(20) DEFAULT 'standard',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(255),
    category VARCHAR(50) DEFAULT 'clothing',
    stock_qty INT DEFAULT 100
);

-- Orders table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order items table
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Test results table (for QA platform)
CREATE TABLE test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    suite VARCHAR(20) NOT NULL,
    test_name VARCHAR(200) NOT NULL,
    status VARCHAR(10) NOT NULL,
    duration_ms INT,
    error_message TEXT,
    run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert SauceDemo users
INSERT INTO users (username, password, is_locked, user_type) VALUES
('standard_user', 'secret_sauce', FALSE, 'standard'),
('locked_out_user', 'secret_sauce', TRUE, 'standard'),
('problem_user', 'secret_sauce', FALSE, 'problem'),
('performance_glitch_user', 'secret_sauce', FALSE, 'performance'),
('error_user', 'secret_sauce', FALSE, 'error'),
('visual_user', 'secret_sauce', FALSE, 'visual');

-- Insert SauceDemo products
INSERT INTO products (name, description, price, category) VALUES
('Sauce Labs Backpack', 'carry.allTheThings() with the sleek, streamlined Sly Pack', 29.99, 'bags'),
('Sauce Labs Bike Light', 'A red light isn''t the desired state in testing but it''s a safe state for a flashlight', 9.99, 'accessories'),
('Sauce Labs Bolt T-Shirt', 'Get your testing superhero on with the Sauce Labs bolt T-shirt', 15.99, 'clothing'),
('Sauce Labs Fleece Jacket', 'It''s not every day that you come across a midweight quarter-zip fleece jacket', 49.99, 'clothing'),
('Sauce Labs Onesie', 'Rib snap infant onesie for the junior automation engineer in development', 7.99, 'clothing'),
('Test.allTheThings() T-Shirt (Red)', 'This classic Sauce Labs t-shirt is perfect to wear when cozying up to your keyboard', 15.99, 'clothing');

-- Insert sample orders
INSERT INTO orders (user_id, status, total_amount) VALUES
(1, 'completed', 45.98),
(1, 'completed', 29.99),
(3, 'pending', 15.99),
(4, 'completed', 57.98);

-- Insert order items
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
(1, 1, 1, 29.99),
(1, 3, 1, 15.99),
(2, 1, 1, 29.99),
(3, 3, 1, 15.99),
(4, 4, 1, 49.99),
(4, 2, 1, 9.99);

-- Insert sample test results
INSERT INTO test_results (suite, test_name, status, duration_ms) VALUES
('smoke', 'login for standard_user should success', 'passed', 1823),
('smoke', 'login for locked_out_user should fail', 'passed', 945),
('smoke', 'login for problem_user should success', 'passed', 2103),
('sanity', 'login and add first inventory item to cart', 'passed', 3421),
('regression', 'complete purchase as John Doe', 'passed', 8932),
('regression', 'complete purchase as Jane Smith', 'failed', 4521);