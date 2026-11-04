using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Infra.Context;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace Finami.Tests.API;

/// <summary>
/// Feature 006 — ponta a ponta (contracts/api.md): transferência dentro da família, dívida em
/// <c>GET /api/users/{id}/debts</c>, destinos em <c>GET /api/wallets/{id}/transfer-destinations</c> e erros novos.
/// </summary>
public class FamilyDebtsApiTests : IClassFixture<FinamiApiFactory>
{
    private readonly FinamiApiFactory _factory;
    private readonly HttpClient _http;

    public FamilyDebtsApiTests(FinamiApiFactory factory)
    {
        _factory = factory;
        _http = factory.CreateClient();
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string jwt, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        if (body != null)
            request.Content = JsonContent.Create(body);
        return await _http.SendAsync(request);
    }

    private (long AnaWallet, long BrunoWallet, long CarlaWallet) Seed(long ana, long bruno, long carla)
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<FinamiContext>();
        var group = new Group
        {
            Name = "Família", UserId = ana,
            Members = new List<GroupMember> { new() { UserId = ana }, new() { UserId = bruno } }
        };
        context.Groups.Add(group);
        Account Wallet(long owner, string name) =>
            new() { Kind = AccountKind.Wallet, UserId = owner, Currency = Currency.Brl, Name = name };
        var anaWallet = Wallet(ana, "Nubank");
        var brunoWallet = Wallet(bruno, "Mesada");
        var carlaWallet = Wallet(carla, "Outra");
        context.Accounts.AddRange(anaWallet, brunoWallet, carlaWallet);
        context.SaveChanges();
        return (anaWallet.AccountId, brunoWallet.AccountId, carlaWallet.AccountId);
    }

    [Fact]
    public async Task Transfer_in_family_creates_debt_and_outsider_is_rejected()
    {
        var (ana, anaJwt) = _factory.CreateUserWithAppJwt("Ana", "Dívida", "ana.divida@exemplo.com");
        var (bruno, brunoJwt) = _factory.CreateUserWithAppJwt("Bruno", "Dívida", "bruno.divida@exemplo.com");
        var (carla, _) = _factory.CreateUserWithAppJwt("Carla", "Fora", "carla.fora@exemplo.com");
        var (anaWallet, brunoWallet, carlaWallet) = Seed(ana, bruno, carla);

        var transfer = await Send(HttpMethod.Post, "/api/transactions/transfer", anaJwt,
            new { sourceWalletId = anaWallet, destinationWalletId = brunoWallet, amount = "100.00" });
        transfer.StatusCode.Should().Be(HttpStatusCode.Created);

        var debts = await Send(HttpMethod.Get, $"/api/users/{bruno}/debts", brunoJwt);
        debts.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await debts.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("userId").GetInt64().Should().Be(bruno);
        var debt = body.GetProperty("debts").EnumerateArray().Should().ContainSingle().Subject;
        debt.GetProperty("counterpartUserId").GetInt64().Should().Be(ana);
        debt.GetProperty("counterpartFirstName").GetString().Should().Be("Ana");
        debt.GetProperty("currency").GetString().Should().Be("BRL");
        debt.GetProperty("amount").GetDecimal().Should().Be(100m);
        debt.GetProperty("direction").GetString().Should().Be("owes");

        var outsider = await Send(HttpMethod.Post, "/api/transactions/transfer/preview", anaJwt,
            new { sourceWalletId = anaWallet, destinationWalletId = carlaWallet, amount = 10 });
        outsider.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await outsider.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("mensagem").GetString()
            .Should().Be("Só é possível transferir para pessoas da sua família.");

        var noAmount = await Send(HttpMethod.Post, "/api/transactions/transfer", anaJwt,
            new { sourceWalletId = anaWallet, destinationWalletId = brunoWallet });
        noAmount.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await noAmount.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("mensagem").GetString()
            .Should().Be("Informe o valor em bitcoin ou em reais, ou quite tudo.");

        var hidden = await Send(HttpMethod.Get, $"/api/users/{carla}/debts", anaJwt);
        hidden.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ---------------- Feature 007 (T034): tipos de transferência ponta a ponta ----------------

    private async Task<JsonElement> Debts(long userId, string jwt) =>
        await (await Send(HttpMethod.Get, $"/api/users/{userId}/debts", jwt)).Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<string?> Message(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("mensagem").GetString();

    [Fact]
    public async Task Loan_minus_settlement_is_the_debt_and_payment_does_not_count()
    {
        var (ana, anaJwt) = _factory.CreateUserWithAppJwt("Ana", "Tipos", "ana.tipos@exemplo.com");
        var (bruno, brunoJwt) = _factory.CreateUserWithAppJwt("Bruno", "Tipos", "bruno.tipos@exemplo.com");
        var (carla, _) = _factory.CreateUserWithAppJwt("Carla", "Tipos", "carla.tipos@exemplo.com");
        var (anaWallet, brunoWallet, _) = Seed(ana, bruno, carla);

        var loan = await Send(HttpMethod.Post, "/api/transactions/transfer", anaJwt,
            new { sourceWalletId = anaWallet, destinationWalletId = brunoWallet, amount = 100m, kind = "loan" });
        loan.StatusCode.Should().Be(HttpStatusCode.Created);
        var loanBody = await loan.Content.ReadFromJsonAsync<JsonElement>();
        loanBody.GetProperty("transferKind").GetString().Should().Be("loan");
        loanBody.GetProperty("debtCurrency").GetString().Should().Be("BRL");
        loanBody.GetProperty("debtAmount").GetDecimal().Should().Be(100m);

        (await Send(HttpMethod.Post, "/api/transactions/transfer", anaJwt,
                new { sourceWalletId = anaWallet, destinationWalletId = brunoWallet, amount = 50m, kind = "payment" }))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        var preview = await Send(HttpMethod.Post, "/api/transactions/transfer/preview", brunoJwt,
            new { sourceWalletId = brunoWallet, destinationWalletId = anaWallet, amount = 30m, kind = "settlement" });
        preview.StatusCode.Should().Be(HttpStatusCode.OK);
        var previewBody = await preview.Content.ReadFromJsonAsync<JsonElement>();
        previewBody.GetProperty("kind").GetString().Should().Be("settlement");
        var effect = previewBody.GetProperty("debt");
        effect.GetProperty("before").GetDecimal().Should().Be(100m);
        effect.GetProperty("after").GetDecimal().Should().Be(70m);
        effect.GetProperty("debtorUserId").GetInt64().Should().Be(bruno);
        effect.GetProperty("creditorUserId").GetInt64().Should().Be(ana);

        (await Send(HttpMethod.Post, "/api/transactions/transfer", brunoJwt,
                new { sourceWalletId = brunoWallet, destinationWalletId = anaWallet, amount = 30m, kind = "settlement" }))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        var debt = (await Debts(bruno, brunoJwt)).GetProperty("debts").EnumerateArray().Should().ContainSingle().Subject;
        debt.GetProperty("amount").GetDecimal().Should().Be(70m);
        debt.GetProperty("direction").GetString().Should().Be("owes");

        var above = await Send(HttpMethod.Post, "/api/transactions/transfer", brunoJwt,
            new { sourceWalletId = brunoWallet, destinationWalletId = anaWallet, amount = 80m, kind = "settlement" });
        above.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await Message(above)).Should().Be("O valor é maior que a dívida (R$ 70,00).");

        var settleAll = await Send(HttpMethod.Post, "/api/transactions/transfer", brunoJwt,
            new { sourceWalletId = brunoWallet, destinationWalletId = anaWallet, kind = "settlement", settleAll = true });
        settleAll.StatusCode.Should().Be(HttpStatusCode.Created);
        (await settleAll.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("sourceAmount").GetDecimal().Should().Be(70m);
        (await Debts(bruno, brunoJwt)).GetProperty("debts").GetArrayLength().Should().Be(0);

        var noDebt = await Send(HttpMethod.Post, "/api/transactions/transfer", brunoJwt,
            new { sourceWalletId = brunoWallet, destinationWalletId = anaWallet, amount = 1m, kind = "settlement" });
        noDebt.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await Message(noDebt)).Should().Be("Você não tem dívida com Ana nesta moeda.");

        // Extrato da carteira de Ana: os três tipos aparecem nos lançamentos.
        var statement = await Send(HttpMethod.Get,
            $"/api/statements/wallets/{anaWallet}?start={DateTime.UtcNow.AddDays(-2):yyyy-MM-dd}&end={DateTime.UtcNow.AddDays(2):yyyy-MM-dd}", anaJwt);
        statement.StatusCode.Should().Be(HttpStatusCode.OK);
        (await statement.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("entries").EnumerateArray()
            .Select(e => e.GetProperty("transferKind").GetString())
            .Should().Contain(new[] { "loan", "payment", "settlement" });
    }

    [Fact]
    public async Task Kind_rules_return_the_contract_messages()
    {
        var (ana, anaJwt) = _factory.CreateUserWithAppJwt("Ana", "Regras", "ana.regras007@exemplo.com");
        var (bruno, _) = _factory.CreateUserWithAppJwt("Bruno", "Regras", "bruno.regras007@exemplo.com");
        var (carla, _) = _factory.CreateUserWithAppJwt("Carla", "Regras", "carla.regras007@exemplo.com");
        var (anaWallet, brunoWallet, _) = Seed(ana, bruno, carla);
        long anaSavings;
        using (var scope = _factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<FinamiContext>();
            var savings = new Account { Kind = AccountKind.Wallet, UserId = ana, Currency = Currency.Brl, Name = "Poupança" };
            context.Accounts.Add(savings);
            context.SaveChanges();
            anaSavings = savings.AccountId;
        }

        var sameOwner = await Send(HttpMethod.Post, "/api/transactions/transfer", anaJwt,
            new { sourceWalletId = anaWallet, destinationWalletId = anaSavings, amount = 10m, kind = "payment" });
        sameOwner.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Message(sameOwner)).Should().Be("O tipo só vale para transferência entre pessoas diferentes.");

        var invalid = await Send(HttpMethod.Post, "/api/transactions/transfer", anaJwt,
            new { sourceWalletId = anaWallet, destinationWalletId = brunoWallet, amount = 10m, kind = "doacao" });
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Message(invalid)).Should().Be("Tipo de transferência inválido.");

        var settlementOnly = await Send(HttpMethod.Post, "/api/transactions/transfer/preview", anaJwt,
            new { sourceWalletId = anaWallet, destinationWalletId = brunoWallet, amount = 10m, kind = "loan", settleAll = true });
        settlementOnly.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Message(settlementOnly)).Should().Be("Moeda da dívida e quitar tudo só valem para quitação.");

        // Sem kind entre pessoas diferentes: empréstimo (compatibilidade).
        var withoutKind = await Send(HttpMethod.Post, "/api/transactions/transfer", anaJwt,
            new { sourceWalletId = anaWallet, destinationWalletId = brunoWallet, amount = 10m });
        (await withoutKind.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("transferKind").GetString().Should().Be("loan");
    }

    [Fact]
    public async Task Transfer_destinations_list_family_wallets_and_require_control()
    {
        var (ana, anaJwt) = _factory.CreateUserWithAppJwt("Ana", "Destinos", "ana.destinos@exemplo.com");
        var (bruno, brunoJwt) = _factory.CreateUserWithAppJwt("Bruno", "Destinos", "bruno.destinos@exemplo.com");
        var (carla, _) = _factory.CreateUserWithAppJwt("Carla", "Destinos", "carla.destinos@exemplo.com");
        var (anaWallet, brunoWallet, _) = Seed(ana, bruno, carla);

        var response = await Send(HttpMethod.Get, $"/api/wallets/{anaWallet}/transfer-destinations", anaJwt);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("sourceWalletId").GetInt64().Should().Be(anaWallet);
        var only = body.GetProperty("sameCurrency").EnumerateArray().Should().ContainSingle().Subject;
        only.GetProperty("walletId").GetInt64().Should().Be(brunoWallet);
        only.GetProperty("ownerFirstName").GetString().Should().Be("Bruno");
        only.GetProperty("isOwn").GetBoolean().Should().BeFalse();
        only.GetProperty("balance").ValueKind.Should().Be(JsonValueKind.Null);
        body.GetProperty("conversion").GetArrayLength().Should().Be(0);

        var wallet = await Send(HttpMethod.Get, $"/api/wallets/{anaWallet}", anaJwt);
        (await wallet.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ownerFirstName").GetString()
            .Should().Be("Ana");

        var forbidden = await Send(HttpMethod.Get, $"/api/wallets/{anaWallet}/transfer-destinations", brunoJwt);
        forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
