using Microsoft.EntityFrameworkCore;
using VulnerableWebApp.Models;

namespace VulnerableWebApp.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                optionsBuilder.UseSqlServer("Server=localhost;Database=VulnerableApp;User Id=sa;Password=HardcodedPassword123!;");
            }
        }
    }
}