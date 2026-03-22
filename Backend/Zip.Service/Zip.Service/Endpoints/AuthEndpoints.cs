using Microsoft.AspNetCore.Mvc;
using Zip.Service.DTOs;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/auth/register", Register);
        app.MapPost("/auth/login", Login);
    }

    private static async Task<IResult> Register(
        [FromBody] RegisterDto dto,
        IAuthService service,
        CancellationToken ct)
    {
        var response = await service.RegisterAsync(dto, ct);
        return response is null
            ? Results.BadRequest(new { error = "Invalid registration data." })
            : Results.Ok(response);
    }

    private static async Task<IResult> Login(
        [FromBody] LoginDto dto,
        [FromServices] IAuthService authService,
        CancellationToken ct)
    {
        var  response = await authService.LoginAsync(dto, ct);
        return response is null
            ? Results.Unauthorized()
            : Results.Ok(response);
    }
}