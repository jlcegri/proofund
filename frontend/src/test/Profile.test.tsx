import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "graphql-request";
import { useConnection } from "wagmi";
import Profile from "../screens/Profile";

vi.mock("wagmi", () => ({
  useConnection: vi.fn(),
}));

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("graphql-request", () => ({
  gql: vi.fn(),
  request: vi.fn(),
}));

const connectedMock = {
  status: "connected",
  address: "0x0000000000000000000000000000000000000001",
  chain: { name: "Sepolia" },
  connector: { name: "MetaMask" },
};

describe("Profile", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ status: "disconnected" } as any);
    vi.mocked(request).mockResolvedValue({ campaigns: [], contributions: [] } as any);
  });

  it("muestra solo el título cuando la wallet no está conectada", () => {
    render(<Profile />);

    expect(screen.getByText("profile.title")).toBeInTheDocument();
    expect(screen.queryByText("profile.statistics.title")).not.toBeInTheDocument();
  });

  it("muestra la información de conexión cuando la wallet está conectada", () => {
    vi.mocked(useConnection).mockReturnValue(connectedMock as any);

    render(<Profile />);

    expect(screen.getByText("profile.statistics.title")).toBeInTheDocument();
    expect(screen.getByText("profile.address:")).toBeInTheDocument();
  });

  it("muestra el indicador de carga mientras se obtienen las estadísticas", () => {
    vi.mocked(useConnection).mockReturnValue(connectedMock as any);
    vi.mocked(request).mockReturnValue(new Promise(() => {}) as any);

    render(<Profile />);

    expect(screen.getByText("profile.statistics.loading")).toBeInTheDocument();
  });

  it("muestra error cuando la petición de estadísticas falla", async () => {
    vi.mocked(useConnection).mockReturnValue(connectedMock as any);
    vi.mocked(request).mockRejectedValue(new Error("fallo"));

    render(<Profile />);

    expect(await screen.findByText("profile.statistics.error")).toBeInTheDocument();
  });

  it("muestra mensaje vacío cuando el usuario no tiene actividad", async () => {
    vi.mocked(useConnection).mockReturnValue(connectedMock as any);
    vi.mocked(request).mockResolvedValue({ campaigns: [], contributions: [] } as any);

    render(<Profile />);

    expect(await screen.findByText("profile.statistics.empty")).toBeInTheDocument();
  });

  it("muestra las estadísticas cuando el usuario tiene actividad", async () => {
    vi.mocked(useConnection).mockReturnValue(connectedMock as any);
    vi.mocked(request).mockResolvedValue({
      campaigns: [{ totalRaised: "1000000000000000000" }],
      contributions: [{ amount: "500000000000000000", campaign: { id: "0x01" } }],
    } as any);

    render(<Profile />);

    expect(await screen.findByText("profile.statistics.campaignsCreated")).toBeInTheDocument();
    expect(screen.getByText("0.5 ETH")).toBeInTheDocument();
    expect(screen.getByText("1 ETH")).toBeInTheDocument();
  });
});
