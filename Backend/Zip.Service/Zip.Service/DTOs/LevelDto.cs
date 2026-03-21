namespace Zip.Service.DTOs;

public class LevelDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Size { get; set; }
    public int SolveCount { get; set; }
    public List<NumberCellDto> Numbers { get; set; } = [];
    public List<WallBarrierDto> Barriers { get; set; } = []; 
}