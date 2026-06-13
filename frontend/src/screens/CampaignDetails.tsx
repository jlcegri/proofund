import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatEther, isAddress, parseEther } from "viem";
import { gql, request } from 'graphql-request';
import {
  useConnection,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import { sepolia } from "wagmi/chains";
import dayjs from "dayjs";
import { campaignAbi } from "../contracts/abi/campaignAbi";

type CampaignMetadata = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  image?: unknown;
};

type TransactionStatus = "inactive" | "waitingTransaction" | "success" | "error";
type PendingAction = "donate" | "withdraw" | "finish" | "cancel" | "refund";
type PendingTransaction = {
  action: PendingAction;
  hash: `0x${string}`;
  donation?: {
    amount: bigint;
    user: string;
  };
};

const refundGracePeriodSeconds = 7 * 24 * 60 * 60;
const secondsPerDay = 24 * 60 * 60;
const ETH_FORMAT = /^\d+(\.\d{1,18})?$/;

const query = gql`
  query CampaignContributions($campaign: Bytes!) {
    contributions(
      first: 3
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

const userContributionQuery = gql`
  query UserCampaignContribution($campaign: Bytes!, $user: Bytes!) {
    contributions(
      first: 1
      where: { campaign: $campaign, user: $user }
    ) {
      transactionHash
    }
  }
`;

const userRefundQuery = gql`
  query UserCampaignRefund($campaign: Bytes!, $user: Bytes!) {
    refunds(
      first: 1
      where: { campaign: $campaign, user: $user }
    ) {
      transactionHash
    }
  }
`;

const userWithdrawalQuery = gql`
  query UserCampaignWithdrawal($campaign: Bytes!, $user: Bytes!) {
    withdrawals(
      first: 1
      where: { campaign: $campaign, user: $user }
    ) {
      transactionHash
    }
  }
`;

const url = "https://api.studio.thegraph.com/query/1749481/subgraph-proofund-sepolia/version/latest";
const token = "7da61121a8d740ce7f7d93168a0aab4a";
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

type UserContributionResponse = {
  contributions: Array<{
    transactionHash: string;
  }>;
};

type UserRefundResponse = {
  refunds: Array<{
    transactionHash: string;
  }>;
};

type UserWithdrawalResponse = {
  withdrawals: Array<{
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

function parsePositiveEthAmount(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue || !ETH_FORMAT.test(trimmedValue)) return null;

  try {
    const amount = parseEther(trimmedValue);

    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

function getMetadataImage(metadata: CampaignMetadata) {
  return getString(metadata.image) || undefined;
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

function hasTransactionHash(
  contributions: ContributionHistoryItem[],
  transactionHash: string
) {
  return contributions.some(
    (contribution) =>
      contribution.transactionHash.toLowerCase() === transactionHash.toLowerCase()
  );
}

function mergeOptimisticContribution(
  contributions: ContributionHistoryItem[],
  optimisticContribution: ContributionHistoryItem | null
) {
  if (
    !optimisticContribution ||
    hasTransactionHash(contributions, optimisticContribution.transactionHash)
  ) {
    return contributions;
  }

  return [optimisticContribution, ...contributions].slice(0, 3);
}

function truncateHex(value: string) {
  if (value.length <= 12) return value;

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getSepoliaAddressUrl(address: string) {
  return `https://sepolia.etherscan.io/address/${address}`;
}

function getSepoliaTransactionUrl(address: string) {
  return `https://sepolia.etherscan.io/tx/${address}`;
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

async function fetchUserHasContributed(campaign: string, user: string) {
  const variables = {
    campaign: campaign.toLowerCase(),
    user: user.toLowerCase(),
  };

  const data = (await request(
    url,
    userContributionQuery,
    variables,
    headers
  )) as UserContributionResponse;

  return data.contributions.length > 0;
}

async function fetchUserHasRefunded(campaign: string, user: string) {
  const variables = {
    campaign: campaign.toLowerCase(),
    user: user.toLowerCase(),
  };

  const data = (await request(
    url,
    userRefundQuery,
    variables,
    headers
  )) as UserRefundResponse;

  return data.refunds.length > 0;
}

async function fetchUserHasWithdrawn(campaign: string, user: string) {
  const variables = {
    campaign: campaign.toLowerCase(),
    user: user.toLowerCase(),
  };

  const data = (await request(
    url,
    userWithdrawalQuery,
    variables,
    headers
  )) as UserWithdrawalResponse;

  return data.withdrawals.length > 0;
}

function CampaignDetails() {
  const { t } = useTranslation();
  const { campaignAddress: campaignAddressParam } = useParams();
  const connection = useConnection();
  const switchChain = useSwitchChain();
  const writeContract = useWriteContract();
  const [donationEth, setDonationEth] = useState("");
  const [donationStatus, setDonationStatus] =
    useState<TransactionStatus>("inactive");
  const [ownerActionStatus, setOwnerActionStatus] =
    useState<TransactionStatus>("inactive");
  const [refundStatus, setRefundStatus] =
    useState<TransactionStatus>("inactive");
  const [pendingTransaction, setPendingTransaction] =
    useState<PendingTransaction | null>(null);
  const [metadata, setMetadata] = useState<CampaignMetadata | null>(null);
  const [metadataError, setMetadataError] = useState("");
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [contributions, setContributions] = useState<ContributionHistoryItem[]>([]);
  const [optimisticContribution, setOptimisticContribution] =
    useState<ContributionHistoryItem | null>(null);
  const [optimisticContributionRefreshCount, setOptimisticContributionRefreshCount] =
    useState(0);
  const [isLoadingContributions, setIsLoadingContributions] = useState(false);
  const [contributionHistoryError, setContributionHistoryError] = useState("");
  const [contributionHistoryVersion, setContributionHistoryVersion] = useState(0);
  const [hasUserContributed, setHasUserContributed] = useState(false);
  const [isLoadingUserContribution, setIsLoadingUserContribution] = useState(false);
  const [hasUserRefunded, setHasUserRefunded] = useState(false);
  const [hasOwnerWithdrawn, setHasOwnerWithdrawn] = useState(false);
  const [isLoadingRefundEvent, setIsLoadingRefundEvent] = useState(false);
  const [isLoadingWithdrawalEvent, setIsLoadingWithdrawalEvent] = useState(false);
  const [showRefundAlreadyCompleted, setShowRefundAlreadyCompleted] = useState(false);
  const [showWithdrawAlreadyCompleted, setShowWithdrawAlreadyCompleted] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(() =>
    Math.floor(Date.now() / 1000)
  );

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

  const userContributionAmountQuery = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: "contributions",
    args: connection.address ? [connection.address] : undefined,
    query: {
      enabled:
        hasCampaignAddress &&
        connection.status === "connected" &&
        Boolean(connection.address),
    },
  });

  const fundsWithdrawnQuery = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: "fundsWithdrawn",
    query: {
      enabled: hasCampaignAddress,
    },
  });

  const receipt = useWaitForTransactionReceipt({
    hash: pendingTransaction?.hash,
  });

  const goalAmount = goalAmountQuery.data ?? 0n;
  const totalRaised = totalRaisedQuery.data ?? 0n;
  const deadline = deadlineQuery.data;
  const status = statusQuery.data;
  const owner = ownerQuery.data;
  const userContributionAmount = userContributionAmountQuery.data;
  const fundsWithdrawn = fundsWithdrawnQuery.data ?? false;
  const metadataURI = metadataURIQuery.data ?? "";
  const refetchTotalRaised = totalRaisedQuery.refetch;
  const refetchStatus = statusQuery.refetch;
  const refetchUserContributionAmount = userContributionAmountQuery.refetch;
  const refetchFundsWithdrawn = fundsWithdrawnQuery.refetch;
  const isActive = status === 0;
  const isSuccessful = status === 1;
  const deadlineTimestamp = deadline ? Number(deadline) : 0;
  const hasReachedGoal = goalAmount > 0n && totalRaised >= goalAmount;
  const hasPassedDeadline = Boolean(
    deadlineTimestamp && currentTimestamp >= deadlineTimestamp
  );
  const isAfterRefundGracePeriod = Boolean(
    deadlineTimestamp &&
      currentTimestamp >= deadlineTimestamp + refundGracePeriodSeconds
  );
  const isRefundAvailableByStatus = status === 2 || status === 3;
  const isRefundAvailable =
    isRefundAvailableByStatus || (isActive && isAfterRefundGracePeriod);
  const shouldShowRefundGracePeriodHint = isActive && isAfterRefundGracePeriod;
  const daysUntilDeadline = deadlineTimestamp
    ? Math.max(0, Math.ceil((deadlineTimestamp - currentTimestamp) / secondsPerDay))
    : null;
  const deadlineRemainingText =
    deadlineTimestamp && currentTimestamp >= deadlineTimestamp
      ? t("campaignDetails.deadlinePassed")
      : daysUntilDeadline
      ? t("campaignDetails.daysRemaining", { count: daysUntilDeadline })
      : "";
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
  const refundButtonText =
    refundStatus === "waitingTransaction"
      ? t("campaignDetails.waitingTransaction")
      : refundStatus === "success"
      ? t("campaignDetails.refundDone")
      : refundStatus === "error"
      ? t("campaignDetails.refundError")
      : t("campaignDetails.refund");
  const isTransactionBusy =
    donationStatus === "waitingTransaction" ||
    ownerActionStatus === "waitingTransaction" ||
    refundStatus === "waitingTransaction" ||
    switchChain.isPending ||
    writeContract.isPending;
  const donationAmount = parsePositiveEthAmount(donationEth);
  const hasRefundableContribution =
    typeof userContributionAmount === "bigint" && userContributionAmount > 0n;
  const hasCompletedRefund =
    hasUserRefunded ||
    (hasUserContributed &&
      typeof userContributionAmount === "bigint" &&
      userContributionAmount === 0n);
  const hasCompletedWithdraw = hasOwnerWithdrawn || fundsWithdrawn;
  const canDonate =
    connection.status === "connected" &&
    isActive &&
    donationAmount !== null &&
    !isTransactionBusy;
  const canRefund =
    connection.status === "connected" &&
    isRefundAvailable &&
    (hasRefundableContribution || hasCompletedRefund) &&
    !isLoadingUserContribution &&
    !isLoadingRefundEvent &&
    !isTransactionBusy;
  const canWithdraw =
    isOwner &&
    isSuccessful &&
    !isLoadingWithdrawalEvent &&
    !fundsWithdrawnQuery.isPending &&
    !isTransactionBusy;
  const canFinishCampaign =
    isOwner &&
    isActive &&
    (hasReachedGoal || hasPassedDeadline) &&
    !isTransactionBusy;
  const statusBadgeClassName =
    status === 0
      ? "badge badge-accent"
      : status === 1
      ? "badge badge-success"
      : status === 2
      ? "badge badge-error"
      : status === 3
      ? "badge badge-warning"
      : "badge badge-outline";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTimestamp(Math.floor(Date.now() / 1000));
    }, 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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
        const hasIndexedOptimisticContribution = Boolean(
          optimisticContribution &&
            hasTransactionHash(nextContributions, optimisticContribution.transactionHash)
        );

        if (!ignore) {
          setContributions(
            mergeOptimisticContribution(nextContributions, optimisticContribution)
          );
          setContributionHistoryError("");

          if (hasIndexedOptimisticContribution) {
            setOptimisticContribution(null);
            setOptimisticContributionRefreshCount(0);
          }
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
  }, [campaignAddress, contributionHistoryVersion, optimisticContribution, t]);

  useEffect(() => {
    if (!optimisticContribution || optimisticContributionRefreshCount >= 6) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOptimisticContributionRefreshCount((current) => current + 1);
      setContributionHistoryVersion((current) => current + 1);
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [optimisticContribution, optimisticContributionRefreshCount]);

  useEffect(() => {
    let ignore = false;

    async function loadUserContribution() {
      if (
        !campaignAddress ||
        connection.status !== "connected" ||
        !connection.address
      ) {
        setHasUserContributed(false);
        setIsLoadingUserContribution(false);
        return;
      }

      setIsLoadingUserContribution(true);

      try {
        const nextHasUserContributed = await fetchUserHasContributed(
          campaignAddress,
          connection.address
        );

        if (!ignore) {
          setHasUserContributed(nextHasUserContributed);
        }
      } catch (error) {
        console.error("Error loading user contribution", campaignAddress, error);

        if (!ignore) {
          setHasUserContributed(false);
        }
      } finally {
        if (!ignore) {
          setIsLoadingUserContribution(false);
        }
      }
    }

    loadUserContribution();

    return () => {
      ignore = true;
    };
  }, [
    campaignAddress,
    connection.address,
    connection.status,
    contributionHistoryVersion,
  ]);

  useEffect(() => {
    let ignore = false;

    async function loadUserRefund() {
      if (
        !campaignAddress ||
        connection.status !== "connected" ||
        !connection.address
      ) {
        setHasUserRefunded(false);
        setIsLoadingRefundEvent(false);
        return;
      }

      setIsLoadingRefundEvent(true);

      try {
        const nextHasUserRefunded = await fetchUserHasRefunded(
          campaignAddress,
          connection.address
        );

        if (!ignore) {
          setHasUserRefunded(nextHasUserRefunded);
        }
      } catch (error) {
        console.error("Error loading user refund", campaignAddress, error);

        if (!ignore) {
          setHasUserRefunded(false);
        }
      } finally {
        if (!ignore) {
          setIsLoadingRefundEvent(false);
        }
      }
    }

    loadUserRefund();

    return () => {
      ignore = true;
    };
  }, [
    campaignAddress,
    connection.address,
    connection.status,
    contributionHistoryVersion,
  ]);

  useEffect(() => {
    let ignore = false;

    async function loadUserWithdrawal() {
      if (
        !campaignAddress ||
        connection.status !== "connected" ||
        !connection.address
      ) {
        setHasOwnerWithdrawn(false);
        setIsLoadingWithdrawalEvent(false);
        return;
      }

      setIsLoadingWithdrawalEvent(true);

      try {
        const nextHasOwnerWithdrawn = await fetchUserHasWithdrawn(
          campaignAddress,
          connection.address
        );

        if (!ignore) {
          setHasOwnerWithdrawn(nextHasOwnerWithdrawn);
        }
      } catch (error) {
        console.error("Error loading user withdrawal", campaignAddress, error);

        if (!ignore) {
          setHasOwnerWithdrawn(false);
        }
      } finally {
        if (!ignore) {
          setIsLoadingWithdrawalEvent(false);
        }
      }
    }

    loadUserWithdrawal();

    return () => {
      ignore = true;
    };
  }, [
    campaignAddress,
    connection.address,
    connection.status,
    contributionHistoryVersion,
  ]);

  useEffect(() => {
    if (!receipt.isSuccess || !pendingTransaction) return;

    if (pendingTransaction.action === "donate") {
      setDonationStatus("success");
      setDonationEth("");
      if (pendingTransaction.donation) {
        const nextOptimisticContribution = {
          user: pendingTransaction.donation.user,
          amount: pendingTransaction.donation.amount,
          timestamp: Math.floor(Date.now() / 1000),
          transactionHash: pendingTransaction.hash,
        };

        setOptimisticContribution(nextOptimisticContribution);
        setOptimisticContributionRefreshCount(0);
        setContributions((currentContributions) =>
          mergeOptimisticContribution(
            currentContributions,
            nextOptimisticContribution
          )
        );
      }
      setContributionHistoryVersion((current) => current + 1);
    } else if (pendingTransaction.action === "refund") {
      setRefundStatus("success");
      setHasUserRefunded(true);
      setShowRefundAlreadyCompleted(false);
      setContributionHistoryVersion((current) => current + 1);
      refetchUserContributionAmount();
    } else if (pendingTransaction.action === "withdraw") {
      setOwnerActionStatus("success");
      setHasOwnerWithdrawn(true);
      setShowWithdrawAlreadyCompleted(false);
      refetchFundsWithdrawn();
    } else {
      setOwnerActionStatus("success");
    }

    refetchTotalRaised();
    refetchStatus();
    setPendingTransaction(null);
  }, [
    pendingTransaction,
    receipt.isSuccess,
    refetchFundsWithdrawn,
    refetchStatus,
    refetchTotalRaised,
    refetchUserContributionAmount,
  ]);

  useEffect(() => {
    if (!receipt.isError || !pendingTransaction) return;

    if (pendingTransaction.action === "donate") {
      setDonationStatus("error");
    } else if (pendingTransaction.action === "refund") {
      setRefundStatus("error");
    } else {
      setOwnerActionStatus("error");
    }

    setPendingTransaction(null);
  }, [pendingTransaction, receipt.isError]);

  useEffect(() => {
    setRefundStatus("inactive");
    setShowRefundAlreadyCompleted(false);
    setShowWithdrawAlreadyCompleted(false);
  }, [campaignAddress, connection.address]);

  useEffect(() => {
    setOptimisticContribution(null);
    setOptimisticContributionRefreshCount(0);
  }, [campaignAddress]);

  async function handleDonate() {
    if (
      !campaignAddress ||
      donationAmount === null ||
      connection.status !== "connected" ||
      !connection.address ||
      !isActive ||
      isTransactionBusy
    ) {
      setDonationStatus("error");
      return;
    }

    const donorAddress = connection.address;

    try {
      setDonationStatus("waitingTransaction");

      if (connection.chain?.id !== sepolia.id) {
        await switchChain.mutateAsync({ chainId: sepolia.id });
      }

      const transactionHash = await writeContract.mutateAsync({
        address: campaignAddress,
        abi: campaignAbi,
        chainId: sepolia.id,
        functionName: "fund",
        value: donationAmount,
      });

      setPendingTransaction({
        action: "donate",
        hash: transactionHash,
        donation: {
          amount: donationAmount,
          user: donorAddress,
        },
      });
    } catch (error) {
      console.error(error);
      setPendingTransaction(null);
      setDonationStatus("error");
    }
  }

  async function handleWithdraw() {
    if (!campaignAddress || !connection.address || !canWithdraw) return;

    if (hasCompletedWithdraw) {
      setOwnerActionStatus("inactive");
      setShowWithdrawAlreadyCompleted(true);
      return;
    }

    try {
      const latestHasOwnerWithdrawn = await fetchUserHasWithdrawn(
        campaignAddress,
        connection.address
      );

      if (latestHasOwnerWithdrawn) {
        setHasOwnerWithdrawn(true);
        setOwnerActionStatus("inactive");
        setShowWithdrawAlreadyCompleted(true);
        return;
      }

      setShowWithdrawAlreadyCompleted(false);
      setOwnerActionStatus("waitingTransaction");

      if (connection.chain?.id !== sepolia.id) {
        await switchChain.mutateAsync({ chainId: sepolia.id });
      }

      const transactionHash = await writeContract.mutateAsync({
        address: campaignAddress,
        abi: campaignAbi,
        chainId: sepolia.id,
        functionName: "withdraw",
      });

      setPendingTransaction({
        action: "withdraw",
        hash: transactionHash,
      });
    } catch (error) {
      console.error(error);
      setPendingTransaction(null);
      setOwnerActionStatus("error");
    }
  }

  async function handleFinishCampaign() {
    if (!campaignAddress || !canFinishCampaign) return;

    try {
      setOwnerActionStatus("waitingTransaction");

      if (connection.chain?.id !== sepolia.id) {
        await switchChain.mutateAsync({ chainId: sepolia.id });
      }

      const transactionHash = await writeContract.mutateAsync({
        address: campaignAddress,
        abi: campaignAbi,
        chainId: sepolia.id,
        functionName: "finishCampaign",
      });

      setPendingTransaction({
        action: "finish",
        hash: transactionHash,
      });
    } catch (error) {
      console.error(error);
      setPendingTransaction(null);
      setOwnerActionStatus("error");
    }
  }

  async function handleCancelCampaign() {
    if (!campaignAddress || !isOwner || !isActive || isTransactionBusy) return;

    try {
      setOwnerActionStatus("waitingTransaction");

      const transactionHash = await writeContract.mutateAsync({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: "cancelCampaign",
      });

      setPendingTransaction({
        action: "cancel",
        hash: transactionHash,
      });
    } catch (error) {
      console.error(error);
      setPendingTransaction(null);
      setOwnerActionStatus("error");
    }
  }

  async function handleRefund() {
    if (
      !campaignAddress ||
      connection.status !== "connected" ||
      !connection.address ||
      !isRefundAvailable ||
      (!hasRefundableContribution && !hasCompletedRefund) ||
      isLoadingUserContribution ||
      isLoadingRefundEvent ||
      isTransactionBusy
    ) {
      setRefundStatus("error");
      return;
    }

    if (hasCompletedRefund) {
      setRefundStatus("inactive");
      setShowRefundAlreadyCompleted(true);
      return;
    }

    try {
      const latestHasUserRefunded = await fetchUserHasRefunded(
        campaignAddress,
        connection.address
      );

      if (latestHasUserRefunded) {
        setHasUserRefunded(true);
        setRefundStatus("inactive");
        setShowRefundAlreadyCompleted(true);
        return;
      }

      setShowRefundAlreadyCompleted(false);
      setRefundStatus("waitingTransaction");

      if (connection.chain?.id !== sepolia.id) {
        await switchChain.mutateAsync({ chainId: sepolia.id });
      }

      const transactionHash = await writeContract.mutateAsync({
        address: campaignAddress,
        abi: campaignAbi,
        chainId: sepolia.id,
        functionName: "refund",
      });

      setPendingTransaction({
        action: "refund",
        hash: transactionHash,
      });
    } catch (error) {
      console.error(error);
      setPendingTransaction(null);
      setRefundStatus("error");
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
        <div className="flex items-center justify-center">
          <span className="loading loading-spinner text-success h-32 w-32"></span>
        </div>
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
        <div className="contents lg:block lg:space-y-6">
          <figure className="order-1 flex min-h-64 items-center justify-center overflow-hidden rounded-box bg-base-300 lg:order-none">
            {image ? (
              <img
                className="h-full w-full object-cover"
                src={ipfsToHttp(image)}
                alt={title}
              />
            ) : (
              <span className="text-base-content/50 text-sm">
                {t("common.noImage")}
              </span>
            )}
          </figure>

          <section className="order-3 card bg-base-100 shadow-xl lg:order-none">
            <div className="card-body">
              <h2 className="card-title">
                {t("campaignDetails.contributionHistory.title")}
              </h2>

              {isLoadingContributions && (
                <div className="flex items-center justify-center">
                  <span className="loading loading-spinner text-success h-32 w-32"></span>
                </div>
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
                          <a
                            className="link link-hover block font-mono"
                            href={getSepoliaAddressUrl(contribution.user)}
                            title={contribution.user}
                            target="_blank"
                          >
                            {truncateHex(contribution.user)}
                          </a>
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
                          <a
                            className="link link-hover block font-mono"
                            href={getSepoliaTransactionUrl(contribution.transactionHash)}
                            title={contribution.transactionHash}
                            target="_blank"
                          >
                            {truncateHex(contribution.transactionHash)}
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
            </div>
          </section>
        </div>

        <div className="order-2 card bg-base-100 shadow-xl lg:order-none lg:self-start">
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
                className="progress progress-success w-full"
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
                  {deadlineRemainingText && (
                    <span className="mt-1 block text-sm text-base-content/70">
                      {deadlineRemainingText}
                    </span>
                  )}
                </dd>
              </div>
              <div className="rounded-box bg-base-200 p-4">
                <dt className="text-sm text-base-content/70">{t("campaignDetails.owner")}</dt>
                <dd className="break-all font-mono">
                  {owner ? (
                    <a
                      className="link link-hover"
                      href={getSepoliaAddressUrl(owner)}
                    >
                      {owner}
                    </a>
                  ) : (
                    t("campaignDetails.notAvailable")
                  )}
                </dd>
              </div>
              <div className="rounded-box bg-base-200 p-4">
                <dt className="text-sm text-base-content/70">{t("campaignDetails.contract")}</dt>
                <dd className="break-all font-mono">
                  <a
                    className="link link-hover"
                    href={getSepoliaAddressUrl(campaignAddress)}
                  >
                    {campaignAddress}
                  </a>
                </dd>
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
                    inputMode="decimal"
                    aria-invalid={donationEth.trim() ? donationAmount === null : undefined}
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
                    className="btn btn-accent w-full sm:w-auto"
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

            {isRefundAvailable && (hasUserContributed || hasCompletedRefund) && (
              <div className="space-y-4 rounded-box bg-base-200 p-4">
                <h2 className="text-xl font-bold">
                  {t("campaignDetails.refundOptions")}
                </h2>
                <button
                  className="btn btn-warning w-full sm:w-auto"
                  disabled={!canRefund}
                  onClick={handleRefund}
                  type="button"
                >
                  {refundButtonText}
                </button>
                {shouldShowRefundGracePeriodHint && (
                  <p className="text-sm text-base-content/70">
                    {t("campaignDetails.refundGracePeriodHint")}
                  </p>
                )}
                {connection.status !== "connected" && (
                  <p className="text-sm text-warning">
                    {t("campaignDetails.connectWalletToRefund")}
                  </p>
                )}
                {showRefundAlreadyCompleted && (
                  <p className="alert alert-info">
                    {t("campaignDetails.refundAlreadyCompleted")}
                  </p>
                )}
                {refundStatus === "success" && (
                  <p className="alert alert-success">
                    {t("campaignDetails.refundSuccess")}
                  </p>
                )}
                {refundStatus === "error" && (
                  <p className="alert alert-error">
                    {t("campaignDetails.refundError")}
                  </p>
                )}
              </div>
            )}

            {isOwner && (
              <div className="space-y-4 rounded-box bg-base-200 p-4">
                <h2 className="text-xl font-bold">
                  {t("campaignDetails.ownerOptions")}
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="btn btn-success"
                    disabled={!canWithdraw}
                    onClick={handleWithdraw}
                    type="button"
                  >
                    {t("campaignDetails.withdraw")}
                  </button>
                  <button
                    className="btn btn-outline"
                    disabled={!canFinishCampaign}
                    onClick={handleFinishCampaign}
                    type="button"
                  >
                    {t("campaignDetails.finishCampaign")}
                  </button>
                  <button
                    className="btn btn-error btn-outline"
                    disabled={isTransactionBusy || !isActive}
                    onClick={handleCancelCampaign}
                    type="button"
                  >
                    {t("campaignDetails.cancelCampaign")}
                  </button>
                </div>
                {ownerActionStatus === "waitingTransaction" && (
                  <p className="alert alert-info">
                    {t("campaignDetails.waitingTransaction")}
                  </p>
                )}
                {showWithdrawAlreadyCompleted && (
                  <p className="alert alert-info">
                    {t("campaignDetails.withdrawAlreadyCompleted")}
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
