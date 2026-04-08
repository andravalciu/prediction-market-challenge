import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  handleCreateMarket,
  handleListMarkets,
  handleGetMarket,
  handlePlaceBet,
  handleResolveMarket,
  handleArchiveMarket,
  handleGetLeaderboard,
  handleGetProfile,
  handleGetActiveBets,
  handleGetResolvedBets,
} from "./handlers";

export const marketRoutes = new Elysia({ prefix: "/api/markets" })
  .use(authMiddleware)
  .get("/", handleListMarkets, {
    query: t.Object({
      status: t.Optional(t.String()),
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
      sortBy: t.Optional(t.String()),
    }),
  })
  .get("/leaderboard", handleGetLeaderboard)
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .get("/profile", handleGetProfile)
        .get("/profile/bets/active", handleGetActiveBets, {
          query: t.Object({
            page: t.Optional(t.Numeric()),
          }),
        })
        .get("/profile/bets/resolved", handleGetResolvedBets, {
          query: t.Object({
            page: t.Optional(t.Numeric()),
          }),
        })
        .post("/", handleCreateMarket, {
          body: t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            outcomes: t.Array(t.String()),
          }),
        })
        .post("/:id/bets", handlePlaceBet, {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
            amount: t.Number(),
          }),
        })
        .post("/:id/resolve", handleResolveMarket, {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
          }),
        })
  )
  .post("/:id/archive", handleArchiveMarket, {
    params: t.Object({
      id: t.Numeric(),
    }),
  })
  .get("/:id", handleGetMarket, {
    params: t.Object({
      id: t.Numeric(),
    }),
  });
