import { useAccount, useConnect, useDisconnect } from "wagmi";

function App() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Proofund</h1>
      <p>Conecta tu wallet y comienza a crear tus campañas</p>

      {!isConnected ? (
        <div>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              style={{
                padding: "0.75rem 1rem",
                cursor: "pointer",
                margin: "10px"
              }}
            >
              Conéctate con {connector.name}
            </button>
          ))}

          {isPending && <p>Conectando...</p>}
          {error && <p>Error: {error.message}</p>}
        </div>
      ) : (
        <div>
          <p>
            <strong>Conectado:</strong> Sí
          </p>
          <p>
            <strong>Dirección:</strong> {address}
          </p>
          <p>
            <strong>Testnet:</strong> {chain?.name}
          </p>

          <button
            onClick={() => disconnect()}
            style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  );
}

export default App;