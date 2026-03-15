/**
 * Calculate implied odds for an outcome based on total bets
 * Formula: outcome_bets / total_bets
 */
export function calculateOutcomeOdds(outcomeBets: number, totalBets: number): number {
  if (totalBets === 0) return 0;
  return Number(((outcomeBets / totalBets) * 100).toFixed(2));
}

/**
 * Calculate winnings for a user on a specific market
 * If user bet on winning outcome, winnings = bet amount * (total_bets / winning_bets)
 * Otherwise, winnings = 0
 */
export function calculateUserWinnings(
  betAmount: number,
  winningOutcomeTotalBets: number,
  totalMarketBets: number,
): number {
  if (winningOutcomeTotalBets === 0) return 0;
  const multiplier = totalMarketBets / winningOutcomeTotalBets;
  return Number((betAmount * multiplier).toFixed(2));
}

/**
 * Calculate total winnings for a user across all resolved markets
 */
export function calculateTotalWinnings(
  userBets: Array<{
    amount: number;
    outcome_id: number;
    resolved_outcome_id: number | null;
  }>,
  betsPerOutcome: Map<number, number>,
  totalBetsPerMarket: Map<string, number>,
): number {
  return userBets.reduce((total, bet) => {
    if (bet.resolved_outcome_id === null) return total;
    if (bet.outcome_id !== bet.resolved_outcome_id) return total;

    const winningBets = betsPerOutcome.get(bet.outcome_id) || 0;
    const totalBets = totalBetsPerMarket.get(String(bet.outcome_id)) || 0;

    if (winningBets === 0) return total;
    const multiplier = totalBets / winningBets;
    return total + Number((bet.amount * multiplier).toFixed(2));
  }, 0);
}
