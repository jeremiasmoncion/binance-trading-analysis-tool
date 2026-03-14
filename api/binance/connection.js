import { connectBinanceTestnet, disconnectBinanceTestnet, getBinanceConnectionState, sendJson } from "../_lib/binance.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return sendJson(res, 200, await getBinanceConnectionState(req));
    if (req.method === "POST") return sendJson(res, 200, await connectBinanceTestnet(req));
    if (req.method === "DELETE") return sendJson(res, 200, await disconnectBinanceTestnet(req));
    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, { message: error.message || "No se pudo procesar la conexión con Binance Testnet" });
  }
}
