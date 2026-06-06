import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublicClient, useReadContract } from "wagmi";
import ExploreCampaigns from "./ExploreCampaigns";

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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ExploreCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra loading mientras carga las campanas", () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: undefined,
      isPending: true,
      error: null,
    } as any);

    vi.mocked(usePublicClient).mockReturnValue(null as any);

    render(<ExploreCampaigns />);

    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
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
});
