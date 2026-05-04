import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { formatEther, isAddress, parseEther } from "viem";
import {
  useConnection,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import dayjs from "dayjs";
import { campaignAbi } from "../../contracts/abi/campaignAbi";
import "./styles.css";

type CampaignMetadata = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  image?: unknown;
  images?: unknown;
};

type TransactionStatus = "inactive" | "waitingTransaction" | "success" | "error";
type PendingAction = "donate" | "withdraw" | "finish" | null;

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

function formatEthAmount(value?: bigint) {
  const formatted = formatEther(value ?? 0n);
  const [whole, fraction] = formatted.split(".");

  if (!fraction) return formatted;

  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, "");

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function getStatusLabel(status?: number) {
  if (status === 0) return "Activa";
  if (status === 1) return "Completada";
  if (status === 2) return "Fallida";
  if (status === 3) return "Cancelada";

  return "Desconocido";
}

function formatDeadline(deadline?: bigint) {
  if (!deadline) return "Sin fecha";

  return dayjs.unix(Number(deadline)).format("DD-MM-YYYY");
}

function CampaignDetails() {
  const { address } = useParams();
  const connection = useConnection();
  const writeContract = useWriteContract();
  const [donationEth, setDonationEth] = useState("");
  const [donationStatus, setDonationStatus] =
    useState<TransactionStatus>("inactive");
  const [ownerActionStatus, setOwnerActionStatus] =
    useState<TransactionStatus>("inactive");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [metadata, setMetadata] = useState<CampaignMetadata | null>(null);
  const [metadataError, setMetadataError] = useState("");
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  const campaignAddress = address && isAddress(address)
    ? address as `0x${string}`
    : undefined;
  const hasCampaignAddress = Boolean(campaignAddress);

  const metadataURIQuery = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: "metadataURI",
    query: {
      enabled: hasCampaignAddress,
    },
  });

  const goalAmountQuery = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: "goalAmount",
    query: {
      enabled: hasCampaignAddress,
    },
  });

  const totalRaisedQuery = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: "totalRaised",
    query: {
      enabled: hasCampaignAddress,
    },
  });

  const deadlineQuery = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: "deadline",
    query: {
      enabled: hasCampaignAddress,
    },
  });

  const statusQuery = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: "status",
    query: {
      enabled: hasCampaignAddress,
    },
  });

  const ownerQuery = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: "owner",
    query: {
      enabled: hasCampaignAddress,
    },
  });

  const receipt = useWaitForTransactionReceipt({
    hash: writeContract.data,
  });

  const goalAmount = goalAmountQuery.data ?? 0n;
  const totalRaised = totalRaisedQuery.data ?? 0n;
  const deadline = deadlineQuery.data;
  const status = statusQuery.data;
  const owner = ownerQuery.data;
  const metadataURI = metadataURIQuery.data ?? "";
  const refetchTotalRaised = totalRaisedQuery.refetch;
  const refetchStatus = statusQuery.refetch;
  const isActive = status === 0;
  const isSuccessful = status === 1;
  const image = metadata ? getMetadataImage(metadata) : undefined;
  const title =
    getString(metadata?.title) ||
    getString(metadata?.name) ||
    (campaignAddress ? `Campaña ${campaignAddress}` : "Campaña");
  const description = getString(metadata?.description) || "Sin descripción.";
  const isOwner = Boolean(
    owner &&
    connection.address &&
    owner.toLowerCase() === connection.address.toLowerCase()
  );
  const contractError =
    metadataURIQuery.error ||
    goalAmountQuery.error ||
    totalRaisedQuery.error ||
    deadlineQuery.error ||
    statusQuery.error ||
    ownerQuery.error;
  const isLoadingContract =
    metadataURIQuery.isPending ||
    goalAmountQuery.isPending ||
    totalRaisedQuery.isPending ||
    deadlineQuery.isPending ||
    statusQuery.isPending ||
    ownerQuery.isPending;
  const progressPercent = useMemo(() => {
    if (goalAmount === 0n) return 0;

    return Number((totalRaised * 10000n) / goalAmount) / 100;
  }, [goalAmount, totalRaised]);
  const progressBarPercent = Math.min(progressPercent, 100);
  const donationButtonText =
    donationStatus === "waitingTransaction"
      ? "Esperando transacción..."
      : donationStatus === "success"
      ? "Donación realizada"
      : donationStatus === "error"
      ? "Error al donar"
      : "Donar";
  const isTransactionBusy =
    donationStatus === "waitingTransaction" ||
    ownerActionStatus === "waitingTransaction" ||
    writeContract.isPending;
  const canDonate =
    connection.status === "connected" &&
    isActive &&
    Boolean(donationEth.trim()) &&
    !isTransactionBusy;

  useEffect(() => {
    let ignore = false;

    async function loadMetadata() {
      if (!metadataURI) {
        setMetadata(null);
        setMetadataError("");
        return;
      }

      setIsLoadingMetadata(true);
      setMetadataError("");

      try {
        const response = await fetch(ipfsToHttp(metadataURI));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const metadataResponse = await response.json() as CampaignMetadata;

        if (!ignore) {
          setMetadata(metadataResponse);
          setMetadataError("");
          setIsLoadingMetadata(false);
        }
      } catch (error) {
        console.error("Error cargando metadatos", campaignAddress, error);

        if (!ignore) {
          setMetadata(null);
          setMetadataError("No se pudieron cargar los metadatos de la campaña");
          setIsLoadingMetadata(false);
        }
      }
    }

    loadMetadata();

    return () => {
      ignore = true;
    };
  }, [campaignAddress, metadataURI]);

  useEffect(() => {
    if (!receipt.isSuccess || !pendingAction) return;

    if (pendingAction === "donate") {
      setDonationStatus("success");
      setDonationEth("");
    } else {
      setOwnerActionStatus("success");
    }

    refetchTotalRaised();
    refetchStatus();
    setPendingAction(null);
  }, [pendingAction, receipt.isSuccess, refetchStatus, refetchTotalRaised]);

  async function handleDonate() {
    if (
      !campaignAddress ||
      !donationEth.trim() ||
      connection.status !== "connected" ||
      !isActive ||
      isTransactionBusy
    ) {
      setDonationStatus("error");
      return;
    }

    try {
      setPendingAction("donate");
      setDonationStatus("waitingTransaction");

      await writeContract.mutateAsync({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: "fund",
        value: parseEther(donationEth),
      });
    } catch (error) {
      console.error(error);
      setPendingAction(null);
      setDonationStatus("error");
    }
  }

  async function handleWithdraw() {
    if (!campaignAddress || !isOwner || !isSuccessful || isTransactionBusy) return;

    try {
      setPendingAction("withdraw");
      setOwnerActionStatus("waitingTransaction");

      await writeContract.mutateAsync({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: "withdraw",
      });
    } catch (error) {
      console.error(error);
      setPendingAction(null);
      setOwnerActionStatus("error");
    }
  }

  async function handleFinishCampaign() {
    if (!campaignAddress || !isOwner || !isActive || isTransactionBusy) return;

    try {
      setPendingAction("finish");
      setOwnerActionStatus("waitingTransaction");

      await writeContract.mutateAsync({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: "finishCampaign",
      });
    } catch (error) {
      console.error(error);
      setPendingAction(null);
      setOwnerActionStatus("error");
    }
  }

  if (!campaignAddress) {
    return (
      <div className="app">
        <p className="status-message status-message--error">
          Dirección de campaña no válida.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-content">
        {(isLoadingContract || isLoadingMetadata) && (
          <p>Cargando campaña...</p>
        )}

        {contractError && (
          <p className="status-message status-message--error">
            Error: {contractError.message}
          </p>
        )}

        {metadataError && (
          <p className="status-message status-message--error">
            Error: {metadataError}
          </p>
        )}

        <section className="panel campaign-detail">
          <div className="campaign-detail__media">
            {image ? (
              <img
                className="campaign-detail__image"
                src={ipfsToHttp(image)}
                alt={title}
              />
            ) : (
              <div className="campaign-detail__image-placeholder">
                Sin imagen
              </div>
            )}
          </div>

          <div className="campaign-detail__content">
            <div>
              <p className="campaign-detail__status">
                {getStatusLabel(status)}
              </p>
              <h1 className="campaign-detail__title">{title}</h1>
              <p className="campaign-detail__description">{description}</p>
            </div>

            <div className="campaign-progress">
              <div className="campaign-progress__header">
                <strong>Progreso</strong>
                <span>{formatPercent(progressPercent)}</span>
              </div>
              <div className="campaign-progress__track">
                <div
                  className="campaign-progress__bar"
                  style={{ width: `${progressBarPercent}%` }}
                />
              </div>
              <p className="campaign-progress__amount">
                {formatEthAmount(totalRaised)} ETH recaudados de{" "}
                {formatEthAmount(goalAmount)} ETH
              </p>
            </div>

            <dl className="campaign-detail__stats">
              <div>
                <dt>Fecha límite</dt>
                <dd>{formatDeadline(deadline)}</dd>
              </div>
              <div>
                <dt>Titular</dt>
                <dd className="campaign-detail__mono">{owner ?? "No disponible"}</dd>
              </div>
              <div>
                <dt>Contrato</dt>
                <dd className="campaign-detail__mono">{campaignAddress}</dd>
              </div>
            </dl>

            <form
              className="campaign-donation"
              onSubmit={(event) => {
                event.preventDefault();
                handleDonate();
              }}
            >
              <label className="field-label" htmlFor="donation-eth">
                Donación en ETH
              </label>
              <div className="campaign-donation__actions">
                <input
                  id="donation-eth"
                  className="field-input"
                  value={donationEth}
                  onChange={(event) => {
                    setDonationEth(event.target.value);

                    if (donationStatus !== "waitingTransaction") {
                      setDonationStatus("inactive");
                    }
                  }}
                  placeholder="0.01"
                />
                <button
                  className="button button--primary"
                  disabled={!canDonate}
                  type="submit"
                >
                  {donationButtonText}
                </button>
              </div>
              {connection.status !== "connected" && (
                <p className="campaign-detail__hint">
                  Conecta tu wallet para poder donar.
                </p>
              )}
              {connection.status === "connected" && !isActive && (
                <p className="campaign-detail__hint">
                  Esta campaña no acepta más donaciones.
                </p>
              )}
            </form>

            {writeContract.error && (
              <p className="status-message status-message--error">
                Error: {writeContract.error.message}
              </p>
            )}

            {donationStatus === "success" && (
              <p className="status-message status-message--success">
                Donación realizada correctamente.
              </p>
            )}

            {isOwner && (
              <div className="campaign-owner-actions">
                <h2 className="campaign-owner-actions__title">
                  Opciones del titular
                </h2>
                <div className="campaign-actions">
                  <button
                    className="button"
                    disabled={isTransactionBusy || !isSuccessful}
                    onClick={handleWithdraw}
                    type="button"
                  >
                    Retirar fondos
                  </button>
                  <button
                    className="button"
                    disabled={isTransactionBusy || !isActive}
                    onClick={handleFinishCampaign}
                    type="button"
                  >
                    Finalizar campaña
                  </button>
                </div>
                {ownerActionStatus === "waitingTransaction" && (
                  <p className="status-message">
                    Esperando transacción...
                  </p>
                )}
                {ownerActionStatus === "success" && (
                  <p className="status-message status-message--success">
                    Acción realizada correctamente.
                  </p>
                )}
                {ownerActionStatus === "error" && (
                  <p className="status-message status-message--error">
                    Error al ejecutar la acción.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CampaignDetails;
