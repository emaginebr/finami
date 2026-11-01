namespace Finami.DTO.Settings;

public class DatabaseSettings
{
    /// <summary>Quando true, a API aplica as migrations pendentes do FinamiContext ao iniciar.</summary>
    public bool MigrateOnStartup { get; set; }
}
