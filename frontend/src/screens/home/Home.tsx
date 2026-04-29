import { Link } from "react-router-dom";
import { useConnection, useConnect, useConnectors } from "wagmi";

import "../../styles/app-shell.css";
import "./styles.css";

function shortenAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Home() {
  const connection = useConnection();
  const connect = useConnect();
  const connectors = useConnectors();
  const primaryConnector = connectors[0];
  const isConnected = connection.status === "connected";

  return (
    <main className="app home">
      <section className="panel home-panel">
        <span className="home-badge">Crowdfunding onchain</span>

        <h1 className="app-title">Bienvenido a Proofund</h1>

        <p>
          Comienza a crear tus campanas. Conecta tu wallet y publica tu primera
          campana en pocos pasos.
        </p>

        <div className="home-actions">
          {isConnected ? (
            <Link
              className="button button--primary button--full-mobile home-link-button"
              to="/campaigns/create"
            >
              Comienza a crear
            </Link>
          ) : (
            <button
              className="button button--primary button--full-mobile"
              disabled={!primaryConnector || connect.isPending}
              type="button"
              onClick={() => {
                if (!primaryConnector) return;

                connect.mutate({ connector: primaryConnector });
              }}
            >
              {connect.isPending ? "Conectando..." : "Conectar wallet"}
            </button>
          )}
        </div>

        {isConnected && connection.address && (
          <div className="panel wallet-status home-wallet-status">
            <p>
              <strong>Wallet:</strong> {shortenAddress(connection.address)}
            </p>
            <p>
              <strong>Red:</strong> {connection.chain?.name}
            </p>
          </div>
        )}

        {!isConnected && (
          <p className="home-helper">
            {primaryConnector
              ? `Compatible con ${primaryConnector.name}.`
              : "No hay wallets disponibles en este navegador."}
          </p>
        )}

        {connect.error && (
          <p className="status-message status-message--error">
            Error: {connect.error.message}
          </p>
        )}
      </section>
    </main>
  );
}

export default Home;
