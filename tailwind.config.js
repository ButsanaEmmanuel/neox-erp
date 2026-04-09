/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Semantic Tokens
                app: "rgb(var(--bg-app) / <alpha-value>)",
                surface: "rgb(var(--bg-surface) / <alpha-value>)",
                card: "rgb(var(--bg-card) / <alpha-value>)",
                popover: "rgb(var(--bg-popover) / <alpha-value>)",

                primary: "rgb(var(--text-primary) / <alpha-value>)",
                secondary: "rgb(var(--text-secondary) / <alpha-value>)",
                muted: {
                    DEFAULT: "rgb(var(--text-muted) / <alpha-value>)",
                    foreground: "rgb(var(--text-muted) / <alpha-value>)",
                },
                foreground: "rgb(var(--text-primary) / <alpha-value>)",

                border: "rgb(var(--border-base) / <alpha-value>)",
                input: "rgb(var(--border-strong) / <alpha-value>)",

                brand: {
                    DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
                    fg: "rgb(var(--color-primary-fg) / <alpha-value>)",
                },

                // Legacy (Keep for compatibility until refactor is complete)
                neox: {
                    obsidian: "#0d1117",
                    "dark-bg": "#0d1117",
                    "dark-card": "#111827",
                    "dark-sidebar": "#0d1117",
                    "dark-border": "#1f2937",
                    "dark-hover": "#1a2332",
                    emerald: "#10b981",
                    rose: "#f43f5e",
                    sky: "#3b82f6",
                    slate: {
                        400: "#94a3b8",
                        500: "#64748b",
                        600: "#475569",
                        900: "#0f172a"
                    }
                }
            },

            fontFamily: {
                inter: ["Inter", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            }
        },
    },
    plugins: [],
}
