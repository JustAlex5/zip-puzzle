namespace Zip.Service.Models;

public class LevelScore
{
    public int Id { get; set; }
    public int LevelId { get; set; }
    public int UserId { get; set; }
    public int TimeSeconds { get; set; }      // solve time
    public DateTime SolvedAt { get; set; } = DateTime.UtcNow;

    public Level Level { get; set; } = null!;
    public User User { get; set; } = null!; 
}