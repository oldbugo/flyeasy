function normalizeAirlineText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const CHINA_BASED_AIRLINE_CODES = new Set([
  "3U",
  "8L",
  "9C",
  "AQ",
  "BK",
  "CA",
  "CZ",
  "EU",
  "FM",
  "G5",
  "GJ",
  "GS",
  "GT",
  "HO",
  "HU",
  "JD",
  "JR",
  "KN",
  "KY",
  "MF",
  "MU",
  "NS",
  "OQ",
  "PN",
  "QW",
  "SC",
  "TV",
  "UQ",
  "ZH"
]);

export const CHINA_BASED_AIRLINE_NAMES = new Set(
  [
    "9 air",
    "air china",
    "beijing capital airlines",
    "chengdu airlines",
    "china eastern airlines",
    "china express airlines",
    "china southern airlines",
    "china united airlines",
    "chongqing airlines",
    "colorful guizhou airlines",
    "donghai airlines",
    "fuzhou airlines",
    "grand china air",
    "guangxi beibu gulf airlines",
    "guangxi beibu gulf air",
    "guangxi beibu gulf",
    "guangxi beibu gulf airlines co ltd",
    "guangxi airlines",
    "hainan airlines",
    "hebei airlines",
    "juneyao air",
    "kunming airlines",
    "loong air",
    "lucky air",
    "okay airways",
    "qingdao airlines",
    "shandong airlines",
    "shanghai airlines",
    "shenzhen airlines",
    "spring airlines",
    "sichuan airlines",
    "suparna airlines",
    "tianjin airlines",
    "west air",
    "xiamenair",
    "xiamen airlines"
  ].map(normalizeAirlineText)
);

export function isChinaBasedAirline({ airlineCode, airlineName, operatingAirlineName } = {}) {
  const normalizedCode = String(airlineCode ?? "").trim().toUpperCase();

  if (normalizedCode && CHINA_BASED_AIRLINE_CODES.has(normalizedCode)) {
    return true;
  }

  const normalizedNames = [
    normalizeAirlineText(airlineName),
    normalizeAirlineText(operatingAirlineName)
  ].filter(Boolean);

  return normalizedNames.some((name) => CHINA_BASED_AIRLINE_NAMES.has(name));
}
