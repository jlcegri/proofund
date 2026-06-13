import { BigInt } from "@graphprotocol/graph-ts";

import {
  Funded,
  Withdrawn,
  Refunded,
  CampaignFinished
} from "../generated/templates/Campaign/Campaign";

import {
  Campaign,
  Contribution,
  Withdrawal,
  Refund
} from "../generated/schema";

function statusToString(status: i32): string {
  if (status == 0) {
    return "ACTIVE";
  }

  if (status == 1) {
    return "SUCCESS";
  }

  if (status == 2) {
    return "FAILED";
  }

  if (status == 3) {
    return "CANCELLED";
  }

  return "UNKNOWN";
}

export function handleFunded(event: Funded): void {
  let campaign = Campaign.load(event.address);

  if (campaign == null) {
    return;
  }

  campaign.totalRaised = campaign.totalRaised.plus(event.params.amount);
  campaign.save();

  let contributionId = event.transaction.hash.concatI32(event.logIndex.toI32());

  let contribution = new Contribution(contributionId);
  contribution.campaign = event.address;
  contribution.user = event.params.user;
  contribution.amount = event.params.amount;
  contribution.timestamp = event.block.timestamp;
  contribution.blockNumber = event.block.number;
  contribution.transactionHash = event.transaction.hash;

  contribution.save();
}

export function handleWithdrawn(event: Withdrawn): void {
  let campaign = Campaign.load(event.address);

  if (campaign == null) {
    return;
  }

  campaign.totalWithdrawn = campaign.totalWithdrawn.plus(event.params.amount);
  campaign.save();

  let withdrawalId = event.transaction.hash.concatI32(event.logIndex.toI32());

  let withdrawal = new Withdrawal(withdrawalId);
  withdrawal.campaign = event.address;
  withdrawal.user = event.params.user;
  withdrawal.amount = event.params.amount;
  withdrawal.timestamp = event.block.timestamp;
  withdrawal.blockNumber = event.block.number;
  withdrawal.transactionHash = event.transaction.hash;

  withdrawal.save();
}

export function handleRefunded(event: Refunded): void {
  let campaign = Campaign.load(event.address);

  if (campaign == null) {
    return;
  }

  campaign.totalRefunded = campaign.totalRefunded.plus(event.params.amount);
  campaign.save();

  let refundId = event.transaction.hash.concatI32(event.logIndex.toI32());

  let refund = new Refund(refundId);
  refund.campaign = event.address;
  refund.user = event.params.user;
  refund.amount = event.params.amount;
  refund.timestamp = event.block.timestamp;
  refund.blockNumber = event.block.number;
  refund.transactionHash = event.transaction.hash;

  refund.save();
}

export function handleCampaignFinished(event: CampaignFinished): void {
  let campaign = Campaign.load(event.address);

  if (campaign == null) {
    return;
  }

  campaign.status = statusToString(event.params.status);
  campaign.save();
}