namespace Zip.Service.DTOs;

public class LeaderboardEntryDto
{
    public string Username { get; set; } = string.Empty;
    public int TimeSeconds { get; set; }
    public DateTime SolvedAt { get; set; }
    public int Rank { get; set; }
}