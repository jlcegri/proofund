import {
    useReadContract,
    usePublicClient
} from "wagmi";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
    image?: string;
    metadataURI?: string;
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

function ExploreCampaigns() {
    const publicClient = usePublicClient();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoadingCampaignMetadata, setIsLoadingCampaignMetadata] = useState(false);
    const [campaignMetadataError, setCampaignMetadataError] = useState("");


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
                            image: getMetadataImage(metadata),
                            metadataURI: campaignMetadataURI
                        };
                    } catch (error) {
                        console.error("Error cargando metadatos", campaignAddress, error);

                        return {
                            address: campaignAddress,
                            title: `Campaña ${campaignAddress}`,
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


    return (
        <div className="app">
            <div className="app-content">

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

                <div className="campaign-grid">
                    {campaigns.map((campaign) => (
                        <Link
                            className="panel campaign-card"
                            key={campaign.address}
                            to={`/campaign/${campaign.address}`}
                        >
                            {campaign.image && (
                                <img
                                    className="campaign-card__image"
                                    src={ipfsToHttp(campaign.image)}
                                    alt={campaign.title}
                                />
                            )}
                            <h3 className="campaign-card__title">{campaign.title}</h3>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );

}

export default ExploreCampaigns;
