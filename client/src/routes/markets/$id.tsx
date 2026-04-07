import { useEffect, useState } from "react";
import {
  useParams,
  useNavigate,
  createFileRoute,
} from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

function MarketDetailPage() {
  const { id } = useParams({ from: "/markets/$id" });
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(
    null
  );
  const [betAmount, setBetAmount] = useState("");
  const [isBetting, setIsBetting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const isAdmin = user?.role === "admin";
  const marketId = parseInt(id, 10);

  const chartData =
    market?.outcomes.map((outcome) => ({
      name: outcome.title,
      value: outcome.odds,
    })) ?? [];

  const CHART_COLORS = ["#111827", "#6B7280", "#D1D5DB", "#9CA3AF"];

  useEffect(() => {
    const loadMarket = async () => {
      try {
        setIsLoading(true);
        const data = await api.getMarket(marketId);
        setMarket(data);
        if (data.outcomes.length > 0) {
          setSelectedOutcomeId(data.outcomes[0].id);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load market details"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadMarket();
  }, [marketId]);

  const handlePlaceBet = async () => {
    if (!selectedOutcomeId || !betAmount) {
      setError("Please select an outcome and enter a bet amount");
      return;
    }

    try {
      setIsBetting(true);
      setError(null);
      await api.placeBet(marketId, selectedOutcomeId, parseFloat(betAmount));
      setBetAmount("");
      // Reload market to show updated odds
      const updated = await api.getMarket(marketId);
      setMarket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bet");
    } finally {
      setIsBetting(false);
    }
  };

  const handleResolveMarket = async () => {
    if (!selectedOutcomeId) {
      setError("Please select an outcome to resolve the market");
      return;
    }

    try {
      setIsResolving(true);
      setError(null);
      await api.resolveMarket(marketId, selectedOutcomeId);

      const updated = await api.getMarket(marketId);
      setMarket(updated);
      setIsResolveDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve market");
    } finally {
      setIsResolving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground">
              Please log in to view this market
            </p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading market...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-destructive">Market not found</p>
            <Button onClick={() => navigate({ to: "/" })}>
              Back to Markets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Header */}
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-4xl">{market.title}</CardTitle>
                {market.description && (
                  <CardDescription className="text-lg mt-2">
                    {market.description}
                  </CardDescription>
                )}
              </div>
              <Badge
                variant={market.status === "active" ? "default" : "secondary"}
              >
                {market.status === "active" ? "Active" : "Resolved"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Outcomes Display */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Outcomes</h3>

              {market.outcomes.map((outcome) => {
                const isSelected =
                  market.status === "active"
                    ? selectedOutcomeId === outcome.id
                    : market.resolvedOutcomeId === outcome.id;

                const isWinner =
                  market.status === "resolved" &&
                  market.resolvedOutcomeId === outcome.id;

                return (
                  <div
                    key={outcome.id}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-secondary bg-secondary/5"
                    } ${market.status === "active" ? "cursor-pointer hover:border-primary/50" : "cursor-default"}`}
                    onClick={() =>
                      market.status === "active" &&
                      setSelectedOutcomeId(outcome.id)
                    }
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{outcome.title}</h4>
                        </div>

                        <p className="text-sm text-muted-foreground mt-1">
                          Total bets: ${outcome.totalBets.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-3xl font-bold text-primary">
                          {outcome.odds}%
                        </p>
                        <p className="text-xs text-muted-foreground">odds</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Bet Distribution</CardTitle>
                <CardDescription>
                  Percentage of total bets placed on each outcome
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {chartData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value: number) => [
                          `${value}%`,
                          "Bet share",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Market Stats */}
            <div className="rounded-lg p-6 border border-primary/20 bg-primary/5">
              <p className="text-sm text-muted-foreground mb-1">
                Total Market Value
              </p>
              <p className="text-4xl font-bold text-primary">
                ${market.totalMarketBets.toFixed(2)}
              </p>
            </div>

            {/* Admin Controls */}
            {market.status === "active" && isAdmin && (
              <Card className="border-amber-300 bg-amber-50">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Admin Controls</CardTitle>
                    <Badge className="bg-amber-100 text-amber-800 border border-amber-200 pointer-events-none">
                      Admin
                    </Badge>
                  </div>
                  <CardDescription>
                    Select the winning outcome and resolve this market.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selected Winning Outcome</Label>
                    <div className="p-3 bg-white border rounded-md">
                      {market.outcomes.find((o) => o.id === selectedOutcomeId)
                        ?.title || "None selected"}
                    </div>
                  </div>

                  <Dialog
                    open={isResolveDialogOpen}
                    onOpenChange={setIsResolveDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        className="w-full text-lg py-6 font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors duration-200"
                        disabled={isResolving || !selectedOutcomeId}
                      >
                        Resolve Market
                      </Button>
                    </DialogTrigger>

                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Resolve market</DialogTitle>
                        <DialogDescription>
                          This will close the market and distribute payouts to
                          bettors who chose the winning outcome.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Winning outcome
                          </p>
                          <p className="font-semibold">
                            {market.outcomes.find(
                              (o) => o.id === selectedOutcomeId
                            )?.title || "None selected"}
                          </p>
                        </div>

                        <Badge
                          variant="outline"
                          className="text-muted-foreground border-muted"
                        >
                          Winner
                        </Badge>
                      </div>

                      <DialogFooter className="flex justify-between items-center pt-4">
                        <Button
                          variant="ghost"
                          onClick={() => setIsResolveDialogOpen(false)}
                          disabled={isResolving}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="bg-slate-900 hover:bg-slate-800 text-white transition-all duration-200 hover:shadow-md"
                          onClick={handleResolveMarket}
                          disabled={isResolving || !selectedOutcomeId}
                        >
                          {isResolving ? "Resolving..." : "Confirm Resolution"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}

            {/* Betting Section */}
            {market.status === "active" && (
              <Card className="bg-secondary/5">
                <CardHeader>
                  <CardTitle>Place Your Bet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selected Outcome</Label>
                    <div className="p-3 bg-white border border-secondary rounded-md">
                      {market.outcomes.find((o) => o.id === selectedOutcomeId)
                        ?.title || "None selected"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="betAmount">Bet Amount ($)</Label>
                    <Input
                      id="betAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder="Enter amount"
                      disabled={isBetting}
                    />
                  </div>

                  <Button
                    className="w-full text-lg py-6"
                    onClick={handlePlaceBet}
                    disabled={isBetting || !selectedOutcomeId || !betAmount}
                  >
                    {isBetting ? "Placing bet..." : "Place Bet"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {market.status === "resolved" && (
              <Card className="rounded-xl border border-emerald-200 bg-emerald-50/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-emerald-800">
                      Market resolved
                    </CardTitle>

                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 pointer-events-none">
                      Closed
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-emerald-700">
                    Winning outcome:{" "}
                    <span className="font-semibold">
                      {market.resolvedOutcomeTitle || "Resolved"}
                    </span>
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/markets/$id")({
  component: MarketDetailPage,
});
