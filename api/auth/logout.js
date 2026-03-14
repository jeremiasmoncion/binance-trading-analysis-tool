import { clearSessionCookie, sendJson } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { message: "Método no permitido" });
  }

  clearSessionCookie(res);
  return sendJson(res, 200, { success: true });
}
