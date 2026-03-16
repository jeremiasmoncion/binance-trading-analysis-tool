import {
  createStrategyExperiment,
  listStrategyEngine,
  sendJson,
  updateStrategyExperiment,
} from "../_lib/strategyEngine.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await listStrategyEngine(req));
    }

    if (req.method === "POST") {
      return sendJson(res, 200, { experiment: await createStrategyExperiment(req) });
    }

    if (req.method === "PATCH") {
      return sendJson(res, 200, { experiment: await updateStrategyExperiment(req) });
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar el motor de estrategias",
    });
  }
}
