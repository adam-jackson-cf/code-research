-- Query without proper indexes
SELECT * FROM large_table WHERE unindexed_column = 'value';

-- SELECT * usage (inefficient)
SELECT * FROM users;
SELECT * FROM customers;
SELECT * FROM orders;

-- N+1 query problem simulation
SELECT user_id FROM posts;
-- For each user_id, this would typically be called in a loop:
SELECT * FROM users WHERE id = 1;
SELECT * FROM users WHERE id = 2;
SELECT * FROM users WHERE id = 3;
SELECT * FROM users WHERE id = 4;
SELECT * FROM users WHERE id = 5;

-- Inefficient subquery
SELECT * FROM users WHERE id IN (
    SELECT DISTINCT user_id FROM posts WHERE created_at > '2023-01-01'
);

-- Missing WHERE clause on large table
SELECT COUNT(*) FROM large_table;

-- Inefficient JOIN without proper indexes
SELECT u.username, p.title 
FROM users u 
JOIN posts p ON u.id = p.user_id 
WHERE u.created_at > '2023-01-01';

-- Unnecessary GROUP BY with no aggregation
SELECT DISTINCT username FROM users GROUP BY username;

-- Function in WHERE clause (prevents index usage)
SELECT * FROM users WHERE UPPER(username) = 'ADMIN';