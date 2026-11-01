using System.Globalization;
using System.Text;
using Finami.Domain.Exceptions;
using Microsoft.AspNetCore.WebUtilities;

namespace Finami.API.Mcp;

/// <summary>
/// Paginação na camada da ferramenta (research R-12, FR-017): <c>limite</c> 1–50 (padrão 20) e cursor opaco
/// base64url com o período e o deslocamento, para o extrato inteiro ser lido em páginas sem mudar o domínio.
/// </summary>
public static class McpPaging
{
    public const int DEFAULT_LIMIT = 20;
    public const int MAX_LIMIT = 50;

    public const string INVALID_LIMIT_MESSAGE = "O limite deve estar entre 1 e 50.";
    public const string INVALID_CURSOR_MESSAGE =
        "Cursor inválido. Use o proximoCursor devolvido pela página anterior, com o mesmo período.";

    private const string VERSION = "v1";

    public static int NormalizeLimit(int? limit)
    {
        var value = limit ?? DEFAULT_LIMIT;
        if (value < 1 || value > MAX_LIMIT)
            throw new ValidationException(INVALID_LIMIT_MESSAGE);
        return value;
    }

    public static string EncodeCursor(DateOnly start, DateOnly end, int offset) =>
        WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(
            $"{VERSION}|{start.ToString(McpFormat.DATE_FORMAT, CultureInfo.InvariantCulture)}|" +
            $"{end.ToString(McpFormat.DATE_FORMAT, CultureInfo.InvariantCulture)}|{offset}"));

    /// <summary>Deslocamento do cursor (0 sem cursor); cursor de outro período ou corrompido → <c>validacao</c>.</summary>
    public static int DecodeCursor(string? cursor, DateOnly start, DateOnly end)
    {
        if (string.IsNullOrWhiteSpace(cursor))
            return 0;
        string text;
        try
        {
            text = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(cursor.Trim()));
        }
        catch (FormatException)
        {
            throw new ValidationException(INVALID_CURSOR_MESSAGE);
        }

        var parts = text.Split('|');
        if (parts.Length != 4 || parts[0] != VERSION
            || parts[1] != start.ToString(McpFormat.DATE_FORMAT, CultureInfo.InvariantCulture)
            || parts[2] != end.ToString(McpFormat.DATE_FORMAT, CultureInfo.InvariantCulture)
            || !int.TryParse(parts[3], NumberStyles.None, CultureInfo.InvariantCulture, out var offset))
            throw new ValidationException(INVALID_CURSOR_MESSAGE);
        return offset;
    }

    /// <summary>Recorta a página e devolve o cursor da próxima (null no fim).</summary>
    public static (List<T> Page, string? NextCursor) Slice<T>(IReadOnlyList<T> items, DateOnly start, DateOnly end,
        int? limit, string? cursor)
    {
        var size = NormalizeLimit(limit);
        var offset = DecodeCursor(cursor, start, end);
        if (offset > items.Count)
            throw new ValidationException(INVALID_CURSOR_MESSAGE);
        var page = items.Skip(offset).Take(size).ToList();
        var next = offset + page.Count < items.Count ? EncodeCursor(start, end, offset + page.Count) : null;
        return (page, next);
    }
}
