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


  // 1. ---------------- Should allow a funded campaign to be finished successfully and withdrawn by the owner ----------------

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



  // 2. Should allow an underfunded campaign to be finished as failed after the deadline and allow refunds to the funder

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



// ------------------------ 3. A canceled campaign should allow refunds to the funder ------------------------

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

  // 4. If the campaign ran out of time and the owner has not finished it in 7 days, should allow refunds to the funder

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


  // -------------- 5. Owner should withdraw the full import from a campaign funded by various users --------------
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


  // ------------- 6. Multiple funders should be allowed to refund a failed campaign -------------
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

});
