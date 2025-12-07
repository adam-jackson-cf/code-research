# Vulnerable Python file with SQL injection for testing semgrep
import sqlite3

def get_user(username):
    """Get user by username - VULNERABLE to SQL injection."""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # SQL Injection vulnerability - string concatenation
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchone()

def search_products(search_term):
    """Search products - VULNERABLE to SQL injection."""
    conn = sqlite3.connect('products.db')
    cursor = conn.cursor()
    # SQL Injection vulnerability - f-string
    query = f"SELECT * FROM products WHERE name LIKE '%{search_term}%'"
    cursor.execute(query)
    return cursor.fetchall()

def delete_user(user_id):
    """Delete user - VULNERABLE to SQL injection."""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # SQL Injection vulnerability - format string
    query = "DELETE FROM users WHERE id = {}".format(user_id)
    cursor.execute(query)
    conn.commit()
