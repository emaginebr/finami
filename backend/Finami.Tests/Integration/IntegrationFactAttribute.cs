namespace Finami.Tests.Integration;

/// <summary>Fact que só roda quando FINAMI_TEST_DB (connection string PostgreSQL) estiver definido.</summary>
public sealed class IntegrationFactAttribute : FactAttribute
{
    public const string ENV_VAR = "FINAMI_TEST_DB";

    public IntegrationFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ENV_VAR)))
            Skip = $"Defina {ENV_VAR} com uma connection string PostgreSQL para rodar os testes de integração.";
    }
}
