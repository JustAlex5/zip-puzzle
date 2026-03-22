using System.Security.Claims;

namespace Zip.Service.Extensions;

public static class ClaimsExtensions
{
    public static int? GetUserId(this ClaimsPrincipal? user)
    {
        if (user?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var sub = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(sub, out var id) ? id : null;
    }
}
