using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Zip.Service.Dal;
using Zip.Service.Dal.Interfaces;
using Zip.Service.Data;
using Zip.Service.Endpoints;
using Zip.Service.Middlware;
using Zip.Service.Services;
using Zip.Service.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<ILevelService, LevelService>();
builder.Services.AddScoped<ILevelRepository, LevelRepository>();
//DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p =>
        p.WithOrigins("https://JustAlex5.github.io")
            .AllowAnyMethod()
            .AllowAnyHeader()));
builder.Services.AddAutoMapper(cfg =>
{
    cfg.LicenseKey= builder.Configuration["AutoMapper:LicenseKey"];
    cfg.AddMaps(AppDomain.CurrentDomain.GetAssemblies());
});
var app = builder.Build();

app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    await ctx.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
}));

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseMiddleware<ResponseWrapperMiddleware>();
app.UseHttpsRedirection();
app.UseCors();
app.MapEndpoints();




app.Run();

