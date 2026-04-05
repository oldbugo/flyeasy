/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#102033",
        mist: "#edf2f7",
        sea: "#0c6b58",
        ember: "#d66b2c",
        line: "#d6dee8"
      }
    }
  },
  plugins: []
};
