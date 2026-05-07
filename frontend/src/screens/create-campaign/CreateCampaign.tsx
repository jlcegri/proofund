import {
  useConnection,
  useConnectors,
  useWriteContract,
} from "wagmi";
import { parseEther } from "viem";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { campaignFactoryAbi } from "../../contracts/abi/campaignFactoryAbi";
import { campaignFactoryContractAddress } from "../../contracts/address/campaignFactoryContractAddress";
import "./styles.css";

dayjs.extend(customParseFormat);

function CreateCampaign() {
  const { t } = useTranslation();
  const connection = useConnection();
  const connectors = useConnectors();
  const writeContract = useWriteContract();
  const [eth, setEth] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "inactive" | "uploadingMetadata" | "waitingTransaction" | "success" | "error"
  >("inactive");
  const timestamp = dayjs(time, "DD-MM-YYYY").unix();

  const buttonText =
    status === "inactive"
      ? t("createCampaign.submit")
      : status === "uploadingMetadata"
      ? t("createCampaign.uploadingMetadata")
      : status === "waitingTransaction"
      ? t("createCampaign.waitingTransaction")
      : status === "success"
      ? t("createCampaign.success")
      : t("createCampaign.error");

  async function handleCreateCampaign() {
    try {
      setStatus("uploadingMetadata");

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);

      if (image) {
        formData.append("images", image);
      }

      const response = await fetch("http://localhost:3001/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      setStatus("waitingTransaction");

      await writeContract.mutateAsync({
        address: campaignFactoryContractAddress,
        abi: campaignFactoryAbi,
        functionName: "createCampaign",
        args: [parseEther(eth), BigInt(timestamp), data.metadataURI],
      });

      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <div className="app">
      {connection.status !== "connected" ? (
        <>
          {connectors.map((connector) => (
            <p className="status-message" key={connector.id}>
              {t("createCampaign.connectWalletPrompt", {
                connectorName: connector.name,
              })}
            </p>
          ))}
        </>
      ) : (
        <div className="app-content">
          <form
            className="panel campaign-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateCampaign();
            }}
          >
            <div className="campaign-form__fields">
              <label className="field-label">{t("createCampaign.ethLabel")}</label>
              <input
                className="field-input"
                value={eth}
                onChange={(e) => setEth(e.target.value)}
                placeholder="ETH"
              />

              <label>{t("createCampaign.deadlineLabel")}</label>
              <input
                className="field-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="01-01-2030"
              />

              <label className="field-label">
                {t("createCampaign.campaignTitleLabel")}
              </label>
              <input
                className="field-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("createCampaign.campaignTitlePlaceholder")}
              />

              <label>{t("createCampaign.descriptionLabel")}</label>
              <input
                className="field-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("createCampaign.descriptionPlaceholder")}
              />

              <label>{t("createCampaign.imagesLabel")}</label>
              <input
                className="field-input field-file"
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />

              {image && (
                <p className="selected-file">
                  {t("createCampaign.selectedImage", {
                    fileName: image.name,
                  })}
                </p>
              )}
            </div>
          </form>

          <button
            className="button button--primary button--full-mobile"
            onClick={handleCreateCampaign}
            disabled={status === "uploadingMetadata" || status === "waitingTransaction"}
          >
            {buttonText}
          </button>

          {writeContract.error && (
            <p className="status-message status-message--error">
              {t("common.errorWithMessage", {
                message: writeContract.error.message,
              })}
            </p>
          )}
          {writeContract.data && (
            <p className="status-message status-message--mono">
              {t("common.transactionHash", {
                hash: writeContract.data,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CreateCampaign;
