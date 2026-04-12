import { SessionContentLoading } from "@/components/sessions/session-content-loading";
import { getSessionLoadingDescriptor } from "@/components/sessions/session-loading-descriptor";

export default function StrategyLoading() {
  return <SessionContentLoading {...getSessionLoadingDescriptor("strategy")} />;
}
