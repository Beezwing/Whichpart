/**
 * Centralized, swappable branding config (Master Spec Section 84).
 * The final brand name is not decided yet — everything the app displays
 * (name, colors, tagline) reads from here so renaming later means
 * editing this one file, not hunting through the codebase.
 */
export const brand = {
  appName: "AutoParts Marketplace",
  shortName: "AutoParts",
  tagline: "Find the right part, from a supplier you can trust.",
  supportEmail: "support@example.com",
  colors: {
    primary: "#C8590C",
    primaryInk: "#FFFFFF",
    secondary: "#2C4A66",
    secondaryInk: "#FFFFFF",
    background: "#F5F4F0",
    surface: "#FFFFFF",
    ink: "#1B1D1F",
    muted: "#666D71",
    border: "#DBD6CB",
    success: "#2F7D4F",
    warning: "#96690A",
    danger: "#AD3A34",
  },
  fonts: {
    display: "Oswald, system-ui, sans-serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
  defaultCurrency: "JMD",
  defaultCountry: "JM",
} as const;

export type Brand = typeof brand;
