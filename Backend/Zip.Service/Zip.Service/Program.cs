using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using Zip.Service.BackgroundServices;
using Zip.Service.Dal;
using Zip.Service.Dal.Interfaces;
using Zip.Service.Data;
using Zip.Service.Endpoints;
using Zip.Service.Hubs;
using Zip.Service.Mapper;
using Zip.Service.Middlware;
using Zip.Service.Services;
using Zip.Service.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration
        .GetConnectionString("DefaultConnection")));

// Redis
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(
        builder.Configuration["Redis:ConnectionString"]!));

// AutoMapper
builder.Services.AddAutoMapper(cfg =>
{
    cfg.LicenseKey = builder.Configuration["AutoMapper:LicenseKey"];
    cfg.AddMaps(AppDomain.CurrentDomain.GetAssemblies());
});

// Repositories
builder.Services.AddScoped<ILevelRepository, LevelRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IScoreRepository, ScoreRepository>();

// Services
builder.Services.AddScoped<ILevelService, LevelService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IScoreService, ScoreService>();
builder.Services.AddSingleton<TokenService>();

// PvP
builder.Services.AddSingleton<IRoomService, RoomService>();
builder.Services.AddSingleton<IMatchmakingService, MatchmakingService>();
builder.Services.AddHostedService<MatchmakingTimeoutService>();

// CORS (optional Cors:Origins in config, comma-separated — e.g. docker-compose env Cors__Origins)
var corsConfigured = builder.Configuration["Cors:Origins"];
var corsOrigins = string.IsNullOrWhiteSpace(corsConfigured)
    ? new[]
    {
        "http://localhost",
        "http://localhost:4200",
        "http://localhost:8080",
        "https://JustAlex5.github.io",
    }
    : corsConfigured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p =>
        p.WithOrigins(corsOrigins)
         .AllowAnyMethod()
         .AllowAnyHeader()
         .AllowCredentials()));

// JWT
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!))
        };

        // allow SignalR to read token from query string
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(token) &&
                    path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Behind nginx / load balancer: correct scheme for SignalR negotiate (wss) and links.
builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    opts.KnownNetworks.Clear();
    opts.KnownProxies.Clear();
});

// SignalR with Redis backplane
builder.Services.AddSignalR()
    .AddStackExchangeRedis(
        builder.Configuration["Redis:ConnectionString"]!);

var app = builder.Build();

// auto-run migrations
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// middleware
app.UseForwardedHeaders();

app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    await ctx.Response.WriteAsJsonAsync(new
    {
        code = 500,
        message = "Internal server error.",
        data = (object?)null,
        isError = true
    });
}));

app.UseMiddleware<ResponseWrapperMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
if (!string.Equals(
        Environment.GetEnvironmentVariable("DISABLE_HTTPS_REDIRECTION"),
        "true",
        StringComparison.OrdinalIgnoreCase))
{
    app.UseHttpsRedirection();
}
app.UseAuthentication();
app.UseAuthorization();

app.MapHub<GameHub>("/hubs/game");
app.MapAuthEndpoints();
app.MapLevelEndpoints();

app.Run();