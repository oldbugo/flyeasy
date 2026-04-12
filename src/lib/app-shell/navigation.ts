export const primaryNav = [
  { href: "/", icon: "house", label: "Home dashboard", matchPrefixes: ["/", "/sessions"] },
  { href: "/sessions/new", icon: "plus", label: "New session", matchPrefixes: ["/sessions/new"] },
  { href: "/settings", icon: "gear", label: "Settings", matchPrefixes: ["/settings"] }
] as const;
