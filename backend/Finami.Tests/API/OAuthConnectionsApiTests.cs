using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;

namespace Finami.Tests.API;

/// <summary>T046 — rotas <c>/api/oauth/connections</c> e <c>/api/oauth/mcp-info</c> (contracts/api.md), ponta a ponta.</summary>
public class OAuthConnectionsApiTests : IClassFixture<FinamiApiFactory>
{
    private readonly FinamiApiFactory _factory;
    private readonly HttpClient _http;

    public OAuthConnectionsApiTests(FinamiApiFactory factory)
    {
        _factory = factory;
        _http = factory.CreateClient();
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string bearer)
    {
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return await _http.SendAsync(request);
    }

    private async Task<HttpStatusCode> CallMcp(string accessToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
        {
            Content = new StringContent("""{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}""",
                Encoding.UTF8, "application/json")
        };
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Accept.ParseAdd("text/event-stream");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return (await _http.SendAsync(request)).StatusCode;
    }

    [Fact]
    public async Task List_and_disconnect_one_makes_the_next_mcp_call_401()
    {
        var (userId, jwt) = _factory.CreateUserWithAppJwt("Ana", "Conexões", "ana.conexoes@exemplo.com");
        var (grantId, token) = _factory.CreateMcpAccessToken(userId);
        (await CallMcp(token)).Should().Be(HttpStatusCode.OK);

        var list = await Send(HttpMethod.Get, "/api/oauth/connections", jwt);
        list.StatusCode.Should().Be(HttpStatusCode.OK);
        var item = (await list.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().Single();
        item.GetProperty("connectionId").GetInt64().Should().Be(grantId);
        item.GetProperty("clientName").GetString().Should().Be("Teste");
        item.GetProperty("lastUsedAt").ValueKind.Should().NotBe(JsonValueKind.Null, "a chamada ao /mcp registrou o uso");

        (await Send(HttpMethod.Delete, $"/api/oauth/connections/{grantId}", jwt)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await CallMcp(token)).Should().Be(HttpStatusCode.Unauthorized);
        (await Send(HttpMethod.Delete, $"/api/oauth/connections/{grantId}", jwt)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Disconnect_all_and_someone_elses_connection()
    {
        var (userId, jwt) = _factory.CreateUserWithAppJwt("Bia", "Conexões", "bia.conexoes@exemplo.com");
        var (otherId, _) = _factory.CreateUserWithAppJwt("Caio", "Conexões", "caio.conexoes@exemplo.com");
        var (_, first) = _factory.CreateMcpAccessToken(userId);
        var (_, second) = _factory.CreateMcpAccessToken(userId);
        var (otherGrant, otherToken) = _factory.CreateMcpAccessToken(otherId);

        (await Send(HttpMethod.Delete, $"/api/oauth/connections/{otherGrant}", jwt)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Send(HttpMethod.Delete, "/api/oauth/connections", jwt)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await CallMcp(first)).Should().Be(HttpStatusCode.Unauthorized);
        (await CallMcp(second)).Should().Be(HttpStatusCode.Unauthorized);
        (await CallMcp(otherToken)).Should().Be(HttpStatusCode.OK);
        var list = await Send(HttpMethod.Get, "/api/oauth/connections", jwt);
        (await list.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task Mcp_info_returns_the_public_mcp_url_and_requires_the_app_jwt()
    {
        var (userId, jwt) = _factory.CreateUserWithAppJwt("Davi", "Info", "davi.info@exemplo.com");

        var response = await Send(HttpMethod.Get, "/api/oauth/mcp-info", jwt);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("mcpUrl").GetString()
            .Should().Be(FinamiApiFactory.PUBLIC_URL + "/mcp");

        var (_, mcpToken) = _factory.CreateMcpAccessToken(userId);
        (await Send(HttpMethod.Get, "/api/oauth/connections", mcpToken)).StatusCode
            .Should().Be(HttpStatusCode.Unauthorized, "o token do MCP não vale nas rotas do app");
    }
}
