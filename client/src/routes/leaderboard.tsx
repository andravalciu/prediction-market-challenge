import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, LeaderboardEntry } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function LeaderboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      const data = await api.getLeaderboard();
      setEntries(data);
      setIsLoading(false);
    };

    loadLeaderboard();
  }, []);

  if (!isAuthenticated) {
    return <div>Please login first</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <div className="mb-2">
              <h1 className="text-4xl font-bold text-gray-900">Leaderboard</h1>
              <p className="text-gray-600 mt-2">Top users by total winnings</p>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <p>Loading leaderboard...</p>
            ) : (
              <>
                <div className="space-y-3">
                  {entries.map((entry) => {
                    const isCurrentUser = entry.username === user?.username;

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center justify-between border rounded-xl transition-shadow ${
                            entry.rank <= 3 ? "px-8 py-7" : "px-6 py-6"
                          } ${
                          isCurrentUser
                            ? "bg-blue-50 border-blue-300 shadow-md"
                            : "bg-white hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                        <div
                            className={`rounded-full text-white flex items-center justify-center font-semibold ${
                                entry.rank <= 3 ? "w-14 h-14 text-lg" : "w-12 h-12"
                            } ${
                                entry.rank === 1
                                ? "bg-yellow-500"
                                : entry.rank === 2
                                ? "bg-gray-400"
                                : entry.rank === 3
                                ? "bg-orange-500"
                                : "bg-black"
                            }`}
                            >
                            {entry.rank}
                        </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{entry.username}</p>

                              {isCurrentUser && (
                                <span className="text-xs px-2 py-1 rounded bg-blue-600 text-white">
                                  YOU
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-muted-foreground">
                              Rank #{entry.rank}
                            </p>
                          </div>
                        </div>

                        <p className="text-lg font-bold">
                          ${entry.totalWinnings.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});