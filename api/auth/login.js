import { getUser, parseJsonBody, publicUser, sendJson, setSessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { message: "Método no permitido" });
  }

  const { username, password } = parseJsonBody(req);
  const user = getUser(String(username || "").trim(), String(password || ""));

  if (!user) {
    return sendJson(res, 401, { message: "Usuario o contraseña incorrectos" });
  }

  setSessionCookie(res, user);
  return sendJson(res, 200, { success: true, user: publicUser(user) });
}
