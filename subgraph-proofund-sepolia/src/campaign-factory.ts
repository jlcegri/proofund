import { BigInt } from "@graphprotocol/graph-ts";
import { CampaignCreated } from "../generated/CampaignFactory/CampaignFactory";
import { Campaign as CampaignTemplate } from "../generated/templates";
import { Campaign } from "../generated/schema";

export function handleCampaignCreated(event: CampaignCreated): void {
  let campaignAddress = event.params.campaign;

  let campaign = new Campaign(campaignAddress);

  campaign.address = campaignAddress;
  campaign.owner = event.params.owner;
  campaign.goalAmount = event.params.goalAmount;
  campaign.deadline = event.params.deadline;
  campaign.metadataURI = event.params.metadataURI;

  campaign.totalRaised = BigInt.zero();
  campaign.totalRefunded = BigInt.zero();
  campaign.totalWithdrawn = BigInt.zero();

  campaign.status = "ACTIVE";

  campaign.createdAt = event.block.timestamp;
  campaign.createdAtBlock = event.block.number;
  campaign.createdAtTx = event.transaction.hash;

  campaign.save();

  CampaignTemplate.create(campaignAddress);
}