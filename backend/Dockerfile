# syntax=docker/dockerfile:1
# Contexto de build: pasta backend/ (ex.: docker build -f backend/Dockerfile backend)

# ---------- build ----------
# SDK 9 compila o alvo net8.0 (mesmo SDK usado no build local).
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Restaura primeiro só pelos .csproj para aproveitar o cache de camadas.
# Restaura/publica pelo .csproj da API (e não pela solução) para não incluir Finami.Tests.
COPY Finami.DTO/Finami.DTO.csproj Finami.DTO/
COPY Finami.Infra.Interfaces/Finami.Infra.Interfaces.csproj Finami.Infra.Interfaces/
COPY Finami.Domain/Finami.Domain.csproj Finami.Domain/
COPY Finami.Infra/Finami.Infra.csproj Finami.Infra/
COPY Finami.Application/Finami.Application.csproj Finami.Application/
COPY Finami.API/Finami.API.csproj Finami.API/
RUN dotnet restore Finami.API/Finami.API.csproj

COPY . .
RUN dotnet publish Finami.API/Finami.API.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- runtime ----------
# Imagem Debian (não alpine) para manter ICU/culturas.
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# curl para o healthcheck do compose (curl -fsS http://localhost:8080/health).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

USER app
ENTRYPOINT ["dotnet", "Finami.API.dll"]
