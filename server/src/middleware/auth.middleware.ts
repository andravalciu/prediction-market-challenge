import { Elysia } from "elysia";
import { getUserById } from "../lib/auth";

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .derive(async ({ headers, jwt }) => {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { user: null };
    }

    const token = authHeader.substring(7);
    const payload = await jwt.verify(token);
    if (!payload) {
      return { user: null };
    }

    const user = await getUserById(payload.userId);
    return { user };
  })
  .as("plugin");
