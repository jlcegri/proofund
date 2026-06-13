import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useConnection } from "wagmi";
import { formatEther } from "viem";
import { gql, request } from 'graphql-request';

const query = gql`
  query ProfileStatistics($user: Bytes!, $first: Int!) {
    campaigns(first: $first, where: { owner: $user }) {
      totalRaised
    }
    contributions(first: $first, where: { user: $user }) {
      amount
      campaign {
        id
      }
    }
  }
`;

const url = "https://api.studio.thegraph.com/query/1749481/subgraph-proofund-sepolia/version/latest";
const token = "7da61121a8d740ce7f7d93168a0aab4a";
const headers = { Authorization: `Bearer ${token}` }; 
const statsLimit = 1000;

type ProfileStatistics = {
  campaignsCreated: number;
  contributionsMade: number;
  totalContributed: bigint;
  distinctCampaignsFunded: number;
  totalRaisedByCampaigns: bigint;
};

type ProfileStatisticsResponse = {
  campaigns: Array<{
    totalRaised: string;
  }>;
  contributions: Array<{
    amount: string;
    campaign: {
      id: string;
    };
  }>;
};

function parseSubgraphBigInt(value: string) {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function formatEthAmount(value: bigint) {
  const formatted = formatEther(value);
  const [whole, fraction] = formatted.split(".");

  if (!fraction) return formatted;

  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, "");

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function getProfileStatistics(data: ProfileStatisticsResponse): ProfileStatistics {
  const fundedCampaigns = new Set<string>();

  const totalContributed = data.contributions.reduce((total, contribution) => {
    fundedCampaigns.add(contribution.campaign.id);
    return total + parseSubgraphBigInt(contribution.amount);
  }, 0n);

  const totalRaisedByCampaigns = data.campaigns.reduce((total, campaign) => {
    return total + parseSubgraphBigInt(campaign.totalRaised);
  }, 0n);

  return {
    campaignsCreated: data.campaigns.length,
    contributionsMade: data.contributions.length,
    totalContributed,
    distinctCampaignsFunded: fundedCampaigns.size,
    totalRaisedByCampaigns,
  };
}

async function fetchSubgraphData(user: string) {
  const variables = {
    user: user.toLowerCase(),
    first: statsLimit,
  };

  const data = (await request(url, query, variables, headers)) as ProfileStatisticsResponse;

  return getProfileStatistics(data);
}

function Profile() {
  const { t } = useTranslation();
  const connection = useConnection();
  const [statistics, setStatistics] = useState<ProfileStatistics | null>(null);
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const [statisticsError, setStatisticsError] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadStatistics() {
      if (connection.status !== "connected" || !connection.address) {
        setStatistics(null);
        setStatisticsError(false);
        setIsLoadingStatistics(false);
        return;
      }

      setIsLoadingStatistics(true);
      setStatisticsError(false);

      try {
        const nextStatistics = await fetchSubgraphData(connection.address);

        if (!ignore) {
          setStatistics(nextStatistics);
        }
      } catch (error) {
        console.error(error);

        if (!ignore) {
          setStatistics(null);
          setStatisticsError(true);
        }
      } finally {
        if (!ignore) {
          setIsLoadingStatistics(false);
        }
      }
    }

    loadStatistics();

    return () => {
      ignore = true;
    };
  }, [connection.address, connection.status]);

  const hasStatistics =
    statistics !== null &&
    (statistics.campaignsCreated > 0 ||
      statistics.contributionsMade > 0 ||
      statistics.totalContributed > 0n ||
      statistics.distinctCampaignsFunded > 0 ||
      statistics.totalRaisedByCampaigns > 0n);

  return (
    <div className="space-y-6">
      <section className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-3xl">{t("profile.title")}</h1>
        </div>
      </section>
      {connection.status === "connected" && (
        <>
          <section className="card bg-base-100 shadow-xl">
            <div className="card-body gap-2">
              <p>
                <strong>{t("profile.connected")}:</strong>{" "}
                {t("profile.yes")}
              </p>
              <p className="break-all">
                <strong>{t("profile.address")}:</strong> {connection.address}
              </p>
              <p>
                <strong>{t("profile.testnet")}:</strong>{" "}
                {connection.chain?.name}
              </p>
              <p>
                <strong>{t("profile.wallet")}:</strong>{" "}
                {connection.connector.name}
              </p>
            </div>
          </section>
          <section className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">{t("profile.statistics.title")}</h2>

              {isLoadingStatistics && (
                <p className="alert alert-info">{t("profile.statistics.loading")}</p>
              )}

              {statisticsError && (
                <p className="alert alert-error">
                  {t("profile.statistics.error")}
                </p>
              )}

              {!isLoadingStatistics && !statisticsError && !hasStatistics && (
                <p className="alert alert-info">{t("profile.statistics.empty")}</p>
              )}

              {!isLoadingStatistics && !statisticsError && statistics && hasStatistics && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-box bg-base-200 p-4">
                    <span className="text-sm text-base-content/70">{t("profile.statistics.campaignsCreated")}</span>
                    <strong className="block text-2xl">{statistics.campaignsCreated}</strong>
                  </div>
                  <div className="rounded-box bg-base-200 p-4">
                    <span className="text-sm text-base-content/70">{t("profile.statistics.contributionsMade")}</span>
                    <strong className="block text-2xl">{statistics.contributionsMade}</strong>
                  </div>
                  <div className="rounded-box bg-base-200 p-4">
                    <span className="text-sm text-base-content/70">{t("profile.statistics.totalContributed")}</span>
                    <strong className="block text-2xl">{formatEthAmount(statistics.totalContributed)} ETH</strong>
                  </div>
                  <div className="rounded-box bg-base-200 p-4">
                    <span className="text-sm text-base-content/70">{t("profile.statistics.distinctCampaignsFunded")}</span>
                    <strong className="block text-2xl">{statistics.distinctCampaignsFunded}</strong>
                  </div>
                  <div className="rounded-box bg-base-200 p-4">
                    <span className="text-sm text-base-content/70">{t("profile.statistics.totalRaisedByCampaigns")}</span>
                    <strong className="block text-2xl">{formatEthAmount(statistics.totalRaisedByCampaigns)} ETH</strong>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Profile;
