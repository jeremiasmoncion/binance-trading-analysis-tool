import { createUser, publicUser, parseJsonBody, sendJson, setSessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { message: "Método no permitido" });
  }

  try {
    const { displayName, email, password } = parseJsonBody(req);
    const user = await createUser({ displayName, email, password });

    if (!user) {
      return sendJson(res, 500, { message: "No se pudo crear el usuario" });
    }

    setSessionCookie(res, user);
    return sendJson(res, 201, { success: true, user: publicUser(user) });
  } catch (error) {
    return sendJson(res, 400, { message: error.message || "No se pudo crear el usuario" });
  }
}
