import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { network } from "hardhat";
import { getAddress, parseEther } from "viem";

describe("Campaign", async function () {
  const { viem } = await network.connect();
  const [aliceWalletClient, bobWalletClient, ownerWalletClient] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const sevenDays = 7 * 24 * 60 * 60;
  const fourteenDays = 14 * 24 * 60 * 60;
  const metadata = "https://ipfs.io/proofund";

  async function getDeadline() {
    const block = await publicClient.getBlock();
    return block.timestamp + BigInt(sevenDays);
  }

  // ------------------------ createCampaign ------------------------

  it("Factory should attach the metadata URI to the created campaign", async function () {
    const factory = await viem.deployContract("CampaignFactory");
    const deadline = await getDeadline();

    await factory.write.createCampaign(
      [parseEther("1"), deadline, metadata],
      { account: ownerWalletClient.account.address },
    );

    const [campaignAddress] = await factory.read.getCampaigns();
    const campaign = await viem.getContractAt("Campaign", campaignAddress);

    assert.equal(await campaign.read.metadataURI(), metadata);
  });

  it("createCampaign should revert with InvalidDeadline if deadline is not in the future", async function () {
    const factory = await viem.deployContract("CampaignFactory");
    const refCampaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("1"),
      await getDeadline(),
      metadata,
    ]);

    const block = await publicClient.getBlock();
    const tx = factory.write.createCampaign(
      [parseEther("1"), block.timestamp, metadata],
      { account: ownerWalletClient.account.address },
    );

    await viem.assertions.revertWithCustomError(tx, refCampaign, "InvalidDeadline");
  });

  it("createCampaign should revert with InvalidGoalAmount if goal is zero", async function () {
    const factory = await viem.deployContract("CampaignFactory");
    const refCampaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("1"),
      await getDeadline(),
      metadata,
    ]);

    const tx = factory.write.createCampaign(
      [parseEther("0"), await getDeadline(), metadata],
      { account: ownerWalletClient.account.address },
    );

    await viem.assertions.revertWithCustomError(tx, refCampaign, "InvalidGoalAmount");
  });

  it("createCampaign should revert with NoMetadata if metadataURI is empty", async function () {
    const factory = await viem.deployContract("CampaignFactory");
    const refCampaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("1"),
      await getDeadline(),
      metadata,
    ]);

    const tx = factory.write.createCampaign(
      [parseEther("1"), await getDeadline(), ""],
      { account: ownerWalletClient.account.address },
    );

    await viem.assertions.revertWithCustomError(tx, refCampaign, "NoMetadata");
  });

  // ------------------------ fund() ------------------------

  it("Fund(0) should revert with error ZeroContribution()", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"), //10 ETH
      await getDeadline(),
      metadata
    ]);

    const aliceFundTx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("0"),
    });

    await viem.assertions.revertWithCustomError(
      aliceFundTx,
      campaign,
      "ZeroContribution"
    );
  });

  it("fund should revert with CampaignNotActive if campaign is cancelled", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"),
      await getDeadline(),
      metadata,
    ]);

    await campaign.write.cancelCampaign({
      account: ownerWalletClient.account.address,
    });

    const tx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "CampaignNotActive");
  });

  it("fund should revert with CampaignExpired if deadline has passed", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"),
      await getDeadline(),
      metadata,
    ]);

    await testClient.increaseTime({ seconds: sevenDays });
    await testClient.mine({ blocks: 1 });

    const tx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "CampaignExpired");
  });

  // ------------------------ finishCampaign() ------------------------

  it("Finishing the campaign before time without reaching the goal should revert with CampaignStillActive", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"), //10 ETH
      await getDeadline(),
      metadata
    ]);

    const finishCampaignTx = campaign.write.finishCampaign({
      account: ownerWalletClient.account.address
    });

    await viem.assertions.revertWithCustomError(
      finishCampaignTx,
      campaign,
      "CampaignStillActive"
    );
  });

  it("finishCampaign should revert with CampaignNotActive if campaign is not active", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("1"),
      await getDeadline(),
      metadata,
    ]);

    await campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await campaign.write.finishCampaign({
      account: ownerWalletClient.account.address,
    });

    const tx = campaign.write.finishCampaign({
      account: ownerWalletClient.account.address,
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "CampaignNotActive");
  });

  // ------------------------ withdraw() ------------------------

  it("Should allow a funded campaign to be finished successfully and withdrawn by the owner", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("1"),
      await getDeadline(),
      metadata
    ]);

    const fundTx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      fundTx,
      campaign,
      "Funded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      fundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: aliceWalletClient.account.address, amount: parseEther("-1") },
      ],
    );

    const finishCampaignTx = campaign.write.finishCampaign({
      account: ownerWalletClient.account.address,
    });

    await viem.assertions.emitWithArgs(
      finishCampaignTx,
      campaign,
      "CampaignFinished",
      [1],
    );

    // ACTIVE: 0, SUCCESS: 1, FAILED: 2, CANCELLED: 3
    const status = await campaign.read.status();
    assert.equal(status, 1);

    const withdrawTx = campaign.write.withdraw({
      account: ownerWalletClient.account.address,
    });

    await viem.assertions.emitWithArgs(
      withdrawTx,
      campaign,
      "Withdrawn",
      [getAddress(ownerWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      withdrawTx,
      [
        { address: campaign.address, amount: parseEther("-1") },
        { address: ownerWalletClient.account.address, amount: parseEther("1") },
      ],
    );
  });

  it("Owner should withdraw the full import from a campaign funded by various users", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("2"), //10 ETH
      await getDeadline(),
      metadata
    ]);

    const aliceFundTx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      aliceFundTx,
      campaign,
      "Funded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      aliceFundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: aliceWalletClient.account.address, amount: parseEther("-1") },
      ],
    );

    const bobFundTx = campaign.write.fund({
      account: bobWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      bobFundTx,
      campaign,
      "Funded",
      [getAddress(bobWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      bobFundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: bobWalletClient.account.address, amount: parseEther("-1") },
      ],
    );

    const finishCampaignTx = campaign.write.finishCampaign({
      account: ownerWalletClient.account.address
    });

    await viem.assertions.emitWithArgs(
      finishCampaignTx,
      campaign,
      "CampaignFinished",
      [1],
    );

    // ACTIVE: 0, SUCCESS: 1, FAILED: 2, CANCELLED: 3
    const status = await campaign.read.status();
    assert.equal(status, 1);

    const withdrawTx = campaign.write.withdraw({
      account: ownerWalletClient.account.address
    });

    await viem.assertions.emitWithArgs(
      withdrawTx,
      campaign,
      "Withdrawn",
      [getAddress(ownerWalletClient.account.address), parseEther("2")],
    );

    await viem.assertions.balancesHaveChanged(
      withdrawTx,
      [
        { address: campaign.address, amount: parseEther("-2") },
        { address: ownerWalletClient.account.address, amount: parseEther("2") },
      ],
    );
  });

  it("withdraw should revert with CampaignNotSuccessful if campaign has not succeeded", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"),
      await getDeadline(),
      metadata,
    ]);

    const tx = campaign.write.withdraw({
      account: ownerWalletClient.account.address,
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "CampaignNotSuccessful");
  });

  it("withdraw should revert with FundsAlreadyWithdrawn if funds were already withdrawn", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("1"),
      await getDeadline(),
      metadata,
    ]);

    await campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await campaign.write.finishCampaign({
      account: ownerWalletClient.account.address,
    });

    await campaign.write.withdraw({
      account: ownerWalletClient.account.address,
    });

    const tx = campaign.write.withdraw({
      account: ownerWalletClient.account.address,
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "FundsAlreadyWithdrawn");
  });

  // ------------------------ refund() ------------------------

  it("Should allow an underfunded campaign to be finished as failed after the deadline and allow refunds to the funder", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"), //10 ETH
      await getDeadline(),
      metadata
    ]);

    const fundTx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      fundTx,
      campaign,
      "Funded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      fundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: aliceWalletClient.account.address, amount: parseEther("-1") },
      ],
    );

    await testClient.increaseTime({ seconds: sevenDays });
    await testClient.mine({ blocks: 1 });

    const finishCampaignTx = campaign.write.finishCampaign({
      account: ownerWalletClient.account.address,
    });

    await viem.assertions.emitWithArgs(
      finishCampaignTx,
      campaign,
      "CampaignFinished",
      [2],
    );

    // ACTIVE: 0, SUCCESS: 1, FAILED: 2, CANCELLED: 3
    const status = await campaign.read.status();
    assert.equal(status, 2);

    const refundTx = campaign.write.refund({
      account: aliceWalletClient.account.address
    });

    await viem.assertions.emitWithArgs(
      refundTx,
      campaign,
      "Refunded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      refundTx,
      [
        { address: campaign.address, amount: parseEther("-1") },
        { address: aliceWalletClient.account.address, amount: parseEther("1") },
      ],
    );

  });

  it("A canceled campaign should allow refunds to the funder", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"), //10 ETH
      await getDeadline(),
      metadata
    ]);

    const fundTx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      fundTx,
      campaign,
      "Funded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      fundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: aliceWalletClient.account.address, amount: parseEther("-1") },
      ],
    );

    const cancelCampaignTx = campaign.write.cancelCampaign({
      account: ownerWalletClient.account.address,
    });

    await viem.assertions.emitWithArgs(
      cancelCampaignTx,
      campaign,
      "CampaignFinished",
      [3],
    );

    // ACTIVE: 0, SUCCESS: 1, FAILED: 2, CANCELLED: 3
    const status = await campaign.read.status();
    assert.equal(status, 3);

    const refundTx = campaign.write.refund({
      account: aliceWalletClient.account.address
    });

    await viem.assertions.emitWithArgs(
      refundTx,
      campaign,
      "Refunded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      refundTx,
      [
        { address: campaign.address, amount: parseEther("-1") },
        { address: aliceWalletClient.account.address, amount: parseEther("1") },
      ],
    );


  });

  it("If the campaign ran out of time and the owner has not finished it in 7 days, should allow refunds to the funder", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"), //10 ETH
      await getDeadline(),
      metadata
    ]);

    const fundTx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      fundTx,
      campaign,
      "Funded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      fundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: aliceWalletClient.account.address, amount: parseEther("-1") },
      ],
    );

    await testClient.increaseTime({ seconds: fourteenDays });
    await testClient.mine({ blocks: 1 });

    const refundTx = campaign.write.refund({
      account: aliceWalletClient.account.address
    });

    await viem.assertions.emitWithArgs(
      refundTx,
      campaign,
      "CampaignFinished",
      [3],
    );

    // ACTIVE: 0, SUCCESS: 1, FAILED: 2, CANCELLED: 3
    const status = await campaign.read.status();
    assert.equal(status, 3);

    await viem.assertions.emitWithArgs(
      refundTx,
      campaign,
      "Refunded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      refundTx,
      [
        { address: campaign.address, amount: parseEther("-1") },
        { address: aliceWalletClient.account.address, amount: parseEther("1") },
      ],
    );

  });

  it("Multiple funders should be allowed to refund a failed campaign", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"), //10 ETH
      await getDeadline(),
      metadata
    ]);

    const aliceFundTx = campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      aliceFundTx,
      campaign,
      "Funded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      aliceFundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: aliceWalletClient.account.address, amount: parseEther("-1") },
      ],
    );

    const bobFundTx = campaign.write.fund({
      account: bobWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      bobFundTx,
      campaign,
      "Funded",
      [getAddress(bobWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      bobFundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: bobWalletClient.account.address, amount: parseEther("-1") },
      ],
    );

    await testClient.increaseTime({ seconds: sevenDays });
    await testClient.mine({ blocks: 1 });

    const finishCampaignTx = campaign.write.finishCampaign({
      account: ownerWalletClient.account.address
    });

    await viem.assertions.emitWithArgs(
      finishCampaignTx,
      campaign,
      "CampaignFinished",
      [2],
    );

    // ACTIVE: 0, SUCCESS: 1, FAILED: 2, CANCELLED: 3
    const status = await campaign.read.status();
    assert.equal(status, 2);

    const aliceRefundTx = campaign.write.refund({
      account: aliceWalletClient.account.address
    });

    await viem.assertions.emitWithArgs(
      aliceRefundTx,
      campaign,
      "Refunded",
      [getAddress(aliceWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      aliceRefundTx,
      [
        { address: campaign.address, amount: parseEther("-1") },
        { address: aliceWalletClient.account.address, amount: parseEther("1") },
      ],
    );

    const bobRefundTx = campaign.write.refund({
      account: bobWalletClient.account.address
    });

    await viem.assertions.emitWithArgs(
      bobRefundTx,
      campaign,
      "Refunded",
      [getAddress(bobWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      bobRefundTx,
      [
        { address: campaign.address, amount: parseEther("-1") },
        { address: bobWalletClient.account.address, amount: parseEther("1") },
      ],
    );
  });

  it("refund should revert with NoContributionToRefund if caller has not contributed", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"),
      await getDeadline(),
      metadata,
    ]);

    await campaign.write.cancelCampaign({
      account: ownerWalletClient.account.address,
    });

    const tx = campaign.write.refund({
      account: aliceWalletClient.account.address,
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "NoContributionToRefund");
  });

  it("refund should revert with RefundNotAvailable if campaign succeeded", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("1"),
      await getDeadline(),
      metadata,
    ]);

    await campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    await campaign.write.finishCampaign({
      account: ownerWalletClient.account.address,
    });

    const tx = campaign.write.refund({
      account: aliceWalletClient.account.address,
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "RefundNotAvailable");
  });

  it("refund should revert with RefundNotAvailable if campaign is still active before deadline + 7 days", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"),
      await getDeadline(),
      metadata,
    ]);

    await campaign.write.fund({
      account: aliceWalletClient.account.address,
      value: parseEther("1"),
    });

    const tx = campaign.write.refund({
      account: aliceWalletClient.account.address,
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "RefundNotAvailable");
  });

  // ------------------------ cancelCampaign() ------------------------

  it("cancelCampaign should revert with CampaignNotActive if campaign is not active", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("10"),
      await getDeadline(),
      metadata,
    ]);

    await campaign.write.cancelCampaign({
      account: ownerWalletClient.account.address,
    });

    const tx = campaign.write.cancelCampaign({
      account: ownerWalletClient.account.address,
    });

    await viem.assertions.revertWithCustomError(tx, campaign, "CampaignNotActive");
  });

});
