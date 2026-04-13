import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { network } from "hardhat";
import { getAddress, parseEther } from "viem";

describe("Campaign", async function () {
  const { viem } = await network.connect();
  const [funderWalletClient, ownerWalletClient] = await viem.getWalletClients();

  it("Should allow a funded campaign to be finished successfully and withdrawn by the owner", async function () {
    const campaign = await viem.deployContract("Campaign", [
      ownerWalletClient.account.address,
      parseEther("1"),
      1782777602n,
    ]);

    const fundTx = campaign.write.fund({
      account: funderWalletClient.account.address,
      value: parseEther("1"),
    });

    await viem.assertions.emitWithArgs(
      fundTx,
      campaign,
      "Funded",
      [getAddress(funderWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.balancesHaveChanged(
      fundTx,
      [
        { address: campaign.address, amount: parseEther("1") },
        { address: funderWalletClient.account.address, amount: parseEther("-1") },
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

});
