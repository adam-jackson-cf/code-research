// NodeGoat Test Application - User Data Access Object
// Contains controlled vulnerabilities for security testing

const database = require('../database');

// VULNERABILITY 7: Passwords stored in plain text
// Location: app/data/user-dao.js (line 10-15)
// CWE-256: Passwords stored in plain text
// This is specifically for detect_secrets analyzer testing
const defaultUsers = [
    {
        id: 1,
        username: 'admin',
        password: 'admin123'  // Plain text password - should be detected by detect_secrets
    },
    {
        id: 2,
        username: 'user',
        password: 'password123'  // Another plain text password
    }
];

// Additional secrets for detect_secrets testing
const config = {
    database_password: 'db-secret-key-67890',
    api_key: 'sk-1234567890abcdefghijklmnopqrstuvwxyz',
    jwt_secret: 'jwt-signing-key-abcdef123456'
};

class UserDAO {
    constructor() {
        this.users = defaultUsers;
    }

    findByUsername(username) {
        return this.users.find(user => user.username === username);
    }

    validateCredentials(username, password) {
        const user = this.findByUsername(username);
        return user && user.password === password;
    }

    createUser(username, password) {
        const newUser = {
            id: this.users.length + 1,
            username: username,
            password: password
        };
        this.users.push(newUser);
        return newUser;
    }
}

module.exports = new UserDAO();