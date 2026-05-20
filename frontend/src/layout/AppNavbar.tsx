import {
  useConnect,
  useDisconnect,
  useConnection,
  useConnectors,
  type Connector,
} from "wagmi";
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

type ThemeName = "light" | "dark";

const themeStorageKey = "theme";

function getInitialTheme(): ThemeName {
  if (typeof window === "undefined") return "light";

  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {
    return "light";
  }

  return "light";
}

function AppNavbar() {
  const { t, i18n } = useTranslation();
  const connect = useConnect();
  const connection = useConnection();
  const disconnect = useDisconnect();
  const connectors = useConnectors();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const location = useLocation();
  const navigate = useNavigate();
  const currentLanguage = getLanguageFromPathname(location.pathname);

  const isConnectingWallet =
    connect.isPending || connection.status === "connecting";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);

    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      return;
    }
  }, [theme]);

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
    <header className="navbar sticky top-0 z-50 bg-base-100 text-base-content shadow-sm">
      <div className="navbar-start">
        <Link to={`/${currentLanguage}`} className="btn btn-ghost text-xl">
          {t("navbar.brand")}
        </Link>
      </div>

      <nav className="navbar-center hidden gap-2 md:flex" aria-label={t("navbar.navigation")}>
        <Link className="btn btn-ghost btn-sm" to={`/${currentLanguage}/explore`}>
          {t("navbar.explore")}
        </Link>
        <Link className="btn btn-ghost btn-sm" to={`/${currentLanguage}/campaign/create`}>
          {t("navbar.createCampaign")}
        </Link>
      </nav>

      <div className="navbar-end gap-2">
        <button
          aria-label="Toggle theme"
          className="btn btn-ghost btn-sm"
          onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
          type="button"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>

        <div className="dropdown dropdown-end md:hidden">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
            Menu
          </div>
          <ul tabIndex={0} className="menu dropdown-content z-[55] mt-3 w-56 rounded-box bg-base-100 p-2 shadow-xl">
            <li>
              <Link to={`/${currentLanguage}/explore`}>
                {t("navbar.explore")}
              </Link>
            </li>
            <li>
              <Link to={`/${currentLanguage}/campaign/create`}>
                {t("navbar.createCampaign")}
              </Link>
            </li>
          </ul>
        </div>

        <div
          className="relative flex items-center gap-2"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsProfileMenuOpen(false);
            }
          }}
          tabIndex={0}
        >
          {connection.status === "connected" && (
            <>
              <button
                aria-label={t("navbar.myProfile")}
                className="btn btn-ghost btn-circle"
                onClick={toggleProfileMenu}
                type="button"
              >
                <Avatar
                  name={connection.address ?? ""}
                  size={36}
                  variant="beam"
                />
              </button>
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full z-[55] mt-2 w-56 rounded-box bg-base-100 p-2 shadow-xl">
                  <button
                    className="btn btn-ghost w-full justify-start"
                    type="button"
                    onClick={() => navigate(`/${currentLanguage}/profile`)}
                  >
                    {t("navbar.myProfile")}
                  </button>
                  <button className="btn btn-ghost w-full justify-start" type="button" onClick={toggleLanguage}>
                    {t("navbar.currentLanguage", {
                      language: currentLanguage.toUpperCase(),
                    })}
                  </button>
                  <button
                    className="btn btn-ghost w-full justify-start text-error"
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
              className="btn btn-primary btn-sm"
              onClick={openWalletModal}
              type="button"
            >
              {t("navbar.connectWallet")}
            </button>
          )}
          {connection.status === "connecting" && (
            <button className="btn btn-primary btn-sm btn-disabled" type="button">
              {t("navbar.connecting")}
            </button>
          )}
        </div>
      </div>

      {isWalletModalOpen && (
        <div
          className="modal modal-open"
          onMouseDown={() => setIsWalletModalOpen(false)}
        >
          <section
            aria-labelledby="wallet-modal-title"
            aria-modal="true"
            className="modal-box"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold" id="wallet-modal-title">{t("navbar.walletModalTitle")}</h2>
              <button
                aria-label={t("navbar.closeWalletModal")}
                className="btn btn-circle btn-ghost btn-sm"
                onClick={() => setIsWalletModalOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              {walletOptions.map((walletOption) => {
                const walletConnector = getConnector(walletOption.connectorId);

                if (!walletConnector) return null;

                return (
                  <button
                    className="btn btn-outline h-auto justify-start gap-3 p-4"
                    disabled={isConnectingWallet}
                    key={walletOption.connectorId}
                    onClick={() => handleWalletConnect(walletConnector)}
                    type="button"
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      className="h-8 w-8"
                      src={walletOption.logoSrc}
                    />
                    <span>
                      {t(walletOption.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>

            {connect.error && (
              <p className="alert alert-error mt-4">
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
