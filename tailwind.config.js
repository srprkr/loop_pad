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
      // The count-in number pops in on each beat.
      keyframes: {
        "countdown-pop": {
          "0%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "countdown-pop": "countdown-pop 120ms ease-out",
      },
    },
  },
  plugins: [],
};
