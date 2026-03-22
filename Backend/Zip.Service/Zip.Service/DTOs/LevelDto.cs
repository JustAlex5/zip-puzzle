namespace Zip.Service.DTOs;

public class LevelDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Size { get; set; }
    public int SolveCount { get; set; }
    public int? UserId { get; set; }
    public string? OwnerUsername { get; set; }
    /// <summary>Current user's best time for this level (seconds), if authenticated and played.</summary>
    public int? MyBestTimeSeconds { get; set; }
    public List<NumberCellDto> Numbers { get; set; } = [];
    public List<WallBarrierDto> Barriers { get; set; } = [];
}
