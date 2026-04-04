import { eq, and, sql } from "drizzle-orm";
import db from "../db";
import {
  usersTable,
  marketsTable,
  marketOutcomesTable,
  betsTable,
} from "../db/schema";
import {
  hashPassword,
  verifyPassword,
  type AuthTokenPayload,
} from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";

type JwtSigner = {
  sign: (payload: AuthTokenPayload) => Promise<string>;
};

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { username, email, password } = body;
  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) =>
      or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {
    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db
    .insert(usersTable)
    .values({ username, email, passwordHash })
    .returning();

  const token = await jwt.sign({ userId: newUser[0].id });

  set.status = 201;
  return {
    id: newUser[0].id,
    username: newUser[0].username,
    email: newUser[0].email,
    role: newUser[0].role,
    token,
  };
}

export async function handleLogin({
  body,
  jwt,
  set,
}: {
  body: { email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    token,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const { title, description, outcomes } = body;
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
    })
    .returning();

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0].id,
        title,
        position: index,
      }))
    )
    .returning();

  set.status = 201;
  return {
    id: market[0].id,
    title: market[0].title,
    description: market[0].description,
    status: market[0].status,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({
  query,
}: {
  query: { status?: string; page?: number; limit?: number; sortBy?: string };
}) {
  const statusFilter = query.status || "active";
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = query.sortBy || "createdAt";

  const markets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, statusFilter),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  const enrichedMarkets = await Promise.all(
    markets.map(async (market) => {
      const betsPerOutcome = await Promise.all(
        market.outcomes.map(async (outcome) => {
          const totalBets = await db
            .select()
            .from(betsTable)
            .where(eq(betsTable.outcomeId, outcome.id));

          const totalAmount = totalBets.reduce(
            (sum, bet) => sum + bet.amount,
            0
          );
          return { outcomeId: outcome.id, totalBets: totalAmount };
        })
      );

      const totalMarketBets = betsPerOutcome.reduce(
        (sum, b) => sum + b.totalBets,
        0
      );

      const marketBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.marketId, market.id));

      const participantCount = new Set(marketBets.map((bet) => bet.userId))
        .size;

      return {
        id: market.id,
        title: market.title,
        status: market.status,
        creator: market.creator?.username,
        createdAt: market.createdAt,
        participantCount,
        outcomes: market.outcomes.map((outcome) => {
          const outcomeBets =
            betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets ||
            0;

          const odds =
            totalMarketBets > 0
              ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2))
              : 0;

          return {
            id: outcome.id,
            title: outcome.title,
            odds,
            totalBets: outcomeBets,
          };
        }),
        totalMarketBets,
      };
    })
  );

  const sortedMarkets = [...enrichedMarkets].sort((a, b) => {
    if (sortBy === "totalBetSize") {
      return b.totalMarketBets - a.totalMarketBets;
    }

    if (sortBy === "participants") {
      return b.participantCount - a.participantCount;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalItems = sortedMarkets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit;
  const items = sortedMarkets.slice(start, start + limit);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    })
  );

  const totalMarketBets = betsPerOutcome.reduce(
    (sum, b) => sum + b.totalBets,
    0
  );

  const resolvedOutcome =
    market.resolvedOutcomeId != null
      ? market.outcomes.find(
          (outcome) => outcome.id === market.resolvedOutcomeId
        ) ?? null
      : null;

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    resolvedOutcomeId: market.resolvedOutcomeId,
    resolvedOutcomeTitle: resolvedOutcome?.title ?? null,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets =
        betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0
          ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2))
          : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}

export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number; amount: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { outcomeId, amount } = body;
  const numericAmount = Number(amount);
  const errors = validateBet(numericAmount);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(
      eq(marketOutcomesTable.id, outcomeId),
      eq(marketOutcomesTable.marketId, marketId)
    ),
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
  }

  const currentUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, user.id),
  });

  if (!currentUser) {
    set.status = 404;
    return { error: "User not found" };
  }

  if (currentUser.balance < numericAmount) {
    set.status = 400;
    return { error: "Insufficient balance" };
  }

  await db
    .update(usersTable)
    .set({
      balance: sql`${usersTable.balance} - ${numericAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  const bet = await db
    .insert(betsTable)
    .values({
      userId: user.id,
      marketId,
      outcomeId,
      amount: numericAmount,
    })
    .returning();

  const updatedUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, user.id),
    columns: {
      id: true,
      balance: true,
    },
  });

  set.status = 201;
  return {
    id: bet[0].id,
    userId: bet[0].userId,
    marketId: bet[0].marketId,
    outcomeId: bet[0].outcomeId,
    amount: bet[0].amount,
    remainingBalance: updatedUser?.balance ?? null,
  };
}

export async function handleResolveMarket({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { outcomeId } = body;

  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  if (user.role !== "admin") {
    set.status = 403;
    return { error: "Admin access required" };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
    with: {
      outcomes: true,
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const winningOutcome = market.outcomes.find(
    (outcome) => outcome.id === outcomeId
  );

  if (!winningOutcome) {
    set.status = 400;
    return { error: "Selected outcome does not belong to this market" };
  }

  const allBets = await db
    .select()
    .from(betsTable)
    .where(eq(betsTable.marketId, marketId));

  const totalPool = allBets.reduce((sum, bet) => sum + bet.amount, 0);
  const winningBets = allBets.filter((bet) => bet.outcomeId === outcomeId);
  const totalWinningStake = winningBets.reduce(
    (sum, bet) => sum + bet.amount,
    0
  );

  if (winningBets.length > 0 && totalWinningStake > 0) {
    for (const bet of winningBets) {
      const payout = Number(
        ((totalPool * bet.amount) / totalWinningStake).toFixed(2)
      );

      await db
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${payout}`,
          totalWinnings: sql`${usersTable.totalWinnings} + ${payout}`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, bet.userId));
    }
  }

  await db
    .update(marketsTable)
    .set({
      status: "resolved",
      resolvedOutcomeId: outcomeId,
      resolvedAt: new Date(),
    })
    .where(eq(marketsTable.id, marketId));

  set.status = 200;
  return {
    success: true,
    marketId,
    resolvedOutcomeId: outcomeId,
    totalPool,
    winnersCount: winningBets.length,
    totalWinningStake,
  };
}

export async function handleGetLeaderboard() {
  const users = await db.query.usersTable.findMany({
    columns: {
      id: true,
      username: true,
      totalWinnings: true,
    },
    orderBy: (users, { desc }) => desc(users.totalWinnings),
    limit: 20,
  });

  return users.map((user, index) => ({
    rank: index + 1,
    id: user.id,
    username: user.username,
    totalWinnings: Number(user.totalWinnings ?? 0),
  }));
}

export async function handleGetProfile({
  set,
  user,
}: {
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const currentUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, user.id),
    columns: {
      id: true,
      username: true,
      email: true,
      role: true,
      balance: true,
      totalWinnings: true,
    },
  });

  if (!currentUser) {
    set.status = 404;
    return { error: "User not found" };
  }

  return currentUser;
}

export async function handleGetActiveBets({
  query,
  set,
  user,
}: {
  query: { page?: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const page = Number(query.page ?? 1);
  const limit = 20;

  const allBets = await db.query.betsTable.findMany({
    where: eq(betsTable.userId, user.id),
    with: {
      market: true,
      outcome: true,
    },
    orderBy: (bets, { desc }) => desc(bets.createdAt),
  });

  const activeBets = allBets.filter((bet) => bet.market?.status === "active");

  const totalItems = activeBets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit;
  const paginated = activeBets.slice(start, start + limit);

  const items = await Promise.all(
    paginated.map(async (bet) => {
      const marketBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.marketId, bet.marketId));

      const totalMarketBets = marketBets.reduce(
        (sum, currentBet) => sum + currentBet.amount,
        0
      );

      const outcomeBets = marketBets.filter(
        (currentBet) => currentBet.outcomeId === bet.outcomeId
      );
      const outcomeTotal = outcomeBets.reduce(
        (sum, currentBet) => sum + currentBet.amount,
        0
      );

      const currentOdds =
        totalMarketBets > 0
          ? Number(((outcomeTotal / totalMarketBets) * 100).toFixed(2))
          : 0;

      return {
        id: bet.id,
        marketId: bet.marketId,
        marketTitle: bet.market?.title ?? "Unknown market",
        outcomeId: bet.outcomeId,
        outcomeTitle: bet.outcome?.title ?? "Unknown outcome",
        amount: bet.amount,
        createdAt: bet.createdAt,
        currentOdds,
      };
    })
  );

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  };
}

export async function handleGetResolvedBets({
  query,
  set,
  user,
}: {
  query: { page?: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const page = Number(query.page ?? 1);
  const limit = 20;

  const allBets = await db.query.betsTable.findMany({
    where: eq(betsTable.userId, user.id),
    with: {
      market: true,
      outcome: true,
    },
    orderBy: (bets, { desc }) => desc(bets.createdAt),
  });

  const resolvedBets = allBets.filter(
    (bet) => bet.market?.status === "resolved"
  );

  const totalItems = resolvedBets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit;
  const paginated = resolvedBets.slice(start, start + limit);

  const items = paginated.map((bet) => {
    const didWin = bet.market?.resolvedOutcomeId === bet.outcomeId;

    return {
      id: bet.id,
      marketId: bet.marketId,
      marketTitle: bet.market?.title ?? "Unknown market",
      outcomeId: bet.outcomeId,
      outcomeTitle: bet.outcome?.title ?? "Unknown outcome",
      amount: bet.amount,
      createdAt: bet.createdAt,
      result: didWin ? "won" : "lost",
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  };
}
