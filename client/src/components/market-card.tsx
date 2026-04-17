import { useState } from "react";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigate } from "@tanstack/react-router";

interface MarketCardProps {
  market: Market;
  isAdmin?: boolean;
}

export function MarketCard({ market, isAdmin }: MarketCardProps) {
  const navigate = useNavigate();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  const handleArchive = async () => {
    try {
      setIsArchiving(true);
      await api.archiveMarket(market.id);
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{market.title}</CardTitle>
            <CardDescription>By: {market.creator || "Unknown"}</CardDescription>
          </div>
          <Badge variant={market.status === "active" ? "default" : "secondary"}>
            {market.status === "active"
              ? "Active"
              : market.status === "resolved"
                ? "Resolved"
                : "Archived"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 space-y-4">
        {/* Outcomes — cresc cât au nevoie, indiferent de câte sunt */}
        <div className="space-y-2">
          {market.outcomes.map((outcome) => (
            <div
              key={outcome.id}
              className="flex items-center justify-between bg-secondary/20 p-3 rounded-md"
            >
              <div>
                <p className="text-sm font-medium">{outcome.title}</p>
                <p className="text-xs text-muted-foreground">
                  ${outcome.totalBets.toFixed(2)} total
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{outcome.odds}%</p>
              </div>
            </div>
          ))}
        </div>

        {/* Spacer — împinge TMV + buton mereu în jos */}
        <div className="flex-1" />

        {/* Bloc fix la baza cardului: TMV + acțiune */}
        <div className="space-y-3">
          <div className="p-3 rounded-md border border-primary/20 bg-primary/5">
            <p className="text-xs text-muted-foreground">Total Market Value</p>
            <p className="text-2xl font-bold text-primary">
              ${market.totalMarketBets.toFixed(2)}
            </p>
          </div>

          {!isAdmin && (
            <Button
              className="w-full"
              onClick={() => navigate({ to: `/markets/${market.id}` })}
            >
              {market.status === "active" ? "Place Bet" : "View Results"}
            </Button>
          )}

          {isAdmin && market.status === "active" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => navigate({ to: `/markets/${market.id}` })}
              >
                Resolve
              </Button>

              <Dialog
                open={isArchiveDialogOpen}
                onOpenChange={setIsArchiveDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    disabled={isArchiving}
                  >
                    Archive
                  </Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Archive market</DialogTitle>
                    <DialogDescription>
                      This will close the market and refund all placed bets back
                      to users.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-muted-foreground">
                      No winning outcome will be selected. All bettors will
                      receive their original stake back.
                    </p>
                  </div>

                  <DialogFooter className="flex justify-between items-center pt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setIsArchiveDialogOpen(false)}
                      disabled={isArchiving}
                    >
                      Cancel
                    </Button>

                    <Button
                      variant="outline"
                      className="border-slate-900 text-slate-900 hover:bg-slate-100"
                      onClick={async () => {
                        await handleArchive();
                        setIsArchiveDialogOpen(false);
                      }}
                      disabled={isArchiving}
                    >
                      {isArchiving ? "Archiving..." : "Confirm Archive"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
