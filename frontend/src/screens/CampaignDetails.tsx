import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatEther, isAddress, parseEther } from "viem";
import { gql, request } from 'graphql-request';
import {
  useConnection,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import dayjs from "dayjs";
import { campaignAbi } from "../contracts/abi/campaignAbi";

type CampaignMetadata = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  image?: unknown;
  images?: unknown;
};

type TransactionStatus = "inactive" | "waitingTransaction" | "success" | "error";
type PendingAction = "donate" | "withdraw" | "finish" | null;

const query = gql`
  query CampaignContributions($campaign: Bytes!) {
    contributions(
      first: 10
      orderBy: timestamp
      orderDirection: desc
      where: { campaign: $campaign }
    ) {
      user
      amount
      timestamp
      transactionHash
    }
  }
`;

const url = import.meta.env.VITE_API_URL;
const token = import.meta.env.VITE_TOKEN;
const headers = { Authorization: `Bearer ${token}` };

type ContributionHistoryItem = {
  user: string;
  amount: bigint;
  timestamp: number;
  transactionHash: string;
};

type ContributionHistoryResponse = {
  contributions: Array<{
    user: string;
    amount: string;
    timestamp: string;
    transactionHash: string;
  }>;
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

function getStatusLabelKey(status?: number) {
  if (status === 0) return "campaignDetails.statuses.active";
  if (status === 1) return "campaignDetails.statuses.completed";
  if (status === 2) return "campaignDetails.statuses.failed";
  if (status === 3) return "campaignDetails.statuses.cancelled";

  return "campaignDetails.statuses.unknown";
}

function formatDeadline(deadline?: bigint) {
  if (!deadline) return "";

  return dayjs.unix(Number(deadline)).format("DD-MM-YYYY");
}

function parseSubgraphBigInt(value: string) {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function truncateHex(value: string) {
  if (value.length <= 12) return value;

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatContributionDate(timestamp: number) {
  if (!timestamp) return "";

  return dayjs.unix(timestamp).format("DD-MM-YYYY HH:mm");
}

async function fetchSubgraphData(campaign: string) {
  const variables = {
    campaign: campaign.toLowerCase(),
  };

  const data = (await request(url, query, variables, headers)) as ContributionHistoryResponse;

  return data.contributions.map((contribution) => ({
    user: contribution.user,
    amount: parseSubgraphBigInt(contribution.amount),
    timestamp: Number(contribution.timestamp),
    transactionHash: contribution.transactionHash,
  }));
}

function CampaignDetails() {
  const { t } = useTranslation();
  const { campaignAddress: campaignAddressParam } = useParams();
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
  const [contributions, setContributions] = useState<ContributionHistoryItem[]>([]);
  const [isLoadingContributions, setIsLoadingContributions] = useState(false);
  const [contributionHistoryError, setContributionHistoryError] = useState("");
  const [contributionHistoryVersion, setContributionHistoryVersion] = useState(0);

  const campaignAddress = campaignAddressParam && isAddress(campaignAddressParam)
    ? campaignAddressParam as `0x${string}`
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
    (campaignAddress
      ? t("campaignDetails.campaignFallback", {
          address: campaignAddress,
        })
      : t("campaignDetails.campaignFallbackGeneric"));
  const description = getString(metadata?.description) || t("campaignDetails.noDescription");
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
      ? t("campaignDetails.waitingTransaction")
      : donationStatus === "success"
      ? t("campaignDetails.donationDone")
      : donationStatus === "error"
      ? t("campaignDetails.donationError")
      : t("campaignDetails.donate");
  const isTransactionBusy =
    donationStatus === "waitingTransaction" ||
    ownerActionStatus === "waitingTransaction" ||
    writeContract.isPending;
  const canDonate =
    connection.status === "connected" &&
    isActive &&
    Boolean(donationEth.trim()) &&
    !isTransactionBusy;
  const statusBadgeClassName =
    status === 0
      ? "badge badge-primary"
      : status === 1
      ? "badge badge-success"
      : status === 2
      ? "badge badge-error"
      : status === 3
      ? "badge badge-warning"
      : "badge badge-outline";

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
        console.error("Error loading metadata", campaignAddress, error);

        if (!ignore) {
          setMetadata(null);
          setMetadataError(t("campaignDetails.metadataLoadError"));
          setIsLoadingMetadata(false);
        }
      }
    }

    loadMetadata();

    return () => {
      ignore = true;
    };
  }, [campaignAddress, metadataURI, t]);

  useEffect(() => {
    let ignore = false;

    async function loadContributionHistory() {
      if (!campaignAddress) {
        setContributions([]);
        setContributionHistoryError("");
        setIsLoadingContributions(false);
        return;
      }

      setIsLoadingContributions(true);
      setContributionHistoryError("");

      try {
        const nextContributions = await fetchSubgraphData(campaignAddress);

        if (!ignore) {
          setContributions(nextContributions);
          setContributionHistoryError("");
        }
      } catch (error) {
        console.error("Error loading contribution history", campaignAddress, error);

        if (!ignore) {
          setContributions([]);
          setContributionHistoryError(t("campaignDetails.contributionHistory.error"));
        }
      } finally {
        if (!ignore) {
          setIsLoadingContributions(false);
        }
      }
    }

    loadContributionHistory();

    return () => {
      ignore = true;
    };
  }, [campaignAddress, contributionHistoryVersion, t]);

  useEffect(() => {
    if (!receipt.isSuccess || !pendingAction) return;

    if (pendingAction === "donate") {
      setDonationStatus("success");
      setDonationEth("");
      setContributionHistoryVersion((current) => current + 1);
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
      <div className="alert alert-error">
        <p>
          {t("campaignDetails.invalidAddress")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(isLoadingContract || isLoadingMetadata) && (
        <p className="alert alert-info">{t("campaignDetails.loading")}</p>
      )}

      {contractError && (
        <p className="alert alert-error">
          {t("common.errorWithMessage", {
            message: contractError.message,
          })}
        </p>
      )}

      {metadataError && (
        <p className="alert alert-error">
          {t("common.errorWithMessage", {
            message: metadataError,
          })}
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="space-y-6">
          <figure className="flex min-h-64 items-center justify-center overflow-hidden rounded-box bg-base-300">
            {image ? (
              <img
                className="h-full w-full object-cover"
                src={ipfsToHttp(image)}
                alt={title}
              />
            ) : (
              <span className="text-base-content/70">
                {t("campaignDetails.noImage")}
              </span>
            )}
          </figure>

          <section className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">
                {t("campaignDetails.contributionHistory.title")}
              </h2>

              {isLoadingContributions && (
                <p className="alert alert-info">
                  {t("campaignDetails.contributionHistory.loading")}
                </p>
              )}

              {contributionHistoryError && (
                <p className="alert alert-error">
                  {contributionHistoryError}
                </p>
              )}

              {!isLoadingContributions &&
                !contributionHistoryError &&
                contributions.length === 0 && (
                  <p className="alert alert-info">
                    {t("campaignDetails.contributionHistory.empty")}
                  </p>
                )}

              {!isLoadingContributions &&
                !contributionHistoryError &&
                contributions.length > 0 && (
                  <div className="grid gap-3">
                    {contributions.map((contribution) => (
                      <article
                        className="grid gap-3 rounded-box bg-base-200 p-4 sm:grid-cols-2"
                        key={`${contribution.transactionHash}-${contribution.timestamp}-${contribution.user}`}
                      >
                        <div>
                          <span className="text-sm text-base-content/70">{t("campaignDetails.contributionHistory.user")}</span>
                          <strong
                            className="block font-mono"
                            title={contribution.user}
                          >
                            {truncateHex(contribution.user)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-sm text-base-content/70">{t("campaignDetails.contributionHistory.amount")}</span>
                          <strong className="block">{formatEthAmount(contribution.amount)} ETH</strong>
                        </div>
                        <div>
                          <span className="text-sm text-base-content/70">{t("campaignDetails.contributionHistory.date")}</span>
                          <strong className="block">
                            {formatContributionDate(contribution.timestamp) ||
                              t("campaignDetails.notAvailable")}
                          </strong>
                        </div>
                        <div>
                          <span className="text-sm text-base-content/70">{t("campaignDetails.contributionHistory.transaction")}</span>
                          <strong
                            className="block font-mono"
                            title={contribution.transactionHash}
                          >
                            {truncateHex(contribution.transactionHash)}
                          </strong>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
            </div>
          </section>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body gap-6">
            <div className="space-y-3">
              <p className={statusBadgeClassName}>
                {t(getStatusLabelKey(status))}
              </p>
              <h1 className="text-3xl font-bold text-base-content">{title}</h1>
              <p className="text-base-content/70">{description}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <strong>{t("campaignDetails.progress")}</strong>
                <span>{formatPercent(progressPercent)}</span>
              </div>
              <progress
                className="progress progress-primary w-full"
                value={progressBarPercent}
                max={100}
              />
              <p className="text-sm text-base-content/70">
                {t("campaignDetails.raisedOfGoal", {
                  raised: formatEthAmount(totalRaised),
                  goal: formatEthAmount(goalAmount),
                })}
              </p>
            </div>

            <dl className="grid gap-3">
              <div className="rounded-box bg-base-200 p-4">
                <dt className="text-sm text-base-content/70">{t("campaignDetails.deadline")}</dt>
                <dd>
                  {formatDeadline(deadline) || t("campaignDetails.noDeadline")}
                </dd>
              </div>
              <div className="rounded-box bg-base-200 p-4">
                <dt className="text-sm text-base-content/70">{t("campaignDetails.owner")}</dt>
                <dd className="break-all font-mono">
                  {owner ?? t("campaignDetails.notAvailable")}
                </dd>
              </div>
              <div className="rounded-box bg-base-200 p-4">
                <dt className="text-sm text-base-content/70">{t("campaignDetails.contract")}</dt>
                <dd className="break-all font-mono">{campaignAddress}</dd>
              </div>
            </dl>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleDonate();
              }}
            >
              <div className="grid w-full gap-1">
                <label className="label" htmlFor="donation-eth">{t("campaignDetails.donationAmount")}</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="donation-eth"
                    className="input w-full"
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
                    className="btn btn-primary w-full sm:w-auto"
                    disabled={!canDonate}
                    type="submit"
                  >
                    {donationButtonText}
                  </button>
                </div>
              </div>
              {connection.status !== "connected" && (
                <p className="text-sm text-warning">
                  {t("campaignDetails.connectWalletToDonate")}
                </p>
              )}
              {connection.status === "connected" && !isActive && (
                <p className="text-sm text-warning">
                  {t("campaignDetails.inactiveCampaignHint")}
                </p>
              )}
            </form>

            {writeContract.error && (
              <p className="alert alert-error">
                {t("common.errorWithMessage", {
                  message: writeContract.error.message,
                })}
              </p>
            )}

            {donationStatus === "success" && (
              <p className="alert alert-success">
                {t("campaignDetails.donationSuccess")}
              </p>
            )}

            {isOwner && (
              <div className="space-y-4 rounded-box bg-base-200 p-4">
                <h2 className="text-xl font-bold">
                  {t("campaignDetails.ownerOptions")}
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="btn btn-secondary"
                    disabled={isTransactionBusy || !isSuccessful}
                    onClick={handleWithdraw}
                    type="button"
                  >
                    {t("campaignDetails.withdraw")}
                  </button>
                  <button
                    className="btn btn-outline"
                    disabled={isTransactionBusy || !isActive}
                    onClick={handleFinishCampaign}
                    type="button"
                  >
                    {t("campaignDetails.finishCampaign")}
                  </button>
                </div>
                {ownerActionStatus === "waitingTransaction" && (
                  <p className="alert alert-info">
                    {t("campaignDetails.waitingTransaction")}
                  </p>
                )}
                {ownerActionStatus === "success" && (
                  <p className="alert alert-success">
                    {t("campaignDetails.actionSuccess")}
                  </p>
                )}
                {ownerActionStatus === "error" && (
                  <p className="alert alert-error">
                    {t("campaignDetails.actionError")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default CampaignDetails;
