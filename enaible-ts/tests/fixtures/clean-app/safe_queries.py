# Clean Python file with safe SQL queries for testing
import sqlite3
import os

def get_user(username):
    """Get user by username - SAFE parameterized query."""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # Safe parameterized query
    query = "SELECT * FROM users WHERE username = ?"
    cursor.execute(query, (username,))
    return cursor.fetchone()

def search_products(search_term):
    """Search products - SAFE parameterized query."""
    conn = sqlite3.connect('products.db')
    cursor = conn.cursor()
    # Safe parameterized query
    query = "SELECT * FROM products WHERE name LIKE ?"
    cursor.execute(query, (f'%{search_term}%',))
    return cursor.fetchall()

def delete_user(user_id):
    """Delete user - SAFE parameterized query."""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # Safe parameterized query
    query = "DELETE FROM users WHERE id = ?"
    cursor.execute(query, (user_id,))
    conn.commit()

def get_config():
    """Get configuration from environment variables - SAFE."""
    return {
        "api_key": os.environ.get("API_KEY"),
        "db_password": os.environ.get("DB_PASSWORD"),
        "secret_token": os.environ.get("SECRET_TOKEN"),
    }
