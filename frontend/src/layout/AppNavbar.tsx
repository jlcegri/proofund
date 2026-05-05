import { useConnect, useDisconnect, useConnection, useConnectors } from "wagmi";
import "./styles.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Avatar from "boring-avatars";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLanguageFromPathname,
  replaceLanguageInPathname,
} from "../i18n/language";

function AppNavbar() {

  const { t, i18n } = useTranslation();
  const connect = useConnect();
  const connection = useConnection();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const connector = connectors[0];

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentLanguage = getLanguageFromPathname(location.pathname);

  function toggleProfileMenu() {
    setIsProfileMenuOpen((current) => !current);
  }

  function toggleLanguage() {
    const newLanguage = currentLanguage === "es" ? "en" : "es";
    const newPathname = replaceLanguageInPathname(location.pathname, newLanguage);

    i18n.changeLanguage(newLanguage);
    navigate(newPathname);
    setIsProfileMenuOpen(false);
  }

  return (
    <header className="app-navbar">
      <div className="app-navbar-brand">
        <Link to={`/${currentLanguage}`} className="navbar-brand-link">
          {t("navbar.brand")}
        </Link>
      </div>

      <nav className="app-navbar-links" aria-label={t("navbar.navigation")}>
        <Link className="navbar-link" to={`/${currentLanguage}/explore`}>
          {t("navbar.explore")}
        </Link>
        <Link className="navbar-link" to={`/${currentLanguage}/campaign/create`}>
          {t("navbar.createCampaign")}
        </Link>
      </nav>

      <div className="profile-menu-container"
            tabIndex={0}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsProfileMenuOpen(false);
              }
      }}>
        {connection.status === "connected" && (
          <>
            <Avatar
              name={connection.address ?? ""}
              size={42}
              variant="beam"
              onClick={toggleProfileMenu}
            />
            {isProfileMenuOpen && (
              <div className="profile-dropdown">
                <button
                  type="button"
                  onClick={() => navigate(`/${currentLanguage}/profile`)}
                >
                  {t("navbar.myProfile")}
                </button>
                <button type="button" onClick={toggleLanguage}>
                  {t("navbar.currentLanguage", {
                    language: currentLanguage.toUpperCase(),
                  })}
                </button>
                <button
                  className="wallet-button"
                  type="button"
                  onClick={() => disconnect.mutate()}
                >
                  {t("navbar.disconnect")}
                </button>
              </div>
            )}
          </>
        )}
        {connection.status === "disconnected" && (
          <button
            className="wallet-button"
            onClick={() => connect.mutate({ connector })}
          >
            {t("navbar.connectWallet")}
          </button>
        )}
        {connection.status === "connecting" && (
          <button className="wallet-button">
            {t("navbar.connecting")}
          </button>
        )}
      </div>
    </header>
  );
}

export default AppNavbar;
