# Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Zip.Service.csproj", "./"]
RUN dotnet restore "Zip.Service.csproj"

COPY . .
RUN dotnet publish "Zip.Service.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Run
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Zip.Service.dll"]
