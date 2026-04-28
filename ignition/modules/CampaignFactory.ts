import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CampaignFactoryModule", (m) => {

  const campaignFactory = m.contract("CampaignFactory");

  return { campaignFactory };
});
