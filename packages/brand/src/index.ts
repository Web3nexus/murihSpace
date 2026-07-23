/**
 * @murihspace/brand
 *
 * This package exports MurihSpace brand design tokens.
 *
 * CSS custom properties are exported from ./tokens.css.
 *
 * TODO: Replace placeholder token values with approved brand values
 * once the official design system has been finalised.
 *
 * Do NOT import this package into applications until token values
 * have been approved by the design team.
 */

// Token names — mirrors the CSS custom properties in tokens.css
export const brandTokenNames = {
  primary: "--brand-primary",
  secondary: "--brand-secondary",
  neutral50: "--brand-neutral-50",
  neutral900: "--brand-neutral-900",
  fontSans: "--brand-font-sans",
  fontHeading: "--brand-font-heading",
  spaceUnit: "--brand-space-unit",
} as const;
