using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Runtime.Serialization.Formatters.Binary;
using VulnerableWebApp.Services;

namespace VulnerableWebApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly UserService _userService;

        public UserController(UserService userService)
        {
            _userService = userService;
        }

        [HttpGet("search")]
        public IActionResult Search(string query)
        {
            var result = $"<h2>Search Results</h2><p>You searched for: {query}</p>";
            return Content(result, "text/html");
        }

        [HttpPost("execute")]
        public IActionResult ExecuteCommand([FromBody] CommandRequest request)
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/c {request.Command}",
                    RedirectStandardOutput = true,
                    UseShellExecute = false
                }
            };

            process.Start();
            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();

            return Ok(new { Output = output });
        }

        [HttpPost("deserialize")]
        public IActionResult DeserializeData([FromBody] string data)
        {
            try
            {
                var bytes = Convert.FromBase64String(data);
                using var stream = new MemoryStream(bytes);
                var formatter = new BinaryFormatter();
                var obj = formatter.Deserialize(stream);
                
                return Ok(new { Result = obj.ToString() });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("files")]
        public IActionResult ReadFile(string path)
        {
            try
            {
                var content = System.IO.File.ReadAllText($"../../../{path}");
                return Ok(new { Content = content });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }

    public class CommandRequest
    {
        public string Command { get; set; } = "";
    }
}