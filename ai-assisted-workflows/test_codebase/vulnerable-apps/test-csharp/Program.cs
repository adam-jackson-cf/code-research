using Microsoft.EntityFrameworkCore;
using VulnerableWebApp.Data;
using VulnerableWebApp.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer("Server=localhost;Database=VulnerableApp;User Id=sa;Password=Admin123!;"));

builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<AuthService>();

var app = builder.Build();

app.UseRouting();
app.MapControllers();

app.Run();