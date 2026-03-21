using Zip.Service.DTOs;
using Zip.Service.Models;
using Zip.Service.Services;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Endpoints;


    public static class MapLevelEndpoints
    {
        public static void MapEndpoints(this WebApplication app)
        {
            app.MapGet("/levels", GetAll);
            app.MapGet("/levels/{id}", GetById);
            app.MapPost("/levels", Create);
            app.MapDelete("/levels/{id}", Delete);
            app.MapPost("/levels/{id}/solve", IncrementSolveCount);
        }

        private static async Task<IResult> GetAll(ILevelService service, CancellationToken ct)
        {
            var levels = await service.GetAllAsync(ct);
            return Results.Ok(levels);
        }

        private static async Task<IResult> GetById(
            int id,
            ILevelService service,
            CancellationToken ct)
        {
            var level = await service.GetByIdAsync(id, ct);
            return level is null
                ? Results.NotFound()
                : Results.Ok(level);
        }

        private static async Task<IResult> Create(LevelDto dto, ILevelService service, CancellationToken ct)
        {
            var id = await service.CreateAsync(dto, ct);
    
            if (id <= 0)
                return Results.UnprocessableEntity(new { error = "No valid solution exists." });

            return Results.Created($"/levels/{id}", dto);
        }

        private static async Task<IResult> Delete(int id, ILevelService service, CancellationToken ct)
        {
            var deleted = await service.DeleteAsync(id, ct);
            return deleted ? Results.NoContent() : Results.NotFound();
        }

        private static async Task<IResult> IncrementSolveCount(
            int id,
            ILevelService service,
            CancellationToken ct)
        {
            var res =await service.IncrementSolveCountAsync(id, ct);
            return res is null ? Results.NotFound() : Results.Ok(res);
        }
    }
