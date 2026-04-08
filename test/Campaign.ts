import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, parseEther } from "viem";

describe("Campaign", async function () {
  const { viem } = await network.connect();
  const [funderWalletClient, ownerWalletClient] = await viem.getWalletClients();

  it("It should emit the Funded event when calling the fund() function, emit the CampaignFinished event when calling the finishCampaign() function, and emit the Withdrawn event when calling the withdraw() function", 
    async function () {
    const campaign = await viem.deployContract("Campaign", [ownerWalletClient.account.address, parseEther("1"), 1782777602n]);

    await viem.assertions.emitWithArgs(
        campaign.write.fund({account: funderWalletClient.account.address, value: parseEther("1")}),
        campaign,
        "Funded",
        [getAddress(funderWalletClient.account.address), parseEther("1")],
    );

    await viem.assertions.emitWithArgs(
        campaign.write.finishCampaign({account: ownerWalletClient.account.address}),
        campaign,
        "CampaignFinished",
        [1],
    );

    await viem.assertions.emitWithArgs(
        campaign.write.withdraw({account: ownerWalletClient.account.address}),
        campaign,
        "Withdrawn",
        [getAddress(ownerWalletClient.account.address), parseEther("1")],
    );
  });


});
