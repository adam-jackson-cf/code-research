#!/usr/bin/env python3
"""
Clean Python application with no security vulnerabilities.
This serves as a control for false positive testing.
"""

import hashlib
import json
import os
from pathlib import Path


class UserManager:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.users: dict[str, dict] = {}
        self.load_config()

    def load_config(self) -> None:
        """Load configuration from environment variables."""
        self.database_url = os.getenv('DATABASE_URL', 'sqlite:///app.db')
        self.secret_key = os.getenv('SECRET_KEY', '')
        if not self.secret_key:
            raise ValueError("SECRET_KEY environment variable is required")

    def hash_password(self, password: str) -> str:
        """Securely hash a password using SHA-256."""
        salt = os.urandom(32)
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return salt.hex() + key.hex()

    def verify_password(self, password: str, stored_hash: str) -> bool:
        """Verify a password against stored hash."""
        salt = bytes.fromhex(stored_hash[:64])
        stored_key = stored_hash[64:]
        new_key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return stored_key == new_key.hex()

    def create_user(self, username: str, password: str, email: str) -> bool:
        """Create a new user with secure password storage."""
        if username in self.users:
            return False

        self.users[username] = {
            'password_hash': self.hash_password(password),
            'email': email,
            'created_at': '2025-01-01T00:00:00Z'
        }
        return True

    def authenticate_user(self, username: str, password: str) -> dict | None:
        """Authenticate user with proper password verification."""
        if username not in self.users:
            return None

        user = self.users[username]
        if self.verify_password(password, user['password_hash']):
            return {
                'username': username,
                'email': user['email']
            }
        return None


class DataProcessor:
    def __init__(self):
        self.processed_items: list[dict] = []

    def process_data(self, data: list[dict]) -> list[dict]:
        """Process data with proper validation."""
        results = []
        for item in data:
            if self.validate_item(item):
                processed = self.clean_data(item)
                results.append(processed)
        return results

    def validate_item(self, item: dict) -> bool:
        """Validate data item structure."""
        required_fields = ['id', 'name', 'type']
        return all(field in item for field in required_fields)

    def clean_data(self, item: dict) -> dict:
        """Clean and sanitize data."""
        return {
            'id': int(item['id']),
            'name': str(item['name']).strip(),
            'type': str(item['type']).lower(),
            'processed': True
        }

    def export_results(self, filename: str) -> bool:
        """Export processed results to file."""
        try:
            output_path = Path(filename)
            if output_path.suffix != '.json':
                return False

            with output_path.open('w') as f:
                json.dump(self.processed_items, f, indent=2)
            return True
        except (OSError, json.JSONEncodeError):
            return False


def main():
    """Main application entry point."""
    print("Starting clean Python application...")

    # Initialize components
    user_manager = UserManager('config.json')
    data_processor = DataProcessor()

    # Example usage
    success = user_manager.create_user('admin', 'secure_password_123!', 'admin@example.com')
    print(f"User creation: {'success' if success else 'failed'}")

    # Process sample data
    sample_data = [
        {'id': 1, 'name': 'Item One', 'type': 'document'},
        {'id': 2, 'name': 'Item Two', 'type': 'image'}
    ]

    results = data_processor.process_data(sample_data)
    print(f"Processed {len(results)} items")

    print("Application completed successfully")


if __name__ == '__main__':
    main()
