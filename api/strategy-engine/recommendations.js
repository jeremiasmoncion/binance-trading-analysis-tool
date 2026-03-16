import {
  activateAdaptiveRecommendation,
  generateAdaptiveRecommendations,
  listStrategyEngine,
  sendJson,
} from "../_lib/strategyEngine.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const payload = await listStrategyEngine(req);
      return sendJson(res, 200, { recommendations: payload.recommendations || [] });
    }

    if (req.method === "POST") {
      return sendJson(res, 200, { recommendations: await generateAdaptiveRecommendations(req) });
    }

    if (req.method === "PATCH") {
      return sendJson(res, 200, await activateAdaptiveRecommendation(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar las recomendaciones adaptativas",
    });
  }
}
