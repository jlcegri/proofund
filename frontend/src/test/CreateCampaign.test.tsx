import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useConnection,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
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

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/en/create" }),
  useNavigate: () => vi.fn(),
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
});
