using System.Text;
using System.Text.Json;
using Zip.Service.Models.Common;

namespace Zip.Service.Middlware;


public class ResponseWrapperMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        // SignalR (negotiate, WebSockets) must not be buffered or re-shaped.
        if (ctx.Request.Path.StartsWithSegments("/hubs"))
        {
            await next(ctx);
            return;
        }

        var originalBody = ctx.Response.Body;

        using var memStream = new MemoryStream();
        ctx.Response.Body = memStream;

        await next(ctx);

        memStream.Position = 0;
        var responseBody = await new StreamReader(memStream).ReadToEndAsync();

        ctx.Response.Body = originalBody;

        var statusCode = ctx.Response.StatusCode;

        // 204/205 must not have a body; 304 uses body per spec in limited ways — do not copy buffer.
        if (statusCode == StatusCodes.Status204NoContent ||
            statusCode == StatusCodes.Status205ResetContent)
        {
            ctx.Response.Headers.Remove("Content-Length");
            return;
        }

        var contentType = ctx.Response.ContentType;
        var isJson =
            contentType != null &&
            contentType.Contains("application/json", StringComparison.OrdinalIgnoreCase);

        // skip swagger and non-json responses
        if (ctx.Request.Path.StartsWithSegments("/swagger") || !isJson)
        {
            if (responseBody.Length > 0)
            {
                ctx.Response.Headers.Remove("Content-Length");
                await ctx.Response.Body.WriteAsync(Encoding.UTF8.GetBytes(responseBody));
            }

            return;
        }

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

        ctx.Response.Headers.Remove("Content-Length");
        ctx.Response.ContentType = "application/json; charset=utf-8";
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
