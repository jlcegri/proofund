import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getLanguageFromPathname } from "../i18n/language";

function Home() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentLanguage = getLanguageFromPathname(location.pathname);

  return (
    <div className="grid min-h-[calc(100vh-8rem)] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="space-y-6">
        <span className="badge badge-primary badge-outline">
          {t("home.badge")}
        </span>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight text-base-content md:text-6xl">
          {t("home.title")}
        </h1>

        <p className="max-w-2xl text-lg text-base-content/70">
          {t("home.subtitle")}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/${currentLanguage}/campaign/create`)}
            type="button"
          >
            {t("home.createCampaign")}
          </button>

          <button
            className="btn btn-outline"
            onClick={() => navigate(`/${currentLanguage}/explore`)}
            type="button"
          >
            {t("home.exploreCampaigns")}
          </button>
        </div>
      </section>

      <aside className="card bg-base-100 shadow-xl">
        <div className="card-body gap-4">
          <h2 className="card-title">{t("home.howItWorks")}</h2>

          <div className="rounded-box bg-base-200 p-4">
            <strong>{t("home.steps.createTitle")}</strong>
            <span className="block text-base-content/70">{t("home.steps.createDescription")}</span>
          </div>

          <div className="rounded-box bg-base-200 p-4">
            <strong>{t("home.steps.fundTitle")}</strong>
            <span className="block text-base-content/70">{t("home.steps.fundDescription")}</span>
          </div>

          <div className="rounded-box bg-base-200 p-4">
            <strong>{t("home.steps.settleTitle")}</strong>
            <span className="block text-base-content/70">{t("home.steps.settleDescription")}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default Home;
