import { getSession, getStorageMode, sendJson } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { message: "Método no permitido" });
  }

  const session = getSession(req);
  if (!session) {
    return sendJson(res, 401, { message: "Sesión no válida o vencida" });
  }

  return sendJson(res, 200, { user: session, storageMode: getStorageMode() });
}
