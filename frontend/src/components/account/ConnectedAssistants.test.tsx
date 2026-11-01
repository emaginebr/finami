import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedAssistants } from "./ConnectedAssistants";
import { OAuthScope } from "../../types/oauthRequest";
import type { OAuthConnectionInfo } from "../../types/oauthConnection";
import { storeSession } from "../../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
import type { MockHandler, MockResponse } from "../../test/utils";
import { notifyError, notifyErrorMessage, notifySuccess } from "../../utils/notify";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn(), notifyErrorMessage: vi.fn() };
});

const NOW = new Date("2026-11-01T18:47:00Z");
const MCP_URL = "https://finami.app/mcp";

const claude: OAuthConnectionInfo = {
  connectionId: 7,
  clientName: "Claude",
  scopes: [OAuthScope.Read, OAuthScope.Write],
  createdAt: "2026-11-01T18:00:00Z",
  lastUsedAt: "2026-11-01T18:42:00Z",
};

const chatgpt: OAuthConnectionInfo = {
  connectionId: 5,
  clientName: "ChatGPT",
  scopes: [OAuthScope.Read],
  createdAt: "2026-10-20T12:00:00Z",
  lastUsedAt: null,
};

const setup = (routes: Record<string, MockResponse | MockHandler>) => {
  storeSession();
  const fetchMock = mockFetch({
    "GET /api/oauth/mcp-info": { body: { mcpUrl: MCP_URL } },
    ...routes,
  });
  const user = userEvent.setup();
  const view = renderWithProviders(<ConnectedAssistants />, { path: "/conta" });
  return { fetchMock, user, ...view };
};

const items = async () =>
  within(await screen.findByRole("list")).getAllByRole("listitem");

describe("ConnectedAssistants", () => {
  beforeEach(() => {
    vi.mocked(notifySuccess).mockClear();
    vi.mocked(notifyError).mockClear();
    vi.mocked(notifyErrorMessage).mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  it("lista assistentes com selo de permissão, datas e último uso; axe sem violações", async () => {
    const { container } = setup({ "GET /api/oauth/connections": { body: [claude, chatgpt] } });

    const [first, second] = await items();
    expect(screen.getByRole("region", { name: "Assistentes conectados" })).toHaveAccessibleDescription(
      "Assistentes de IA que podem acessar sua conta pelo MCP.",
    );
    expect(within(first!).getByRole("heading", { level: 3, name: "Claude" })).toBeInTheDocument();
    expect(first).toHaveTextContent("Consulta e alterações");
    expect(first).toHaveTextContent("Conectado em 01/11/2026");
    expect(first).toHaveTextContent("Último uso há 5 minutos");
    expect(first!.querySelector("time")).toHaveAttribute("datetime", "2026-11-01T18:00:00.000Z");
    expect(second).toHaveTextContent("Só consulta");
    expect(second).toHaveTextContent("Conectado em 20/10/2026");
    expect(second).toHaveTextContent("Ainda não usado");
    expect(screen.getByRole("button", { name: "Desconectar Claude" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desconectar todos" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("desconectar pede confirmação, chama a API, tira da lista e mostra o toast", async () => {
    const { fetchMock, user } = setup({
      "GET /api/oauth/connections": { body: [claude, chatgpt] },
      "DELETE /api/oauth/connections/7": { status: 204 },
    });

    await user.click(await screen.findByRole("button", { name: "Desconectar Claude" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Desconectar Claude\?/ });
    expect(dialog).toHaveTextContent("O assistente perde o acesso na hora.");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Desconectar" }));

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Claude desconectado."));
    expect(requestsTo(fetchMock, "DELETE /api/oauth/connections/7")).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Claude" })).not.toBeInTheDocument();
    // Com uma conexão só, "Desconectar todos" some; o foco vai para o item que ocupou a posição
    expect(screen.queryByRole("button", { name: "Desconectar todos" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Desconectar ChatGPT" })).toHaveFocus());
  });

  it("cancelar não chama a API", async () => {
    const { fetchMock, user } = setup({ "GET /api/oauth/connections": { body: [claude] } });

    await user.click(await screen.findByRole("button", { name: "Desconectar Claude" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(requestsTo(fetchMock, "DELETE /api/oauth/connections/7")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 3, name: "Claude" })).toBeInTheDocument();
  });

  it("erro ao desconectar mostra toast de erro e mantém a lista", async () => {
    const { user } = setup({
      "GET /api/oauth/connections": { body: [claude] },
      "DELETE /api/oauth/connections/7": apiError(404, "Conexão não encontrada."),
    });

    await user.click(await screen.findByRole("button", { name: "Desconectar Claude" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Desconectar" }));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifySuccess).not.toHaveBeenCalled();
    // O modal fica aberto para nova tentativa (o Radix esconde o resto da árvore acessível)
    expect(screen.getByRole("alertdialog", { name: /Desconectar Claude\?/ })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3, name: "Claude", hidden: true })).toHaveLength(1);
  });

  it("desconectar todos (2+) confirma, chama a API e vai para o vazio", async () => {
    const { fetchMock, user } = setup({
      "GET /api/oauth/connections": { body: [claude, chatgpt] },
      "DELETE /api/oauth/connections": { status: 204 },
    });

    await user.click(await screen.findByRole("button", { name: "Desconectar todos" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Desconectar todos os assistentes\?/ });
    expect(dialog).toHaveTextContent("Os 2 assistentes perdem o acesso na hora.");
    await user.click(within(dialog).getByRole("button", { name: "Desconectar todos" }));

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Assistentes desconectados."));
    expect(requestsTo(fetchMock, "DELETE /api/oauth/connections")).toHaveLength(1);
    const empty = await screen.findByRole("heading", { level: 3, name: "Nenhum assistente conectado." });
    await waitFor(() => expect(empty).toHaveFocus());
    expect(await screen.findByLabelText("Endereço do MCP")).toHaveValue(MCP_URL);
  });

  it("vazio mostra o endereço do MCP e copia; axe sem violações", async () => {
    const { user, container } = setup({ "GET /api/oauth/connections": { body: [] } });

    expect(await screen.findByText("Nenhum assistente conectado.")).toBeInTheDocument();
    expect(
      screen.getByText("Para conectar, adicione este endereço no seu assistente (ex.: Claude → Conectores):"),
    ).toBeInTheDocument();
    const field = await screen.findByLabelText("Endereço do MCP");
    expect(field).toHaveValue(MCP_URL);
    expect(field).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Desconectar todos" })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Copiar endereço do MCP" }));

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Endereço copiado."));
    expect(await navigator.clipboard.readText()).toBe(MCP_URL);
  });

  it("falha ao copiar mostra toast de erro e seleciona o endereço", async () => {
    const { user } = setup({ "GET /api/oauth/connections": { body: [] } });
    const field = await screen.findByLabelText<HTMLInputElement>("Endereço do MCP");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("negado"));

    await user.click(screen.getByRole("button", { name: "Copiar endereço do MCP" }));

    await waitFor(() =>
      expect(notifyErrorMessage).toHaveBeenCalledWith(
        "Não foi possível copiar. Selecione o endereço e copie manualmente.",
      ),
    );
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(field).toHaveFocus();
  });

  it("erro ao carregar mostra o aviso com \"Tentar de novo\"", async () => {
    let calls = 0;
    const { user } = setup({
      "GET /api/oauth/connections": () => {
        calls += 1;
        return calls === 1 ? apiError(500, "Falhou.") : { body: [claude] };
      },
    });

    expect(await screen.findByText("Não foi possível carregar os assistentes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Claude" })).toBeInTheDocument();
  });

  it("último uso há menos de 1 minuto mostra \"agora há pouco\"", async () => {
    setup({
      "GET /api/oauth/connections": { body: [{ ...claude, lastUsedAt: "2026-11-01T18:46:30Z" }] },
    });

    const [first] = await items();
    expect(first).toHaveTextContent("Último uso agora há pouco");
  });

  it("\"Tentar de novo\" fica na faixa em loading com o foco e, se falhar de novo, o foco continua nele", async () => {
    let calls = 0;
    let release: (response: MockResponse) => void = () => undefined;
    const { user } = setup({
      "GET /api/oauth/connections": () => {
        calls += 1;
        if (calls === 1) return apiError(500, "Falhou.");
        return new Promise<MockResponse>((resolve) => {
          release = resolve;
        });
      },
    });

    const alert = await screen.findByRole("alert");
    const retry = within(alert).getByRole("button", { name: "Tentar de novo" });
    await user.click(retry);

    const busy = await within(alert).findByRole("button", { name: "Carregando…" });
    expect(busy).toBe(retry);
    expect(busy).toHaveFocus();
    expect(alert).toHaveTextContent("Não foi possível carregar os assistentes");

    // Simula o navegador tirando o foco do botão `disabled`; a nova falha devolve o foco a ele
    act(() => busy.blur());
    act(() => release(apiError(500, "Falhou de novo.")));

    await waitFor(() => expect(alert).toHaveTextContent("Falhou de novo."));
    const again = within(alert).getByRole("button", { name: "Tentar de novo" });
    expect(again).toBe(retry);
    await waitFor(() => expect(again).toHaveFocus());
  });

  it("vazio: enquanto o endereço do MCP carrega mostra o esqueleto do campo", async () => {
    const { container } = setup({
      "GET /api/oauth/connections": { body: [] },
      "GET /api/oauth/mcp-info": () => new Promise<MockResponse>(() => undefined),
    });

    expect(await screen.findByText("Nenhum assistente conectado.")).toBeInTheDocument();
    const busy = container.querySelector("[aria-busy='true']");
    expect(busy).toHaveTextContent("Carregando…");
    expect(screen.queryByLabelText("Endereço do MCP")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("vazio: erro ao carregar o endereço do MCP mostra o aviso e tenta de novo", async () => {
    let calls = 0;
    let release: (response: MockResponse) => void = () => undefined;
    const { fetchMock, user } = setup({
      "GET /api/oauth/connections": { body: [] },
      "GET /api/oauth/mcp-info": () => {
        calls += 1;
        if (calls === 1) return apiError(500, "Falhou.");
        return new Promise<MockResponse>((resolve) => {
          release = resolve;
        });
      },
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar o endereço do MCP.");
    expect(screen.queryByLabelText("Endereço do MCP")).not.toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(alert).findByRole("button", { name: "Carregando…" })).toHaveFocus();

    act(() => release({ body: { mcpUrl: MCP_URL } }));

    expect(await screen.findByLabelText("Endereço do MCP")).toHaveValue(MCP_URL);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "GET /api/oauth/mcp-info")).toHaveLength(2);
  });

  it("falha ao desconectar devolve o foco ao botão de confirmar (B-8)", async () => {
    let release: (response: MockResponse) => void = () => undefined;
    const { user } = setup({
      "GET /api/oauth/connections": { body: [claude] },
      "DELETE /api/oauth/connections/7": () =>
        new Promise<MockResponse>((resolve) => {
          release = resolve;
        }),
    });

    await user.click(await screen.findByRole("button", { name: "Desconectar Claude" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Desconectar" }));

    const busy = await within(dialog).findByRole("button", { name: "Desconectando…" });
    expect(busy).toBeDisabled();
    // Simula o navegador tirando o foco do botão `disabled` durante o envio (um `blur()` não serve:
    // o FocusScope do Radix devolve o foco ao último elemento; o conteúdo do diálogo tem tabIndex -1)
    act(() => dialog.focus());
    expect(busy).not.toHaveFocus();

    act(() => release(apiError(500, "Falhou.")));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    const confirm = within(dialog).getByRole("button", { name: "Desconectar" });
    expect(confirm).toBe(busy);
    await waitFor(() => expect(confirm).toHaveFocus());
  });
});
