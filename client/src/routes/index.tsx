import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarketCard } from "@/components/market-card";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "resolved">("active");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "totalBetSize" | "participants">("createdAt");
  const [pagination, setPagination] = useState<any>(null);

  const loadMarkets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.listMarkets(status, page, sortBy);
      setMarkets(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMarkets = async () => {
    try {
      const data = await api.listMarkets(status, page, sortBy);
      setMarkets(data.items);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Polling failed:", err);
    }
  };

  //da refresh la 5 secunde
  useEffect(() => {
    if (!isAuthenticated) return;
  
    const intervalId = setInterval(() => {
      refreshMarkets();
    }, 5000);
  
    return () => clearInterval(intervalId);
  }, [isAuthenticated, status, page, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [status, sortBy]);

  useEffect(() => {
    loadMarkets();
  }, [status, page, sortBy]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">Prediction Markets</h1>
          <p className="text-gray-600 mb-8 text-lg">Create and participate in prediction markets</p>
          <div className="space-x-4">
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/register" })}>
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Markets</h1>
            <p className="text-gray-600 mt-2">Welcome back, {user?.username}!</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Navigation */}
            <Button variant="outline" onClick={() => navigate({ to: "/leaderboard" })}>
              Leaderboard
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/profile" })}>
              Profile
            </Button>

            {/* Actions */}
            <Button onClick={() => navigate({ to: "/markets/new" })}>
              Create Market
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/logout" })}>
              Logout
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <Button
            variant={status === "active" ? "default" : "outline"}
            onClick={() => setStatus("active")}
          >
            Active Markets
          </Button>
          <Button
            variant={status === "resolved" ? "default" : "outline"}
            onClick={() => setStatus("resolved")}
          >
            Resolved Markets
          </Button>
          <Button
            variant={sortBy === "createdAt" ? "default" : "outline"}
            onClick={() => setSortBy("createdAt")}
          >
            Newest
          </Button>
          <Button
            variant={sortBy === "totalBetSize" ? "default" : "outline"}
            onClick={() => setSortBy("totalBetSize")}
          >
            Highest Pool
          </Button>
          <Button
            variant={sortBy === "participants" ? "default" : "outline"}
            onClick={() => setSortBy("participants")}
          >
            Most Participants
          </Button>
          <Button variant="outline" onClick={loadMarkets} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Markets Grid */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading markets...</p>
            </CardContent>
          </Card>
        ) : markets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground text-lg">
                  No {status} markets found. {status === "active" && "Create one to get started!"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
        {pagination && pagination.totalPages > 1 && (
  <div className="flex items-center justify-between mt-8">
    <Button
      variant="outline"
      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
      disabled={page === 1}
    >
      Previous
    </Button>

    <p className="text-sm text-muted-foreground">
      Page {pagination.page} of {pagination.totalPages}
    </p>

    <Button
      variant="outline"
      onClick={() =>
        setPage((prev) => Math.min(prev + 1, pagination.totalPages))
      }
      disabled={page === pagination.totalPages}
    >
      Next
    </Button>
  </div>
)}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
