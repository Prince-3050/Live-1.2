-- MySQL Sample Database Script
CREATE DATABASE IF NOT EXISTS demo_db;
USE demo_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  category VARCHAR(50),
  price DECIMAL(10, 2) NOT NULL,
  stock INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  total_amount DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'pending',
  ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Sample Data
INSERT INTO users (name, email, role) VALUES
('Alice Johnson', 'alice@mysql.com', 'admin'),
('Bob Smith', 'bob@mysql.com', 'developer'),
('Charlie Brown', 'charlie@mysql.com', 'user'),
('Diana Prince', 'diana@mysql.com', 'manager');

INSERT INTO products (title, category, price, stock) VALUES
('Developer Laptop Pro 16"', 'Electronics', 2499.99, 45),
('Ergonomic Mechanical Keyboard', 'Peripherals', 149.50, 120),
('4K UltraHD Monitor 32"', 'Electronics', 699.00, 30),
('Wireless Noise-Canceling Headphones', 'Audio', 299.99, 85);

INSERT INTO orders (user_id, total_amount, status) VALUES
(1, 2649.49, 'completed'),
(2, 149.50, 'shipped'),
(3, 699.00, 'pending');

INSERT INTO audit_logs (action, details) VALUES
('MYSQL_INIT', 'MySQL demo database seeded successfully.');
