import { Navigate, Routes, Route } from "react-router-dom";
import Home from "../screens/Home";
import CreateCampaign from "../screens/CreateCampaign";
import ExploreCampaigns from "../screens/ExploreCampaigns";
import CampaignDetails from "../screens/CampaignDetails";
import Profile from "../screens/Profile";

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