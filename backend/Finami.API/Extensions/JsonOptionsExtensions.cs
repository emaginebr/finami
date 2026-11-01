using System.Text.Json;
using System.Text.Json.Serialization;

namespace Finami.API.Extensions;

/// <summary>Configuração JSON única da API, reutilizada pelo Program e pelos testes.</summary>
public static class JsonOptionsExtensions
{
    /// <summary>
    /// Enums como texto e números aceitos também como string JSON na leitura
    /// (ex.: <c>"amount": "0.00000001"</c>); as respostas continuam com números JSON.
    /// </summary>
    public static JsonSerializerOptions ConfigureFinamiJson(this JsonSerializerOptions options)
    {
        options.Converters.Add(new JsonStringEnumConverter());
        options.NumberHandling = JsonNumberHandling.AllowReadingFromString;
        return options;
    }
}
