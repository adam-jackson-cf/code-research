// Vulnerable JavaScript file with XSS vulnerabilities for testing semgrep

// XSS vulnerability - innerHTML with user input
function displayUserContent(userInput) {
  const container = document.getElementById('content');
  container.innerHTML = userInput; // XSS vulnerability
}

// XSS vulnerability - document.write
function writeUserData(data) {
  document.write('<div>' + data + '</div>'); // XSS vulnerability
}

// XSS vulnerability - eval with user input
function executeCode(userCode) {
  eval(userCode); // Code injection vulnerability
}

// SQL-like vulnerability in template literal
function queryUser(userId) {
  const query = `SELECT * FROM users WHERE id = ${userId}`; // SQL injection pattern
  return executeQuery(query);
}

// Insecure randomness
function generateToken() {
  return Math.random().toString(36); // Insecure random
}

// Hardcoded credentials
const config = {
  apiKey: 'hardcoded_api_key_12345',
  dbPassword: 'admin123',
  secretToken: 'super_secret_token_xyz'
};

// Path traversal vulnerability
function readFile(filename) {
  const path = '/uploads/' + filename; // Path traversal
  return fs.readFileSync(path);
}

// Command injection
const { exec } = require('child_process');
function runCommand(userInput) {
  exec('ls ' + userInput); // Command injection
}

// Prototype pollution potential
function merge(target, source) {
  for (const key in source) {
    target[key] = source[key]; // Prototype pollution
  }
  return target;
}

module.exports = {
  displayUserContent,
  writeUserData,
  executeCode,
  queryUser,
  generateToken,
  config,
  readFile,
  runCommand,
  merge
};
