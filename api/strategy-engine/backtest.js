import { backfillStrategyLearningDataset, getStrategyValidationLab, processQueuedStrategyBacktests, runStrategyBacktest, sendJson } from "../_lib/strategyEngine.js";

async function parseBody(req) {
  if (req?.body !== undefined && req?.body !== null) return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await getStrategyValidationLab(req));
    }

    if (req.method === "POST") {
      const body = await parseBody(req);
      req.body = body;
      if (body?.action === "backfillDataset") {
        return sendJson(res, 200, await backfillStrategyLearningDataset(req));
      }
      if (body?.action === "processQueue") {
        return sendJson(res, 200, await processQueuedStrategyBacktests(req));
      }
      return sendJson(res, 200, await runStrategyBacktest(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo generar el laboratorio de backtesting",
    });
  }
}
