import type { sessions } from "@/lib/db/schema/session";
import { buildStrategyPlansFromSelections, type SearchStrategyBundleSelection } from "@/lib/search-strategies/catalog";
import type { StrategyPlan } from "@/lib/search-strategies/types";

type SessionRecord = typeof sessions.$inferSelect;

export function planStrategiesForSession(
  session: SessionRecord,
  selections: SearchStrategyBundleSelection[] = []
): StrategyPlan[] {
  return buildStrategyPlansFromSelections(session, selections);
}
