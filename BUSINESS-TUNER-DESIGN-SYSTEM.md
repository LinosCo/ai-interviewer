# Business Tuner — Design System & Implementation Guide

## Overview

Business Tuner è una piattaforma SaaS che permette alle PMI italiane di condurre interviste qualitative AI-powered per raccogliere feedback da clienti, dipendenti e stakeholder. Il design deve comunicare: professionalità, innovazione accessibile, calore umano e semplicità.

**Metafora visiva centrale:** L'equalizzatore audio che si trasforma in grafico business — rappresenta l'ascolto attivo del mercato tradotto in dati actionable.

---

## 1. BRAND IDENTITY

### 1.1 Nome e Posizionamento
- **Nome:** Business Tuner
- **Tagline:** "Ascolta il mercato. Decidi meglio."
- **Tone of voice:** Professionale ma accessibile, competente senza essere tecnico, caldo e rassicurante

### 1.2 Logo

Il logo combina un equalizzatore audio con elementi di business chart.

```jsx
const Logo = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#D97706" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#FBBF24" />
      </linearGradient>
    </defs>
    {/* Container con angoli arrotondati */}
    <rect width="48" height="48" rx="14" fill="url(#logoGradient)" />
    {/* Barre equalizzatore/chart */}
    <g fill="white" opacity="0.9">
      <rect x="8" y="28" width="5" height="12" rx="2" opacity="0.4" />
      <rect x="15" y="24" width="5" height="16" rx="2" opacity="0.55" />
      <rect x="22" y="18" width="5" height="22" rx="2" opacity="0.7" />
      <rect x="29" y="14" width="5" height="26" rx="2" opacity="0.85" />
      <rect x="36" y="20" width="5" height="20" rx="2" opacity="0.7" />
    </g>
    {/* Trend line */}
    <path 
      d="M10 34 L17.5 30 L24.5 22 L31.5 16 L38.5 22" 
      stroke="white" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none" 
    />
    {/* Data point di picco */}
    <circle cx="31.5" cy="16" r="3" fill="white" />
  </svg>
);
```

**Varianti logo:**
- `size={48}` — Navbar, favicon
- `size={36}` — Header compatto
- `size={28}` — Footer, inline
- `size={20}` — Avatar piccolo, icona

**Wordmark:** "Business Tuner" in Inter SemiBold (600), colore `#1F1F1F`

---

## 2. COLOR PALETTE

### 2.1 Colori Primari

```javascript
const colors = {
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
  
  // Semantici
  success: '#16A34A',
  successLight: '#DCFCE7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#0EA5E9',
  infoLight: '#E0F2FE'
};
```

### 2.2 Gradienti

```css
/* Gradiente primario — per CTA, header cards, elementi hero */
.gradient-primary {
  background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%);
}

/* Gradiente brand esteso — per hero text, elementi speciali */
.gradient-brand {
  background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #FFB088 100%);
}

/* Gradiente sezione pricing/feature — blocco arancione */
.gradient-section-orange {
  background: linear-gradient(180deg, 
    rgba(251, 191, 36, 0.95) 0%, 
    #F59E0B 30%,
    #F59E0B 70%,
    rgba(251, 191, 36, 0.95) 100%
  );
}

/* Effetto luce 3D su sezione arancione */
.gradient-section-orange-3d {
  background: 
    radial-gradient(ellipse 120% 60% at 50% -10%, rgba(255,255,255,0.4) 0%, transparent 50%),
    radial-gradient(ellipse 100% 40% at 50% 110%, rgba(255,255,255,0.2) 0%, transparent 40%);
}

/* Gradiente soft per cards/elementi */
.gradient-soft {
  background: linear-gradient(135deg, #FFECD2 0%, #FFD4A8 100%);
}

/* Background mesh per pagine */
.background-mesh {
  background: 
    radial-gradient(ellipse 80% 50% at 50% -20%, #FFECD260 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 100% 30%, #FFE4E640 0%, transparent 40%),
    radial-gradient(ellipse 50% 30% at 0% 60%, #F3E8FF30 0%, transparent 35%),
    #FFFFFF;
}
```

### 2.3 Applicazione Colori per Contesto

| Contesto | Colore/Gradiente |
|----------|------------------|
| CTA primaria | `gradient-primary` + shadow amber |
| CTA secondaria | `white/60%` + blur + border subtle |
| Link | `amber` → `amberDark` on hover |
| Text heading | `text` (#1F1F1F) |
| Text body | `muted` (#525252) |
| Text label/caption | `subtle` (#737373) |
| Background page | `white` con `background-mesh` |
| Background card | `white/75-90%` + blur |
| Background section colorata | `gradient-section-orange` |
| Bordi | `light` o `white/80%` |
| Icone | `subtle` default, `amber` active |

---

## 3. TYPOGRAPHY

### 3.1 Font Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

**Caricamento:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 3.2 Scale Tipografica

```css
/* Display — Hero headlines */
.text-display {
  font-size: 4rem;      /* 64px */
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

/* H1 — Page titles */
.text-h1 {
  font-size: 3rem;      /* 48px */
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

/* H2 — Section titles */
.text-h2 {
  font-size: 2rem;      /* 32px */
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

/* H3 — Card titles, subsections */
.text-h3 {
  font-size: 1.25rem;   /* 20px */
  font-weight: 600;
  line-height: 1.4;
}

/* H4 — Small headings */
.text-h4 {
  font-size: 1rem;      /* 16px */
  font-weight: 600;
  line-height: 1.5;
}

/* Body large */
.text-body-lg {
  font-size: 1.25rem;   /* 20px */
  font-weight: 400;
  line-height: 1.7;
}

/* Body default */
.text-body {
  font-size: 1rem;      /* 16px */
  font-weight: 400;
  line-height: 1.6;
}

/* Body small */
.text-body-sm {
  font-size: 0.9375rem; /* 15px */
  font-weight: 400;
  line-height: 1.6;
}

/* Caption/Label */
.text-caption {
  font-size: 0.875rem;  /* 14px */
  font-weight: 500;
  line-height: 1.5;
}

/* Overline — badges, tags */
.text-overline {
  font-size: 0.75rem;   /* 12px */
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Tiny — metadata */
.text-tiny {
  font-size: 0.6875rem; /* 11px */
  font-weight: 500;
  line-height: 1.5;
}
```

### 3.3 Testo con Gradiente

```jsx
// Per headline con gradiente brand
<span style={{
  background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #FFB088 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent'
}}>
  Decidi meglio.
</span>
```

---

## 4. SPACING & LAYOUT

### 4.1 Spacing Scale

```javascript
const spacing = {
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
```

### 4.2 Container & Grid

```css
/* Container principale */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 3rem; /* 48px laterali */
}

/* Container stretto (form, content) */
.container-narrow {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Container largo (pricing, features) */
.container-wide {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Grid base */
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; }
```

### 4.3 Border Radius

```javascript
const radius = {
  sm: '8px',      // Inputs, small buttons
  md: '12px',     // Cards piccole, avatars
  lg: '18px',     // Cards medie, messaggi chat
  xl: '24px',     // Cards grandi
  '2xl': '28px',  // Cards hero, panels
  '3xl': '32px',  // Modali, cards featured
  full: '100px', // Pills, badges, buttons circolari
};
```

---

## 5. EFFECTS & GLASSMORPHISM

### 5.1 Glassmorphism Cards

```css
/* Card glassmorphism standard */
.glass-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 24px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

/* Card glassmorphism su sfondo colorato (sezione arancione) */
.glass-card-on-color {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 28px;
}

/* Card solida bianca (featured, es. pricing Pro) */
.solid-card-featured {
  background: white;
  border-radius: 28px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15);
  transform: scale(1.05);
}

/* Input glassmorphism */
.glass-input {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}
```

### 5.2 Shadows

```css
/* Shadow piccola — hover states, elementi piccoli */
.shadow-sm {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

/* Shadow media — cards, dropdowns */
.shadow-md {
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.06);
}

/* Shadow grande — modali, cards hero */
.shadow-lg {
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.08);
}

/* Shadow XL — elementi floating featured */
.shadow-xl {
  box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.1);
}

/* Shadow colorata — CTA amber */
.shadow-amber {
  box-shadow: 0 8px 30px rgba(245, 158, 11, 0.4);
}

/* Glow animato */
.glow-amber {
  animation: glow 2s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.3); }
  50% { box-shadow: 0 0 40px rgba(251, 191, 36, 0.5); }
}
```

### 5.3 Animazioni

```css
/* Shimmer — per CTA, badges, loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.shimmer-overlay {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s infinite;
}

/* Float — per cards hero */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.float {
  animation: float 6s ease-in-out infinite;
}

/* Wave typing — indicatore digitazione chat */
@keyframes waveTyping {
  0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
  50% { transform: scaleY(1); opacity: 1; }
}

/* Fade in up — entrata elementi */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Transizione standard */
.transition-default {
  transition: all 0.2s ease;
}

.transition-smooth {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 6. COMPONENTI UI

### 6.1 Buttons

```jsx
// Primary CTA
const ButtonPrimary = ({ children, ...props }) => (
  <button
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.625rem',
      padding: '1rem 1.75rem',
      background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '100px',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 8px 30px rgba(245, 158, 11, 0.4)',
      position: 'relative',
      overflow: 'hidden'
    }}
    {...props}
  >
    {children}
    {/* Shimmer overlay */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: '-100%',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
      animation: 'shimmer 2s infinite'
    }} />
  </button>
);

// Secondary button
const ButtonSecondary = ({ children, ...props }) => (
  <button
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '1rem 1.5rem',
      background: 'rgba(255,255,255,0.6)',
      backdropFilter: 'blur(10px)',
      color: '#525252',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: '100px',
      fontSize: '1rem',
      fontWeight: '500',
      cursor: 'pointer'
    }}
    {...props}
  >
    {children}
  </button>
);

// Ghost button (su sfondo colorato)
const ButtonGhost = ({ children, ...props }) => (
  <button
    style={{
      padding: '1rem',
      background: 'rgba(255,255,255,0.2)',
      border: '1px solid rgba(255,255,255,0.4)',
      borderRadius: '100px',
      color: 'white',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer'
    }}
    {...props}
  >
    {children}
  </button>
);

// Text button / Link
const ButtonText = ({ children, ...props }) => (
  <button
    style={{
      background: 'none',
      border: 'none',
      color: '#F59E0B',
      fontSize: '0.9375rem',
      fontWeight: '500',
      cursor: 'pointer',
      padding: 0
    }}
    {...props}
  >
    {children}
  </button>
);

// Icon button
const ButtonIcon = ({ children, size = 40, ...props }) => (
  <button
    style={{
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255,255,255,0.8)',
      border: '1px solid rgba(0,0,0,0.05)',
      borderRadius: '12px',
      color: '#525252',
      cursor: 'pointer'
    }}
    {...props}
  >
    {children}
  </button>
);
```

### 6.2 Inputs

```jsx
// Text input
const Input = ({ label, error, ...props }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    {label && (
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#525252',
        marginBottom: '0.5rem'
      }}>
        {label}
      </label>
    )}
    <input
      style={{
        width: '100%',
        padding: '0.875rem 1rem',
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(10px)',
        border: error ? '1px solid #DC2626' : '1px solid rgba(0,0,0,0.08)',
        borderRadius: '12px',
        fontSize: '1rem',
        color: '#1F1F1F',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s'
      }}
      {...props}
    />
    {error && (
      <p style={{ fontSize: '0.8125rem', color: '#DC2626', marginTop: '0.5rem' }}>
        {error}
      </p>
    )}
  </div>
);

// Textarea
const Textarea = ({ label, rows = 4, ...props }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    {label && (
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#525252',
        marginBottom: '0.5rem'
      }}>
        {label}
      </label>
    )}
    <textarea
      rows={rows}
      style={{
        width: '100%',
        padding: '0.875rem 1rem',
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '12px',
        fontSize: '1rem',
        color: '#1F1F1F',
        resize: 'vertical',
        outline: 'none'
      }}
      {...props}
    />
  </div>
);
```

### 6.3 Cards

```jsx
// Card standard
const Card = ({ children, padding = '2rem', ...props }) => (
  <div
    style={{
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(15px)',
      borderRadius: '24px',
      padding,
      border: '1px solid rgba(255, 255, 255, 0.8)',
      boxShadow: '0 15px 40px rgba(0, 0, 0, 0.04)'
    }}
    {...props}
  >
    {children}
  </div>
);

// Card con header colorato (stile chat preview)
const CardWithHeader = ({ header, children }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
    borderRadius: '28px',
    overflow: 'hidden',
    boxShadow: '0 30px 60px -10px rgba(0,0,0,0.1)'
  }}>
    <div style={{
      background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #FFB08890 100%)',
      padding: '1.25rem 1.5rem'
    }}>
      {header}
    </div>
    <div style={{ padding: '1.5rem' }}>
      {children}
    </div>
  </div>
);

// Stat card
const StatCard = ({ value, label }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      fontSize: '3rem',
      fontWeight: '600',
      background: 'linear-gradient(135deg, #D97706, #FBBF24)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    }}>
      {value}
    </div>
    <div style={{ fontSize: '0.9375rem', color: '#737373' }}>
      {label}
    </div>
  </div>
);
```

### 6.4 Pills & Badges

```jsx
// Pill/Tag
const Pill = ({ children, active = false }) => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: active ? 'linear-gradient(135deg, #FBBF24, #F59E0B)' : 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(8px)',
    border: active ? 'none' : '1px solid rgba(0,0,0,0.05)',
    borderRadius: '100px',
    color: active ? 'white' : '#737373',
    fontSize: '0.8125rem',
    fontWeight: '500'
  }}>
    {children}
  </div>
);

// Badge con dot animato
const Badge = ({ children }) => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: '100px'
  }}>
    <div style={{
      width: '8px',
      height: '8px',
      background: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
      borderRadius: '50%',
      animation: 'glow 2s ease-in-out infinite'
    }} />
    <span style={{
      fontSize: '0.8125rem',
      fontWeight: '600',
      background: 'linear-gradient(90deg, #D97706, #F59E0B, #D97706)',
      backgroundSize: '200% 100%',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      animation: 'shimmer 3s linear infinite'
    }}>
      {children}
    </span>
  </div>
);

// Status badge
const StatusBadge = ({ status, children }) => {
  const statusColors = {
    success: { bg: '#DCFCE7', text: '#16A34A' },
    warning: { bg: '#FEF3C7', text: '#D97706' },
    error: { bg: '#FEE2E2', text: '#DC2626' },
    info: { bg: '#E0F2FE', text: '#0EA5E9' }
  };
  const colors = statusColors[status] || statusColors.info;
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.25rem 0.75rem',
      background: colors.bg,
      color: colors.text,
      borderRadius: '100px',
      fontSize: '0.75rem',
      fontWeight: '600'
    }}>
      {children}
    </span>
  );
};
```

### 6.5 Navigation

```jsx
// Navbar
const Navbar = ({ scrolled = false }) => (
  <nav style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '1rem 3rem',
    background: scrolled ? 'rgba(255,255,255,0.9)' : 'transparent',
    backdropFilter: scrolled ? 'blur(20px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(0,0,0,0.05)' : 'none',
    transition: 'all 0.3s ease'
  }}>
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      {/* Logo + Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Logo size={36} />
        <span style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F1F1F' }}>
          Business Tuner
        </span>
      </div>
      
      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        {['Come funziona', 'Prezzi', 'Casi d\'uso'].map(item => (
          <a
            key={item}
            href="#"
            style={{
              color: '#525252',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            {item}
          </a>
        ))}
        <button style={{
          padding: '0.5rem 1.25rem',
          background: '#1F1F1F',
          color: 'white',
          border: 'none',
          borderRadius: '100px',
          fontSize: '0.875rem',
          fontWeight: '500',
          cursor: 'pointer'
        }}>
          Prova gratis
        </button>
      </div>
    </div>
  </nav>
);
```

### 6.6 Avatar

```jsx
// Avatar con iniziali
const Avatar = ({ name, size = 48, image = null }) => {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
    
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: image ? `url(${image}) center/cover` : 'linear-gradient(135deg, #FFECD2, #FFD4A8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: '600',
      color: '#D97706'
    }}>
      {!image && initials}
    </div>
  );
};
```

---

## 7. ICON SET

Utilizzare Lucide React come libreria principale. Icone custom solo per casi specifici.

### 7.1 Icone di Sistema

```jsx
import {
  // Navigation
  Menu, X, ChevronDown, ChevronRight, ChevronLeft,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  ExternalLink, Home,
  
  // Actions
  Plus, Minus, Check, Copy, Download, Upload,
  Edit, Trash2, Save, RefreshCw, Search,
  Settings, Filter, MoreHorizontal, MoreVertical,
  
  // Communication
  MessageSquare, Send, Mail, Bell, Phone,
  
  // Media
  Play, Pause, Volume2, VolumeX, Mic, MicOff,
  
  // Data/Analytics
  BarChart2, TrendingUp, PieChart, Activity,
  
  // Users
  User, Users, UserPlus,
  
  // Business
  Building, Briefcase, ShoppingCart, CreditCard,
  
  // Status
  AlertCircle, Info, HelpCircle, CheckCircle, XCircle,
  
  // Files
  File, FileText, Folder, Image,
  
  // Misc
  Star, Heart, Zap, Clock, Calendar, Link, Lock, Unlock,
  Eye, EyeOff, Globe, Share2
} from 'lucide-react';
```

### 7.2 Icone Custom (SVG inline)

```jsx
// Equalizer icon (brand)
const IconEqualizer = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="14" width="3" height="6" rx="1" fill={color} opacity="0.4" />
    <rect x="8" y="10" width="3" height="10" rx="1" fill={color} opacity="0.6" />
    <rect x="13" y="6" width="3" height="14" rx="1" fill={color} opacity="0.8" />
    <rect x="18" y="8" width="3" height="12" rx="1" fill={color} />
  </svg>
);

// Waveform icon
const IconWaveform = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <path d="M2 12h2l2-4 3 8 3-6 2 4h2l2-2 2 4h2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Interview/Chat icon
const IconInterview = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
  </svg>
);

// Insight/Lightbulb
const IconInsight = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M9 18h6M10 22h4M12 2v1M4.22 4.22l.7.7M1 12h1M4.22 19.78l.7-.7M12 17a5 5 0 100-10 5 5 0 000 10z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
```

### 7.3 Stile Icone

```jsx
// Dimensioni standard
const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32
};

// Icona con container
const IconBox = ({ children, size = 40, variant = 'default' }) => {
  const variants = {
    default: {
      background: 'rgba(255,255,255,0.8)',
      border: '1px solid rgba(0,0,0,0.05)',
      color: '#525252'
    },
    primary: {
      background: 'linear-gradient(135deg, #FFECD2, #FFD4A8)',
      border: 'none',
      color: '#D97706'
    },
    success: {
      background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)',
      border: 'none',
      color: '#16A34A'
    }
  };
  const style = variants[variant];
  
  return (
    <div style={{
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: size > 30 ? '14px' : '10px',
      ...style
    }}>
      {children}
    </div>
  );
};
```

---

## 8. DECORAZIONI & SEPARATORI

### 8.1 Separatore Onde Soft (tra blocchi bianchi)

Il separatore deve essere alto (280-320px) e sfumare verso il bianco sia sopra che sotto.

```jsx
const SoftWaveSeparator = ({ 
  accentColor = '#F59E0B', 
  height = 300 
}) => (
  <div style={{ 
    width: '100%', 
    height: `${height}px`, 
    position: 'relative',
    overflow: 'hidden',
    // Sfuma verso bianco sopra e sotto
    background: `linear-gradient(180deg, 
      #FFFFFF 0%, 
      transparent 15%,
      transparent 85%,
      #FFFFFF 100%
    )`
  }}>
    <svg 
      style={{ 
        position: 'absolute', 
        width: '200%', 
        left: '-50%', 
        top: 0, 
        height: '100%' 
      }}
      viewBox="0 0 2880 300" 
      preserveAspectRatio="none"
    >
      <defs>
        {/* Mask per sfumare verticalmente */}
        <linearGradient id="softFadeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="20%" stopColor="white" stopOpacity="1" />
          <stop offset="80%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="softFadeMask">
          <rect width="100%" height="100%" fill="url(#softFadeGrad)" />
        </mask>
      </defs>
      
      <g mask="url(#softFadeMask)">
        {/* Onda principale spessa */}
        <path 
          d="M0 150 C480 80 960 220 1440 150 C1920 80 2400 220 2880 150" 
          fill="none"
          stroke={accentColor}
          strokeWidth="80"
          opacity="0.06"
          strokeLinecap="round"
        >
          <animate 
            attributeName="d" 
            dur="12s"
            repeatCount="indefinite"
            values="
              M0 150 C480 80 960 220 1440 150 C1920 80 2400 220 2880 150;
              M0 150 C480 220 960 80 1440 150 C1920 220 2400 80 2880 150;
              M0 150 C480 80 960 220 1440 150 C1920 80 2400 220 2880 150
            "
          />
        </path>
        
        {/* Onda secondaria */}
        <path 
          d="M0 150 C360 100 720 200 1080 150 C1440 100 1800 200 2160 150 C2520 100 2880 200 2880 150" 
          fill="none"
          stroke={accentColor}
          strokeWidth="50"
          opacity="0.04"
          strokeLinecap="round"
        >
          <animate 
            attributeName="d" 
            dur="8s"
            repeatCount="indefinite"
            values="
              M0 150 C360 100 720 200 1080 150 C1440 100 1800 200 2160 150;
              M0 150 C360 200 720 100 1080 150 C1440 200 1800 100 2160 150;
              M0 150 C360 100 720 200 1080 150 C1440 100 1800 200 2160 150
            "
          />
        </path>

        {/* Linea accent sottile */}
        <path 
          d="M0 150 Q720 100 1440 150 T2880 150" 
          stroke={accentColor}
          strokeWidth="2.5"
          fill="none"
          opacity="0.15"
          strokeLinecap="round"
        >
          <animate 
            attributeName="d" 
            dur="6s"
            repeatCount="indefinite"
            values="
              M0 150 Q720 100 1440 150 T2880 150;
              M0 150 Q720 200 1440 150 T2880 150;
              M0 150 Q720 100 1440 150 T2880 150
            "
          />
        </path>
      </g>
    </svg>

    {/* Barre equalizzatore sfumate - sinistra */}
    <div style={{ 
      position: 'absolute', 
      top: '50%', 
      left: '8%', 
      transform: 'translateY(-50%)',
      opacity: 0.08,
      filter: 'blur(1px)'
    }}>
      <svg width="160" height="70" viewBox="0 0 160 70">
        <defs>
          <linearGradient id="barFade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0" />
            <stop offset="30%" stopColor={accentColor} stopOpacity="1" />
            <stop offset="70%" stopColor={accentColor} stopOpacity="1" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0,1,2,3,4,5,6].map(i => (
          <rect 
            key={i} 
            x={i * 22} 
            y={20} 
            width="14" 
            height={30 + Math.sin(i) * 12} 
            rx="5" 
            fill="url(#barFade)"
          >
            <animate 
              attributeName="height" 
              values={`${30 + Math.sin(i) * 12};${20 + Math.cos(i) * 8};${30 + Math.sin(i) * 12}`} 
              dur={`${1.5 + i * 0.2}s`} 
              repeatCount="indefinite" 
            />
          </rect>
        ))}
      </svg>
    </div>

    {/* Barre equalizzatore sfumate - destra */}
    <div style={{ 
      position: 'absolute', 
      top: '50%', 
      right: '8%', 
      transform: 'translateY(-50%)',
      opacity: 0.06,
      filter: 'blur(1px)'
    }}>
      <svg width="130" height="60" viewBox="0 0 130 60">
        {[0,1,2,3,4,5].map(i => (
          <rect 
            key={i} 
            x={i * 22} 
            y={15} 
            width="14" 
            height={25 + Math.cos(i * 0.8) * 10} 
            rx="5" 
            fill={accentColor}
          >
            <animate 
              attributeName="height" 
              values={`${25 + Math.cos(i * 0.8) * 10};${18 + Math.sin(i) * 6};${25 + Math.cos(i * 0.8) * 10}`} 
              dur={`${1.3 + i * 0.15}s`} 
              repeatCount="indefinite" 
            />
          </rect>
        ))}
      </svg>
    </div>
  </div>
);
```

### 8.2 Separatore con Barre/Chart (tra blocchi bianchi)

```jsx
const SoftChartSeparator = ({ 
  color = '#F59E0B', 
  height = 220 
}) => (
  <div style={{ 
    width: '100%', 
    height: `${height}px`, 
    position: 'relative',
    overflow: 'hidden',
    background: `linear-gradient(180deg, 
      #FFFFFF 0%, 
      transparent 15%,
      transparent 85%,
      #FFFFFF 100%
    )`
  }}>
    <svg 
      style={{ width: '100%', height: '100%' }} 
      viewBox="0 0 1440 220" 
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartBarFade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="25%" stopColor={color} stopOpacity="1" />
          <stop offset="75%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Barre chart distribuite */}
      {Array.from({ length: 50 }).map((_, i) => {
        const x = i * 29 + 5;
        const baseH = 50 + Math.sin(i * 0.3) * 30 + Math.cos(i * 0.5) * 20;
        return (
          <rect
            key={i}
            x={x}
            y={110 - baseH / 2}
            width="18"
            height={baseH}
            rx="6"
            fill="url(#chartBarFade)"
            opacity={0.06 + Math.sin(i * 0.2) * 0.03}
          >
            <animate
              attributeName="height"
              values={`${baseH};${baseH * 0.6};${baseH * 1.2};${baseH}`}
              dur={`${2.5 + (i % 7) * 0.3}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="y"
              values={`${110 - baseH / 2};${110 - baseH * 0.3};${110 - baseH * 0.6};${110 - baseH / 2}`}
              dur={`${2.5 + (i % 7) * 0.3}s`}
              repeatCount="indefinite"
            />
          </rect>
        );
      })}

      {/* Trend line */}
      <path
        d="M0 110 Q360 70 720 100 T1440 80"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        opacity="0.12"
        strokeLinecap="round"
      >
        <animate
          attributeName="d"
          values="M0 110 Q360 70 720 100 T1440 80;M0 100 Q360 130 720 90 T1440 110;M0 110 Q360 70 720 100 T1440 80"
          dur="10s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  </div>
);
```

### 8.3 Transizione verso/da Sezione Arancione

```jsx
const OrangeTransition = ({ 
  toOrange = true, 
  height = 200 
}) => (
  <div style={{ 
    width: '100%', 
    height: `${height}px`, 
    position: 'relative',
    overflow: 'hidden',
    background: toOrange 
      ? `linear-gradient(180deg, 
          #FFFFFF 0%, 
          #FFECD2 30%, 
          #FFD4A8 60%, 
          rgba(251, 191, 36, 0.95) 100%
        )`
      : `linear-gradient(180deg, 
          rgba(251, 191, 36, 0.95) 0%, 
          #FFD4A8 40%, 
          #FFECD2 70%, 
          #FFFFFF 100%
        )`
  }}>
    <svg 
      style={{ 
        position: 'absolute', 
        width: '200%', 
        left: '-50%', 
        top: 0, 
        height: '100%' 
      }}
      viewBox="0 0 2880 200" 
      preserveAspectRatio="none"
    >
      {/* Onde bianche soft per fusione */}
      <path 
        d="M0 100 C480 50 960 150 1440 100 C1920 50 2400 150 2880 100" 
        fill="none"
        stroke="white"
        strokeWidth="60"
        opacity="0.2"
        strokeLinecap="round"
      >
        <animate 
          attributeName="d" 
          dur="10s"
          repeatCount="indefinite"
          values="
            M0 100 C480 50 960 150 1440 100 C1920 50 2400 150 2880 100;
            M0 100 C480 150 960 50 1440 100 C1920 150 2400 50 2880 100;
            M0 100 C480 50 960 150 1440 100 C1920 50 2400 150 2880 100
          "
        />
      </path>
      
      <path 
        d="M0 100 Q720 60 1440 100 T2880 100" 
        stroke="white"
        strokeWidth="2"
        fill="none"
        opacity="0.35"
        strokeLinecap="round"
      >
        <animate 
          attributeName="d" 
          dur="7s"
          repeatCount="indefinite"
          values="
            M0 100 Q720 60 1440 100 T2880 100;
            M0 100 Q720 140 1440 100 T2880 100;
            M0 100 Q720 60 1440 100 T2880 100
          "
        />
      </path>
    </svg>
  </div>
);
```

---

## 9. STRUTTURA PAGINE

### 9.1 Landing Page

```
┌─────────────────────────────────────────────────────────┐
│  NAVBAR (sticky, blur on scroll)                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HERO SECTION                                           │
│  ┌─────────────────────┬───────────────────────────┐   │
│  │ Badge animato       │                           │   │
│  │ Headline + gradient │  Chat Preview Card        │   │
│  │ Subheadline         │  (glassmorphism, float)   │   │
│  │ CTA buttons         │                           │   │
│  │ Use case pills      │  + Floating insight card  │   │
│  └─────────────────────┴───────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░ SOFT WAVE SEPARATOR (300px, sfuma al bianco) ░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  STATS SECTION                                          │
│  ┌─────────────┬─────────────┬─────────────┐           │
│  │   70%+      │   10 min    │    1/10     │           │
│  │ completion  │   setup     │   costo     │           │
│  └─────────────┴─────────────┴─────────────┘           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░ SOFT CHART SEPARATOR (280px, sfuma al bianco) ░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HOW IT WORKS                                           │
│  ┌────────┬────────┬────────┬────────┐                 │
│  │   01   │   02   │   03   │   04   │                 │
│  │ Desc.  │  AI    │ Share  │ Insight│                 │
│  └────────┴────────┴────────┴────────┘                 │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓▓ ORANGE TRANSITION (bianco → gold gradient) ▓▓▓▓▓  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
├─────────────────────────────────────────────────────────┤
│  █████████████████████████████████████████████████████  │
│  █                                                   █  │
│  █  PRICING SECTION (sfondo arancione 3D)            █  │
│  █  ┌──────────┐  ┌─────────────┐  ┌──────────┐     █  │
│  █  │ Starter  │  │ PROFESSIONAL│  │Enterprise│     █  │
│  █  │ glass bg │  │  WHITE card │  │ glass bg │     █  │
│  █  └──────────┘  └─────────────┘  └──────────┘     █  │
│  █                                                   █  │
│  █████████████████████████████████████████████████████  │
├─────────────────────────────────────────────────────────┤
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓▓ ORANGE TRANSITION (gold gradient → bianco) ▓▓▓▓▓  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TESTIMONIAL                                            │
│  ┌───────────────────────────────────────────┐         │
│  │  ⭐⭐⭐⭐⭐                                 │         │
│  │  "Quote..."                                │         │
│  │  👤 Nome, Ruolo                            │         │
│  └───────────────────────────────────────────┘         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░ SOFT WAVE SEPARATOR (250px) ░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CTA FINALE                                             │
│  "Pronto ad ascoltare?"                                 │
│  [Inizia ora →]                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  FOOTER                                                 │
│  Logo · © 2025 Business Tuner                           │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Dashboard / Pannello di Controllo

```
┌─────────────────────────────────────────────────────────┐
│  SIDEBAR (240px)          │  MAIN CONTENT               │
│  ┌─────────────────────┐  │                             │
│  │ Logo + Wordmark     │  │  HEADER                     │
│  ├─────────────────────┤  │  ┌───────────────────────┐  │
│  │ 📊 Dashboard        │  │  │ Page Title            │  │
│  │ 💬 Interviste       │  │  │ Breadcrumb            │  │
│  │ 📈 Analytics        │  │  │           [+ Nuova]   │  │
│  │ 👥 Risposte         │  │  └───────────────────────┘  │
│  │ ⚙️ Impostazioni     │  │                             │
│  ├─────────────────────┤  │  CONTENT AREA               │
│  │                     │  │  ┌───────────────────────┐  │
│  │ Workspace           │  │  │                       │  │
│  │ [Dropdown ▼]        │  │  │  Cards / Tables /     │  │
│  ├─────────────────────┤  │  │  Forms / Charts       │  │
│  │ Piano: Pro          │  │  │                       │  │
│  │ [Upgrade]           │  │  │                       │  │
│  └─────────────────────┘  │  └───────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Stile Dashboard:**
- Background: `#FAFAFA` o `background-mesh` leggero
- Sidebar: `white` con bordo destro `#E5E5E5`
- Cards: `glass-card` o bianche con shadow-md
- Tables: righe alternate con hover state
- Grafici: palette amber/coral per i dati

### 9.3 Chatbot / Interfaccia Intervista

```
┌───────────────────────────────────────────────────────┐
│  HEADER (branding cliente o Business Tuner default)   │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [Logo] Nome Intervista              [Progress]  │  │
│  └─────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────┤
│                                                       │
│  CHAT AREA (scrollable)                               │
│                                                       │
│    ┌──────────────────────────────────┐              │
│    │ 🤖 Messaggio AI                  │              │
│    │ (bg: white, border-radius left)  │              │
│    └──────────────────────────────────┘              │
│                                                       │
│              ┌──────────────────────────────────┐    │
│              │ Risposta utente                  │    │
│              │ (bg: gradient-primary, white text│    │
│              │  border-radius right)            │    │
│              └──────────────────────────────────┘    │
│                                                       │
│    ┌──────────────────────────────────┐              │
│    │ 🤖 Follow-up AI                  │              │
│    │ ▌▐▌ (typing indicator se attivo) │              │
│    └──────────────────────────────────┘              │
│                                                       │
├───────────────────────────────────────────────────────┤
│  INPUT AREA                                           │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [Textarea con placeholder]              [Send]  │  │
│  └─────────────────────────────────────────────────┘  │
│  "Powered by Business Tuner" (se non white-label)    │
└───────────────────────────────────────────────────────┘
```

**Stile Chat Default (non personalizzato):**
- Background: gradient soft `peach → white → lavender`
- Messaggi AI: `white` con shadow leggera
- Messaggi utente: `gradient-primary` con shadow amber
- Avatar AI: Logo Business Tuner in miniatura
- Typing indicator: 5 barre animate stile equalizzatore

### 9.4 Simulatore Bot

```
┌───────────────────────────────────────────────────────┐
│  TOOLBAR                                              │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [← Back] Simula: "Nome Intervista"   [Restart]  │  │
│  └─────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────┤
│                                                       │
│  DEVICE FRAME (centrato)                              │
│  ┌─────────────────────────────────────┐             │
│  │  ┌───────────────────────────────┐  │             │
│  │  │                               │  │             │
│  │  │    Chat Interface             │  │             │
│  │  │    (stessa del chatbot)       │  │             │
│  │  │                               │  │             │
│  │  │                               │  │             │
│  │  └───────────────────────────────┘  │             │
│  └─────────────────────────────────────┘             │
│       [Mobile] [Tablet] [Desktop]                    │
│                                                       │
├───────────────────────────────────────────────────────┤
│  INFO PANEL                                           │
│  Domanda corrente: 3/8                                │
│  Tempo medio risposta: 45s                            │
└───────────────────────────────────────────────────────┘
```

### 9.5 Registrazione / Onboarding

```
┌───────────────────────────────────────────────────────┐
│                                                       │
│  SPLIT LAYOUT                                         │
│  ┌─────────────────────┬─────────────────────────┐   │
│  │                     │                         │   │
│  │  LEFT PANEL         │  RIGHT PANEL            │   │
│  │  (gradient bg)      │  (white, form)          │   │
│  │                     │                         │   │
│  │  Logo grande        │  "Crea il tuo account"  │   │
│  │  Tagline            │                         │   │
│  │                     │  [Form fields]          │   │
│  │  ～～～～～～       │  • Email                │   │
│  │  (onde animate)     │  • Password             │   │
│  │                     │  • Nome azienda         │   │
│  │  Testimonial        │                         │   │
│  │  breve              │  [Registrati]           │   │
│  │                     │                         │   │
│  │                     │  "Hai già un account?"  │   │
│  │                     │  [Accedi]               │   │
│  │                     │                         │   │
│  └─────────────────────┴─────────────────────────┘   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Onboarding Steps:**
1. Dati account (email, password)
2. Info azienda (nome, settore, dimensione)
3. Obiettivo principale (B2B, B2C, HR)
4. Prima intervista guidata

---

## 10. RESPONSIVE BREAKPOINTS

```javascript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet portrait
  lg: '1024px',  // Tablet landscape / Small desktop
  xl: '1280px',  // Desktop
  '2xl': '1536px' // Large desktop
};
```

**Adattamenti principali:**

| Componente | Desktop | Tablet | Mobile |
|------------|---------|--------|--------|
| Container padding | 3rem | 2rem | 1.5rem |
| Hero grid | 2 colonne | 1 colonna | 1 colonna |
| Step cards | 4 colonne | 2 colonne | 1 colonna |
| Pricing cards | 3 colonne | 3 (stack) | 1 colonna |
| Separatori height | 300px | 200px | 150px |
| Display font | 4rem | 3rem | 2.5rem |

---

## 11. IMPLEMENTAZIONE NEXT.JS

### 11.1 Struttura Progetto

```
/app
  /layout.tsx           # Root layout con font, metadata
  /page.tsx             # Landing page
  /(auth)
    /login/page.tsx
    /register/page.tsx
    /layout.tsx         # Auth layout (split screen)
  /(dashboard)
    /layout.tsx         # Dashboard layout con sidebar
    /page.tsx           # Dashboard home
    /interviews/page.tsx
    /interviews/[id]/page.tsx
    /analytics/page.tsx
    /settings/page.tsx
  /(chat)
    /[interviewId]/page.tsx  # Chatbot pubblico
    /simulate/[id]/page.tsx  # Simulatore
/components
  /ui                   # Componenti base (Button, Input, Card...)
  /layout               # Navbar, Sidebar, Footer
  /sections             # Sezioni landing (Hero, Pricing...)
  /decorations          # Separatori, onde, equalizzatori
  /chat                 # Componenti chat
  /dashboard            # Componenti dashboard specifici
/lib
  /colors.ts            # Palette colori
  /animations.ts        # Keyframes e varianti
  /utils.ts             # Utility functions
/styles
  /globals.css          # CSS globale, font import
```

### 11.2 Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#FBBF24',
          amber: '#F59E0B',
          'amber-dark': '#D97706',
          peach: '#FFECD2',
          coral: '#FFB088',
          apricot: '#FFD4A8',
          cream: '#FFFBF5',
        },
        accent: {
          rose: '#FFE4E6',
          lavender: '#F3E8FF',
          sky: '#E0F2FE',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'wave': 'waveTyping 0.8s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(251, 191, 36, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(251, 191, 36, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        waveTyping: {
          '0%, 100%': { transform: 'scaleY(0.4)', opacity: '0.5' },
          '50%': { transform: 'scaleY(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
```

### 11.3 CSS Globale

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-gold: #FBBF24;
  --color-amber: #F59E0B;
  --color-amber-dark: #D97706;
  --color-peach: #FFECD2;
  --color-coral: #FFB088;
  --color-text: #1F1F1F;
  --color-muted: #525252;
  --color-subtle: #737373;
}

* {
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Focus states accessibili */
:focus-visible {
  outline: 2px solid var(--color-amber);
  outline-offset: 2px;
}

/* Scrollbar custom (opzionale) */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}

/* Selection */
::selection {
  background: var(--color-amber);
  color: white;
}
```

---

## 12. ACCESSIBILITY

- **Contrasto:** Tutti i testi rispettano WCAG AA (4.5:1 per testo normale, 3:1 per testo grande)
- **Focus states:** Outline visibile su tutti gli elementi interattivi
- **Motion:** Rispettare `prefers-reduced-motion` disabilitando animazioni
- **ARIA:** Labels appropriati per icone, form fields, navigation
- **Keyboard navigation:** Tab order logico, escape per chiudere modali

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 13. CHECKLIST IMPLEMENTAZIONE

### Landing Page
- [ ] Background mesh gradient
- [ ] Navbar sticky con blur
- [ ] Hero con chat preview card
- [ ] Separatori onde soft (300px, sfumati)
- [ ] Stats section
- [ ] Separatori chart (280px, sfumati)
- [ ] How it works (4 step cards)
- [ ] Transizione verso arancione
- [ ] Pricing section (sfondo gold 3D)
- [ ] Transizione da arancione
- [ ] Testimonial
- [ ] CTA finale
- [ ] Footer

### Dashboard
- [ ] Sidebar con navigation
- [ ] Header con breadcrumb
- [ ] Cards glassmorphism
- [ ] Tabelle styled
- [ ] Grafici con palette brand
- [ ] Empty states con illustrazioni

### Chatbot
- [ ] Header con branding
- [ ] Messaggi AI (white, left)
- [ ] Messaggi utente (gradient, right)
- [ ] Typing indicator animato
- [ ] Input area
- [ ] Progress indicator

### Auth Pages
- [ ] Split layout
- [ ] Form styling
- [ ] Validation states
- [ ] Social login buttons (se presenti)

### Generale
- [ ] Font Inter caricato
- [ ] Colori palette corretti
- [ ] Border radius consistenti
- [ ] Shadow system implementato
- [ ] Animazioni smooth
- [ ] Responsive su tutti i breakpoint
- [ ] Accessibility verificata

---

## 14. NOTE FINALI

### Do's ✅
- Usare sempre glassmorphism per cards su sfondi colorati/gradient
- Mantenere sfumature soft sui separatori (mai bordi netti)
- Animazioni sottili e non invasive
- Consistenza nei border-radius (pills = 100px, cards = 24-28px)
- Gradient text solo per headline importanti
- Separatori alti (280-320px) tra sezioni bianche

### Don'ts ❌
- Mai usare colori flat senza gradient o sfumature
- Mai bordi netti sui separatori (devono sfumare)
- Mai animazioni troppo veloci o appariscenti
- Mai testo colorato su sfondo colorato (leggibilità)
- Mai elementi troppo piccoli o sottili
- Mai parallax eccessivo (max 0.02 su pochi elementi)

---

*Questo documento è la guida definitiva per l'implementazione del design system di Business Tuner. Ogni pagina e componente della piattaforma deve seguire queste linee guida per garantire coerenza visiva e una user experience premium.*
