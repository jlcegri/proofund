import {
  useConnection,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { parseEther } from "viem";
import { useEffect, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { campaignFactoryAbi } from "../contracts/abi/campaignFactoryAbi";
import { campaignFactoryContractAddress } from "../contracts/address/campaignFactoryContractAddress";

dayjs.extend(customParseFormat);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ETH_FORMAT = /^\d+(\.\d{1,18})?$/;

type FormErrorKey =
  | "createCampaign.validation.titleRequired"
  | "createCampaign.validation.titleMinLength"
  | "createCampaign.validation.titleMaxLength"
  | "createCampaign.validation.descriptionRequired"
  | "createCampaign.validation.descriptionMinLength"
  | "createCampaign.validation.descriptionMaxLength"
  | "createCampaign.validation.goalRequired"
  | "createCampaign.validation.goalInvalid"
  | "createCampaign.validation.goalPositive"
  | "createCampaign.validation.deadlineRequired"
  | "createCampaign.validation.deadlineInvalid"
  | "createCampaign.validation.deadlineFuture"
  | "createCampaign.validation.imageRequired"
  | "createCampaign.validation.imageType"
  | "createCampaign.validation.imageSize"
  | "createCampaign.validation.metadataUploadFailed"
  | "createCampaign.validation.createFailed";

type ValidationResult =
  | {
      isValid: true;
      deadlineTimestamp: bigint;
      goalAmount: bigint;
    }
  | {
      isValid: false;
      errors: FormErrorKey[];
    };

function CreateCampaign() {
  const { t } = useTranslation();
  const connection = useConnection();
  const switchChain = useSwitchChain();
  const writeContract = useWriteContract();
  const [eth, setEth] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [formErrorKeys, setFormErrorKeys] = useState<FormErrorKey[]>([]);
  const [status, setStatus] = useState<
    "inactive" | "uploadingMetadata" | "waitingTransaction" | "success" | "error"
  >("inactive");

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(image);
    setImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [image]);

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
  const isSubmitting =
    status === "uploadingMetadata" ||
    status === "waitingTransaction" ||
    switchChain.isPending;
  const previewTitle =
    title.trim() || t("createCampaign.preview.titlePlaceholder");
  const previewDescription =
    description.trim() || t("createCampaign.preview.descriptionPlaceholder");
  const previewGoal = eth.trim()
    ? `${eth.trim()} ETH`
    : t("createCampaign.preview.goalPlaceholder");
  const previewDeadline =
    time.trim() || t("createCampaign.preview.deadlinePlaceholder");

  function clearFeedback() {
    setFormErrorKeys([]);

    if (status === "success" || status === "error") {
      setStatus("inactive");
    }
  }

  function validateForm(): ValidationResult {
    const errors: FormErrorKey[] = [];
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedEth = eth.trim();
    const trimmedDeadline = time.trim();
    let goalAmount = 0n;
    let deadlineTimestamp = 0n;

    if (!trimmedTitle) {
      errors.push("createCampaign.validation.titleRequired");
    } else if (trimmedTitle.length < 3) {
      errors.push("createCampaign.validation.titleMinLength");
    } else if (trimmedTitle.length > 80) {
      errors.push("createCampaign.validation.titleMaxLength");
    }

    if (!trimmedDescription) {
      errors.push("createCampaign.validation.descriptionRequired");
    } else if (trimmedDescription.length < 10) {
      errors.push("createCampaign.validation.descriptionMinLength");
    } else if (trimmedDescription.length > 1000) {
      errors.push("createCampaign.validation.descriptionMaxLength");
    }

    if (!trimmedEth) {
      errors.push("createCampaign.validation.goalRequired");
    } else if (!ETH_FORMAT.test(trimmedEth)) {
      errors.push("createCampaign.validation.goalInvalid");
    } else {
      try {
        goalAmount = parseEther(trimmedEth);

        if (goalAmount <= 0n) {
          errors.push("createCampaign.validation.goalPositive");
        }
      } catch {
        errors.push("createCampaign.validation.goalInvalid");
      }
    }

    if (!trimmedDeadline) {
      errors.push("createCampaign.validation.deadlineRequired");
    } else {
      const parsedDeadline = dayjs(trimmedDeadline, "DD-MM-YYYY", true);

      if (!parsedDeadline.isValid()) {
        errors.push("createCampaign.validation.deadlineInvalid");
      } else if (!parsedDeadline.isAfter(dayjs())) {
        errors.push("createCampaign.validation.deadlineFuture");
      } else {
        deadlineTimestamp = BigInt(parsedDeadline.unix());
      }
    }

    if (!image) {
      errors.push("createCampaign.validation.imageRequired");
    } else {
      if (!image.type.startsWith("image/")) {
        errors.push("createCampaign.validation.imageType");
      }

      if (image.size > MAX_IMAGE_SIZE) {
        errors.push("createCampaign.validation.imageSize");
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      deadlineTimestamp,
      goalAmount,
    };
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedImage = event.target.files?.[0] ?? null;

    clearFeedback();

    if (!selectedImage) {
      setImage(null);
      return;
    }

    if (!selectedImage.type.startsWith("image/")) {
      setImage(null);
      event.target.value = "";
      setFormErrorKeys(["createCampaign.validation.imageType"]);
      return;
    }

    if (selectedImage.size > MAX_IMAGE_SIZE) {
      setImage(null);
      event.target.value = "";
      setFormErrorKeys(["createCampaign.validation.imageSize"]);
      return;
    }

    setImage(selectedImage);
  }

  async function handleCreateCampaign() {
    const validation = validateForm();

    if (!validation.isValid) {
      setFormErrorKeys(validation.errors);
      setStatus("inactive");
      return;
    }

    try {
      setFormErrorKeys([]);

      if (connection.chain?.id !== sepolia.id) {
        setStatus("waitingTransaction");
        await switchChain.switchChainAsync({ chainId: sepolia.id });
      }

      setStatus("uploadingMetadata");

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());

      if (image) {
        formData.append("images", image);
      }

      const response = await fetch("http://localhost:3001/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as {
        metadataURI?: unknown;
      } | null;

      if (
        !response.ok ||
        !data ||
        typeof data.metadataURI !== "string" ||
        !data.metadataURI.trim()
      ) {
        setStatus("error");
        setFormErrorKeys(["createCampaign.validation.metadataUploadFailed"]);
        return;
      }

      setStatus("waitingTransaction");

      await writeContract.mutateAsync({
        address: campaignFactoryContractAddress,
        abi: campaignFactoryAbi,
        chainId: sepolia.id,
        functionName: "createCampaign",
        args: [validation.goalAmount, validation.deadlineTimestamp, data.metadataURI],
      });

      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setFormErrorKeys(["createCampaign.validation.createFailed"]);
    }
  }

  return (
    <div className="space-y-6">
      {connection.status !== "connected" ? (
        <div className="space-y-3">
            <p className="alert alert-info">
              {t("createCampaign.connectWalletPrompt")}
            </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-4">
              <form
                className="card bg-base-100 shadow-xl"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateCampaign();
                }}
              >
                <div className="card-body gap-5">
                  <label className="grid w-full gap-1" htmlFor="campaign-goal">
                    <span className="label">{t("createCampaign.ethLabel")}</span>
                    <input
                      id="campaign-goal"
                      className="input w-full"
                      value={eth}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setEth(e.target.value);
                        clearFeedback();
                      }}
                      placeholder="ETH"
                    />
                  </label>

                  <label className="grid w-full gap-1" htmlFor="campaign-deadline">
                    <span className="label">{t("createCampaign.deadlineLabel")}</span>
                    <input
                      id="campaign-deadline"
                      className="input w-full"
                      value={time}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setTime(e.target.value);
                        clearFeedback();
                      }}
                      placeholder="01-01-2030"
                    />
                  </label>

                  <label className="grid w-full gap-1" htmlFor="campaign-title">
                    <span className="label">{t("createCampaign.campaignTitleLabel")}</span>
                    <input
                      id="campaign-title"
                      className="input w-full"
                      value={title}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        clearFeedback();
                      }}
                      placeholder={t("createCampaign.campaignTitlePlaceholder")}
                    />
                  </label>

                  <label className="grid w-full gap-1" htmlFor="campaign-description">
                    <span className="label">{t("createCampaign.descriptionLabel")}</span>
                    <input
                      id="campaign-description"
                      className="input w-full"
                      value={description}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        clearFeedback();
                      }}
                      placeholder={t("createCampaign.descriptionPlaceholder")}
                    />
                  </label>

                  <div className="grid w-full gap-1">
                    <span className="label">{t("createCampaign.imagesLabel")}</span>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        id="campaign-image"
                        className="hidden"
                        type="file"
                        accept="image/*"
                        disabled={isSubmitting}
                        onChange={handleImageChange}
                      />
                      <label
                        className={`btn btn-success${isSubmitting ? " btn-disabled" : ""}`}
                        htmlFor="campaign-image"
                        aria-disabled={isSubmitting}
                      >
                        {t("createCampaign.selectImage")}
                      </label>
                      <span className="text-sm text-base-content/70">
                        {image?.name ?? t("createCampaign.noImageSelected")}
                      </span>
                    </div>
                  </div>

                  {formErrorKeys.length > 0 && (
                    <div
                      className="alert alert-error"
                      aria-live="polite"
                    >
                      <div>
                        {formErrorKeys.map((errorKey) => (
                          <p key={errorKey}>{t(errorKey)}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="card-actions justify-end">
                    <button
                      className="btn btn-accent w-full sm:w-auto"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {buttonText}
                    </button>
                  </div>
                </div>
              </form>

              {status === "error" && writeContract.error && formErrorKeys.length === 0 && (
                <p className="alert alert-error">
                  {t("createCampaign.validation.createFailed")}
                </p>
              )}
              {status === "success" && writeContract.data && (
                <p className="alert alert-success break-all font-mono">
                  {t("common.transactionHash", {
                    hash: writeContract.data,
                  })}
                </p>
              )}
            </div>

            <aside className="card bg-base-100 shadow-xl">
              <figure className="flex h-64 items-center justify-center bg-base-200">
                {imagePreviewUrl ? (
                  <img className="h-full w-full object-cover" src={imagePreviewUrl} alt={previewTitle} />
                ) : (
                  <span className="text-base-content/70">{t("createCampaign.noImageSelected")}</span>
                )}
              </figure>
              <div className="card-body">
                <p className="badge badge-sm badge-accent badge-outline px-1">
                  {t("createCampaign.preview.badge")}
                </p>
                <h2 className="card-title">{previewTitle}</h2>
                <p className="text-base-content/70">
                  {previewDescription}
                </p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-box bg-base-200 p-3">
                    <dt>{t("createCampaign.preview.goalLabel")}</dt>
                    <dd className="font-bold">{previewGoal}</dd>
                  </div>
                  <div className="rounded-box bg-base-200 p-3">
                    <dt>{t("createCampaign.preview.deadlineLabel")}</dt>
                    <dd className="font-bold">{previewDeadline}</dd>
                  </div>
                </dl>
              </div>
            </aside>
        </div>
      )}
    </div>
  );
}

export default CreateCampaign;
