using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;

namespace Finami.Tests.API;

/// <summary>
/// T059 — contrato do catálogo (contracts/mcp-tools.md + feature 006): exatamente as 41 ferramentas (feature 008: alterar_permissoes_membro), anotações corretas,
/// descrições em pt-BR, <c>chave_repeticao</c> só nas marcadas ⟲ e nada de senha/conta/conexões (FR-020).
/// Também confere recursos e prompts publicados.
/// </summary>
public class McpToolsCatalogTests : IClassFixture<FinamiApiFactory>
{
    private sealed record Expected(bool ReadOnly, bool Destructive, bool Idempotent, bool Repeatable = false);

    private static readonly Dictionary<string, Expected> CONTRACT = new()
    {
        // Leitura (R, ro)
        ["obter_perfil"] = new(true, false, true),
        ["saldo_total"] = new(true, false, true),
        ["listar_carteiras"] = new(true, false, true),
        ["obter_carteira"] = new(true, false, true),
        ["destinos_de_transferencia"] = new(true, false, true),
        ["dividas_da_pessoa"] = new(true, false, true),
        ["listar_familias"] = new(true, false, true),
        ["obter_familia"] = new(true, false, true),
        ["saldos_da_familia"] = new(true, false, true),
        ["saldos_da_pessoa"] = new(true, false, true),
        ["extrato_carteira"] = new(true, false, true),
        ["extrato_pessoa"] = new(true, false, true),
        ["extrato_familia"] = new(true, false, true),
        ["obter_lancamento"] = new(true, false, true),
        ["cotacao_bitcoin"] = new(true, false, true),
        ["listar_notificacoes"] = new(true, false, true),
        ["contar_notificacoes_nao_lidas"] = new(true, false, true),
        ["listar_convites_da_familia"] = new(true, false, true),
        ["verificar_email_para_familia"] = new(true, false, true),
        ["listar_pessoas_criadas_por_mim"] = new(true, false, true),
        // Escrita (W)
        ["registrar_receita"] = new(false, false, false, true),
        ["registrar_despesa"] = new(false, false, false, true),
        ["previa_transferencia"] = new(true, false, true),
        ["registrar_transferencia"] = new(false, false, false, true),
        ["estornar_lancamento"] = new(false, true, true),
        ["criar_carteira"] = new(false, false, false, true),
        ["atualizar_carteira"] = new(false, false, true),
        ["mover_carteira_de_familia"] = new(false, false, true),
        ["desativar_carteira"] = new(false, true, true),
        ["excluir_carteira"] = new(false, true, false),
        ["criar_familia"] = new(false, false, false, true),
        ["renomear_familia"] = new(false, false, true),
        ["criar_pessoa_na_familia"] = new(false, false, false, true),
        ["convidar_para_familia"] = new(false, false, false, true),
        ["cancelar_convite"] = new(false, true, true),
        ["retirar_membro"] = new(false, true, true),
        ["alterar_permissoes_membro"] = new(false, false, true),
        ["aceitar_convite"] = new(false, false, true),
        ["recusar_convite"] = new(false, true, true),
        ["marcar_notificacoes_como_lidas"] = new(false, false, true),
        ["atualizar_perfil"] = new(false, false, true)
    };

    private readonly FinamiApiFactory _factory;

    public McpToolsCatalogTests(FinamiApiFactory factory)
    {
        _factory = factory;
    }

    private async Task<McpClient> Connect(string email, string scopes = "finami:read finami:write")
    {
        var (userId, _) = _factory.CreateUserWithAppJwt("Ana", "Catálogo", email);
        var (_, token) = _factory.CreateMcpAccessToken(userId, scopes);
        return await _factory.CreateMcpClientAsync(token);
    }

    [Fact]
    public void Contract_has_41_tools()
    {
        CONTRACT.Should().HaveCount(41);
    }

    [Fact]
    public async Task Tools_list_matches_the_contract_exactly()
    {
        await using var mcp = await Connect("catalogo.lista@exemplo.com");

        var tools = await mcp.ListToolsAsync();

        tools.Select(t => t.Name).Should().BeEquivalentTo(CONTRACT.Keys);
        foreach (var tool in tools)
        {
            var expected = CONTRACT[tool.Name];
            var annotations = tool.ProtocolTool.Annotations;
            annotations.Should().NotBeNull(tool.Name);
            annotations!.ReadOnlyHint.Should().Be(expected.ReadOnly, tool.Name);
            annotations.DestructiveHint.Should().Be(expected.Destructive, tool.Name);
            annotations.IdempotentHint.Should().Be(expected.Idempotent, tool.Name);
            annotations.OpenWorldHint.Should().BeFalse(tool.Name);
            tool.ProtocolTool.Title.Should().NotBeNullOrWhiteSpace(tool.Name);

            var schema = tool.JsonSchema.GetRawText();
            schema.Contains("chave_repeticao").Should().Be(expected.Repeatable, tool.Name);
            schema.Should().NotContain("\"user\"", $"{tool.Name}: ClaimsPrincipal vem do token");
            schema.Should().NotContain("serviceProvider", tool.Name);
        }
    }

    [Fact]
    public async Task Descriptions_are_in_portuguese_and_parameters_are_documented()
    {
        await using var mcp = await Connect("catalogo.descricao@exemplo.com");

        foreach (var tool in await mcp.ListToolsAsync())
        {
            tool.Description.Should().NotBeNullOrWhiteSpace(tool.Name);
            tool.Description!.Length.Should().BeGreaterThan(40, tool.Name);
            tool.Description.Should().MatchRegex(@"\b(da|de|do|a|o|com|em|para)\b", $"{tool.Name} em pt-BR");

            var schema = tool.JsonSchema;
            if (!schema.TryGetProperty("properties", out var properties))
                continue;
            foreach (var property in properties.EnumerateObject())
            {
                property.Name.Should().MatchRegex("^[a-z_]+$", $"{tool.Name}.{property.Name} em snake_case");
                property.Value.TryGetProperty("description", out var description).Should()
                    .BeTrue($"{tool.Name}.{property.Name} precisa de descrição");
                description.GetString().Should().NotBeNullOrWhiteSpace();
            }
        }
    }

    [Fact]
    public async Task No_tool_touches_password_account_or_connections()
    {
        await using var mcp = await Connect("catalogo.fr020@exemplo.com");

        var names = (await mcp.ListToolsAsync()).Select(t => t.Name).ToList();

        var forbidden = new[] { "senha", "conta", "conexao", "conexoes", "login", "cadastro", "token", "assistente" };
        names.SelectMany(n => n.Split('_')).Should().NotContain(forbidden);
    }

    [Fact]
    public async Task Resources_and_prompts_are_published_and_resources_read_the_token_user()
    {
        await using var mcp = await Connect("catalogo.recursos@exemplo.com", "finami:read");

        var resources = await mcp.ListResourcesAsync();
        resources.Select(r => r.Uri).Should().BeEquivalentTo(
            "finami://perfil", "finami://carteiras", "finami://familias", "finami://notificacoes/nao-lidas");

        var profile = await mcp.ReadResourceAsync("finami://perfil");
        var text = profile.Contents.OfType<TextResourceContents>().Single();
        text.MimeType.Should().Be("application/json");
        JsonDocument.Parse(text.Text).RootElement.GetProperty("email").GetString()
            .Should().Be("catalogo.recursos@exemplo.com");

        var wallets = await mcp.ReadResourceAsync("finami://carteiras");
        JsonDocument.Parse(wallets.Contents.OfType<TextResourceContents>().Single().Text).RootElement
            .ValueKind.Should().Be(JsonValueKind.Array);

        var prompts = await mcp.ListPromptsAsync();
        prompts.Select(p => p.Name).Should().BeEquivalentTo("resumo_do_mes", "registrar_gasto", "revisar_convites");
        var summary = await mcp.GetPromptAsync("resumo_do_mes", new Dictionary<string, object?> { ["mes"] = "2026-10" });
        summary.Messages.Single().Content.Should().BeOfType<TextContentBlock>()
            .Which.Text.Should().Contain("2026-10-01").And.Contain("2026-10-31");
    }

    [Fact]
    public async Task Read_only_connection_gets_insufficient_scope_on_write_tools_end_to_end()
    {
        await using var mcp = await Connect("catalogo.escopo@exemplo.com", "finami:read");

        var result = await mcp.CallToolAsync("criar_familia", new Dictionary<string, object?> { ["nome"] = "Família X" });

        result.IsError.Should().BeTrue();
        result.StructuredContent!.Value.GetProperty("codigo").GetString().Should().Be("permissao_insuficiente");
        result.Content.OfType<TextContentBlock>().Single().Text.Should()
            .Be("Esta conexão só permite consultas. Reconecte o assistente permitindo alterações.");

        var families = await mcp.CallToolAsync("listar_familias", new Dictionary<string, object?>());
        families.IsError.Should().NotBe(true);
        families.StructuredContent!.Value.GetProperty("itens").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task Write_tool_end_to_end_creates_data_and_writes_audit()
    {
        await using var mcp = await Connect("catalogo.escrita@exemplo.com");

        var first = await mcp.CallToolAsync("criar_familia",
            new Dictionary<string, object?> { ["nome"] = "Família Teste", ["chave_repeticao"] = "k-1" });
        var again = await mcp.CallToolAsync("criar_familia",
            new Dictionary<string, object?> { ["nome"] = "Família Teste", ["chave_repeticao"] = "k-1" });

        first.IsError.Should().NotBe(true);
        var groupId = first.StructuredContent!.Value.GetProperty("groupId").GetInt64();
        again.StructuredContent!.Value.GetProperty("groupId").GetInt64().Should().Be(groupId, "mesma chave_repeticao");
        var list = await mcp.CallToolAsync("listar_familias", new Dictionary<string, object?>());
        list.StructuredContent!.Value.GetProperty("itens").GetArrayLength().Should().Be(1);

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<Finami.Infra.Context.FinamiContext>();
        context.McpAuditLogs.Where(l => l.ToolName == "criar_familia" && l.TargetId == groupId)
            .Should().HaveCount(2).And.OnlyContain(l => l.Outcome == "sucesso");
    }
}

/// <summary>T057 — limites de taxa com valores pequenos (a factory padrão os desliga).</summary>
public class McpRateLimitTests : IClassFixture<McpRateLimitTests.LimitedFactory>
{
    public class LimitedFactory : FinamiApiFactory
    {
        protected override IDictionary<string, string?> ExtraSettings => new Dictionary<string, string?>
        {
            ["Mcp:RateLimitPerMinute"] = "2",
            ["Mcp:RegisterRateLimitPerHour"] = "1",
            ["Mcp:TokenRateLimitPerMinute"] = "2"
        };
    }

    private readonly LimitedFactory _factory;
    private readonly HttpClient _http;

    public McpRateLimitTests(LimitedFactory factory)
    {
        _factory = factory;
        _http = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
    }

    private static HttpRequestMessage ToolsList(string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
        {
            Content = new StringContent("""{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}""",
                Encoding.UTF8, "application/json")
        };
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Accept.ParseAdd("text/event-stream");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    [Fact]
    public async Task Mcp_limit_is_per_connection_and_returns_429_with_retry_after()
    {
        var (userId, _) = _factory.CreateUserWithAppJwt("Rita", "Limite", "rita.limite@exemplo.com");
        var (_, token) = _factory.CreateMcpAccessToken(userId);
        var (_, other) = _factory.CreateMcpAccessToken(userId);

        (await _http.SendAsync(ToolsList(token))).StatusCode.Should().Be(HttpStatusCode.OK);
        (await _http.SendAsync(ToolsList(token))).StatusCode.Should().Be(HttpStatusCode.OK);
        var limited = await _http.SendAsync(ToolsList(token));

        limited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        limited.Headers.RetryAfter.Should().NotBeNull();
        (await limited.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()
            .Should().Be("limite_excedido");
        (await _http.SendAsync(ToolsList(other))).StatusCode.Should().Be(HttpStatusCode.OK, "outra conexão tem a própria cota");
    }

    [Fact]
    public async Task Register_and_token_endpoints_are_limited_by_ip()
    {
        object Client() => new { client_name = "X", redirect_uris = new[] { "http://127.0.0.1/cb" } };
        (await _http.PostAsJsonAsync("/oauth/register", Client())).StatusCode.Should().Be(HttpStatusCode.Created);
        var limited = await _http.PostAsJsonAsync("/oauth/register", Client());
        limited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        limited.Headers.RetryAfter.Should().NotBeNull();

        FormUrlEncodedContent Form() => new(new Dictionary<string, string> { ["grant_type"] = "password", ["client_id"] = "x" });
        (await _http.PostAsync("/oauth/token", Form())).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await _http.PostAsync("/oauth/token", Form())).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await _http.PostAsync("/oauth/token", Form())).StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }
}
