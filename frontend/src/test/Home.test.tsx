import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation, useNavigate } from "react-router-dom";
import Home from "../screens/Home";

vi.mock("react-router-dom", () => ({
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
}));

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

describe("Home", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    vi.mocked(useLocation).mockReturnValue({ pathname: "/en/" } as any);
  });

  it("renderiza los elementos principales de la pantalla de inicio", () => {
    render(<Home />);

    expect(screen.getByText("home.subtitle")).toBeInTheDocument();
    expect(screen.getByText("home.createCampaign")).toBeInTheDocument();
    expect(screen.getByText("home.exploreCampaigns")).toBeInTheDocument();
    expect(screen.getByText("home.howItWorks")).toBeInTheDocument();
  });

  it("el botón de crear campaña navega a la ruta correcta", () => {
    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    render(<Home />);
    fireEvent.click(screen.getByText("home.createCampaign"));

    expect(mockNavigate).toHaveBeenCalledWith("/en/campaign/create");
  });

  it("el botón de explorar navega a la ruta correcta", () => {
    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    render(<Home />);
    fireEvent.click(screen.getByText("home.exploreCampaigns"));

    expect(mockNavigate).toHaveBeenCalledWith("/en/explore");
  });

  it("usa el idioma de la URL al navegar", () => {
    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useLocation).mockReturnValue({ pathname: "/es/" } as any);

    render(<Home />);
    fireEvent.click(screen.getByText("home.createCampaign"));

    expect(mockNavigate).toHaveBeenCalledWith("/es/campaign/create");
  });
});
