import { useTranslation } from "react-i18next";
import "./styles.css";

function Profile() {
  const { t } = useTranslation();

  return (
    <div className="app">
      <div className="app-content">
        <section className="panel profile-panel">
          <h1>{t("profile.title")}</h1>
        </section>
      </div>
    </div>
  );
}

export default Profile;
