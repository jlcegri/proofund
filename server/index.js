import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import FormData from "form-data";

dotenv.config();

const app = express();

const PORT = process.env.PORT;
const PINATA_JWT = process.env.PINATA_JWT;

if (!PINATA_JWT) {
  throw new Error("PINATA_JWT is missing in .env file");
}

if (!PORT) {
  throw new Error("PORT is missing in .env file");
}

app.use(
  cors({
    origin: "http://localhost:5173"
  })
);

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // max. 5mb permitido por imagen
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  }
});

async function uploadImageToIPFS(file) {
  const formData = new FormData();

  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype
  });

  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    formData,
    {
      maxBodyLength: Infinity,
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${PINATA_JWT}`
      }
    }
  );

  return `ipfs://${response.data.IpfsHash}`;
}

async function uploadJSONToIPFS(metadata) {
  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      pinataContent: metadata
    },
    {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json"
      }
    }
  );

  return `ipfs://${response.data.IpfsHash}`;
}

app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    const { title, description } = req.body;
    const file = req.file;

    if (!title || !description) {
      return res.status(400).json({
        error: "Title and description are required"
      });
    }

    if (!file) {
      return res.status(400).json({
        error: "Image is required"
      });
    }

    const imageURI = await uploadImageToIPFS(file);

    const metadata = {
      title,
      description,
      image: imageURI,
      version: 1
    };

    const metadataURI = await uploadJSONToIPFS(metadata);

    return res.status(201).json({
      metadataURI,
      metadata
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Error uploading metadata to IPFS"
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (
    error instanceof multer.MulterError ||
    error.message === "Only image files are allowed"
  ) {
    return res.status(400).json({
      error: error.message
    });
  }

  return next(error);
});

app.listen(PORT, () => {
  console.log(`Proofund backend running on http://localhost:${PORT}`);
});
