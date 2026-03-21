namespace Zip.Service.Models.Common;

public class ApiResponse<T>
{
    public int Code { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; } = string.Empty;
    public bool IsError => !string.IsNullOrEmpty(Message);



    public static ApiResponse<T> Success(T data) => new()
    {
        Code = 200,
        Data = data,
    };

    public static ApiResponse<T> Failure(string message, int code = 400) => new()
    {
        Code = code,
        Message = message,
        Data = default,
    };
}