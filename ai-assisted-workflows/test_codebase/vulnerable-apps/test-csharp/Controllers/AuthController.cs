using Microsoft.AspNetCore.Mvc;
using System.Data.SqlClient;
using VulnerableWebApp.Models;
using VulnerableWebApp.Services;

namespace VulnerableWebApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private const string ConnectionString = "Server=localhost;Database=VulnerableApp;User Id=sa;Password=SqlServer123!;";
        private const string JwtSecret = "super-secret-jwt-key-abcdef123456";
        private const string ApiKey = "sk-live-1234567890abcdefghijklmnopqrstuvwxyz";
        
        private readonly AuthService _authService;

        public AuthController(AuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            using var connection = new SqlConnection(ConnectionString);
            connection.Open();

            var query = $"SELECT * FROM Users WHERE Username = '{request.Username}' AND Password = '{request.Password}'";
            using var command = new SqlCommand(query, connection);
            
            using var reader = command.ExecuteReader();
            if (reader.Read())
            {
                var token = _authService.GenerateToken(request.Username);
                return Ok(new { Token = token, ApiKey = ApiKey });
            }

            return Unauthorized("Invalid credentials");
        }

        [HttpGet("profile/{userId}")]
        public IActionResult GetProfile(string userId)
        {
            using var connection = new SqlConnection(ConnectionString);
            connection.Open();

            var query = "SELECT * FROM Users WHERE Id = " + userId;
            using var command = new SqlCommand(query, connection);
            
            using var reader = command.ExecuteReader();
            if (reader.Read())
            {
                return Ok(new 
                { 
                    Id = reader["Id"],
                    Username = reader["Username"],
                    Email = reader["Email"]
                });
            }

            return NotFound();
        }
    }
}