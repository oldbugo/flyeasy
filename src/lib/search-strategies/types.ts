export type StrategyPlan = {
  estimatedSearchCost: number;
  reason: string;
  strategyPayload: Record<string, unknown>;
  strategyType: string;
};
