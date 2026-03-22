using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Zip.Service.DTOs;
using Zip.Service.Extensions;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Endpoints;

public static class LevelEndpoints
{
    public static void MapLevelEndpoints(this WebApplication app)
    {
        app.MapGet("/levels", GetAll);
        app.MapGet("/levels/{id}", GetById);
        app.MapPost("/levels", Create).RequireAuthorization();
        app.MapDelete("/levels/{id}", Delete).RequireAuthorization();
        app.MapPost("/levels/{id}/solve", RecordSolve).RequireAuthorization();
    }

        private static async Task<IResult> GetAll(HttpContext http, ILevelService service, CancellationToken ct)
        {
            var userId = http.User.GetUserId();
            var levels = await service.GetAllAsync(userId, ct);
            return Results.Ok(levels);
        }

    private static async Task<IResult> GetById(
        int id,
        HttpContext http,
        ILevelService service,
        CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        var level = await service.GetByIdAsync(id, userId, ct);
        return level is null
            ? Results.NotFound()
            : Results.Ok(level);
    }

    private static async Task<IResult> Create(
        LevelDto dto,
        HttpContext http,
        ILevelService service,
        CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null)
        {
            return Results.Unauthorized();
        }

        int id;
        try
        {
            id = await service.CreateAsync(dto, userId.Value, ct);
        }
        catch (ArgumentException)
        {
            return Results.UnprocessableEntity(new { error = "No valid solution exists." });
        }

        if (id <= 0)
        {
            return Results.UnprocessableEntity(new { error = "No valid solution exists." });
        }

        return Results.Created($"/levels/{id}", dto);
    }

    private static async Task<IResult> Delete(
        int id,
        [FromServices] ILevelService levelService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userId = int.Parse(
            httpContext.User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var success= await levelService.DeleteAsync(id, userId, ct);
        return success ? Results.NoContent() : Results.Forbid();
    }

    private static async Task<IResult> RecordSolve(
        int id,
        SolveLevelDto body,
        HttpContext http,
        ILevelService service,
        CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null)
        {
            return Results.Unauthorized();
        }

        if (body.TimeSeconds < 0)
        {
            return Results.BadRequest(new { error = "TimeSeconds must be non-negative." });
        }

        var res = await service.RecordSolveAsync(id, userId.Value, body.TimeSeconds, ct);
        return res is null ? Results.NotFound() : Results.Ok(res);
    }
}
