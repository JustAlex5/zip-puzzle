namespace Zip.Service.DTOs;

public class LevelLeaderboardDto
{
    public int LevelId { get; set; }
    public string LevelName { get; set; } = string.Empty;
    public List<LeaderboardEntryDto> TopScores { get; set; } = [];
    public LeaderboardEntryDto? UserBestScore { get; set; }
}