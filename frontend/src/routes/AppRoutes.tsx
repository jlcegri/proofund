import { Routes, Route } from "react-router-dom";
import Home from "../screens/home/Home";
import CreateCampaign from "../screens/create-campaign/CreateCampaign";
import ExploreCampaigns from "../screens/explore-campaigns/ExploreCampaigns";
import CampaignDetails from "../screens/campaign-details/CampaignDetails";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/campaigns/create" element={<CreateCampaign />} />
      <Route path="/campaigns/explore" element={<ExploreCampaigns />} />
      <Route path="/campaign/:address" element={<CampaignDetails />} />
    </Routes>
  );
}

export default AppRoutes;
