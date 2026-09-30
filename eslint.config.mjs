import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      ".desktop-runtime/**",
      ".tmp/**",
      "node_modules/**",
      "release/**"
    ]
  }
];

export default config;
