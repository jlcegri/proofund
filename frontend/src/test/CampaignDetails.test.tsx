import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "graphql-request";
import { useParams } from "react-router-dom";
import {
  useConnection,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import CampaignDetails from "../screens/CampaignDetails";

vi.mock("wagmi", () => ({
  useConnection: vi.fn(),
  useReadContract: vi.fn(),
  useSwitchChain: vi.fn(),
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
}));

vi.mock("wagmi/chains", () => ({
  sepolia: { id: 11155111 },
}));

vi.mock("react-router-dom", () => ({
  useParams: vi.fn(),
}));

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("graphql-request", () => ({
  gql: vi.fn(),
  request: vi.fn().mockResolvedValue({ contributions: [], refunds: [], withdrawals: [] }),
}));

describe("CampaignDetails", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    vi.mocked(useParams).mockReturnValue({
      campaignAddress: "0x0000000000000000000000000000000000000001",
    });

    vi.mocked(useReadContract).mockReturnValue({
      isPending: false,
      data: undefined,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "disconnected",
      address: undefined,
      chain: undefined,
    } as any);

    vi.mocked(useSwitchChain).mockReturnValue({
      isPending: false,
      switchChainAsync: vi.fn(),
    } as any);

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
      data: undefined,
      isPending: false,
    } as any);

    vi.mocked(request).mockResolvedValue({
      contributions: [],
      refunds: [],
      withdrawals: [],
    } as any);
  });

  it("muestra el spinner mientras se cargan los datos del contrato", () => {
    vi.mocked(useReadContract).mockReturnValue({
      isPending: true,
      data: undefined,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<CampaignDetails />);

    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
  });

  it("muestra error de dirección inválida cuando la URL no contiene una dirección válida", () => {
    vi.mocked(useParams).mockReturnValue({ campaignAddress: "not-an-address" });

    render(<CampaignDetails />);

    expect(screen.getByText("campaignDetails.invalidAddress")).toBeInTheDocument();
  });

  it("muestra alerta de error cuando el contrato devuelve un error", () => {
    vi.mocked(useReadContract).mockReturnValue({
      isPending: false,
      data: undefined,
      error: new Error("Error de contrato"),
      refetch: vi.fn(),
    } as any);

    render(<CampaignDetails />);

    expect(screen.getByText("common.errorWithMessage")).toBeInTheDocument();
  });

  it("muestra aviso de conectar wallet en el formulario de donación", () => {
    render(<CampaignDetails />);

    expect(screen.getByText("campaignDetails.connectWalletToDonate")).toBeInTheDocument();
  });

  it("renderiza título, badge de estado, cantidades y barra de progreso cuando los datos se cargan", async () => {
    const contractData: Record<string, unknown> = {
      metadataURI: "ipfs://QmTest123",
      goalAmount: 1000000000000000000n,
      totalRaised: 500000000000000000n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 0,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: "Test Campaign", image: "ipfs://QmImage123" }),
      })
    );

    render(<CampaignDetails />);

    expect(await screen.findByText("Test Campaign")).toBeInTheDocument();
    expect(screen.getByText("campaignDetails.statuses.active")).toBeInTheDocument();
    expect(screen.getByText("campaignDetails.raisedOfGoal")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("muestra badge de campaña completada cuando status es 1", () => {
    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 1 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);

    expect(screen.getByText("campaignDetails.statuses.completed")).toBeInTheDocument();
  });

  it("muestra badge de campaña fallida cuando status es 2", () => {
    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 2 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);

    expect(screen.getByText("campaignDetails.statuses.failed")).toBeInTheDocument();
  });

  it("muestra badge de campaña cancelada cuando status es 3", () => {
    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 3 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);

    expect(screen.getByText("campaignDetails.statuses.cancelled")).toBeInTheDocument();
  });

  it("muestra aviso de campaña inactiva cuando la wallet está conectada y la campaña no está activa", () => {
    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 1 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000002",
      chain: { id: 11155111 },
    } as any);

    render(<CampaignDetails />);

    expect(screen.getByText("campaignDetails.inactiveCampaignHint")).toBeInTheDocument();
  });

  it("muestra texto sin imagen cuando los metadatos no contienen imagen", async () => {
    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "metadataURI" ? "ipfs://QmTest" : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: "Sin imagen" }),
      })
    );

    render(<CampaignDetails />);

    expect(await screen.findByText("Sin imagen")).toBeInTheDocument();
    expect(screen.getByText("common.noImage")).toBeInTheDocument();
  });

  it("muestra error de metadatos cuando el fetch de IPFS devuelve ok: false", async () => {
    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "metadataURI" ? "ipfs://QmTest" : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    render(<CampaignDetails />);

    expect(await screen.findByText("common.errorWithMessage")).toBeInTheDocument();
  });

  it("actualiza el valor del campo de donación al escribir", () => {
    render(<CampaignDetails />);

    fireEvent.change(
      screen.getByLabelText("campaignDetails.donationAmount"),
      { target: { value: "1.5" } }
    );

    expect(screen.getByLabelText("campaignDetails.donationAmount")).toHaveValue("1.5");
  });

  it("muestra error de writeContract cuando la transacción falla", () => {
    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
      error: new Error("Transacción fallida"),
      data: undefined,
    } as any);

    render(<CampaignDetails />);

    expect(screen.getByText("common.errorWithMessage")).toBeInTheDocument();
  });

  it("muestra error en el botón de donación al enviar el formulario sin wallet conectada", () => {
    render(<CampaignDetails />);

    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText("campaignDetails.donationError")).toBeInTheDocument();
  });

  it("llama a writeContract al enviar una donación válida con wallet conectada", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 0 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);

    fireEvent.change(
      screen.getByLabelText("campaignDetails.donationAmount"),
      { target: { value: "0.1" } }
    );
    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText("campaignDetails.waitingTransaction")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "fund" })
      )
    );
  });

  it("llama a writeContract al cancelar una campaña activa siendo el owner", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    const contractData: Record<string, unknown> = {
      metadataURI: "",
      goalAmount: 0n,
      totalRaised: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 0,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);

    fireEvent.click(screen.getByText("campaignDetails.cancelCampaign"));

    expect(screen.getByText("campaignDetails.waitingTransaction")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "cancelCampaign" })
      )
    );
  });

  it("muestra la sección de reembolso cuando la campaña ha fallado y el usuario ha contribuido", async () => {
    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 2 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000002",
      chain: { id: 11155111 },
    } as any);

    vi.mocked(request).mockResolvedValue({
      contributions: [{ transactionHash: "0xabc", user: "0x0000000000000000000000000000000000000002", amount: "0", timestamp: "0" }],
      refunds: [],
      withdrawals: [],
    } as any);

    render(<CampaignDetails />);

    expect(await screen.findByText("campaignDetails.refundOptions")).toBeInTheDocument();
  });

  it("muestra las opciones de propietario cuando la dirección conectada es el owner", () => {
    const contractData: Record<string, unknown> = {
      metadataURI: "",
      goalAmount: 1000000000000000000n,
      totalRaised: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 0,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    render(<CampaignDetails />);

    expect(screen.getByText("campaignDetails.ownerOptions")).toBeInTheDocument();
    expect(screen.getByText("campaignDetails.withdraw")).toBeInTheDocument();
    expect(screen.getByText("campaignDetails.finishCampaign")).toBeInTheDocument();
    expect(screen.getByText("campaignDetails.cancelCampaign")).toBeInTheDocument();
  });

  it("no muestra las opciones de propietario cuando la dirección conectada no es el owner", () => {
    const contractData: Record<string, unknown> = {
      metadataURI: "",
      goalAmount: 1000000000000000000n,
      totalRaised: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 0,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000002",
      chain: { id: 11155111 },
    } as any);

    render(<CampaignDetails />);

    expect(screen.queryByText("campaignDetails.ownerOptions")).not.toBeInTheDocument();
    expect(screen.queryByText("campaignDetails.withdraw")).not.toBeInTheDocument();
    expect(screen.queryByText("campaignDetails.finishCampaign")).not.toBeInTheDocument();
    expect(screen.queryByText("campaignDetails.cancelCampaign")).not.toBeInTheDocument();
  });

  it("muestra error de historial cuando la petición al subgraph falla", async () => {
    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000002",
      chain: { id: 11155111 },
    } as any);
    vi.mocked(request).mockRejectedValue(new Error("Subgraph error"));

    render(<CampaignDetails />);

    expect(await screen.findByText("campaignDetails.contributionHistory.error")).toBeInTheDocument();
  });

  it("llama a writeContract al finalizar una campaña con el objetivo alcanzado siendo el owner", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    const contractData: Record<string, unknown> = {
      metadataURI: "",
      goalAmount: 1n,
      totalRaised: 1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 0,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);
    fireEvent.click(screen.getByText("campaignDetails.finishCampaign"));

    expect(screen.getByText("campaignDetails.waitingTransaction")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "finishCampaign" })
      )
    );
  });

  it("muestra donationSuccess cuando el recibo de la transacción de donación es exitoso", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
      data: {},
      isPending: false,
      isSuccess: true,
      isError: false,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 0 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);
    fireEvent.change(
      screen.getByLabelText("campaignDetails.donationAmount"),
      { target: { value: "0.1" } }
    );
    fireEvent.submit(document.querySelector("form")!);

    expect(await screen.findByText("campaignDetails.donationSuccess")).toBeInTheDocument();
  });

  it("muestra donationError cuando el recibo de la transacción de donación reporta error", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
      data: undefined,
      isPending: false,
      isSuccess: false,
      isError: true,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 0 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);
    fireEvent.change(
      screen.getByLabelText("campaignDetails.donationAmount"),
      { target: { value: "0.1" } }
    );
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByText("campaignDetails.donationError")).toBeInTheDocument()
    );
  });

  it("muestra actionSuccess tras completar la transacción de cancelación", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
      data: {},
      isPending: false,
      isSuccess: true,
      isError: false,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    const contractData: Record<string, unknown> = {
      metadataURI: "",
      goalAmount: 0n,
      totalRaised: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 0,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);
    fireEvent.click(screen.getByText("campaignDetails.cancelCampaign"));

    expect(await screen.findByText("campaignDetails.actionSuccess")).toBeInTheDocument();
  });

  it("muestra actionError cuando la transacción de cancelación falla en la red", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
      data: undefined,
      isPending: false,
      isSuccess: false,
      isError: true,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    const contractData: Record<string, unknown> = {
      metadataURI: "",
      goalAmount: 0n,
      totalRaised: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 0,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);
    fireEvent.click(screen.getByText("campaignDetails.cancelCampaign"));

    expect(await screen.findByText("campaignDetails.actionError")).toBeInTheDocument();
  });

  it("llama a switchChain cuando la wallet está en una red diferente al donar", async () => {
    const mockSwitchMutateAsync = vi.fn().mockResolvedValue(undefined);
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useSwitchChain).mockReturnValue({
      isPending: false,
      switchChainAsync: vi.fn(),
      mutateAsync: mockSwitchMutateAsync,
    } as any);

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 1 },
    } as any);

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 0 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);
    fireEvent.change(
      screen.getByLabelText("campaignDetails.donationAmount"),
      { target: { value: "0.1" } }
    );
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() =>
      expect(mockSwitchMutateAsync).toHaveBeenCalledWith({ chainId: 11155111 })
    );
  });

  it("muestra donationError cuando la transacción de donación falla en la red", async () => {
    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockRejectedValue(new Error("tx failed")),
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: functionName === "status" ? 0 : undefined,
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);
    fireEvent.change(
      screen.getByLabelText("campaignDetails.donationAmount"),
      { target: { value: "0.1" } }
    );
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByText("campaignDetails.donationError")).toBeInTheDocument()
    );
  });

  it("muestra actionError cuando la transacción de cancelación falla por error de contrato", async () => {
    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockRejectedValue(new Error("contract error")),
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    const contractData: Record<string, unknown> = {
      metadataURI: "",
      goalAmount: 0n,
      totalRaised: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 0,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);
    fireEvent.click(screen.getByText("campaignDetails.cancelCampaign"));

    await waitFor(() =>
      expect(screen.getByText("campaignDetails.actionError")).toBeInTheDocument()
    );
  });

  it("llama a writeContract al retirar fondos siendo el owner de una campaña exitosa", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue("0xhash");

    vi.mocked(useWriteContract).mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
      error: null,
      data: undefined,
    } as any);

    vi.mocked(useConnection).mockReturnValue({
      status: "connected",
      address: "0x0000000000000000000000000000000000000001",
      chain: { id: 11155111 },
    } as any);

    const contractData: Record<string, unknown> = {
      metadataURI: "",
      goalAmount: 1n,
      totalRaised: 1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      status: 1,
      owner: "0x0000000000000000000000000000000000000001",
    };

    vi.mocked(useReadContract).mockImplementation(({ functionName }: any) => ({
      isPending: false,
      data: contractData[functionName],
      error: null,
      refetch: vi.fn(),
    } as any));

    render(<CampaignDetails />);

    await waitFor(() =>
      expect(screen.getByText("campaignDetails.withdraw").closest("button")).not.toBeDisabled()
    );
    fireEvent.click(screen.getByText("campaignDetails.withdraw"));

    await waitFor(() =>
      expect(screen.getByText("campaignDetails.waitingTransaction")).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "withdraw" })
      )
    );
  });
});
