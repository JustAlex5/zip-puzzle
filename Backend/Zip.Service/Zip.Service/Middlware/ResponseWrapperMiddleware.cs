using System.Text;
using System.Text.Json;
using Zip.Service.Models.Common;

namespace Zip.Service.Middlware;


public class ResponseWrapperMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        var originalBody = ctx.Response.Body;

        using var memStream = new MemoryStream();
        ctx.Response.Body = memStream;

        await next(ctx);

        memStream.Position = 0;
        var responseBody = await new StreamReader(memStream).ReadToEndAsync();

        ctx.Response.Body = originalBody;

        // skip swagger and non-json responses
        if (ctx.Request.Path.StartsWithSegments("/swagger") ||
            ctx.Response.ContentType == null ||
            !ctx.Response.ContentType.Contains("application/json"))
        {
            await ctx.Response.Body.WriteAsync(
                Encoding.UTF8.GetBytes(responseBody));
            return;
        }

        var statusCode = ctx.Response.StatusCode;
        var isError = statusCode >= 400;

        object wrapped;

        if (isError)
        {
            wrapped = new ApiResponse<object>
            {
                Code = statusCode,
                Message = GetMessageForStatus(statusCode),
                Data = string.IsNullOrEmpty(responseBody) 
                    ? null 
                    : JsonSerializer.Deserialize<object>(responseBody),
            };
        }
        else
        {
            wrapped = new ApiResponse<object>
            {
                Code = statusCode,
                Data = string.IsNullOrEmpty(responseBody) 
                    ? null 
                    : JsonSerializer.Deserialize<object>(responseBody),
            };
        }

        var json = JsonSerializer.Serialize(wrapped, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsync(json);
    }

    private static string GetMessageForStatus(int code) => code switch
    {
        400 => "Bad request.",
        401 => "Unauthorized.",
        403 => "Forbidden.",
        404 => "Not found.",
        422 => "Unprocessable entity.",
        500 => "Internal server error.",
        _   => "Unknown error."
    };
}
