// Business Tuner Design System Constants
// Coordinated palette for Landing + Dashboard

export const colors = {
  // Core Brand — Primary Coral/Orange
  coral: '#E85D3B',         // Primary coral (hsl 16 85% 58%)
  coralLight: '#EF8A6F',    // Light coral (hsl 16 85% 68%)
  coralDark: '#C74426',     // Dark coral (hsl 16 85% 48%)

  // Extended Brand — Amber/Gold accents
  gold: '#FBBF24',          // Accent brillante, highlights
  amber: '#F5A623',         // Accent amber (hsl 35 90% 55%)
  amberLight: '#F7C35F',    // Light amber
  amberDark: '#D97706',     // Hover states, profondità

  // Warm Backgrounds
  peach: '#EDCBB3',         // Peach (hsl 25 80% 85%)
  peachLight: '#F4DFD0',    // Light peach (hsl 25 80% 92%)
  apricot: '#FFD4A8',       // Transizioni
  cream: '#FBF7F3',         // Cream (hsl 30 50% 97%)
  warmWhite: '#FCFBFA',     // Warm white (hsl 30 40% 99%)

  // Accent Freddi — Per bilanciare
  rose: '#FFE4E6',          // Accent rosa tenue
  lavender: '#F3E8FF',      // Accent viola tenue
  sky: '#E0F2FE',           // Accent azzurro tenue

  // Neutrali
  text: '#2D2320',          // Testo principale (hsl 20 25% 15%)
  muted: '#6B5E57',         // Testo secondario (hsl 20 15% 45%)
  subtle: '#8A8077',        // Testo terziario, labels
  light: '#E5DED9',         // Bordi, divisori (hsl 25 30% 88%)
  white: '#FFFFFF',         // Background principale
  bg: '#FCF9F6',            // Sfondo pagina default (hsl 30 50% 98%)

  // Semantici
  success: '#16A34A',
  successLight: '#DCFCE7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#0EA5E9',
  infoLight: '#E0F2FE',

  // Dark section colors
  darkBg: '#0F0F0F',        // hsl(0 0% 6%)
  darkCard: '#141414',      // hsl(0 0% 8%)
  darkBorder: '#262626',    // hsl(0 0% 15%)
};

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
};

export const radius = {
  sm: '8px',      // Inputs, small buttons
  md: '12px',     // Cards piccole, avatars
  lg: '18px',     // Cards medie, messaggi chat
  xl: '24px',     // Cards grandi
  '2xl': '28px',  // Cards hero, panels
  '3xl': '32px',  // Modali, cards featured
  full: '100px',  // Pills, badges, buttons circolari
};

export const gradients = {
  // Primary gradient: Coral → Orange → Amber
  primary: `linear-gradient(135deg, ${colors.coral} 0%, #E87040 50%, ${colors.amber} 100%)`,

  // Brand gradient: Full spectrum
  brand: `linear-gradient(135deg, ${colors.coral} 0%, ${colors.amber} 50%, ${colors.gold} 100%)`,

  // Soft backgrounds
  soft: `linear-gradient(135deg, ${colors.peach} 0%, ${colors.apricot} 100%)`,

  // Hero gradient for light backgrounds
  hero: `linear-gradient(135deg, ${colors.peachLight} 0%, ${colors.bg} 50%, ${colors.cream} 100%)`,

  // CTA gradient
  cta: `linear-gradient(135deg, ${colors.coral} 0%, #E06830 100%)`,

  // Dark section gradient
  dark: `linear-gradient(180deg, #0D0D0D 0%, #141414 100%)`,

  // Mesh gradient for dashboard background
  mesh: `
    radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.peach}50 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 100% 30%, ${colors.apricot}30 0%, transparent 40%),
    radial-gradient(ellipse 50% 30% at 0% 60%, ${colors.gold}15 0%, transparent 35%),
    ${colors.white}
  `,

  // Section orange gradient
  sectionOrange: `linear-gradient(180deg, rgba(232, 93, 59, 0.95) 0%, ${colors.coral} 30%, ${colors.coral} 70%, rgba(232, 93, 59, 0.95) 100%)`,
};

export const shadows = {
  // Standard shadows
  sm: '0 2px 8px -2px rgba(0, 0, 0, 0.15)',
  md: '0 8px 24px -8px rgba(0, 0, 0, 0.2)',
  lg: '0 16px 48px -12px rgba(0, 0, 0, 0.25)',
  xl: '0 30px 60px -10px rgba(0, 0, 0, 0.1)',

  // Colored shadows
  coral: `0 8px 32px -8px rgba(232, 93, 59, 0.25)`,
  coralLg: `0 12px 48px -12px rgba(232, 93, 59, 0.35)`,
  amber: `0 8px 30px rgba(245, 158, 11, 0.4)`,
};

// Typography (matches globals.css)
export const fonts = {
  sans: "'Inter', system-ui, sans-serif",
  display: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
};

// CSS variable references (for use in components)
export const cssVars = {
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: 'hsl(var(--card))',
  cardForeground: 'hsl(var(--card-foreground))',
  primary: 'hsl(var(--primary))',
  primaryForeground: 'hsl(var(--primary-foreground))',
  secondary: 'hsl(var(--secondary))',
  secondaryForeground: 'hsl(var(--secondary-foreground))',
  muted: 'hsl(var(--muted))',
  mutedForeground: 'hsl(var(--muted-foreground))',
  accent: 'hsl(var(--accent))',
  accentForeground: 'hsl(var(--accent-foreground))',
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  coral: 'hsl(var(--coral))',
  coralLight: 'hsl(var(--coral-light))',
  coralDark: 'hsl(var(--coral-dark))',
  amber: 'hsl(var(--amber))',
  amberLight: 'hsl(var(--amber-light))',
  peach: 'hsl(var(--peach))',
  peachLight: 'hsl(var(--peach-light))',
  cream: 'hsl(var(--cream))',
  warmWhite: 'hsl(var(--warm-white))',
};
