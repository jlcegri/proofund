import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePublicClient, useReadContract } from "wagmi";
import ExploreCampaigns from "../screens/ExploreCampaigns";

vi.mock("wagmi", () => ({
  usePublicClient: vi.fn(),
  useReadContract: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/en/explore" }),
  Link: ({
    children,
    to,
    className,
  }: {
    children: ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return {
    useTranslation: () => ({ t }),
  };
});

describe("ExploreCampaigns", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("muestra loading mientras carga las campañas", () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: undefined,
      isPending: true,
      error: null,
    } as any);

    vi.mocked(usePublicClient).mockReturnValue(null as any);

    render(<ExploreCampaigns />);

    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
  });

  it("muestra las campañas leídas desde CampaignFactory", async () => {
    const campaignAddress =
      "0x0000000000000000000000000000000000000001" as `0x${string}`;

    vi.mocked(useReadContract).mockReturnValue({
      data: [campaignAddress],
      isPending: false,
      error: null,
    } as any);

    const mockReadContract = vi
      .fn()
      .mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "metadataURI")
          return Promise.resolve("ipfs://QmTest123");
        if (functionName === "goalAmount")
          return Promise.resolve(1000000000000000000n);
        if (functionName === "totalRaised")
          return Promise.resolve(500000000000000000n);
        return Promise.resolve(null);
      });

    vi.mocked(usePublicClient).mockReturnValue({
      readContract: mockReadContract,
    } as any);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: "Test Campaign" }),
      })
    );

    render(<ExploreCampaigns />);

    expect(await screen.findByText("Test Campaign")).toBeInTheDocument();
    expect(await screen.findByText("0.5 exploreCampaigns.ethRaised")).toBeInTheDocument();
  });

  it("muestra título fallback cuando falla la carga de metadatos", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const campaignAddress =
      "0x0000000000000000000000000000000000000001" as `0x${string}`;

    vi.mocked(useReadContract).mockReturnValue({
      data: [campaignAddress],
      isPending: false,
      error: null,
    } as any);

    vi.mocked(usePublicClient).mockReturnValue({
      readContract: vi.fn().mockRejectedValue(new Error("RPC error")),
    } as any);

    render(<ExploreCampaigns />);

    expect(
      await screen.findByText("exploreCampaigns.campaignFallback")
    ).toBeInTheDocument();
  });

  it("renderiza múltiples campañas en orden inverso", async () => {
    const addressA = "0x0000000000000000000000000000000000000001" as `0x${string}`;
    const addressB = "0x0000000000000000000000000000000000000002" as `0x${string}`;

    vi.mocked(useReadContract).mockReturnValue({
      data: [addressA, addressB],
      isPending: false,
      error: null,
    } as any);

    vi.mocked(usePublicClient).mockReturnValue({
      readContract: vi.fn().mockImplementation(
        ({ address, functionName }: { address: `0x${string}`; functionName: string }) => {
          if (functionName === "metadataURI")
            return Promise.resolve(address === addressA ? "ipfs://QmA" : "ipfs://QmB");
          if (functionName === "goalAmount") return Promise.resolve(1000000000000000000n);
          if (functionName === "totalRaised") return Promise.resolve(1000000000000000000n);
          return Promise.resolve(null);
        }
      ),
    } as any);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ title: url.includes("QmA") ? "Campaign A" : "Campaign B" }),
        })
      )
    );

    render(<ExploreCampaigns />);

    await screen.findByText("Campaign A");

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings[0]).toHaveTextContent("Campaign B");
    expect(headings[1]).toHaveTextContent("Campaign A");
  });

  it("muestra el estado vacio cuando getCampaigns devuelve una lista vacia", () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: [],
      isPending: false,
      error: null,
    } as any);

    vi.mocked(usePublicClient).mockReturnValue({} as any);

    render(<ExploreCampaigns />);

    expect(screen.getByText("exploreCampaigns.empty")).toBeInTheDocument();
  });

  it("muestra error cuando useReadContract falla al obtener las campañas", () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("Contract error"),
    } as any);

    vi.mocked(usePublicClient).mockReturnValue(null as any);

    render(<ExploreCampaigns />);

    expect(screen.getByText("common.errorWithMessage")).toBeInTheDocument();
  });

  it("renderiza una imagen cuando la campaña tiene imagen en sus metadatos", async () => {
    const campaignAddress = "0x0000000000000000000000000000000000000001" as `0x${string}`;

    vi.mocked(useReadContract).mockReturnValue({
      data: [campaignAddress],
      isPending: false,
      error: null,
    } as any);

    vi.mocked(usePublicClient).mockReturnValue({
      readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "metadataURI") return Promise.resolve("ipfs://QmTest");
        if (functionName === "goalAmount") return Promise.resolve(1000000000000000000n);
        if (functionName === "totalRaised") return Promise.resolve(500000000000000000n);
        return Promise.resolve(null);
      }),
    } as any);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: "Con Imagen", image: "ipfs://QmImg" }),
    }));

    render(<ExploreCampaigns />);

    await screen.findByText("Con Imagen");
    expect(document.querySelector("img")).toBeInTheDocument();
  });

  it("muestra el fallback cuando el fetch de metadatos devuelve un error HTTP", async () => {
    const campaignAddress = "0x0000000000000000000000000000000000000001" as `0x${string}`;

    vi.mocked(useReadContract).mockReturnValue({
      data: [campaignAddress],
      isPending: false,
      error: null,
    } as any);

    vi.mocked(usePublicClient).mockReturnValue({
      readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "metadataURI") return Promise.resolve("ipfs://QmTest");
        if (functionName === "goalAmount") return Promise.resolve(1000000000000000000n);
        if (functionName === "totalRaised") return Promise.resolve(500000000000000000n);
        return Promise.resolve(null);
      }),
    } as any);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    render(<ExploreCampaigns />);

    expect(await screen.findByText("exploreCampaigns.campaignFallback")).toBeInTheDocument();
  });
});
