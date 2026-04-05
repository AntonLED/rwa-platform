import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import { sumsubWebhookRouter } from "./webhooks/sumsub";
import { kycRouter } from "./api/kyc";
import { whitelistRouter } from "./api/whitelist";
import { invoiceRouter } from "./api/invoice";
import { poolRouter } from "./api/pool";
import { edoRouter } from "./api/edo";
import logger from "./lib/logger";

const app = express();

// CORS
app.use(cors());

// Raw body нужен для верификации Sumsub webhook подписи
app.use("/webhook/sumsub", express.raw({ type: "application/json" }));
app.use(express.json());

// Routes
app.use(sumsubWebhookRouter);
app.use(kycRouter);
app.use(whitelistRouter);
app.use(invoiceRouter);
app.use(poolRouter);
app.use(edoRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => logger.info(`Backend listening on http://localhost:${PORT}`));
