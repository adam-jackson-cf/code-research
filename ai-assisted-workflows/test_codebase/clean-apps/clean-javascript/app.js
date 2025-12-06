/**
 * Clean JavaScript/Node.js application with no security vulnerabilities.
 * This serves as a control for false positive testing.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

class UserService {
    constructor() {
        this.users = new Map();
        this.secretKey = process.env.SECRET_KEY;
        if (!this.secretKey) {
            throw new Error('SECRET_KEY environment variable is required');
        }
    }

    async hashPassword(password) {
        const salt = crypto.randomBytes(32);
        const hash = await promisify(crypto.pbkdf2)(password, salt, 100000, 64, 'sha256');
        return salt.toString('hex') + hash.toString('hex');
    }

    async verifyPassword(password, storedHash) {
        const salt = Buffer.from(storedHash.slice(0, 64), 'hex');
        const storedKey = storedHash.slice(64);
        const hash = await promisify(crypto.pbkdf2)(password, salt, 100000, 64, 'sha256');
        return storedKey === hash.toString('hex');
    }

    async createUser(username, password, email) {
        if (this.users.has(username)) {
            return false;
        }

        const passwordHash = await this.hashPassword(password);
        this.users.set(username, {
            passwordHash,
            email,
            createdAt: new Date().toISOString()
        });
        return true;
    }

    async authenticateUser(username, password) {
        const user = this.users.get(username);
        if (!user) {
            return null;
        }

        const isValid = await this.verifyPassword(password, user.passwordHash);
        if (isValid) {
            return {
                username,
                email: user.email
            };
        }
        return null;
    }
}

class DataProcessor {
    constructor() {
        this.processedItems = [];
    }

    processData(dataArray) {
        const results = [];
        for (const item of dataArray) {
            if (this.validateItem(item)) {
                const processed = this.cleanData(item);
                results.push(processed);
            }
        }
        return results;
    }

    validateItem(item) {
        const requiredFields = ['id', 'name', 'type'];
        return requiredFields.every(field => item.hasOwnProperty(field));
    }

    cleanData(item) {
        return {
            id: parseInt(item.id, 10),
            name: String(item.name).trim(),
            type: String(item.type).toLowerCase(),
            processed: true
        };
    }

    async exportResults(filename) {
        try {
            const filePath = path.resolve(filename);
            if (path.extname(filePath) !== '.json') {
                return false;
            }

            const data = JSON.stringify(this.processedItems, null, 2);
            await fs.writeFile(filePath, data, 'utf8');
            return true;
        } catch (error) {
            console.error('Export failed:', error.message);
            return false;
        }
    }
}

class ConfigManager {
    constructor() {
        this.config = this.loadConfig();
    }

    loadConfig() {
        return {
            databaseUrl: process.env.DATABASE_URL || 'sqlite:///app.db',
            port: process.env.PORT || 3000,
            nodeEnv: process.env.NODE_ENV || 'development',
            logLevel: process.env.LOG_LEVEL || 'info'
        };
    }

    getDatabaseConfig() {
        return {
            url: this.config.databaseUrl,
            options: {
                ssl: this.config.nodeEnv === 'production',
                logging: this.config.nodeEnv === 'development'
            }
        };
    }
}

async function main() {
    console.log('Starting clean JavaScript application...');

    try {
        // Initialize services
        const configManager = new ConfigManager();
        const userService = new UserService();
        const dataProcessor = new DataProcessor();

        // Example usage
        const userCreated = await userService.createUser(
            'admin',
            'secure_password_123!',
            'admin@example.com'
        );
        console.log(`User creation: ${userCreated ? 'success' : 'failed'}`);

        // Process sample data
        const sampleData = [
            { id: 1, name: 'Item One', type: 'document' },
            { id: 2, name: 'Item Two', type: 'image' }
        ];

        const results = dataProcessor.processData(sampleData);
        console.log(`Processed ${results.length} items`);

        // Get configuration
        const dbConfig = configManager.getDatabaseConfig();
        console.log(`Database configured: ${dbConfig.url}`);

        console.log('Application completed successfully');
    } catch (error) {
        console.error('Application error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { UserService, DataProcessor, ConfigManager };