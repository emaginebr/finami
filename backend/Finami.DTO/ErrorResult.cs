using System.Text.Json.Serialization;

namespace Finami.DTO;

public class ErrorResult
{
    [JsonPropertyName("sucesso")]
    public bool Sucesso { get; set; }

    [JsonPropertyName("mensagem")]
    public string Mensagem { get; set; } = string.Empty;

    [JsonPropertyName("erros")]
    public List<string> Erros { get; set; } = new();
}
