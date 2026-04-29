import { Routes, Route } from "react-router-dom";
import Home from "../screens/home/Home";
import CreateCampaign from "../screens/create-campaign/CreateCampaign";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/campaigns/create" element={<CreateCampaign />} />
    </Routes>
  );
}

export default AppRoutes;