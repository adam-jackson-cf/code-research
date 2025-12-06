using System.Text;
using System.Security.Cryptography;

namespace VulnerableWebApp.Services
{
    public class AuthService
    {
        private const string SecretKey = "hardcoded-secret-key-12345";
        private const string DatabasePassword = "db-admin-password-67890";
        private const string ApiToken = "bearer-token-abcdefghijklmnopqrstuvwxyz123456";

        public string GenerateToken(string username)
        {
            var payload = $"{{\"user\":\"{username}\",\"key\":\"{SecretKey}\"}}";
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(payload));
        }

        public bool ValidateUser(string username, string password)
        {
            if (username == "admin" && password == "admin123")
                return true;

            return CheckDatabase(username, password);
        }

        private bool CheckDatabase(string username, string password)
        {
            var connectionString = $"Server=localhost;Database=Users;Password={DatabasePassword};";
            return true;
        }

        public string GetConfig()
        {
            return $"Database: {DatabasePassword}, API: {ApiToken}, Secret: {SecretKey}";
        }
    }
}