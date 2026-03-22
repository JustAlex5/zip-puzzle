namespace Zip.Service.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    public ICollection<Level> Levels { get; set; } = [];
    public ICollection<LevelScore> Scores { get; set; } = [];
    
}