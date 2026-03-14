import { getSession, getStorageMode, listUsers, sendJson } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { message: "Método no permitido" });
  }

  const session = getSession(req);
  if (!session) {
    return sendJson(res, 401, { message: "Sesión no válida o vencida" });
  }

  try {
    return sendJson(res, 200, { users: await listUsers(), storageMode: getStorageMode() });
  } catch (error) {
    return sendJson(res, 503, { message: "No se pudo consultar la base de datos de usuarios", detail: error.message });
  }
}
