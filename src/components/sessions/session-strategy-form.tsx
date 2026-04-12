import { saveSessionStrategiesAction } from "@/app/sessions/actions";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { SessionStickySaveTracker } from "@/components/sessions/session-sticky-actions";
import {
  isAdaptiveCoverageMarketScanSelection,
  isAlternateReturnCityExplorationSelection,
  isAnchoredMultiCitySearchSelection,
  isMarketScanStrategySelection,
  isMultiCityVerificationSelection,
  isRecommendationDateCoverageSelection,
  isStitchedValueProbeSelection,
  resolveAdaptiveCoverageExecutionConfig,
  resolveAlternateReturnCityExecutionConfig,
  resolveAnchoredMultiCitySearchExecutionConfig,
  resolveMarketScanExecutionConfig,
  resolveMultiCityVerificationExecutionConfig,
  resolveRecommendationDateCoverageExecutionConfig,
  resolveStitchedValueProbeExecutionConfig,
  type SearchStrategyBundleSelection
} from "@/lib/search-strategies/catalog";

type SessionStrategyFormProps = {
  formId?: string;
  returnTo: string;
  searchIntensity: string;
  selections: SearchStrategyBundleSelection[];
  sessionId: string;
  strategyExperimentMode: string;
  strategyExperimentSampleSize: number;
  sessionMaxStops: number;
  sessionReturnOriginMode: string;
  showSavedState?: boolean;
};

function FieldLabel(props: { title: string; tooltip: string }) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
      <span>{props.title}</span>
      <InfoTooltip content={props.tooltip} label={`About ${props.title}`} />
    </span>
  );
}

function OverrideInput(props: {
  currentDefault: number | string;
  description: string;
  max?: string;
  min?: string;
  name: string;
  placeholder?: string;
  step?: string;
  title: string;
  tooltip: string;
  value: number | string | null;
}) {
  return (
    <label className="space-y-2">
      <FieldLabel title={props.title} tooltip={props.tooltip} />
      <input
        name={props.name}
        type="number"
        step={props.step ?? "1"}
        min={props.min ?? "0"}
        max={props.max}
        defaultValue={props.value ?? ""}
        placeholder={props.placeholder ?? `default ${props.currentDefault}`}
        className="w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none transition focus:border-sea"
      />
      <p className="text-xs leading-6 text-slate-500">
        {props.description} Leave this blank to keep the current default of{" "}
        <span className="font-semibold text-slate-700">{props.currentDefault}</span>.
      </p>
    </label>
  );
}

function PassToggle(props: {
  defaultChecked: boolean;
  disabled?: boolean;
  label: string;
  name?: string;
}) {
  return (
    <div className="shrink-0">
      {props.name ? <input type="hidden" name={props.name} value="0" /> : null}
      <label
        className={`inline-flex items-center gap-3 ${
          props.disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <span className="relative inline-flex h-6 w-11 shrink-0">
          {props.name ? (
            <input
              type="checkbox"
              name={props.name}
              value="1"
              defaultChecked={props.defaultChecked}
              disabled={props.disabled}
              className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
            />
          ) : (
            <input
              type="checkbox"
              checked={props.defaultChecked}
              disabled
              readOnly
              className="peer absolute inset-0 m-0 h-full w-full cursor-default opacity-0"
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none relative inline-flex h-6 w-11 rounded-full bg-slate-300 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-sea peer-checked:after:translate-x-5 peer-disabled:bg-slate-200 peer-disabled:after:bg-white/80 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sea"
          />
        </span>
        <span className="text-sm font-semibold text-slate-700">{props.label}</span>
      </label>
    </div>
  );
}

function BaselineChoiceToggle(props: {
  defaultChecked: boolean;
  description: string;
  label: string;
  value: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-start gap-3 rounded-[18px] border border-line bg-white px-4 py-3 shadow-sm">
      <input
        type="radio"
        name="baselineStrategyKey"
        value={props.value}
        defaultChecked={props.defaultChecked}
        className="mt-1 h-4 w-4 border-line text-sea focus:ring-sea"
      />
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-slate-700">{props.label}</span>
        <span className="block text-xs leading-6 text-slate-500">{props.description}</span>
      </span>
    </label>
  );
}

function PassCard(props: {
  badges?: string[];
  children?: React.ReactNode;
  detail: string;
  note?: string;
  summary: string;
  title: string;
  toggle: React.ReactNode;
  tooltip: string;
}) {
  return (
    <article className="rounded-[22px] border border-line bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-ink">{props.title}</h4>
            <InfoTooltip content={props.tooltip} label={`About the ${props.title} pass`} />
            {props.badges?.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700"
              >
                {badge}
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-700">{props.summary}</p>
          {props.note ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
              {props.note}
            </p>
          ) : null}
        </div>
        {props.toggle}
      </div>

      <details className="mt-4 rounded-[20px] bg-slate-50 px-4 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-sea">
          Show details and settings
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-7 text-slate-600">{props.detail}</p>
          {props.children}
        </div>
      </details>
    </article>
  );
}

function StrategyFlowSummary(props: {
  expectedInputs: string[];
  expectedOutputs: string[];
  focusLabel: string;
}) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
      <div className="rounded-[20px] border border-line bg-white px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Focus
        </p>
        <p className="mt-2 text-sm leading-7 text-slate-700">{props.focusLabel}</p>
      </div>
      <div className="rounded-[20px] border border-line bg-white px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Expected inputs
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.expectedInputs.map((item) => (
            <span
              key={item}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-[20px] border border-line bg-white px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Expected outputs
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.expectedOutputs.map((item) => (
            <span
              key={item}
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StrategyHeader(props: {
  order: number;
  selection: SearchStrategyBundleSelection;
  stepLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
        Step {props.order}
      </span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
          props.selection.isRequired
            ? "bg-emerald-100 text-emerald-800"
            : "bg-slate-200 text-slate-700"
        }`}
      >
        {props.stepLabel}
      </span>
      <h3 className="text-lg font-semibold text-ink">{props.selection.title}</h3>
      {!props.selection.compatibility.isCompatible ? (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
          incompatible
        </span>
      ) : null}
    </div>
  );
}

export function SessionStrategyForm({
  formId,
  returnTo,
  searchIntensity,
  selections,
  sessionId,
  strategyExperimentMode,
  strategyExperimentSampleSize,
  sessionMaxStops,
  sessionReturnOriginMode,
  showSavedState = false
}: SessionStrategyFormProps) {
  const marketScanSelection = selections.find(
    (selection) => selection.strategyKey === "price_first_market_scan"
  );
  const adaptiveCoverageSelection = selections.find(
    (selection) => selection.strategyKey === "adaptive_coverage_market_scan"
  );
  const multiCitySelection = selections.find(
    (selection) => selection.strategyKey === "multi_city_verification"
  );
  const anchoredMultiCitySelection = selections.find(
    (selection) => selection.strategyKey === "anchored_multi_city_search"
  );
  const alternateReturnSelection = selections.find(
    (selection) => selection.strategyKey === "alternate_return_city_exploration"
  );
  const recommendationDateCoverageSelection = selections.find(
    (selection) => selection.strategyKey === "recommendation_date_coverage"
  );
  const stitchedSelection = selections.find(
    (selection) => selection.strategyKey === "stitched_value_probe"
  );

  if (
    !marketScanSelection ||
    !adaptiveCoverageSelection ||
    !multiCitySelection ||
    !anchoredMultiCitySelection ||
    !alternateReturnSelection ||
    !recommendationDateCoverageSelection ||
    !stitchedSelection ||
    !isMarketScanStrategySelection(marketScanSelection) ||
    !isAdaptiveCoverageMarketScanSelection(adaptiveCoverageSelection) ||
    !isMultiCityVerificationSelection(multiCitySelection) ||
    !isAnchoredMultiCitySearchSelection(anchoredMultiCitySelection) ||
    !isAlternateReturnCityExplorationSelection(alternateReturnSelection) ||
    !isRecommendationDateCoverageSelection(recommendationDateCoverageSelection) ||
    !isStitchedValueProbeSelection(stitchedSelection)
  ) {
    return null;
  }

  const marketDefaults = resolveMarketScanExecutionConfig(
    { searchIntensity } as const,
    marketScanSelection.config
  );
  const adaptiveCoverageDefaults = resolveAdaptiveCoverageExecutionConfig(
    { searchIntensity } as const,
    adaptiveCoverageSelection.config
  );
  const multiCityDefaults = resolveMultiCityVerificationExecutionConfig(
    { maxStops: sessionMaxStops, searchIntensity } as const,
    multiCitySelection.config
  );
  const anchoredMultiCityDefaults = resolveAnchoredMultiCitySearchExecutionConfig(
    { maxStops: sessionMaxStops, searchIntensity } as const,
    anchoredMultiCitySelection.config
  );
  const alternateReturnDefaults = resolveAlternateReturnCityExecutionConfig(
    { returnOriginMode: sessionReturnOriginMode, searchIntensity } as const,
    alternateReturnSelection.config
  );
  const alternateReturnIsAvailable = alternateReturnSelection.compatibility.isCompatible;
  const recommendationDateCoverageDefaults = resolveRecommendationDateCoverageExecutionConfig(
    { searchIntensity } as const,
    recommendationDateCoverageSelection.config
  );
  const stitchedDefaults = resolveStitchedValueProbeExecutionConfig(stitchedSelection.config);
  const multiCityIsAvailable = multiCitySelection.compatibility.isCompatible;
  const anchoredMultiCityIsAvailable = anchoredMultiCitySelection.compatibility.isCompatible;
  const stitchedPassIsAvailable = stitchedSelection.compatibility.isCompatible;
  const selectedBaselineKey = adaptiveCoverageSelection.enabled
    ? "adaptive_coverage_market_scan"
    : "price_first_market_scan";

  return (
    <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Search strategy
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">
            Line up multiple strategies for one scan
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Choose one baseline strategy first, then layer optional follow-on strategies after it.
            Each card shows what it expects as input, what it should hand off next, and which
            passes you can safely tune. Leaving a numeric field blank keeps the current{" "}
            <span className="font-semibold text-ink">{searchIntensity}</span> intensity default.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            The baseline choice is mutually exclusive. Optional follow-on strategies can still be
            combined when they are compatible with the session rules.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Outcome summaries now live in Overview, and detailed search evidence lives in Results,
            so this tab stays focused on strategy setup only.
          </p>
        </div>
      </div>

      <form id={formId} action={saveSessionStrategiesAction} className="mt-6 space-y-6">
        {formId ? (
          <SessionStickySaveTracker
            formId={formId}
            label="Save strategy configuration"
            showSavedState={showSavedState}
          />
        ) : null}
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <article className="rounded-[24px] bg-mist px-6 py-6">
          <StrategyHeader
            order={1}
            selection={marketScanSelection}
            stepLabel={marketScanSelection.enabled ? "Selected baseline" : "Baseline option"}
          />
          <p className="mt-3 text-sm leading-7 text-slate-700">{marketScanSelection.summary}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {marketScanSelection.description}
          </p>

          <StrategyFlowSummary
            expectedInputs={marketScanSelection.expectedInputs}
            expectedOutputs={marketScanSelection.expectedOutputs}
            focusLabel="Build the first trustworthy round-trip picture, expose recurring stopover clues from bounded return-option expansion, and surface the departure-date and airline signals that later strategies can reuse."
          />

          <div className="mt-5 space-y-4">
            <PassCard
              badges={["Required pass"]}
              detail="This is the opening pass for the run. It samples packaged round-trip fares across the allowed date window so the session starts with real market prices."
              summary="Starts broad by checking a spread of departure and return date pairs for packaged round trips."
              title="Direct sweep"
              toggle={
                <BaselineChoiceToggle
                  defaultChecked={selectedBaselineKey === "price_first_market_scan"}
                  description="Use the stable even-coverage baseline."
                  label="Choose this baseline"
                  value="price_first_market_scan"
                />
              }
              tooltip="The direct sweep is the first live Trip.com pass. It creates the base round-trip observations that later analysis and follow-on strategies depend on."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: sample{" "}
                <span className="font-semibold text-ink">{marketDefaults.directSweepLimit}</span>{" "}
                date pairs, keep{" "}
                <span className="font-semibold text-ink">
                  {marketDefaults.maxOutboundOptionsPerQuery}
                </span>{" "}
                cheapest distinct outbound options per query, and keep{" "}
                <span className="font-semibold text-ink">
                  {marketDefaults.maxReturnOptionsPerOutbound}
                </span>{" "}
                cheapest distinct return options for each outbound option.
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <OverrideInput
                  currentDefault={marketDefaults.directSweepLimit}
                  description="Controls how many departure and return date pairs the opening sweep should sample."
                  name="price_first_market_scan__directSweepLimitOverride"
                  title="Date pairs to sample first"
                  tooltip="A higher value widens the opening market scan and costs more live queries."
                  value={marketScanSelection.config.directSweepLimitOverride}
                />
                <OverrideInput
                  currentDefault={marketDefaults.maxOutboundOptionsPerQuery}
                  description="Controls how many distinct outbound choices to keep for each sampled date pair after near-duplicate cards are collapsed."
                  name="price_first_market_scan__maxOutboundOptionsPerQueryOverride"
                  title="Distinct outbound options to keep"
                  tooltip="The sweep now scans a broader sorted card set first, then keeps the cheapest distinct outbound options by price, airline, stopover location, and similar schedule."
                  value={marketScanSelection.config.maxOutboundOptionsPerQueryOverride}
                />
                <OverrideInput
                  currentDefault={marketDefaults.maxReturnOptionsPerOutbound}
                  description="Controls how many distinct return choices to keep for each outbound option after near-duplicate cards are collapsed."
                  name="price_first_market_scan__maxReturnOptionsPerOutboundOverride"
                  title="Distinct return options to keep"
                  tooltip="This keeps the cheapest distinct return combinations instead of stopping at the first raw block of similar cards."
                  value={marketScanSelection.config.maxReturnOptionsPerOutboundOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Optional pass", "Uses direct sweep winners"]}
              detail="After the direct sweep finishes, this pass opens a bounded set of the cheapest round-trip winners and drills one level deeper into their return choices. It is designed to discover recurring stopover cities and alternate return patterns without brute-forcing every cheap variant from the same family."
              summary="Expands deeper return choices from cheap winners, prioritising coverage across candidate families before repeating the same family again."
              title="Return option expansion"
              toggle={
                <PassToggle
                  defaultChecked={marketScanSelection.config.enableReturnOptionExpansion}
                  label="Run this pass"
                  name="price_first_market_scan__enableReturnOptionExpansion"
                />
              }
              tooltip="This pass is the bounded deep-inspection step for the baseline. It looks past the first visible return list so FlyEasy can learn which stopover cities and return-option families keep reappearing."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: expand up to{" "}
                <span className="font-semibold text-ink">
                  {marketDefaults.baselineReturnOptionExpansionTargetLimit}
                </span>{" "}
                baseline winner
                {marketDefaults.baselineReturnOptionExpansionTargetLimit === 1 ? "" : "s"}, and keep up to{" "}
                <span className="font-semibold text-ink">
                  {marketDefaults.baselineReturnOptionExpansionVariationLimit}
                </span>{" "}
                distinct deeper return option
                {marketDefaults.baselineReturnOptionExpansionVariationLimit === 1 ? "" : "s"} per expanded winner.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={marketDefaults.baselineReturnOptionExpansionTargetLimit}
                  description="Controls how many cheap baseline winners should be opened for deeper return-option inspection."
                  name="price_first_market_scan__returnOptionExpansionTargetLimitOverride"
                  title="Baseline winners to expand"
                  tooltip="The worker prioritises family coverage first, so this budget is spent across different airline and stopover patterns before it repeats the same family."
                  value={marketScanSelection.config.returnOptionExpansionTargetLimitOverride}
                />
                <OverrideInput
                  currentDefault={marketDefaults.baselineReturnOptionExpansionVariationLimit}
                  description="Controls how many distinct deeper return options to keep after a baseline winner is expanded."
                  name="price_first_market_scan__returnOptionExpansionVariationLimitOverride"
                  title="Distinct deeper return options to keep"
                  tooltip="This is the second-stage branch budget after a winner is opened. It should stay bounded so the baseline discovers recurring stopover clues without turning into an exhaustive deep search."
                  value={marketScanSelection.config.returnOptionExpansionVariationLimitOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Required pass", "No live query"]}
              detail="This pass reads the completed baseline queries and turns them into structured evidence: cheap departure trends, airline signals, and stopover observations from both the first sweep and any deeper return-option expansion."
              summary="Reads the first sweep and turns it into clues that the next strategies can act on."
              title="Pass 1 analysis"
              toggle={<PassToggle defaultChecked label="Required" />}
              tooltip="Pass 1 analysis is a local ranking step. It summarizes the first sweep so later strategies can reuse its evidence instead of guessing."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: promote up to{" "}
                <span className="font-semibold text-ink">
                  {marketDefaults.anchorDepartureDateLimit}
                </span>{" "}
                promising departure dates into follow-on work.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={marketDefaults.anchorDepartureDateLimit}
                  description="Controls how many promising departure dates this pass should send forward into anchored follow-up work."
                  name="price_first_market_scan__anchorDepartureDateLimitOverride"
                  title="Departure dates to promote"
                  tooltip="This is the size of the shortlist created from the first sweep. A larger shortlist gives the next pass more dates to revisit."
                  value={marketScanSelection.config.anchorDepartureDateLimitOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Optional pass", "Uses pass 1 clues"]}
              detail="When pass 1 finds departure dates that look unusually cheap, this pass keeps those departures fixed and tests fresh return dates around them."
              summary="Re-checks the strongest departure dates with more return-date combinations."
              title="Anchored departure follow-up"
              toggle={
                <PassToggle
                  defaultChecked={marketScanSelection.config.enableAnchoredDateFollowup}
                  label="Run this pass"
                  name="price_first_market_scan__enableAnchoredDateFollowup"
                />
              }
              tooltip="This pass narrows in on promising departure dates from pass 1 and explores additional return dates that the opening sweep did not cover."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: test{" "}
                <span className="font-semibold text-ink">
                  {marketDefaults.anchoredReturnSweepLimit}
                </span>{" "}
                extra return dates for each promoted departure date.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={marketDefaults.anchoredReturnSweepLimit}
                  description="Controls how many extra return dates to test for each promoted departure date."
                  name="price_first_market_scan__anchoredReturnSweepLimitOverride"
                  title="Return dates to test per promoted departure"
                  tooltip="Raising this deepens the search around each promising departure date. It increases precision, but also increases query cost."
                  value={marketScanSelection.config.anchoredReturnSweepLimitOverride}
                />
              </div>
            </PassCard>
          </div>
        </article>

        <article className="rounded-[24px] bg-mist px-6 py-6">
          <StrategyHeader
            order={1}
            selection={adaptiveCoverageSelection}
            stepLabel={adaptiveCoverageSelection.enabled ? "Selected baseline" : "Baseline option"}
          />
          <p className="mt-3 text-sm leading-7 text-slate-700">{adaptiveCoverageSelection.summary}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {adaptiveCoverageSelection.description}
          </p>

          <StrategyFlowSummary
            expectedInputs={adaptiveCoverageSelection.expectedInputs}
            expectedOutputs={adaptiveCoverageSelection.expectedOutputs}
            focusLabel="Start with a smaller seed sweep across the full date window, then spend the remaining direct-sweep budget adaptively using current-run rewards, undercovered date buckets, and weak priors from earlier runs in the same session."
          />

          <div className="mt-5 space-y-4">
            <PassCard
              badges={["Baseline pass", "Experimental"]}
              detail="This opening pass still covers the whole date window, but it does not follow a fixed pair order all the way through. It seeds the search with an even spread of date pairs, then chooses the remaining pairs adaptively based on which early queries looked cheapest, which departure buckets are still under-covered, and which dates have looked promising in prior runs of the same session."
              summary="Seeds the full date window first, then reallocates the remaining direct-sweep budget adaptively instead of following a fixed pair list."
              title="Adaptive direct sweep"
              toggle={
                <BaselineChoiceToggle
                  defaultChecked={selectedBaselineKey === "adaptive_coverage_market_scan"}
                  description="Use the experimental adaptive baseline."
                  label="Choose this baseline"
                  value="adaptive_coverage_market_scan"
                />
              }
              tooltip="This experimental baseline keeps the same Trip.com adapter, but changes the date-pair ordering so the later direct-sweep queries react to what the earlier ones found."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: run up to{" "}
                <span className="font-semibold text-ink">
                  {adaptiveCoverageDefaults.directSweepLimit}
                </span>{" "}
                direct-sweep queries, start with{" "}
                <span className="font-semibold text-ink">
                  {adaptiveCoverageDefaults.initialSeedSweepLimit}
                </span>{" "}
                evenly spread seed quer
                {adaptiveCoverageDefaults.initialSeedSweepLimit === 1 ? "y" : "ies"}, then choose the
                remaining pairs adaptively.
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <OverrideInput
                  currentDefault={adaptiveCoverageDefaults.directSweepLimit}
                  description="Controls the total direct-sweep budget for the adaptive baseline."
                  name="adaptive_coverage_market_scan__directSweepLimitOverride"
                  title="Total direct-sweep queries"
                  tooltip="This is the total date-pair budget for the adaptive baseline. The strategy spends the first part on coverage, then reallocates the rest adaptively."
                  value={adaptiveCoverageSelection.config.directSweepLimitOverride}
                />
                <OverrideInput
                  currentDefault={adaptiveCoverageDefaults.initialSeedSweepLimit}
                  description="Controls how many evenly spread seed queries should run before the adaptive pair selector starts reacting to early results."
                  name="adaptive_coverage_market_scan__initialSeedSweepLimitOverride"
                  title="Initial seed sweep size"
                  tooltip="A higher value gives the adaptive baseline a broader first read on the market before it starts exploiting early signals."
                  value={adaptiveCoverageSelection.config.initialSeedSweepLimitOverride}
                />
                <OverrideInput
                  currentDefault={adaptiveCoverageDefaults.maxOutboundOptionsPerQuery}
                  description="Controls how many distinct outbound choices to keep for each adaptive date-pair query."
                  name="adaptive_coverage_market_scan__maxOutboundOptionsPerQueryOverride"
                  title="Distinct outbound options to keep"
                  tooltip="The adaptive baseline still collapses near-duplicate cards. This controls how many distinct outbound candidates remain per query."
                  value={adaptiveCoverageSelection.config.maxOutboundOptionsPerQueryOverride}
                />
                <OverrideInput
                  currentDefault={adaptiveCoverageDefaults.maxReturnOptionsPerOutbound}
                  description="Controls how many distinct return choices to keep for each outbound option."
                  name="adaptive_coverage_market_scan__maxReturnOptionsPerOutboundOverride"
                  title="Distinct return options to keep"
                  tooltip="This is the return-side branch budget for each adaptive query."
                  value={adaptiveCoverageSelection.config.maxReturnOptionsPerOutboundOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Optional pass", "Uses adaptive winners"]}
              detail="This pass is the same deeper-return inspection stage used by the default baseline, but it works from the adaptive baseline winners instead. It still prioritises family coverage before it repeats the same family."
              summary="Opens a bounded set of adaptive-baseline winners to inspect deeper return options and recurring stopover clues."
              title="Return option expansion"
              toggle={
                <PassToggle
                  defaultChecked={adaptiveCoverageSelection.config.enableReturnOptionExpansion}
                  label="Run this pass"
                  name="adaptive_coverage_market_scan__enableReturnOptionExpansion"
                />
              }
              tooltip="This keeps the experimental baseline comparable to the default baseline by reusing the same bounded deep-return inspection pass."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={adaptiveCoverageDefaults.baselineReturnOptionExpansionTargetLimit}
                  description="Controls how many adaptive-baseline winners should be opened for deeper return-option inspection."
                  name="adaptive_coverage_market_scan__returnOptionExpansionTargetLimitOverride"
                  title="Baseline winners to expand"
                  tooltip="This budget is still spent across distinct candidate families before the same family is revisited."
                  value={adaptiveCoverageSelection.config.returnOptionExpansionTargetLimitOverride}
                />
                <OverrideInput
                  currentDefault={adaptiveCoverageDefaults.baselineReturnOptionExpansionVariationLimit}
                  description="Controls how many distinct deeper return options to keep after an adaptive-baseline winner is expanded."
                  name="adaptive_coverage_market_scan__returnOptionExpansionVariationLimitOverride"
                  title="Distinct deeper return options to keep"
                  tooltip="This is the return-side branch budget after a winner is opened."
                  value={adaptiveCoverageSelection.config.returnOptionExpansionVariationLimitOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Required pass", "No live query"]}
              detail="This pass reads the adaptive direct-sweep results and turns them into structured evidence for later strategies."
              summary="Analyses the adaptive baseline so later strategies can reuse the same departure-date, airline, and stopover clues."
              title="Pass 1 analysis"
              toggle={<PassToggle defaultChecked label="Runs with this baseline" />}
              tooltip="The adaptive baseline still uses the same pass-1 evidence layer as the default baseline."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={adaptiveCoverageDefaults.anchorDepartureDateLimit}
                  description="Controls how many promising departure dates this pass should promote into anchored follow-up work."
                  name="adaptive_coverage_market_scan__anchorDepartureDateLimitOverride"
                  title="Departure dates to promote"
                  tooltip="This is the size of the shortlist the adaptive baseline hands to anchored follow-up."
                  value={adaptiveCoverageSelection.config.anchorDepartureDateLimitOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Optional pass", "Uses adaptive clues"]}
              detail="This pass is still the same anchored departure follow-up stage, but it consumes the adaptive baseline clues instead of the default baseline clues."
              summary="Re-checks the strongest adaptive-baseline departure dates with more return-date combinations."
              title="Anchored departure follow-up"
              toggle={
                <PassToggle
                  defaultChecked={adaptiveCoverageSelection.config.enableAnchoredDateFollowup}
                  label="Run this pass"
                  name="adaptive_coverage_market_scan__enableAnchoredDateFollowup"
                />
              }
              tooltip="Keeping this pass optional makes it easier to compare whether the adaptive direct sweep alone is already finding enough of the useful date space."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={adaptiveCoverageDefaults.anchoredReturnSweepLimit}
                  description="Controls how many extra return dates to test for each promoted departure date."
                  name="adaptive_coverage_market_scan__anchoredReturnSweepLimitOverride"
                  title="Return dates to test per promoted departure"
                  tooltip="Use this to compare whether the adaptive baseline still benefits from a dedicated anchored pass afterwards."
                  value={adaptiveCoverageSelection.config.anchoredReturnSweepLimitOverride}
                />
              </div>
            </PassCard>
          </div>
        </article>

        <article className="rounded-[24px] bg-mist px-6 py-6">
          <StrategyHeader order={2} selection={multiCitySelection} stepLabel="Optional strategy" />
          <p className="mt-3 text-sm leading-7 text-slate-700">{multiCitySelection.summary}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {multiCitySelection.description}
          </p>

          <StrategyFlowSummary
            expectedInputs={multiCitySelection.expectedInputs}
            expectedOutputs={multiCitySelection.expectedOutputs}
            focusLabel="Verify whether the round-trip baseline uncovered stopover cities that deserve a dedicated multi-city or longer-stop strategy next."
          />

          <div className="mt-5 space-y-4">
            <PassCard
              badges={["Optional pass", "Needs stopovers"]}
              detail="This strategy now starts by reviewing bounded family-city seed contexts from the baseline handoff, checking which stopover cities stay cheap across those contexts, and comparing them against the strongest departure-date, return-date, and airline trends before it verifies them live."
              note={multiCitySelection.compatibility.reason ?? undefined}
              summary="Reviews bounded baseline seed contexts, ranks the strongest stopover clues, then verifies the best cities live."
              title="Stopover city verification"
              toggle={
                <PassToggle
                  defaultChecked={multiCitySelection.enabled}
                  disabled={!multiCityIsAvailable}
                  label={multiCityIsAvailable ? "Run this strategy" : "Unavailable"}
                  name="multi_city_verification__enabled"
                />
              }
              tooltip="This strategy is now separate from the baseline so stopover work can evolve independently into a fuller multi-city verification cluster."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: review{" "}
                <span className="font-semibold text-ink">
                  {multiCityDefaults.candidateReviewLimit}
                </span>{" "}
                baseline seed contexts, then verify{" "}
                <span className="font-semibold text-ink">
                  {multiCityDefaults.followupCityLimit}
                </span>{" "}
                stopover cities from that evidence, testing up to{" "}
                <span className="font-semibold text-ink">
                  {multiCityDefaults.seedContextsPerCityLimit}
                </span>{" "}
                context{multiCityDefaults.seedContextsPerCityLimit === 1 ? "" : "s"} per city.
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <OverrideInput
                  currentDefault={multiCityDefaults.candidateReviewLimit}
                  description="Controls how many baseline seed contexts this strategy should inspect before it ranks stopover cities."
                  name="multi_city_verification__candidateReviewLimitOverride"
                  title="Baseline contexts to review"
                  tooltip="This is the size of the evidence set the strategy uses when it looks for repeated stopover cities, cheap date combinations, and low-price airline patterns across the baseline handoff."
                  value={multiCitySelection.config.candidateReviewLimitOverride}
                />
                <OverrideInput
                  currentDefault={multiCityDefaults.followupCityLimit}
                  description="Controls how many stopover cities from the ranked evidence board this strategy should verify first."
                  name="multi_city_verification__followupCityLimitOverride"
                  title="Stopover cities to verify"
                  tooltip="A higher value widens the multi-city verification cluster. This is the first bounded step before deeper city-specific work is introduced."
                  value={multiCitySelection.config.followupCityLimitOverride}
                />
                <OverrideInput
                  currentDefault={multiCityDefaults.seedContextsPerCityLimit}
                  description="Controls how many distinct baseline contexts this strategy should test for each selected stopover city."
                  name="multi_city_verification__seedContextsPerCityLimitOverride"
                  title="Contexts to test per city"
                  tooltip="Use this to let the strategy test more than one family/date clue for the same city. That helps it avoid overcommitting to one cheap baseline family when another context may produce a better multi-city result."
                  value={multiCitySelection.config.seedContextsPerCityLimitOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Included pass", "Analysis only"]}
              detail="After the live city verification finishes, this pass checks whether the verified cities are showing stop durations that are long enough to justify a dedicated longer-stop search next."
              summary="Scores the verified cities for long-stop readiness before any deeper follow-up is added."
              title="Long-stop validation"
              toggle={<PassToggle defaultChecked={multiCitySelection.enabled} label="Runs with this strategy" />}
              tooltip="This pass does not hit Trip.com again. It analyses the verified multi-city results and flags which cities are most ready for a longer-stop strategy."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: treat{" "}
                <span className="font-semibold text-ink">
                  {multiCityDefaults.longStopValidationMinHours}
                </span>{" "}
                hours as the minimum stop length worth escalating into a dedicated long-stop probe.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={multiCityDefaults.longStopValidationMinHours}
                  description="Controls the minimum observed stop length that counts as promising for a dedicated long-stop follow-up."
                  name="multi_city_verification__longStopValidationMinHoursOverride"
                  title="Minimum stop length to treat as promising"
                  tooltip="This threshold helps the analysis separate cities that only show short connections from cities that may support a more intentional longer-stop strategy."
                  value={multiCitySelection.config.longStopValidationMinHoursOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Included pass", "Live query"]}
              detail="Once a city passes the readiness check, this pass reruns the stopover filter with a minimum stop-duration target. That means it keeps only candidates that actually show a longer stop instead of just hinting that one might exist."
              summary="Runs a dedicated longer-stop query for the most promising cities and keeps only candidates that cross the stop-length target."
              title="Long-stop follow-up"
              toggle={<PassToggle defaultChecked={multiCitySelection.enabled} label="Runs with this strategy" />}
              tooltip="This pass reuses the stopover-city query path, but applies a minimum stop-duration threshold so the cluster can surface true longer-stop candidates."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: deepen up to{" "}
                <span className="font-semibold text-ink">
                  {multiCityDefaults.longStopFollowupCityLimit}
                </span>{" "}
                city{multiCityDefaults.longStopFollowupCityLimit === 1 ? "" : "ies"} with a target
                stop length of at least{" "}
                <span className="font-semibold text-ink">
                  {multiCityDefaults.longStopValidationMinHours}
                </span>{" "}
                hours.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={multiCityDefaults.longStopFollowupCityLimit}
                  description="Controls how many promising cities should get a dedicated long-stop query after validation."
                  name="multi_city_verification__longStopFollowupCityLimitOverride"
                  title="Cities to deepen with long-stop search"
                  tooltip="This is the final bounded step in the cluster. It should stay small so the strategy only spends extra live queries on the strongest cities."
                  value={multiCitySelection.config.longStopFollowupCityLimitOverride}
                />
              </div>
            </PassCard>
          </div>
        </article>

        <article className="rounded-[24px] bg-mist px-6 py-6">
          <StrategyHeader
            order={3}
            selection={anchoredMultiCitySelection}
            stepLabel="Optional strategy"
          />
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {anchoredMultiCitySelection.summary}
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {anchoredMultiCitySelection.description}
          </p>

          <StrategyFlowSummary
            expectedInputs={anchoredMultiCitySelection.expectedInputs}
            expectedOutputs={anchoredMultiCitySelection.expectedOutputs}
            focusLabel="Convert the strongest baseline stopover clues into real three-leg Trip.com searches, keep the original departure and final return dates anchored, and test a bounded spread of stopover dates inside the session stop window."
          />

          <div className="mt-5 space-y-4">
            <PassCard
              badges={["Optional pass", "Live multi-city"]}
              detail="This strategy does not replay round-trip result pages. It takes the strongest baseline city and family clues, anchors the baseline departure and return dates, then opens Trip.com's true multi-city flow and varies the stopover departure date inside the session stop window."
              note={anchoredMultiCitySelection.compatibility.reason ?? undefined}
              summary="Runs bounded true multi-city searches from the best baseline clues."
              title="Anchored multi-city search"
              toggle={
                <PassToggle
                  defaultChecked={anchoredMultiCitySelection.enabled}
                  disabled={!anchoredMultiCityIsAvailable}
                  label={anchoredMultiCityIsAvailable ? "Run this strategy" : "Unavailable"}
                  name="anchored_multi_city_search__enabled"
                />
              }
              tooltip="Use this when you want FlyEasy to stop inferring stopover value from round-trip pages and instead try the same city as a real multi-city stop with the baseline dates kept in place."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: review{" "}
                <span className="font-semibold text-ink">
                  {anchoredMultiCityDefaults.candidateReviewLimit}
                </span>{" "}
                baseline contexts, probe{" "}
                <span className="font-semibold text-ink">
                  {anchoredMultiCityDefaults.followupCityLimit}
                </span>{" "}
                cit{anchoredMultiCityDefaults.followupCityLimit === 1 ? "y" : "ies"}, test{" "}
                <span className="font-semibold text-ink">
                  {anchoredMultiCityDefaults.seedContextsPerCityLimit}
                </span>{" "}
                context{anchoredMultiCityDefaults.seedContextsPerCityLimit === 1 ? "" : "s"} per
                city, sample{" "}
                <span className="font-semibold text-ink">
                  {anchoredMultiCityDefaults.dateVariationLimit}
                </span>{" "}
                stopover date variation
                {anchoredMultiCityDefaults.dateVariationLimit === 1 ? "" : "s"} per context, and
                keep up to{" "}
                <span className="font-semibold text-ink">
                  {anchoredMultiCityDefaults.segmentOptionLimit}
                </span>{" "}
                distinct option
                {anchoredMultiCityDefaults.segmentOptionLimit === 1 ? "" : "s"} per Trip.com
                segment stage.
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <OverrideInput
                  currentDefault={anchoredMultiCityDefaults.candidateReviewLimit}
                  description="Controls how many baseline family-city contexts this strategy should inspect before choosing which ones become true multi-city probes."
                  name="anchored_multi_city_search__candidateReviewLimitOverride"
                  title="Baseline contexts to review"
                  tooltip="This is the size of the baseline handoff pool the strategy considers before it chooses which city and date clues should graduate into the real multi-city adapter."
                  value={anchoredMultiCitySelection.config.candidateReviewLimitOverride}
                />
                <OverrideInput
                  currentDefault={anchoredMultiCityDefaults.followupCityLimit}
                  description="Controls how many stopover cities should be converted into true multi-city searches first."
                  name="anchored_multi_city_search__followupCityLimitOverride"
                  title="Cities to convert"
                  tooltip="Keep this bounded. Each city multiplies into several date and segment combinations once the true multi-city search starts."
                  value={anchoredMultiCitySelection.config.followupCityLimitOverride}
                />
                <OverrideInput
                  currentDefault={anchoredMultiCityDefaults.seedContextsPerCityLimit}
                  description="Controls how many distinct baseline family contexts to keep for each selected city."
                  name="anchored_multi_city_search__seedContextsPerCityLimitOverride"
                  title="Contexts to keep per city"
                  tooltip="This stops one cheap baseline family from monopolising a city. If another family exposed the same city with better date or airline context, FlyEasy can try that too."
                  value={anchoredMultiCitySelection.config.seedContextsPerCityLimitOverride}
                />
                <OverrideInput
                  currentDefault={anchoredMultiCityDefaults.dateVariationLimit}
                  description="Controls how many stopover departure dates to test inside the allowed stop-duration window for each selected context."
                  name="anchored_multi_city_search__dateVariationLimitOverride"
                  title="Stopover date variations"
                  tooltip="The strategy keeps the baseline departure and final return dates anchored, then samples this many stopover departure dates between the minimum and maximum stop duration."
                  value={anchoredMultiCitySelection.config.dateVariationLimitOverride}
                />
                <OverrideInput
                  currentDefault={anchoredMultiCityDefaults.segmentOptionLimit}
                  description="Controls how many distinct options to keep at each of the three Trip.com segment stages."
                  name="anchored_multi_city_search__segmentOptionLimitOverride"
                  title="Segment options per stage"
                  tooltip="This is the main runtime brake for the true multi-city adapter. A value of 2 means FlyEasy can try up to 2 outbound options, 2 middle-leg options, and 2 final-return options per anchored date combination."
                  value={anchoredMultiCitySelection.config.segmentOptionLimitOverride}
                />
              </div>
            </PassCard>
          </div>
        </article>

        <article className="rounded-[24px] bg-mist px-6 py-6">
          <StrategyHeader order={4} selection={alternateReturnSelection} stepLabel="Optional strategy" />
          <p className="mt-3 text-sm leading-7 text-slate-700">{alternateReturnSelection.summary}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {alternateReturnSelection.description}
          </p>

          <StrategyFlowSummary
            expectedInputs={alternateReturnSelection.expectedInputs}
            expectedOutputs={alternateReturnSelection.expectedOutputs}
            focusLabel="Compare a small set of alternate mainland cities when the session allows flexible return-origin planning. This is a bounded round-trip comparison, not a true open-jaw search."
          />

          <div className="mt-5 space-y-4">
            <PassCard
              badges={["Optional pass", "Live query"]}
              detail="This pass does not try to fake a true open-jaw search. Instead, it picks a small set of alternate mainland cities from the baseline and multi-city evidence, then runs bounded round-trip comparison queries for those cities."
              note={alternateReturnSelection.compatibility.reason ?? undefined}
              summary="Compares a small set of alternate mainland cities as round-trip probes when flexible return-origin planning is allowed."
              title="Alternate city comparison"
              toggle={
                <PassToggle
                  defaultChecked={alternateReturnSelection.enabled}
                  disabled={!alternateReturnIsAvailable}
                  label={alternateReturnIsAvailable ? "Run this strategy" : "Unavailable"}
                  name="alternate_return_city_exploration__enabled"
                />
              }
              tooltip="This cluster is intentionally honest about the current adapter. It uses bounded round-trip comparisons to identify promising alternate return-origin cities without claiming to be a true open-jaw search."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: compare up to{" "}
                <span className="font-semibold text-ink">
                  {alternateReturnDefaults.candidateCityLimit}
                </span>{" "}
                alternate cit{alternateReturnDefaults.candidateCityLimit === 1 ? "y" : "ies"}, using up to{" "}
                <span className="font-semibold text-ink">
                  {alternateReturnDefaults.datePairLimit}
                </span>{" "}
                date pair{alternateReturnDefaults.datePairLimit === 1 ? "" : "s"} per city.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={alternateReturnDefaults.candidateCityLimit}
                  description="Controls how many alternate mainland cities the strategy should compare."
                  name="alternate_return_city_exploration__candidateCityLimitOverride"
                  title="Alternate cities to compare"
                  tooltip="Keep this small. The cluster is meant to answer whether alternate cities look promising, not to brute-force every mainland option."
                  value={alternateReturnSelection.config.candidateCityLimitOverride}
                />
                <OverrideInput
                  currentDefault={alternateReturnDefaults.datePairLimit}
                  description="Controls how many date-pair comparisons to run for each alternate city."
                  name="alternate_return_city_exploration__datePairLimitOverride"
                  title="Date pairs to compare per city"
                  tooltip="The strategy reuses the strongest baseline departure clues, then tests a bounded set of date pairs for each alternate city."
                  value={alternateReturnSelection.config.datePairLimitOverride}
                />
              </div>
            </PassCard>

            <PassCard
              badges={["Included pass", "Analysis only"]}
              detail="After the live city comparisons finish, this pass writes a comparison board so the session can show which alternate cities looked strongest and why they were chosen."
              summary="Summarises the alternate-city comparison results so later strategy work can reuse them."
              title="Comparison summary"
              toggle={<PassToggle defaultChecked={alternateReturnSelection.enabled} label="Runs with this strategy" />}
              tooltip="This pass records a reusable summary of the alternate-city comparison board for the session UI and future planning work."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                The summary pass explains which cities were compared, how many queries each city consumed, and the cheapest fares that came back from the bounded comparison.
              </div>
            </PassCard>
          </div>
        </article>

        <article className="rounded-[24px] bg-mist px-6 py-6">
          <StrategyHeader
            order={5}
            selection={recommendationDateCoverageSelection}
            stepLabel="Optional strategy"
          />
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {recommendationDateCoverageSelection.summary}
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {recommendationDateCoverageSelection.description}
          </p>

          <StrategyFlowSummary
            expectedInputs={recommendationDateCoverageSelection.expectedInputs}
            expectedOutputs={recommendationDateCoverageSelection.expectedOutputs}
            focusLabel="Densify nearby date flexibility for the strongest recommendation routes after the earlier discovery and comparison clusters finish. This improves the endpoint pickers without spending baseline budget on broad new discovery."
          />

          <div className="mt-5 space-y-4">
            <PassCard
              badges={["Optional pass", "Late-stage densification"]}
              detail="This pass is deliberately late in the program. It waits for the earlier discovery and comparison clusters to reveal which route families are actually worth caring about, then spends a small bounded budget filling nearby date variants so the recommendation cards have more usable local flexibility."
              summary="Fills nearby date variants for the strongest recommendation families instead of hunting for brand-new route ideas."
              title="Recommendation date coverage"
              toggle={
                <PassToggle
                  defaultChecked={recommendationDateCoverageSelection.enabled}
                  label="Run this strategy"
                  name="recommendation_date_coverage__enabled"
                />
              }
              tooltip="Use this when you want FlyEasy to spend some of the late-stage budget improving recommendation-card flexibility. It is a product-support pass, not another baseline or route-discovery pass."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: review{" "}
                <span className="font-semibold text-ink">
                  {recommendationDateCoverageDefaults.candidateReviewLimit}
                </span>{" "}
                promising route families, densify up to{" "}
                <span className="font-semibold text-ink">
                  {recommendationDateCoverageDefaults.routeTargetLimit}
                </span>{" "}
                of them, and probe up to{" "}
                <span className="font-semibold text-ink">
                  {recommendationDateCoverageDefaults.dateVariationLimit}
                </span>{" "}
                nearby date variation
                {recommendationDateCoverageDefaults.dateVariationLimit === 1 ? "" : "s"} per
                selected route.
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <OverrideInput
                  currentDefault={recommendationDateCoverageDefaults.candidateReviewLimit}
                  description="Controls how many promising route families from earlier strategies this pass should inspect before choosing which ones deserve extra date coverage."
                  name="recommendation_date_coverage__candidateReviewLimitOverride"
                  title="Route families to review"
                  tooltip="This is the size of the earlier-results handoff pool. A higher value lets the pass consider more winners before it picks which routes deserve densification."
                  value={recommendationDateCoverageSelection.config.candidateReviewLimitOverride}
                />
                <OverrideInput
                  currentDefault={recommendationDateCoverageDefaults.routeTargetLimit}
                  description="Controls how many route families this pass should actually densify once it finishes reviewing the earlier winners."
                  name="recommendation_date_coverage__routeTargetLimitOverride"
                  title="Routes to densify"
                  tooltip="Keep this small. The goal is to improve date flexibility on the strongest recommendation routes, not to re-run the whole search program."
                  value={recommendationDateCoverageSelection.config.routeTargetLimitOverride}
                />
                <OverrideInput
                  currentDefault={recommendationDateCoverageDefaults.dateVariationLimit}
                  description="Controls how many nearby date variations to probe for each selected route family."
                  name="recommendation_date_coverage__dateVariationLimitOverride"
                  title="Nearby date variations"
                  tooltip="Round-trip routes use this to probe nearby departure and return pairs. Multi-city routes use it to probe nearby anchored stopover dates."
                  value={recommendationDateCoverageSelection.config.dateVariationLimitOverride}
                />
              </div>
            </PassCard>
          </div>
        </article>

        <article className="rounded-[24px] bg-mist px-6 py-6">
          <StrategyHeader order={6} selection={stitchedSelection} stepLabel="Optional strategy" />
          <p className="mt-3 text-sm leading-7 text-slate-700">{stitchedSelection.summary}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">{stitchedSelection.description}</p>

          <StrategyFlowSummary
            expectedInputs={stitchedSelection.expectedInputs}
            expectedOutputs={stitchedSelection.expectedOutputs}
            focusLabel="Compare packaged winners against a bounded stitched-style estimate after the earlier packaged strategies have done their work."
          />

          <div className="mt-5 space-y-4">
            <PassCard
              badges={["Optional pass", "Synthetic today"]}
              detail="This pass runs after the packaged strategies and creates a small stitched comparison set from the packaged winners. It helps you judge whether stitched booking might be worth pursuing, but it is not yet a live stitched-search adapter."
              note={stitchedSelection.compatibility.reason ?? undefined}
              summary="Adds a bounded stitched comparison after the earlier packaged strategies finish."
              title="Stitched comparison follow-up"
              toggle={
                <PassToggle
                  defaultChecked={stitchedSelection.enabled}
                  disabled={!stitchedPassIsAvailable}
                  label={stitchedPassIsAvailable ? "Run this strategy" : "Unavailable"}
                  name="stitched_value_probe__enabled"
                />
              }
              tooltip="This pass is still a derived comparison, not a live stitched search. It estimates stitched-style upside from packaged results within a small, bounded budget."
            >
              <div className="rounded-[18px] border border-dashed border-line bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                Current default for this session: derive{" "}
                <span className="font-semibold text-ink">
                  {stitchedDefaults.maxDerivedCandidates}
                </span>{" "}
                stitched comparisons with a synthetic discount multiplier of{" "}
                <span className="font-semibold text-ink">{stitchedDefaults.discountRate}</span>.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideInput
                  currentDefault={stitchedDefaults.maxDerivedCandidates}
                  description="Controls how many stitched comparison candidates to derive from the packaged winners."
                  name="stitched_value_probe__maxDerivedCandidatesOverride"
                  title="Stitched comparisons to derive"
                  tooltip="A higher value creates more stitched-style comparison candidates after the packaged scan completes."
                  value={stitchedSelection.config.maxDerivedCandidatesOverride}
                />
                <OverrideInput
                  currentDefault={stitchedDefaults.discountRate}
                  description="Controls the temporary synthetic discount multiplier used by the placeholder stitched comparison."
                  max="1"
                  min="0.75"
                  name="stitched_value_probe__discountRateOverride"
                  step="0.01"
                  title="Synthetic stitched discount"
                  tooltip="This is a temporary estimation lever. A value of 0.90 means the synthetic stitched comparison is treated as 10 percent cheaper than the packaged baseline."
                  value={stitchedSelection.config.discountRateOverride}
                />
              </div>
            </PassCard>
          </div>
        </article>

        <article className="rounded-[24px] border border-dashed border-line bg-white px-6 py-6">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
                Strategy experiments
              </p>
              <InfoTooltip
                content="This is a manual testing mode for baseline strategy comparison. Instead of launching one baseline arm, FlyEasy can queue a small experiment suite, run one live worker at a time, and compare the resulting runs afterwards."
                label="About strategy experiments"
              />
            </div>
            <h3 className="mt-3 text-lg font-semibold text-ink">Queued baseline comparison</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Turn this on when you want manual scans to run a small champion-versus-challenger
              baseline experiment instead of a single baseline. FlyEasy keeps the currently
              selected baseline as the champion arm, randomly samples additional compatible
              baseline arms as challengers, runs them through the live-worker queue, and stores
              the grouped comparison so Overview and Results can track what is winning over time.
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              This is intentionally limited to baseline strategies for now. It is designed to
              refine search efficiency without mixing different follow-on strategy families into
              the same experiment.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="rounded-[20px] bg-mist px-5 py-5">
              <input type="hidden" name="strategyExperimentMode" value="off" />
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span>Enable queued baseline experiment mode</span>
                    <InfoTooltip
                      content="When enabled, Start baseline run and Rerun now will create a small experiment suite instead of one baseline run. Each arm is still a separate run, and the queue will process one live worker at a time so results stay auditable."
                      label="About baseline experiment mode"
                    />
                  </span>
                  <p className="text-sm leading-7 text-slate-600">
                    Manual scans will queue multiple baseline arms, run them one at a time,
                    compare them afterwards, and keep the outcomes grouped as one experiment
                    suite.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-3">
                  <span className="relative inline-flex h-6 w-11 shrink-0">
                    <input
                      type="checkbox"
                      name="strategyExperimentMode"
                      value="baseline_parallel_random"
                      defaultChecked={strategyExperimentMode === "baseline_parallel_random"}
                      className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none relative inline-flex h-6 w-11 rounded-full bg-slate-300 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-sea peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sea"
                    />
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {strategyExperimentMode === "baseline_parallel_random" ? "Enabled" : "Off"}
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-[20px] bg-mist px-5 py-5">
              <OverrideInput
                currentDefault={strategyExperimentSampleSize}
                description="Controls how many baseline arms should be queued in one manual experiment suite, including the currently selected champion baseline."
                max="4"
                min="2"
                name="strategyExperimentSampleSize"
                title="Baseline arms per experiment"
                tooltip="Use 2 for a simple champion-versus-challenger comparison. Higher values are reserved for future sessions where more than two compatible baseline strategies exist."
                value={strategyExperimentSampleSize}
              />
            </div>
          </div>

          <div className="mt-4 rounded-[20px] border border-dashed border-line bg-mist px-4 py-4 text-sm leading-7 text-slate-600">
            Current mode:{" "}
            <span className="font-semibold text-ink">
              {strategyExperimentMode === "baseline_parallel_random"
                ? "Queued baseline experiment"
                : "Single baseline run"}
            </span>
            . The active baseline choice above remains the champion arm whenever experiment mode is
            enabled.
          </div>
        </article>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-sea px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Save strategy configuration
          </button>
        </div>
      </form>
    </section>
  );
}
