import {
  executeSignalTrade,
  getExecutionCenter,
  sendJson,
  updateExecutionProfile,
} from "../_lib/executionEngine.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await getExecutionCenter(req));
    }

    if (req.method === "PATCH") {
      return sendJson(res, 200, { profile: await updateExecutionProfile(req) });
    }

    if (req.method === "POST") {
      return sendJson(res, 200, await executeSignalTrade(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar la ejecución demo",
    });
  }
}
