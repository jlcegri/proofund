import { useTranslation } from "react-i18next";
import { useConnection } from "wagmi";
import "./styles.css";

function Profile() {
  const { t } = useTranslation();
  const connection = useConnection();

  return (
    <div className="app">
      <div className="app-content">
        <section className="panel profile-panel">
          <h1>{t("profile.title")}</h1>
        </section>
        {connection.status === "connected" && (
          <>
            <p>
              <strong>{t("profile.connected")}:</strong>{" "}
              {t("profile.yes")}
            </p>
            <p>
              <strong>{t("profile.address")}:</strong> {connection.address}
            </p>
            <p>
              <strong>{t("profile.testnet")}:</strong>{" "}
              {connection.chain?.name}
            </p>
            <p>
              <strong>{t("profile.wallet")}:</strong>{" "}
              {connection.connector.name}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;
