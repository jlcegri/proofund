import { Navigate, Routes, Route } from "react-router-dom";
import Home from "../screens/home/Home";
import CreateCampaign from "../screens/create-campaign/CreateCampaign";
import ExploreCampaigns from "../screens/explore-campaigns/ExploreCampaigns";
import CampaignDetails from "../screens/campaign-details/CampaignDetails";
import Profile from "../screens/profile/Profile";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/es" replace />} />

      <Route path="/es" element={<Home />} />
      <Route path="/en" element={<Home />} />

      <Route path="/es/explore" element={<ExploreCampaigns />} />
      <Route path="/en/explore" element={<ExploreCampaigns />} />

      <Route path="/es/campaign/create" element={<CreateCampaign />} />
      <Route path="/en/campaign/create" element={<CreateCampaign />} />

      <Route path="/es/campaign/:campaignAddress" element={<CampaignDetails />} />
      <Route path="/en/campaign/:campaignAddress" element={<CampaignDetails />} />

      <Route path="/es/profile" element={<Profile />} />
      <Route path="/en/profile" element={<Profile />} />

      <Route path="*" element={<Navigate to="/es" replace />} />
    </Routes>
  );
}

export default AppRoutes;