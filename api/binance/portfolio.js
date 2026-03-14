import { getPortfolioSnapshot, sendJson } from "../_lib/binance.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return sendJson(res, 405, { message: "Método no permitido" });
    }

    const period = typeof req.query?.period === "string" ? req.query.period : "1d";
    return sendJson(res, 200, await getPortfolioSnapshot(req, period));
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo cargar el portafolio de Binance Demo Spot",
    });
  }
}
