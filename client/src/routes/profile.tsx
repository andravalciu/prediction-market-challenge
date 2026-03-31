import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ProfilePage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBets, setActiveBets] = useState<any[]>([]);
  const [resolvedBets, setResolvedBets] = useState<any[]>([]);

  const [activePage, setActivePage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);

  const [activePagination, setActivePagination] = useState<any>(null);
  const [resolvedPagination, setResolvedPagination] = useState<any>(null);

  const loadProfileSummary = async () => {
    const data = await api.getProfile();
    setProfile(data);
  };
  
  const loadActiveBets = async (page = activePage) => {
    const activeData = await api.getActiveBets(page);
    setActiveBets(activeData.items);
    setActivePagination(activeData.pagination);
  };
  
  const loadResolvedBets = async (page = resolvedPage) => {
    const resolvedData = await api.getResolvedBets(page);
    setResolvedBets(resolvedData.items);
    setResolvedPagination(resolvedData.pagination);
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        await loadProfileSummary();
        await loadActiveBets(activePage);
        await loadResolvedBets(resolvedPage);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadProfile();
  }, [activePage, resolvedPage]);

  useEffect(() => {
    if (!isAuthenticated) return;
  
    const intervalId = setInterval(async () => {
      try {
        await loadProfileSummary();
        await loadActiveBets(activePage);
      } catch (err) {
        console.error("Polling failed:", err);
      }
    }, 5000);
  
    return () => clearInterval(intervalId);
  }, [isAuthenticated, activePage]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-10">
            <p>Please log in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-4xl">Profile</CardTitle>
          </CardHeader>
          <CardContent>
  {isLoading ? (
    <p>Loading profile...</p>
  ) : (
    <>
      {/* USER INFO */}
      <p className="text-lg">Welcome, {user?.username}!</p>

      <div className="mt-4 space-y-2">
        <p>Balance: ${profile?.balance?.toFixed(2)}</p>
        <p>Total winnings: ${profile?.totalWinnings?.toFixed(2)}</p>
      </div>

      {/* ACTIVE BETS */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Active Bets</h2>

        {activeBets.length === 0 ? (
          <p className="text-muted-foreground">No active bets yet.</p>
        ) : (
          <div className="space-y-3">
            {activeBets.map((bet) => (
              <div
                key={bet.id}
                className="border rounded-xl bg-white px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold">{bet.marketTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    Outcome: {bet.outcomeTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Amount: ${bet.amount.toFixed(2)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold">{bet.currentOdds}%</p>
                  <p className="text-xs text-muted-foreground">
                    current odds
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {activePagination && activePagination.totalPages > 1 && (
  <div className="flex items-center justify-between mt-4">
    <Button
      variant="outline"
      onClick={() => setActivePage((prev) => Math.max(prev - 1, 1))}
      disabled={activePage === 1}
    >
      Previous
    </Button>

    <p className="text-sm text-muted-foreground">
      Page {activePagination.page} of {activePagination.totalPages}
    </p>

    <Button
      variant="outline"
      onClick={() =>
        setActivePage((prev) =>
          Math.min(prev + 1, activePagination.totalPages)
        )
      }
      disabled={activePage === activePagination.totalPages}
    >
      Next
    </Button>
  </div>
)}
      </div>

{/* RESOLVED BETS */}

      <div className="mt-8">
  <h2 className="text-2xl font-semibold mb-4">Resolved Bets</h2>

  {resolvedBets.length === 0 ? (
    <p className="text-muted-foreground">No resolved bets yet.</p>
  ) : (
    <div className="space-y-3">
      {resolvedBets.map((bet) => (
        <div
          key={bet.id}
          className="border rounded-xl bg-white px-5 py-4 flex items-center justify-between"
        >
          <div>
            <p className="font-semibold">{bet.marketTitle}</p>
            <p className="text-sm text-muted-foreground">
              Outcome: {bet.outcomeTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              Amount: ${bet.amount.toFixed(2)}
            </p>
          </div>

          <div className="text-right">
            <p
              className={`text-sm font-semibold ${
                bet.result === "won" ? "text-green-600" : "text-red-600"
              }`}
            >
              {bet.result === "won" ? "Won" : "Lost"}
            </p>
          </div>
        </div>
      ))}
    </div>
  )}
  {resolvedPagination && resolvedPagination.totalPages > 1 && (
  <div className="flex items-center justify-between mt-4">
    <Button
      variant="outline"
      onClick={() => setResolvedPage((prev) => Math.max(prev - 1, 1))}
      disabled={resolvedPage === 1}
    >
      Previous
    </Button>

    <p className="text-sm text-muted-foreground">
      Page {resolvedPagination.page} of {resolvedPagination.totalPages}
    </p>

    <Button
      variant="outline"
      onClick={() =>
        setResolvedPage((prev) =>
          Math.min(prev + 1, resolvedPagination.totalPages)
        )
      }
      disabled={resolvedPage === resolvedPagination.totalPages}
    >
      Next
    </Button>
  </div>
)}
</div>
    </>
  )}
</CardContent>
                    </Card>
                </div>
                </div>
            );
            }

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});