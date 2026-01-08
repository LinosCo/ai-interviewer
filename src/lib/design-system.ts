import React from 'react';

// Business Tuner Design System Constants

export const colors = {
    // Core Brand — Gamma Amber/Gold
    gold: '#FBBF24',        // Accent brillante, highlights
    amber: '#F59E0B',       // Primario principale
    amberDark: '#D97706',   // Hover states, profondità
    amberLight: '#FCD34D',  // Backgrounds leggeri

    // Extended Warm — Per gradienti e transizioni
    peach: '#FFECD2',       // Background soft
    coral: '#FFB088',       // Accent secondario caldo
    apricot: '#FFD4A8',     // Transizioni
    cream: '#FFFBF5',       // Background alternativo

    // Accent Freddi — Per bilanciare
    rose: '#FFE4E6',        // Accent rosa tenue
    lavender: '#F3E8FF',    // Accent viola tenue
    sky: '#E0F2FE',         // Accent azzurro tenue

    // Neutrali
    text: '#1F1F1F',        // Testo principale
    muted: '#525252',       // Testo secondario
    subtle: '#737373',      // Testo terziario, labels
    light: '#E5E5E5',       // Bordi, divisori
    white: '#FFFFFF',       // Background principale
    bg: '#FFFBEB',          // Sfondo pagina default (Amber 50)

    // Semantici
    success: '#16A34A',
    successLight: '#DCFCE7', // Added for matching design system usage
    error: '#DC2626',
    warning: '#F59E0B',
    info: '#0EA5E9',
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
    full: '100px', // Pills, badges, buttons circolari
};

export const gradients = {
    primary: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.amber} 100%)`,
    brand: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.amber} 50%, ${colors.coral} 100%)`,
    soft: `linear-gradient(135deg, ${colors.peach} 0%, ${colors.apricot} 100%)`,
    sectionOrange: `linear-gradient(180deg, rgba(251, 191, 36, 0.95) 0%, ${colors.amber} 30%, ${colors.amber} 70%, rgba(251, 191, 36, 0.95) 100%)`,
    mesh: `
    radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.peach}50 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 100% 30%, ${colors.apricot}30 0%, transparent 40%),
    radial-gradient(ellipse 50% 30% at 0% 60%, ${colors.gold}15 0%, transparent 35%),
    ${colors.white}
  `,
};

export const shadows = {
    sm: '0 4px 12px rgba(0, 0, 0, 0.05)',
    md: '0 15px 40px rgba(0, 0, 0, 0.06)',
    lg: '0 25px 60px rgba(0, 0, 0, 0.08)',
    xl: '0 30px 60px -10px rgba(0, 0, 0, 0.1)',
    amber: `0 8px 30px rgba(245, 158, 11, 0.4)`,
};
