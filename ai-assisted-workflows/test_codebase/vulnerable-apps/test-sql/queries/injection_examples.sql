-- These are example SQL injection patterns

-- Dynamic SQL construction (vulnerable)
SET @user_input = '1; DROP TABLE users; --';
SET @sql = CONCAT('SELECT * FROM users WHERE id = ', @user_input);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Another injection example
SET @username = "admin' OR '1'='1";
SET @query = CONCAT("SELECT * FROM users WHERE username = '", @username, "'");
PREPARE stmt2 FROM @query;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Stored procedure with injection
DELIMITER //
CREATE PROCEDURE GetUserData(IN user_input VARCHAR(255))
BEGIN
    SET @sql = CONCAT('SELECT * FROM users WHERE id = ', user_input);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //
DELIMITER ;

-- Function with injection risk
DELIMITER //
CREATE FUNCTION SearchUser(search_term VARCHAR(255)) RETURNS TEXT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE result TEXT;
    SET @sql = CONCAT('SELECT username FROM users WHERE username LIKE "%', search_term, '%"');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    RETURN result;
END //
DELIMITER ;