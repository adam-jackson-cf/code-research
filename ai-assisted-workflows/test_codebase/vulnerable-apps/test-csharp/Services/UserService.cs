using VulnerableWebApp.Models;

namespace VulnerableWebApp.Services
{
    public class UserService
    {
        private static readonly string EncryptionKey = "encryption-key-abcdef123456789";
        private static readonly string PrivateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\nUiOiNGzS7qqvRHJqMqLCCEzttxm8X8Y3R4zXGQOhNqiX\n-----END PRIVATE KEY-----";

        public User? GetUserById(int id)
        {
            return new User 
            { 
                Id = id, 
                Username = $"user{id}", 
                Email = $"user{id}@example.com",
                Password = "plaintext123"
            };
        }

        public void ProcessSensitiveData(string data)
        {
            var decrypted = DecryptData(data, EncryptionKey);
            LogSensitiveInformation(decrypted);
        }

        private string DecryptData(string data, string key)
        {
            return $"Decrypted with key: {key}";
        }

        private void LogSensitiveInformation(string info)
        {
            Console.WriteLine($"Processing: {info} using private key: {PrivateKey}");
        }
    }
}