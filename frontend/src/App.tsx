import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseEther } from "viem";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { campaignAbi } from "./campaignAbi";
import { campaignFactoryAbi } from "./campaignFactoryAbi";
import { campaignFactoryContractAddress } from "./campaignFactoryContractAddress";

dayjs.extend(customParseFormat);

function App() {
  const connection = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const writeContract = useWriteContract();
  const [eth, setEth] = useState("");
  const [time, setTime] = useState("");
  const [metadataURI, setMetadataURI] = useState("https://ipfs.io/proofund");
  const [selectedCampaignAddress, setSelectedCampaignAddress] =
    useState<`0x${string}` | "">("");
  const timestamp = dayjs(time, "DD-MM-YYYY").unix();

  const campaignsQuery = useReadContract({
    address: campaignFactoryContractAddress,
    abi: campaignFactoryAbi,
    functionName: "getCampaigns",
  });

  const refetchCampaigns = campaignsQuery.refetch;
  const campaignAddresses = (campaignsQuery.data ?? []) as `0x${string}`[];

  const receipt = useWaitForTransactionReceipt({
    hash: writeContract.data,
  });

  useEffect(() => {
    if (receipt.isSuccess) {
      refetchCampaigns();
    }
  }, [receipt.isSuccess, refetchCampaigns]);

  useEffect(() => {
    if (!selectedCampaignAddress && campaignAddresses.length > 0) {
      setSelectedCampaignAddress(campaignAddresses[campaignAddresses.length - 1]);
    }
  }, [campaignAddresses, selectedCampaignAddress]);

  async function handleCreateCampaign() {
    try {
      await writeContract.mutateAsync({
        address: campaignFactoryContractAddress,
        abi: campaignFactoryAbi,
        functionName: "createCampaign",
        args: [parseEther(eth), BigInt(timestamp), metadataURI],
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleFund() {
    if (!selectedCampaignAddress) return;

    try {
      await writeContract.mutateAsync({
        address: selectedCampaignAddress,
        abi: campaignAbi,
        functionName: "fund",
        value: parseEther(eth),
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleWithdraw() {
    if (!selectedCampaignAddress) return;

    try {
      await writeContract.mutateAsync({
        address: selectedCampaignAddress,
        abi: campaignAbi,
        functionName: "withdraw",
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleFinishCampaign() {
    if (!selectedCampaignAddress) return;

    try {
      await writeContract.mutateAsync({
        address: selectedCampaignAddress,
        abi: campaignAbi,
        functionName: "finishCampaign",
      });
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
                margin: "10px",
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateCampaign();
            }}
          >
            <div>
              <label>ETH</label>
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

              <label>Metadata URI</label>
              <input
                value={metadataURI}
                onChange={(e) => setMetadataURI(e.target.value)}
                placeholder="ipfs://..."
              />
            </div>
          </form>

          <button
            onClick={handleCreateCampaign}
            style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
          >
            Crear campaña
          </button>

          {campaignAddresses.length > 0 && (
            <>
              <div style={{ marginTop: "1rem" }}>
                <label>Campaña</label>
                <select
                  value={selectedCampaignAddress}
                  onChange={(e) =>
                    setSelectedCampaignAddress(e.target.value as `0x${string}`)
                  }
                >
                  {campaignAddresses.map((campaignAddress) => (
                    <option key={campaignAddress} value={campaignAddress}>
                      {campaignAddress}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleFund}
                style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
              >
                Aportar a la campaña
              </button>
              <button
                onClick={handleWithdraw}
                style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
              >
                Retirar fondos
              </button>
              <button
                onClick={handleFinishCampaign}
                style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
              >
                Finalizar campaña
              </button>
            </>
          )}

          {campaignsQuery.isPending && <p>Cargando campañas...</p>}
          {campaignsQuery.error && <p>Error: {campaignsQuery.error.message}</p>}
          {writeContract.isPending && <p>Confirmando transacción...</p>}
          {writeContract.error && <p>Error: {writeContract.error.message}</p>}
          {writeContract.data && <p>Tx hash: {writeContract.data}</p>}
        </div>
      )}
    </div>
  );
}

export default App;
