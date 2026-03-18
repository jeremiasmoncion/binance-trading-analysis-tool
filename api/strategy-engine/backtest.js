import { getStrategyValidationLab, runStrategyBacktest, sendJson } from "../_lib/strategyEngine.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await getStrategyValidationLab(req));
    }

    if (req.method === "POST") {
      return sendJson(res, 200, await runStrategyBacktest(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo generar el laboratorio de backtesting",
    });
  }
}
