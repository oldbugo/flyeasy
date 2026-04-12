export type SessionLoadingVariant =
  | "candidate"
  | "history"
  | "overview"
  | "results"
  | "run"
  | "settings"
  | "strategy";

export type SessionLoadingDescriptor = {
  description: string;
  steps: string[];
  title: string;
  variant: SessionLoadingVariant;
};

const sessionLoadingDescriptors: Record<SessionLoadingVariant, SessionLoadingDescriptor> = {
  candidate: {
    description:
      "Restoring the selected result, its route family, fare observations, and manual handoff details.",
    steps: [
      "Loading candidate summary",
      "Fetching leg and stopover detail",
      "Preparing shortlist and handoff actions"
    ],
    title: "Loading candidate detail",
    variant: "candidate"
  },
  history: {
    description:
      "Rebuilding the monitoring timeline, route-family continuity, and recent displayed-price observations for this session.",
    steps: [
      "Loading monitoring summary",
      "Collecting latest run history",
      "Rehydrating price and family panels"
    ],
    title: "Loading monitoring history",
    variant: "history"
  },
  overview: {
    description:
      "Preparing the selected tab and restoring the latest session data for this workspace.",
    steps: [
      "Restoring the latest session shell",
      "Loading page-specific records",
      "Hydrating the content pane"
    ],
    title: "Loading session content",
    variant: "overview"
  },
  results: {
    description:
      "Pulling the latest run progress, candidate groups, and analysis summaries for this results view.",
    steps: [
      "Fetching latest run progress",
      "Grouping candidate families",
      "Preparing the results surface"
    ],
    title: "Loading results",
    variant: "results"
  },
  run: {
    description:
      "Rebuilding run progress, strategy execution state, and any recovery controls tied to this run.",
    steps: [
      "Loading run status",
      "Restoring strategy progress",
      "Preparing recovery and action controls"
    ],
    title: "Loading run detail",
    variant: "run"
  },
  settings: {
    description:
      "Restoring the latest session settings, validation context, and session-control actions for this workspace.",
    steps: [
      "Loading saved trip constraints",
      "Preparing session control actions",
      "Rebuilding save and fork actions"
    ],
    title: "Loading session setting",
    variant: "settings"
  },
  strategy: {
    description:
      "Preparing strategy bundles, compiled program details, and AI proposal context for this session.",
    steps: [
      "Loading enabled strategy bundles",
      "Compiling search plan details",
      "Restoring proposal and tuning controls"
    ],
    title: "Loading search strategy",
    variant: "strategy"
  }
};

export function getSessionLoadingDescriptor(
  variant: SessionLoadingVariant
): SessionLoadingDescriptor {
  const descriptor = sessionLoadingDescriptors[variant];

  return {
    ...descriptor,
    steps: [...descriptor.steps]
  };
}

export function getSessionLoadingDescriptorForPath(pathname: string): SessionLoadingDescriptor {
  const normalizedPathname = normalizeInternalPath(pathname);
  const sessionId = getSessionIdFromPathname(normalizedPathname);

  if (!sessionId) {
    return getSessionLoadingDescriptor("overview");
  }

  const sessionBasePath = `/sessions/${sessionId}`;

  if (normalizedPathname === `${sessionBasePath}/results`) {
    return getSessionLoadingDescriptor("results");
  }

  if (normalizedPathname.startsWith(`${sessionBasePath}/candidates/`)) {
    return getSessionLoadingDescriptor("candidate");
  }

  if (normalizedPathname === `${sessionBasePath}/history`) {
    return getSessionLoadingDescriptor("history");
  }

  if (normalizedPathname.startsWith(`${sessionBasePath}/runs/`)) {
    return getSessionLoadingDescriptor("run");
  }

  if (normalizedPathname === `${sessionBasePath}/settings`) {
    return getSessionLoadingDescriptor("settings");
  }

  if (normalizedPathname === `${sessionBasePath}/strategy`) {
    return getSessionLoadingDescriptor("strategy");
  }

  return getSessionLoadingDescriptor("overview");
}

export function getSessionIdFromPathname(pathname: string) {
  const normalizedPathname = normalizeInternalPath(pathname);
  const match = normalizedPathname.match(/^\/sessions\/([^/]+)/);

  return match ? decodeURIComponent(match[1]) : null;
}

export function normalizeInternalPath(pathname: string) {
  if (!pathname) {
    return "/";
  }

  try {
    const url = new URL(pathname, "http://localhost");

    return url.pathname || "/";
  } catch {
    const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const [withoutHash] = normalized.split("#");
    const [withoutSearch] = withoutHash.split("?");

    return withoutSearch || "/";
  }
}
