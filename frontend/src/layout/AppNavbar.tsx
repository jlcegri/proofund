import {
  useConnect,
  useDisconnect,
  useConnection,
  useConnectors,
  type Connector,
} from "wagmi";
import "./styles.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Avatar from "boring-avatars";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLanguageFromPathname,
  replaceLanguageInPathname,
} from "../i18n/language";
import coinbaseLogo from "../assets/wallets/coinbase.png";
import metamaskLogo from "../assets/wallets/metamask.svg";

const walletOptions = [
  {
    connectorId: "metaMaskSDK",
    labelKey: "navbar.wallets.metaMask",
    logoSrc: metamaskLogo,
  },
  {
    connectorId: "coinbaseWalletSDK",
    labelKey: "navbar.wallets.coinbase",
    logoSrc: coinbaseLogo,
  },
];

function AppNavbar() {

  const { t, i18n } = useTranslation();
  const connect = useConnect();
  const connection = useConnection();
  const disconnect = useDisconnect();
  const connectors = useConnectors();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentLanguage = getLanguageFromPathname(location.pathname);

  const isConnectingWallet =
    connect.isPending || connection.status === "connecting";

  useEffect(() => {
    if (!isWalletModalOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsWalletModalOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isWalletModalOpen]);

  function getConnector(connectorId: string) {
    return connectors.find(
      (currentConnector) => currentConnector.id === connectorId,
    );
  }

  function toggleProfileMenu() {
    setIsProfileMenuOpen((current) => !current);
  }

  function openWalletModal() {
    connect.reset();
    setIsProfileMenuOpen(false);
    setIsWalletModalOpen(true);
  }

  function handleWalletConnect(connector: Connector) {
    connect.mutate(
      { connector },
      {
        onSuccess: () => {
          setIsWalletModalOpen(false);
        },
      },
    );
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

      <div
        className="profile-menu-container"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsProfileMenuOpen(false);
          }
        }}
        tabIndex={0}
      >
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
            onClick={openWalletModal}
            type="button"
          >
            {t("navbar.connectWallet")}
          </button>
        )}
        {connection.status === "connecting" && (
          <button className="wallet-button" type="button">
            {t("navbar.connecting")}
          </button>
        )}
      </div>
      {isWalletModalOpen && (
        <div
          className="wallet-modal-backdrop"
          onMouseDown={() => setIsWalletModalOpen(false)}
        >
          <section
            aria-labelledby="wallet-modal-title"
            aria-modal="true"
            className="wallet-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="wallet-modal__header">
              <h2 id="wallet-modal-title">{t("navbar.walletModalTitle")}</h2>
              <button
                aria-label={t("navbar.closeWalletModal")}
                className="wallet-modal__close"
                onClick={() => setIsWalletModalOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="wallet-modal__options">
              {walletOptions.map((walletOption) => {
                const walletConnector = getConnector(walletOption.connectorId);

                if (!walletConnector) return null;

                return (
                  <button
                    className="wallet-option"
                    disabled={isConnectingWallet}
                    key={walletOption.connectorId}
                    onClick={() => handleWalletConnect(walletConnector)}
                    type="button"
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      className="wallet-option__logo"
                      src={walletOption.logoSrc}
                    />
                    <span className="wallet-option__name">
                      {t(walletOption.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>

            {connect.error && (
              <p className="wallet-modal__error">
                {t("common.errorWithMessage", {
                  message: connect.error.message,
                })}
              </p>
            )}
          </section>
        </div>
      )}
    </header>
  );
}

export default AppNavbar;
