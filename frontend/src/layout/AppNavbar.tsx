import { useConnect, useDisconnect, useConnection, useConnectors } from "wagmi";
import "./styles.css";
import { Link } from "react-router-dom";
import Avatar from "boring-avatars";

function AppNavbar() {

  const connect = useConnect();
  const connection = useConnection();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const connector = connectors[0];

  return (
    <header className="app-navbar">
      <div className="app-navbar-brand">
        <Link to="/" className="navbar-brand-link">Proofund</Link>
      </div>

      <div className="navbar-right">
        {connection.status === "connected" && (
        <>
        <button
          className="wallet-button"
          onClick={() => disconnect.mutate()}
        >
          Desconectar
        </button>
        <Avatar name={connection.address} size={42} variant="beam"/>
        </>
      )}
      {connection.status === "disconnected" && (
        <button
          className="wallet-button"
          onClick={() => connect.mutate({connector})}
        >
          Connect wallet
        </button>
      )}
      {connection.status === "connecting" && (
        <button
            className = "wallet-button"
        >
            Conectando...
        </button>
      )}
      </div>

      
    </header>
  );
}

export default AppNavbar;
