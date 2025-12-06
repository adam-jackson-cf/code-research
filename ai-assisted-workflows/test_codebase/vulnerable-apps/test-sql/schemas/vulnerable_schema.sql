CREATE DATABASE IF NOT EXISTS testdb;
USE testdb;

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) DEFAULT 'password123',
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    ssn VARCHAR(11),
    credit_card VARCHAR(20),
    phone VARCHAR(15),
    address TEXT
);

CREATE TABLE debug_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    api_key VARCHAR(255),
    session_token VARCHAR(255),
    user_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password, email) VALUES
('admin', 'admin123', 'admin@test.com'),
('user', 'user456', 'user@test.com'),
('guest', 'guest789', 'guest@test.com');

INSERT INTO customers (name, ssn, credit_card, phone, address) VALUES
('John Doe', '123-45-6789', '4111-1111-1111-1111', '555-1234', '123 Main St'),
('Jane Smith', '987-65-4321', '5555-5555-5555-4444', '555-5678', '456 Oak Ave');

INSERT INTO debug_log (api_key, session_token, user_data) VALUES
('sk-1234567890abcdef', 'sess_abcdef123456', '{"user_id": 1, "role": "admin"}'),
('api_xyz789', 'sess_789xyz', '{"user_id": 2, "role": "user"}');