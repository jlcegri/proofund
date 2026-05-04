import {
  useConnection,
  useConnectors,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
  usePublicClient
} from "wagmi";
import { parseEther } from "viem";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { campaignAbi } from "../../contracts/abi/campaignAbi";
import { campaignFactoryAbi } from "../../contracts/abi/campaignFactoryAbi";
import { campaignFactoryContractAddress } from "../../contracts/address/campaignFactoryContractAddress";
import "./styles.css";

dayjs.extend(customParseFormat);

type Campaign = {
  address: `0x${string}`;
  title: string;
  description: string;
  image?: string;
  metadataURI?: string;
};

type CampaignMetadata = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  image?: unknown;
  images?: unknown;
};

function ipfsToHttp(uri: string) {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }

  return uri;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getMetadataImage(metadata: CampaignMetadata) {
  if (Array.isArray(metadata.images)) {
    return metadata.images.find((image): image is string => typeof image === "string");
  }

  return getString(metadata.images) || getString(metadata.image) || undefined;
}

function CreateCampaign() {
  const connection = useConnection();
  const connectors = useConnectors();
  const writeContract = useWriteContract();
  const publicClient = usePublicClient();
  const [eth, setEth] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [selectedCampaignAddress, setSelectedCampaignAddress] =
    useState<`0x${string}` | "">("");
  const [status, setStatus] = useState<"inactive" | "uploadingMetadata" |
    "waitingTransaction" | "success" | "error">("inactive");
  const timestamp = dayjs(time, "DD-MM-YYYY").unix();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaignMetadata, setIsLoadingCampaignMetadata] = useState(false);
  const [campaignMetadataError, setCampaignMetadataError] = useState("");

  const buttonText =
  status === "inactive"
    ? "Crear campaña"
    : status === "uploadingMetadata"
    ? "Subiendo metadatos..."
    : status === "waitingTransaction"
    ? "Esperando transacción..."
    : status === "success"
    ? "Campaña creada"
    : "Error al crear campaña";

  const campaignsQuery = useReadContract({
    address: campaignFactoryContractAddress,
    abi: campaignFactoryAbi,
    functionName: "getCampaigns",
  });

  const refetchCampaigns = campaignsQuery.refetch;
  const campaignAddresses = useMemo(
    () => (campaignsQuery.data ?? []) as `0x${string}`[],
    [campaignsQuery.data],
  );
  const campaignTitleByAddress = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.address, campaign.title])),
    [campaigns],
  );

  const receipt = useWaitForTransactionReceipt({
    hash: writeContract.data,
  });

  useEffect(() => {
    if (receipt.isSuccess) {
      refetchCampaigns();
    }
  }, [receipt.isSuccess, refetchCampaigns]);

  useEffect(() => {
    let ignore = false;

    async function loadCampaigns() {
      if (!publicClient || !campaignsQuery.data) return;

      const campaignsAddresses = Array.from(campaignsQuery.data).reverse() as `0x${string}`[];

      if (campaignsAddresses.length === 0) {
        setCampaigns([]);
        setCampaignMetadataError("");
        return;
      }

      setIsLoadingCampaignMetadata(true);
      setCampaignMetadataError("");

      const loadedCampaigns = await Promise.all(
        campaignsAddresses.map(async (campaignAddress) => {
          let campaignMetadataURI = "";

          try {
            campaignMetadataURI = await publicClient.readContract({
              address: campaignAddress,
              abi: campaignAbi,
              functionName: "metadataURI"
            }) as string;

            const response = await fetch(ipfsToHttp(campaignMetadataURI));

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const metadata = await response.json() as CampaignMetadata;

            return {
              address: campaignAddress,
              title: getString(metadata.title),
              description: getString(metadata.description),
              image: getMetadataImage(metadata),
              metadataURI: campaignMetadataURI
            };
          } catch (error) {
            console.error("Error cargando metadatos", campaignAddress, error);

            return {
              address: campaignAddress,
              title: `Campaña ${campaignAddress}`,
              description: campaignMetadataURI
                ? `No se pudieron cargar los metadatos desde ${campaignMetadataURI}`
                : "No se pudo leer la URI de metadatos del contrato",
              metadataURI: campaignMetadataURI
            };
          }
        })
      );

      if (!ignore) {
        setCampaigns(loadedCampaigns);
        setCampaignMetadataError("");
        setIsLoadingCampaignMetadata(false);
      }
    }

    loadCampaigns().catch((error) => {
      console.error(error);

      if (!ignore) {
        setCampaignMetadataError("No se pudieron cargar los metadatos de las campañas");
        setIsLoadingCampaignMetadata(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [publicClient, campaignsQuery.data]);

  useEffect(() => {
    if (!selectedCampaignAddress && campaignAddresses.length > 0) {
      setSelectedCampaignAddress(campaignAddresses[campaignAddresses.length - 1]);
    }
  }, [campaignAddresses, selectedCampaignAddress]);

  async function handleCreateCampaign() {
    try {

      setStatus("uploadingMetadata");

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);

      if (image) {
        formData.append("images", image);
      }

      const response = await fetch("http://localhost:3001/api/upload", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      setStatus("waitingTransaction")

      await writeContract.mutateAsync({
        address: campaignFactoryContractAddress,
        abi: campaignFactoryAbi,
        functionName: "createCampaign",
        args: [parseEther(eth), BigInt(timestamp), data.metadataURI],
      });

      setStatus("success");

    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  async function handleFund() {
    if (!selectedCampaignAddress) return;

    try {
      await writeContract.mutateAsync({
        address: selectedCampaignAddress,
        abi: campaignAbi,
        functionName: "fund",
        value: parseEther(eth),
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleWithdraw() {
    if (!selectedCampaignAddress) return;

    try {
      await writeContract.mutateAsync({
        address: selectedCampaignAddress,
        abi: campaignAbi,
        functionName: "withdraw",
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleFinishCampaign() {
    if (!selectedCampaignAddress) return;

    try {
      await writeContract.mutateAsync({
        address: selectedCampaignAddress,
        abi: campaignAbi,
        functionName: "finishCampaign",
      });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="app">
      {connection.status !== "connected" ? (
        <>
          {connectors.map((connector) => (
            <p className="status-message">
              Conéctate con {connector.name} para poder crear tus campañas
            </p>
          ))}
        </>
      ) : (
        <div className="app-content">
          <p>
            <strong>Conectado:</strong> Sí
          </p>
          <p>
            <strong>Dirección:</strong> {connection.address}
          </p>
          <p>
            <strong>Testnet:</strong> {connection.chain?.name}
          </p>

          <form
            className="panel campaign-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateCampaign();
            }}
          >
            <div className="campaign-form__fields">
              <label className="field-label">ETH</label>
              <input
                className="field-input"
                value={eth}
                onChange={(e) => setEth(e.target.value)}
                placeholder="ETH"
              />

              <label>Fecha de finalización</label>
              <input
                className="field-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="01-01-2030"
              />

              <label className="field-label">Nombre</label>
              <input
                className="field-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titulo"
              />

              <label>Descripción</label>
              <input
                className="field-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción"
              />

              <input
                className="field-input field-file"
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />

              {image && <p className="selected-file">Imagen seleccionada: {image.name}</p>}

            </div>
          </form>

          <button
            className="button button--primary button--full-mobile"
            onClick={handleCreateCampaign}
            disabled={status === "uploadingMetadata" || status === "waitingTransaction"}
          >
            {buttonText}
          </button>

          {campaignAddresses.length > 0 && (
            <>
              <div className="panel campaign-picker">
                <label>Campaña</label>
                <select
                  className="field-select"
                  value={selectedCampaignAddress}
                  onChange={(e) =>
                    setSelectedCampaignAddress(e.target.value as `0x${string}`)
                  }
                >
                  {campaignAddresses.map((campaignAddress) => (
                    <option key={campaignAddress} value={campaignAddress}>
                      {campaignTitleByAddress.get(campaignAddress) ?? campaignAddress}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campaign-actions">
                <button
                  className="button"
                  onClick={handleFund}
                >
                Aportar a la campaña
                </button>
                <button
                  className="button"
                  onClick={handleWithdraw}
                >
                Retirar fondos
                </button>
                <button
                  className="button"
                  onClick={handleFinishCampaign}
                >
                Finalizar campaña
                </button>
              </div>
            </>
          )}

          {campaignsQuery.isPending && <p>Cargando campañas...</p>}
          {isLoadingCampaignMetadata && <p className="status-message">Cargando metadatos...</p>}
          {campaignMetadataError && (
            <p className="status-message status-message--error">
              Error: {campaignMetadataError}
            </p>
          )}
          {campaignsQuery.error && (
            <p className="status-message status-message--error">
              Error: {campaignsQuery.error.message}
            </p>
          )}
          {writeContract.error && (
            <p className="status-message status-message--error">
              Error: {writeContract.error.message}
            </p>
          )}
          {writeContract.data && (
            <p className="status-message status-message--mono">
              Tx hash: {writeContract.data}
            </p>
          )}

        </div>
      )}


    </div>
  );

}

export default CreateCampaign;
