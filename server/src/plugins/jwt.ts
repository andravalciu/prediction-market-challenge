import { jwt } from "@elysiajs/jwt";
import { t } from "elysia";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

export const jwtPlugin = jwt({
  name: "jwt",
  secret: JWT_SECRET,
  exp: "7d",
  schema: t.Object({
    userId: t.Number(),
  }),
});
