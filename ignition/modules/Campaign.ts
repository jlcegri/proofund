import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { configVariable } from "hardhat/config";

export default buildModule("CampaignModule", (m) => {
  const goalAmount = 1000000000000000000n; // 1 ETH
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
  const initialOwner = m.getParameter("sepoliaPublicKey");

  const campaign = m.contract("Campaign", [initialOwner, goalAmount, deadline]);

  return { campaign };
});
