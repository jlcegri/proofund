import { useConnection, useConnect, useDisconnect, useConnectors, useDeployContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { wagmiAbi } from "./abi";
import { bytecode } from "./bytecode"
import { parseEther } from "viem";
import { useState, useEffect } from "react";
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"

dayjs.extend(customParseFormat);

function App() {
  const connection = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const deployContract = useDeployContract();
  const writeContract = useWriteContract();
  const [eth, setEth] = useState("");
  const [time, setTime] = useState("");
  const timestamp = dayjs(time, "DD-MM-YYYY").unix();
  const [contractAddress, setContractAddress] = useState("");

  const receipt = useWaitForTransactionReceipt({
    hash: deployContract.data
  });

  useEffect(() => {
    if (receipt.data?.contractAddress) {
      setContractAddress(receipt.data.contractAddress);
    }
  }, [receipt.data?.contractAddress]);

  async function handleDeploy() {
    try {
      await deployContract.mutateAsync({
        abi: wagmiAbi,
        args: [connection.address, parseEther(eth), BigInt(timestamp)],
        bytecode: bytecode
      })
    } catch (err) {
      console.error(err);
    }
  }

  async function handleFund() {
    try {
      await writeContract.mutateAsync({
        address: contractAddress as `0x${string}`,
        abi: wagmiAbi,
        functionName: "fund",
        value: parseEther(eth)
      })
    } catch (err) {
      console.error(err);
    }
  }

  async function handleWithdraw() {
    try {
      await writeContract.mutateAsync({
        address: contractAddress as `0x${string}`,
        abi: wagmiAbi,
        functionName: "withdraw"
      })
    } catch (err) {
      console.error(err);
    }
  }

  async function handleFinishCampaign() {
    try {
      await writeContract.mutateAsync({
        address: contractAddress as `0x${string}`,
        abi: wagmiAbi,
        functionName: "finishCampaign"
      })
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Proofund</h1>
      <p>Conecta tu wallet y comienza a crear tus campañas</p>

      {connection.status !== "connected" ? (
        <div>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect.mutate({ connector })}
              style={{
                padding: "0.75rem 1rem",
                cursor: "pointer",
                margin: "10px"
              }}
            >
              Conéctate con {connector.name}
            </button>
          ))}

          {connect.isPending && <p>Conectando...</p>}
          {connect.error && <p>Error: {connect.error.message}</p>}
        </div>
      ) : (
        <div>
          <p>
            <strong>Conectado:</strong> Sí
          </p>
          <p>
            <strong>Dirección:</strong> {connection.address}
          </p>
          <p>
            <strong>Testnet:</strong> {connection.chain?.name}
          </p>

          <button
            onClick={() => disconnect.mutate()}
            style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
          >
            Desconectar
          </button>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleDeploy();
          }}>
            <div>
              <label>Objetivo (ETH)</label>
              <input
                value={eth}
                onChange={(e) => setEth(e.target.value)}
                placeholder="ETH"
              />
              <label>Fecha de finalización</label>
              <input
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="01-01-2030"
              />
            </div>
          </form>
          <button
            onClick={handleDeploy}
            style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
          >
            Desplegar contrato
          </button>
          {contractAddress && (
            <>
              <button
                onClick={handleFund}
                style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
              >
                Aportar al contrato
              </button>
              <button
                onClick={handleWithdraw}
                style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
              >
                Recuperar el dinero
              </button>
              <button
                onClick={handleFinishCampaign}
                style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
              >
                Finalizar campaña
              </button>
            </>
          )}

          {deployContract.isPending && <p>Desplegando...</p>}
          {deployContract.error && <p>Error: {deployContract.error.message}</p>}
          {deployContract.data && <p>Tx hash: {deployContract.data}</p>}
          {contractAddress && (
            <p>Dirección: {contractAddress}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
