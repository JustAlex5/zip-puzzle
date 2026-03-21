using System.Text;
using System.Text.Json;
using Zip.Service.Models.Common;

namespace Zip.Service.Middlware;


// Middleware/ResponseWrapperMiddleware.cs
public class ResponseWrapperMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        // skip swagger
        if (ctx.Request.Path.StartsWithSegments("/swagger"))
        {
            await next(ctx);
            return;
        }

        var originalBody = ctx.Response.Body;
        using var memStream = new MemoryStream();
        ctx.Response.Body = memStream;

        try
        {
            await next(ctx);

            memStream.Position = 0;
            var responseBody = await new StreamReader(memStream).ReadToEndAsync();

            ctx.Response.Body = originalBody;

            if (ctx.Response.ContentType == null ||
                !ctx.Response.ContentType.Contains("application/json"))
            {
                await ctx.Response.Body.WriteAsync(Encoding.UTF8.GetBytes(responseBody));
                return;
            }

            var statusCode = ctx.Response.StatusCode;
            var isError = statusCode >= 400;

            var wrapped = new ApiResponse<object>
            {
                Code = statusCode,
                Message = isError ? GetMessageForStatus(statusCode) : "OK",
                Data = string.IsNullOrEmpty(responseBody)
                    ? null
                    : JsonSerializer.Deserialize<object>(responseBody),
            };

            var json = JsonSerializer.Serialize(wrapped, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(json);
        }
        catch
        {
            // restore original body BEFORE exception handler runs
            ctx.Response.Body = originalBody;
            throw; // let UseExceptionHandler handle it cleanly
        }
        finally
        {
            // guarantee restoration even in edge cases
            if (ctx.Response.Body != originalBody)
                ctx.Response.Body = originalBody;
        }
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
