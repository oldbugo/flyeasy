import airportData from "./data/airports.json";
import cityData from "./data/cities.json";

export type AirportCatalogEntry = {
  aliases: string[];
  cityName: string;
  code: string;
  country: string;
  displayName: string;
};

export type CityCatalogEntry = {
  aliases: string[];
  code: string;
  country: string;
  displayName: string;
};

export const airportCatalog = airportData as AirportCatalogEntry[];
export const cityCatalog = cityData as CityCatalogEntry[];

export type LocationResolution<T> =
  | { matches: T[]; reason: "empty" | "not_found"; status: "invalid" }
  | { match: T; status: "resolved" }
  | { matches: T[]; status: "ambiguous" };

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function uniqueByCode<T extends { code: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.code)) {
      return false;
    }
    seen.add(item.code);
    return true;
  });
}

function matchesAlias(query: string, aliases: string[]) {
  return aliases.some((alias) => alias.includes(query));
}

function exactAliasMatches<T extends { aliases: string[] }>(query: string, entries: T[]) {
  return entries.filter((entry) => entry.aliases.some((alias) => alias === query));
}

export function searchAirports(query: string) {
  const normalized = normalizeQuery(query);

  if (normalized.length === 0) {
    return airportCatalog;
  }

  return uniqueByCode(
    airportCatalog.filter(
      (entry) =>
        entry.code.toLowerCase().includes(normalized) ||
        entry.displayName.toLowerCase().includes(normalized) ||
        entry.cityName.toLowerCase().includes(normalized) ||
        matchesAlias(normalized, entry.aliases)
    )
  ).slice(0, 8);
}

export function resolveAirportInputDetailed(value: string): LocationResolution<AirportCatalogEntry> {
  const normalized = normalizeQuery(value);

  if (!normalized) {
    return {
      matches: [],
      reason: "empty",
      status: "invalid"
    };
  }

  const exactCodeMatches = airportCatalog.filter((entry) => entry.code.toLowerCase() === normalized);
  if (exactCodeMatches.length === 1) {
    return {
      match: exactCodeMatches[0],
      status: "resolved"
    };
  }

  const exactDisplayMatches = airportCatalog.filter(
    (entry) =>
      entry.displayName.toLowerCase() === normalized ||
      `${entry.displayName} (${entry.code})`.toLowerCase() === normalized
  );

  if (exactDisplayMatches.length === 1) {
    return {
      match: exactDisplayMatches[0],
      status: "resolved"
    };
  }

  const aliasMatches = exactAliasMatches(normalized, airportCatalog);
  if (aliasMatches.length === 1) {
    return {
      match: aliasMatches[0],
      status: "resolved"
    };
  }

  if (aliasMatches.length > 1) {
    return {
      matches: uniqueByCode(aliasMatches),
      status: "ambiguous"
    };
  }

  const searchMatches = searchAirports(value);
  if (searchMatches.length === 1) {
    return {
      match: searchMatches[0],
      status: "resolved"
    };
  }

  if (searchMatches.length > 1) {
    return {
      matches: searchMatches,
      status: "ambiguous"
    };
  }

  return {
    matches: [],
    reason: "not_found",
    status: "invalid"
  };
}

export function resolveAirportInput(value: string) {
  const result = resolveAirportInputDetailed(value);
  return result.status === "resolved" ? result.match : null;
}

export function searchCities(query: string) {
  const normalized = normalizeQuery(query);

  if (normalized.length === 0) {
    return cityCatalog;
  }

  return uniqueByCode(
    cityCatalog.filter(
      (entry) =>
        entry.code.toLowerCase().includes(normalized) ||
        entry.displayName.toLowerCase().includes(normalized) ||
        matchesAlias(normalized, entry.aliases)
    )
  ).slice(0, 10);
}

export function resolveCityInputDetailed(value: string): LocationResolution<CityCatalogEntry> {
  const normalized = normalizeQuery(value);

  if (!normalized) {
    return {
      matches: [],
      reason: "empty",
      status: "invalid"
    };
  }

  const exactCodeMatches = cityCatalog.filter((entry) => entry.code.toLowerCase() === normalized);
  if (exactCodeMatches.length === 1) {
    return {
      match: exactCodeMatches[0],
      status: "resolved"
    };
  }

  const exactDisplayMatches = cityCatalog.filter((entry) => entry.displayName.toLowerCase() === normalized);
  if (exactDisplayMatches.length === 1) {
    return {
      match: exactDisplayMatches[0],
      status: "resolved"
    };
  }

  const aliasMatches = exactAliasMatches(normalized, cityCatalog);
  if (aliasMatches.length === 1) {
    return {
      match: aliasMatches[0],
      status: "resolved"
    };
  }

  const searchMatches = searchCities(value);
  if (searchMatches.length === 1) {
    return {
      match: searchMatches[0],
      status: "resolved"
    };
  }

  if (searchMatches.length > 1) {
    return {
      matches: searchMatches,
      status: "ambiguous"
    };
  }

  return {
    matches: [],
    reason: "not_found",
    status: "invalid"
  };
}

export function resolveCityInput(value: string) {
  const result = resolveCityInputDetailed(value);
  return result.status === "resolved" ? result.match : null;
}

export function resolveCityList(values: string[]) {
  const resolved: string[] = [];
  const unknown: string[] = [];

  for (const value of values) {
    const match = resolveCityInput(value);
    if (!match) {
      unknown.push(value);
      continue;
    }

    if (!resolved.includes(match.code)) {
      resolved.push(match.code);
    }
  }

  return {
    resolved,
    unknown
  };
}
