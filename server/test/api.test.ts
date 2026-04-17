import { describe, it, expect, beforeAll } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { app } from "../index";
import db from "../src/db";
import { eq } from "drizzle-orm";
import { usersTable, marketsTable } from "../src/db/schema";

const BASE = "http://localhost";

// Shared state across tests (populated by earlier tests, consumed by later ones)
let authToken: string;
let userId: number;
let marketId: number;
let outcomeId: number;
let adminToken: string;
let adminUserId: number;

beforeAll(async () => {
  // Run migrations to create tables on the in-memory DB
  await migrate(db, { migrationsFolder: "./drizzle" });
});

describe("Auth", () => {
  const username = "testuser";
  const email = "test@example.com";
  const password = "testpass123";

  it("POST /api/auth/register — creates a new user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.username).toBe(username);
    expect(data.email).toBe(email);
    expect(data.token).toBeDefined();

    authToken = data.token;
    userId = data.id;
  });

  it("POST /api/auth/register — rejects duplicate user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      })
    );

    expect(res.status).toBe(409);
  });

  it("POST /api/auth/register — validates input", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ab", email: "bad", password: "12" }),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("POST /api/auth/login — logs in with valid credentials", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(userId);
    expect(data.token).toBeDefined();
  });

  it("POST /api/auth/login — rejects invalid credentials", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nobody@example.com",
          password: "wrong",
        }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/auth/register — creates an admin user for protected routes", async () => {
    const adminUsername = "adminuser";
    const adminEmail = "admin@example.com";
    const adminPassword = "adminpass123";

    const registerRes = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminUsername,
          email: adminEmail,
          password: adminPassword,
        }),
      })
    );

    expect(registerRes.status).toBe(201);
    const registerData = await registerRes.json();
    adminUserId = registerData.id;

    await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, adminUserId));

    const loginRes = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
        }),
      })
    );

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    adminToken = loginData.token;
  });
});

describe("Markets", () => {
  it("POST /api/markets — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test market",
          outcomes: ["Yes", "No"],
        }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/markets — creates a market", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Will it rain tomorrow?",
          description: "Weather prediction",
          outcomes: ["Yes", "No"],
        }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.outcomes).toHaveLength(2);

    marketId = data.id;
    outcomeId = data.outcomes[0].id;
  });

  it("POST /api/markets — validates input", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ title: "Hi", outcomes: ["Only one"] }),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("GET /api/markets — lists markets", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets`));

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0].id).toBeDefined();
    expect(data.items[0].title).toBeDefined();
    expect(data.items[0].outcomes).toBeDefined();

    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
  });

  it("GET /api/markets/:id — returns market detail", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}`)
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(marketId);
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.description).toBe("Weather prediction");
    expect(data.outcomes).toHaveLength(2);
  });

  it("GET /api/markets/:id — 404 for nonexistent market", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/99999`));

    expect(res.status).toBe(404);
  });
});

describe("Bets", () => {
  it("POST /api/markets/:id/bets — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId, amount: 100 }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/markets/:id/bets — places a bet", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId, amount: 50 }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.userId).toBe(userId);
    expect(data.marketId).toBe(marketId);
    expect(data.outcomeId).toBe(outcomeId);
    expect(data.amount).toBe(50);
  });

  it("POST /api/markets/:id/bets — validates amount", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId, amount: -10 }),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("POST /api/markets/:id/bets — rejects admin users", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ outcomeId, amount: 50 }),
      })
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Admins are not allowed to place bets");
  });
});

describe("Admin market actions", () => {
  let archiveMarketId: number;
  let archiveOutcomeId: number;

  it("POST /api/markets/:id/archive — refunds all bets and archives market", async () => {
    const createRes = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Will stocks go up?",
          description: "Archive test market",
          outcomes: ["Yes", "No"],
        }),
      })
    );

    expect(createRes.status).toBe(201);
    const createdMarket = await createRes.json();
    archiveMarketId = createdMarket.id;
    archiveOutcomeId = createdMarket.outcomes[0].id;

    const betRes = await app.handle(
      new Request(`${BASE}/api/markets/${archiveMarketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId: archiveOutcomeId, amount: 40 }),
      })
    );

    expect(betRes.status).toBe(201);

    const balanceAfterBet = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
      columns: { balance: true },
    });

    const archiveRes = await app.handle(
      new Request(`${BASE}/api/markets/${archiveMarketId}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(archiveRes.status).toBe(200);
    const archiveData = await archiveRes.json();
    expect(archiveData.success).toBe(true);
    expect(archiveData.status).toBe("archived");

    const refundedUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
      columns: { balance: true },
    });

    expect(refundedUser?.balance).toBe((balanceAfterBet?.balance ?? 0) + 40);

    const archivedMarket = await db.query.marketsTable.findFirst({
      where: eq(marketsTable.id, archiveMarketId),
      columns: { status: true },
    });

    expect(archivedMarket?.status).toBe("archived");
  });

  it("POST /api/markets/:id/archive — rejects non-admin users", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${archiveMarketId}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`, // regular user token
        },
      })
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/markets/:id/bets — rejects bets on archived market", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${archiveMarketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId: archiveOutcomeId, amount: 20 }),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("Resolve market", () => {
  let resolveMarketId: number;
  let resolveOutcomeId: number;

  it("POST /api/markets/:id/resolve — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/markets/:id/resolve — resolves market and pays out winners", async () => {
    // create a fresh market
    const createRes = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Will it snow?",
          description: "Resolve test market",
          outcomes: ["Yes", "No"],
        }),
      })
    );

    expect(createRes.status).toBe(201);
    const createdMarket = await createRes.json();
    resolveMarketId = createdMarket.id;
    resolveOutcomeId = createdMarket.outcomes[0].id;

    // place a bet
    const betRes = await app.handle(
      new Request(`${BASE}/api/markets/${resolveMarketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId: resolveOutcomeId, amount: 50 }),
      })
    );

    expect(betRes.status).toBe(201);

    const balanceBeforeResolve = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
      columns: { balance: true },
    });

    // resolve the market
    const resolveRes = await app.handle(
      new Request(`${BASE}/api/markets/${resolveMarketId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ outcomeId: resolveOutcomeId }),
      })
    );

    expect(resolveRes.status).toBe(200);
    const resolveData = await resolveRes.json();
    expect(resolveData.success).toBe(true);

    // check market is marked resolved in db
    const resolvedMarket = await db.query.marketsTable.findFirst({
      where: eq(marketsTable.id, resolveMarketId),
      columns: { status: true },
    });

    expect(resolvedMarket?.status).toBe("resolved");

    // check winner got paid out
    const balanceAfterResolve = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
      columns: { balance: true },
    });

    expect(balanceAfterResolve?.balance).toBeGreaterThan(
      balanceBeforeResolve?.balance ?? 0
    );
  });

  it("POST /api/markets/:id/resolve — rejects non-admin users", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${resolveMarketId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId: resolveOutcomeId }),
      })
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/markets/:id/resolve — rejects bets after market is resolved", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${resolveMarketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId: resolveOutcomeId, amount: 20 }),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("Leaderboard", () => {
  it("GET /api/markets/leaderboard — returns leaderboard", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/leaderboard`)
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Profile", () => {
  it("GET /api/markets/profile — requires auth", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/profile`));

    expect(res.status).toBe(401);
  });

  it("GET /api/markets/profile — returns profile", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(userId);
    expect(data.username).toBeDefined();
    expect(data.balance).toBeDefined();
  });

  it("GET /api/markets/profile/bets/active — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/profile/bets/active`)
    );

    expect(res.status).toBe(401);
  });

  it("GET /api/markets/profile/bets/active — returns active bets", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/profile/bets/active`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("GET /api/markets/profile/bets/resolved — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/profile/bets/resolved`)
    );

    expect(res.status).toBe(401);
  });

  it("GET /api/markets/profile/bets/resolved — returns resolved bets", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/profile/bets/resolved`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.pagination).toBeDefined();
  });
});

describe("Error handling", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await app.handle(new Request(`${BASE}/nonexistent`));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Not found");
  });
});
