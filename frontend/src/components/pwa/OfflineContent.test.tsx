import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OfflineContent } from "./OfflineContent";
import { axe } from "../../test/utils";

describe("OfflineContent", () => {
  it("mostra o aviso de conteúdo indisponível e 'Tentar de novo' chama onRetry", async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <main>
        <OfflineContent onRetry={onRetry} />
      </main>,
    );

    const region = screen.getByRole("status");
    expect(
      screen.getByRole("heading", { level: 2, name: "Este conteúdo não está disponível sem internet." }),
    ).toBeInTheDocument();
    expect(region).toHaveTextContent("Abra esta tela de novo quando a conexão voltar.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
