import { createSignalSnapshot, listSignalSnapshots, sendJson } from "../_lib/signals.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, { signals: await listSignalSnapshots(req) });
    }

    if (req.method === "POST") {
      return sendJson(res, 200, { signal: await createSignalSnapshot(req) });
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar la memoria de señales",
    });
  }
}
