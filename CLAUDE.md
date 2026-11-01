# finami Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-11-01

## Active Technologies
- TypeScript 5.x, React 18.3, Node 22 (build); backend C# 12 / .NET 8 (ajustes) + Vite 6, Tailwind CSS 4 (`@tailwindcss/vite`), React Router 6, i18next 25 + react-i18next 15, sonner, @radix-ui/react-dialog, lucide-react; dev: ESLint (template do Vite), sharp (ícones), Vitest 3, @testing-library/react 16, @testing-library/user-event, jsdom, vitest-axe (002-finami-frontend-mobile)
- `localStorage` apenas para a sessão (`finami:auth`); dados vêm da API (PostgreSQL no backend) (002-finami-frontend-mobile)

- C# 12 / .NET 8 (`net8.0`; build com SDK 9.0.309 instalado) + ASP.NET Core 8 Web API, EF Core 9.x + Npgsql.EntityFrameworkCore.PostgreSQL 9.x, Swashbuckle 8.x, Microsoft.AspNetCore.Authentication.JwtBearer 8.x, Google.Apis.Auth, Microsoft.Extensions.Identity.Core (PasswordHasher), FluentValidation (001-finami-backend-core)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

# Add commands for C# 12 / .NET 8 (`net8.0`; build com SDK 9.0.309 instalado)

## Code Style

C# 12 / .NET 8 (`net8.0`; build com SDK 9.0.309 instalado): Follow standard conventions

## Recent Changes
- 002-finami-frontend-mobile: Added TypeScript 5.x, React 18.3, Node 22 (build); backend C# 12 / .NET 8 (ajustes) + Vite 6, Tailwind CSS 4 (`@tailwindcss/vite`), React Router 6, i18next 25 + react-i18next 15, sonner, @radix-ui/react-dialog, lucide-react; dev: ESLint (template do Vite), sharp (ícones), Vitest 3, @testing-library/react 16, @testing-library/user-event, jsdom, vitest-axe

- 001-finami-backend-core: Added C# 12 / .NET 8 (`net8.0`; build com SDK 9.0.309 instalado) + ASP.NET Core 8 Web API, EF Core 9.x + Npgsql.EntityFrameworkCore.PostgreSQL 9.x, Swashbuckle 8.x, Microsoft.AspNetCore.Authentication.JwtBearer 8.x, Google.Apis.Auth, Microsoft.Extensions.Identity.Core (PasswordHasher), FluentValidation

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
