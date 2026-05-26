import {
    useReadContract,
    usePublicClient
} from "wagmi";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatEther } from "viem";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { campaignAbi } from "../contracts/abi/campaignAbi";
import { campaignFactoryAbi } from "../contracts/abi/campaignFactoryAbi";
import { campaignFactoryContractAddress } from "../contracts/address/campaignFactoryContractAddress";
import { getLanguageFromPathname } from "../i18n/language";

dayjs.extend(customParseFormat);

type Campaign = {
    address: `0x${string}`;
    title: string;
    image?: string;
    metadataURI?: string;
    goalAmount: bigint;
    totalRaised: bigint;
};

type CampaignMetadata = {
    title?: unknown;
    name?: unknown;
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

function formatEthAmount(value?: bigint) {
    const formatted = formatEther(value ?? 0n);
    const [whole, fraction] = formatted.split(".");

    if (!fraction) return formatted;

    const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, "");

    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function ExploreCampaigns() {
    const { t } = useTranslation();
    const location = useLocation();
    const publicClient = usePublicClient();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoadingCampaignMetadata, setIsLoadingCampaignMetadata] = useState(false);
    const [campaignMetadataError, setCampaignMetadataError] = useState("");
    const currentLanguage = getLanguageFromPathname(location.pathname);


    const campaignsQuery = useReadContract({
        address: campaignFactoryContractAddress,
        abi: campaignFactoryAbi,
        functionName: "getCampaigns",
    });

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
                    let goalAmount = 0n;
                    let totalRaised = 0n;

                    try {
                        campaignMetadataURI = await publicClient.readContract({
                            address: campaignAddress,
                            abi: campaignAbi,
                            functionName: "metadataURI"
                        }) as string;

                        const [campaignGoalAmount, campaignTotalRaised] = await Promise.all([
                            publicClient.readContract({
                                address: campaignAddress,
                                abi: campaignAbi,
                                functionName: "goalAmount"
                            }),
                            publicClient.readContract({
                                address: campaignAddress,
                                abi: campaignAbi,
                                functionName: "totalRaised"
                            })
                        ]);

                        goalAmount = campaignGoalAmount as bigint;
                        totalRaised = campaignTotalRaised as bigint;

                        const response = await fetch(ipfsToHttp(campaignMetadataURI));

                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}`);
                        }

                        const metadata = await response.json() as CampaignMetadata;

                        return {
                            address: campaignAddress,
                            title: getString(metadata.title),
                            image: getMetadataImage(metadata),
                            metadataURI: campaignMetadataURI,
                            goalAmount,
                            totalRaised
                        };
                    } catch (error) {
                        console.error("Error cargando metadatos", campaignAddress, error);

                        return {
                            address: campaignAddress,
                            title: t("exploreCampaigns.campaignFallback", {
                                address: campaignAddress,
                            }),
                            metadataURI: campaignMetadataURI,
                            goalAmount,
                            totalRaised
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
                setCampaignMetadataError(t("exploreCampaigns.metadataLoadError"));
                setIsLoadingCampaignMetadata(false);
            }
        });

        return () => {
            ignore = true;
        };
    }, [publicClient, campaignsQuery.data, t]);


    return (
        <div className="space-y-6">
            {(campaignsQuery.isPending || isLoadingCampaignMetadata) && (
                <div className="flex min-h-[60vh] items-center justify-center">
                    <span className="loading loading-spinner text-success h-32 w-32"></span>
                </div>
            )}
            {campaignMetadataError && (
                <p className="alert alert-error">
                    {t("common.errorWithMessage", {
                        message: campaignMetadataError,
                    })}
                </p>
            )}
            {campaignsQuery.error && (
                <p className="alert alert-error">
                    {t("common.errorWithMessage", {
                        message: campaignsQuery.error.message,
                    })}
                </p>
            )}
            {!campaignsQuery.isPending &&
                !isLoadingCampaignMetadata &&
                campaigns.length === 0 && (
                    <p className="alert alert-info">{t("exploreCampaigns.empty")}</p>
                )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((campaign) => {
                    const progressPercent = campaign.goalAmount === 0n
                        ? 0
                        : Number((campaign.totalRaised * 10000n) / campaign.goalAmount) / 100;
                    const progressBarPercent = Math.min(progressPercent, 100);

                    return (
                        <Link
                            className="card bg-base-100 shadow-xl transition-shadow hover:shadow-2xl"
                            key={campaign.address}
                            to={`/${currentLanguage}/campaign/${campaign.address}`}
                        >
                            {campaign.image && (
                                <figure className="h-48 bg-base-200">
                                    <img
                                        className="h-full w-full object-cover"
                                        src={ipfsToHttp(campaign.image)}
                                        alt={campaign.title}
                                    />
                                </figure>
                            )}
                            <div className="card-body">
                                <h3 className="card-title">{campaign.title}</h3>
                                <div className="space-y-2">
                                    <progress
                                        className="progress progress-success w-full"
                                        value={progressBarPercent}
                                        max={100}
                                    />
                                    <p className="text-sm text-base-content/70">
                                        {formatEthAmount(campaign.totalRaised)} {t("exploreCampaigns.ethRaised")}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );

}

export default ExploreCampaigns;
