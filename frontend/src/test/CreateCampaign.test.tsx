import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeEventLog } from "viem";
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { useNavigate } from "react-router-dom";
import CreateCampaign from "../screens/CreateCampaign";

vi.mock("wagmi", () => ({
  useConnection: vi.fn(),
  usePublicClient: vi.fn(),
  useSwitchChain: vi.fn(),
  useWriteContract: vi.fn(),
}));

vi.mock("wagmi/chains", () => ({
  sepolia: { id: 11155111 },
}));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return { ...actual, decodeEventLog: vi.fn() };
});

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/en/create" }),
  useNavigate: vi.fn(),
}));

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

describe("CreateCampaign", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      chain: { id: 11155111 },
    } as any);
    vi.mocked(usePublicClient).mockReturnValue(null as any);
    vi.mocked(useSwitchChain).mockReturnValue({
      isPending: false,
      switchChainAsync: vi.fn(),
    } as any);
    vi.mocked(useWriteContract).mockReturnValue({
      mutateAsync: vi.fn(),
      error: null,
      data: undefined,
    } as any);
  });

  it("muestra errores de campos requeridos al enviar el formulario vacío", () => {
    render(<CreateCampaign />);

    fireEvent.click(screen.getByRole("button", { name: "createCampaign.submit" }));

    expect(screen.getByText("createCampaign.validation.titleRequired")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.descriptionRequired")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.goalRequired")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.deadlineRequired")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.imageRequired")).toBeInTheDocument();
  });

  it("muestra error de tipo al seleccionar un fichero que no es imagen", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<CreateCampaign />);

    const file = new File(["content"], "document.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("createCampaign.selectImage"), file);

    expect(
      screen.getByText("createCampaign.validation.imageType")
    ).toBeInTheDocument();
  });

  it("muestra error de tamaño al seleccionar una imagen superior a 5 MB", async () => {
    const user = userEvent.setup();
    render(<CreateCampaign />);

    const bigContent = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([bigContent], "big.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("createCampaign.selectImage"), file);

    expect(
      screen.getByText("createCampaign.validation.imageSize")
    ).toBeInTheDocument();
  });

  it("actualiza título, descripción y cantidad objetivo del preview al escribir en los campos", async () => {
    const user = userEvent.setup();
    render(<CreateCampaign />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "createCampaign.preview.titlePlaceholder"
    );

    await user.type(screen.getByLabelText("createCampaign.campaignTitleLabel"), "Mi campaña");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Mi campaña");
  
    expect(
      screen.getByText("createCampaign.preview.descriptionPlaceholder")
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("createCampaign.descriptionLabel"),
      "Una descripción"
    );

    expect(screen.getByText("Una descripción")).toBeInTheDocument();

    expect(
      screen.getByText("createCampaign.preview.goalPlaceholder")
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("createCampaign.ethLabel"), "1.5");

    expect(screen.getByText("1.5 ETH")).toBeInTheDocument();
  });

  it("muestra error de metadatos cuando el upload falla", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve(null),
      })
    );

    render(<CreateCampaign />);

    await user.type(screen.getByLabelText("createCampaign.campaignTitleLabel"), "Mi campaña");
    await user.type(screen.getByLabelText("createCampaign.descriptionLabel"), "Una descripción válida");
    await user.type(screen.getByLabelText("createCampaign.ethLabel"), "1");
    await user.type(screen.getByLabelText("createCampaign.deadlineLabel"), "01-01-2030");
    await user.upload(
      screen.getByLabelText("createCampaign.selectImage"),
      new File(["img"], "photo.png", { type: "image/png" })
    );

    fireEvent.click(screen.getByRole("button", { name: "createCampaign.submit" }));

    expect(
      await screen.findByText("createCampaign.validation.metadataUploadFailed")
    ).toBeInTheDocument();
  });

  it("flujo completo: crea la campaña y navega a su página", async () => {
    const campaignAddress = "0x000000000000000000000000000000000000000a" as const;

    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ metadataURI: "ipfs://QmTest" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const mockMutateAsync = vi.fn().mockResolvedValue("0xTxHash");
    vi.mocked(useWriteContract).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    const mockWaitForReceipt = vi.fn().mockResolvedValue({
      logs: [{ data: "0x", topics: [] }],
    });
    vi.mocked(usePublicClient).mockReturnValue({
      waitForTransactionReceipt: mockWaitForReceipt,
    } as any);

    vi.mocked(decodeEventLog).mockReturnValue({
      eventName: "CampaignCreated",
      args: { campaign: campaignAddress },
    } as any);

    const user = userEvent.setup();
    render(<CreateCampaign />);

    await user.type(screen.getByLabelText("createCampaign.campaignTitleLabel"), "Mi campaña");
    await user.type(screen.getByLabelText("createCampaign.descriptionLabel"), "Una descripción válida");
    await user.type(screen.getByLabelText("createCampaign.ethLabel"), "1");
    await user.type(screen.getByLabelText("createCampaign.deadlineLabel"), "01-01-2030");
    await user.upload(
      screen.getByLabelText("createCampaign.selectImage"),
      new File(["img"], "photo.png", { type: "image/png" })
    );

    fireEvent.click(screen.getByRole("button", { name: "createCampaign.submit" }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/upload",
        expect.objectContaining({ method: "POST" })
      )
    );

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "createCampaign" })
      )
    );

    await waitFor(() =>
      expect(mockWaitForReceipt).toHaveBeenCalledWith({ hash: "0xTxHash" })
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/en/campaign/0x000000000000000000000000000000000000000a"
      )
    );
  });

  it("muestra mensaje de conectar wallet para crear campaña", async () => {
    vi.mocked(useConnection).mockReturnValue({ status: "disconnected" } as any);
    render(<CreateCampaign />);

    expect(
      screen.getByText("createCampaign.connectWalletPrompt")
    ).toBeInTheDocument();
  });

  it("muestra errores de validación por valores cortos o formato incorrecto", async () => {
    const user = userEvent.setup();
    render(<CreateCampaign />);

    await user.type(screen.getByLabelText("createCampaign.campaignTitleLabel"), "ab");
    await user.type(screen.getByLabelText("createCampaign.descriptionLabel"), "corta");
    await user.type(screen.getByLabelText("createCampaign.ethLabel"), "abc");
    await user.type(screen.getByLabelText("createCampaign.deadlineLabel"), "99-99-9999");

    fireEvent.click(screen.getByRole("button", { name: "createCampaign.submit" }));

    expect(screen.getByText("createCampaign.validation.titleMinLength")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.descriptionMinLength")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.goalInvalid")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.deadlineInvalid")).toBeInTheDocument();
  });

  it("muestra errores de validación por valores fuera de rango o fecha pasada", async () => {
    const user = userEvent.setup();
    render(<CreateCampaign />);

    fireEvent.change(
      screen.getByLabelText("createCampaign.campaignTitleLabel"),
      { target: { value: "a".repeat(81) } }
    );
    fireEvent.change(
      screen.getByLabelText("createCampaign.descriptionLabel"),
      { target: { value: "a".repeat(1001) } }
    );
    await user.type(screen.getByLabelText("createCampaign.ethLabel"), "0");
    await user.type(screen.getByLabelText("createCampaign.deadlineLabel"), "01-01-2020");

    fireEvent.click(screen.getByRole("button", { name: "createCampaign.submit" }));

    expect(screen.getByText("createCampaign.validation.titleMaxLength")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.descriptionMaxLength")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.goalPositive")).toBeInTheDocument();
    expect(screen.getByText("createCampaign.validation.deadlineFuture")).toBeInTheDocument();
  });
});
