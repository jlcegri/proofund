import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
  usePublicClient
} from "wagmi";
import { parseEther } from "viem";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { campaignAbi } from "./campaignAbi";
import { campaignFactoryAbi } from "./campaignFactoryAbi";
import { campaignFactoryContractAddress } from "./campaignFactoryContractAddress";
import "./App.css";

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

function shortenAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function App() {
  const connection = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const writeContract = useWriteContract();
  const publicClient = usePublicClient();
  const [eth, setEth] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [metadataURI, setMetadataURI] = useState("");
  const [selectedCampaignAddress, setSelectedCampaignAddress] =
    useState<`0x${string}` | "">("");
  const timestamp = dayjs(time, "DD-MM-YYYY").unix();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaignMetadata, setIsLoadingCampaignMetadata] = useState(false);
  const [campaignMetadataError, setCampaignMetadataError] = useState("");

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
              title: `Campaña ${shortenAddress(campaignAddress)}`,
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
      if (!metadataURI) {
        console.error("Primero debes subir los metadatos");
        return;
      }
      await writeContract.mutateAsync({
        address: campaignFactoryContractAddress,
        abi: campaignFactoryAbi,
        functionName: "createCampaign",
        args: [parseEther(eth), BigInt(timestamp), metadataURI],
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function sendMetadataToBackend() {
    try {

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

      setMetadataURI(data.metadataURI);

    } catch (err) {
      console.error(err);
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
      <h1 className="app-title">Proofund</h1>
      <p>Conecta tu wallet y comienza a crear tus campañas</p>

      {connection.status !== "connected" ? (
        <div className="panel wallet-connect">
          {connectors.map((connector) => (
            <button
              className="button button--primary"
              key={connector.uid}
              onClick={() => connect.mutate({ connector })}
            >
              Conéctate con {connector.name}
            </button>
          ))}

          {connect.isPending && <p className="status-message">Conectando...</p>}
          {connect.error && (
            <p className="status-message status-message--error">
              Error: {connect.error.message}
            </p>
          )}
        </div>
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

          <button
            className="button button--secondary button--full-mobile"
            onClick={() => disconnect.mutate()}
          >
            Desconectar
          </button>

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

              <button
                className="button button--primary"
                type="button"
                onClick={() => sendMetadataToBackend()}
              >
                Subir metadatos
              </button>


            </div>
          </form>

          <button
            className="button button--primary button--full-mobile"
            onClick={handleCreateCampaign}
          >
            Crear campaña
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
                      {campaignAddress}
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
          {writeContract.isPending && <p>Confirmando transacción...</p>}
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

          {campaigns.map((campaign) => (
      <div className="panel campaign-card" key={campaign.address}>
        <h3 className="campaign-card__title">{campaign.title}</h3>
        <p className="campaign-card__description">{campaign.description}</p>
        {campaign.image && (
          <img
            className="campaign-card__image"
            src={ipfsToHttp(campaign.image)}
            alt={campaign.title}
          />
        )}
        </div>
      ))}

        </div>
      )}


    </div>
  );

}

export default App;
