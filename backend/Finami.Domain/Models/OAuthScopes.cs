namespace Finami.Domain.Models;

/// <summary>Escopos do MCP (research R-06), guardados como texto separado por espaço.</summary>
public static class OAuthScopes
{
    public const string READ = "finami:read";
    public const string WRITE = "finami:write";

    public static readonly string[] All = { READ, WRITE };

    /// <summary>Quebra "a b" em lista distinta e sem vazios; conhecidos primeiro, na ordem de <see cref="All"/>.</summary>
    public static List<string> Parse(string? scopes) =>
        (scopes ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(Rank)
            .ToList();

    /// <summary>Ordena e remove duplicados; <c>finami:write</c> sempre leva <c>finami:read</c> junto.</summary>
    public static List<string> Normalize(IEnumerable<string> scopes)
    {
        var list = Parse(string.Join(' ', scopes));
        if (list.Contains(WRITE) && !list.Contains(READ))
            list.Insert(0, READ);
        return list;
    }

    public static string Join(IEnumerable<string> scopes) => string.Join(' ', Normalize(scopes));

    public static bool AreKnown(IEnumerable<string> scopes) => scopes.All(s => All.Contains(s, StringComparer.Ordinal));

    public static bool Has(string? scopes, string scope) => Parse(scopes).Contains(scope, StringComparer.Ordinal);

    private static int Rank(string scope)
    {
        var index = Array.IndexOf(All, scope);
        return index >= 0 ? index : int.MaxValue;
    }
}
