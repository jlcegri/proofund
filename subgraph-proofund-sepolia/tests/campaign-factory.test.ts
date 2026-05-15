import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { CampaignCreated } from "../generated/schema"
import { CampaignCreated as CampaignCreatedEvent } from "../generated/CampaignFactory/CampaignFactory"
import { handleCampaignCreated } from "../src/campaign-factory"
import { createCampaignCreatedEvent } from "./campaign-factory-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let owner = Address.fromString("0x0000000000000000000000000000000000000001")
    let campaign = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let goalAmount = BigInt.fromI32(234)
    let deadline = BigInt.fromI32(234)
    let metadataURI = "Example string value"
    let newCampaignCreatedEvent = createCampaignCreatedEvent(
      owner,
      campaign,
      goalAmount,
      deadline,
      metadataURI
    )
    handleCampaignCreated(newCampaignCreatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("CampaignCreated created and stored", () => {
    assert.entityCount("CampaignCreated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "CampaignCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "owner",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "CampaignCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "campaign",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "CampaignCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "goalAmount",
      "234"
    )
    assert.fieldEquals(
      "CampaignCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "deadline",
      "234"
    )
    assert.fieldEquals(
      "CampaignCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "metadataURI",
      "Example string value"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
