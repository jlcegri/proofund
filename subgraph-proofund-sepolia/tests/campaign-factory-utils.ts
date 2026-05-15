import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import { CampaignCreated } from "../generated/CampaignFactory/CampaignFactory"

export function createCampaignCreatedEvent(
  owner: Address,
  campaign: Address,
  goalAmount: BigInt,
  deadline: BigInt,
  metadataURI: string
): CampaignCreated {
  let campaignCreatedEvent = changetype<CampaignCreated>(newMockEvent())

  campaignCreatedEvent.parameters = new Array()

  campaignCreatedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  campaignCreatedEvent.parameters.push(
    new ethereum.EventParam("campaign", ethereum.Value.fromAddress(campaign))
  )
  campaignCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "goalAmount",
      ethereum.Value.fromUnsignedBigInt(goalAmount)
    )
  )
  campaignCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "deadline",
      ethereum.Value.fromUnsignedBigInt(deadline)
    )
  )
  campaignCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "metadataURI",
      ethereum.Value.fromString(metadataURI)
    )
  )

  return campaignCreatedEvent
}
