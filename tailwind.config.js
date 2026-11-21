/** @type {import('tailwindcss').Config} */
export default {
  // hover: styles only on devices that can hover, so a tapped pad doesn't stay highlighted.
  future: { hoverOnlyWhenSupported: true },
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // In-between greys the original design used alongside Tailwind's zinc scale.
        zinc: {
          650: "#48484f",
          750: "#333338",
          850: "#1f1f22",
        },
      },
    },
  },
  plugins: [],
};
