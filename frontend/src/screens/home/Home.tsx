import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getLanguageFromPathname } from "../../i18n/language";
import "./styles.css";

function Home() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentLanguage = getLanguageFromPathname(location.pathname);

  return (
    <main className="home">
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="home-badge">{t("home.badge")}</span>

          <h1>{t("home.title")}</h1>

          <p>{t("home.subtitle")}</p>

          <div className="home-actions">
            <button
              className="home-primary-button"
              onClick={() => navigate(`/${currentLanguage}/campaign/create`)}
            >
              {t("home.createCampaign")}
            </button>

            <button
              className="home-secondary-button"
              onClick={() => navigate(`/${currentLanguage}/explore`)}
            >
              {t("home.exploreCampaigns")}
            </button>
          </div>
        </div>

        <div className="home-hero-card">
          <h2>{t("home.howItWorks")}</h2>

          <div className="home-step">
            <strong>{t("home.steps.createTitle")}</strong>
            <span>{t("home.steps.createDescription")}</span>
          </div>

          <div className="home-step">
            <strong>{t("home.steps.fundTitle")}</strong>
            <span>{t("home.steps.fundDescription")}</span>
          </div>

          <div className="home-step">
            <strong>{t("home.steps.settleTitle")}</strong>
            <span>{t("home.steps.settleDescription")}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
