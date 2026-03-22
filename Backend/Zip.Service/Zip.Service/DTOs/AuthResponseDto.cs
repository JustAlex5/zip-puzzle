namespace Zip.Service.DTOs;

public class AuthResponseDto
{
    public int UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}