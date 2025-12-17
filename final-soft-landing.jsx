import React, { useState, useEffect } from 'react';

const FinalSoftLanding = () => {
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const colors = {
    gold: '#FBBF24',
    amber: '#F59E0B',
    amberDark: '#D97706',
    peach: '#FFECD2',
    coral: '#FFB088',
    apricot: '#FFD4A8',
    cream: '#FFFBF5',
    rose: '#FFE4E6',
    lavender: '#F3E8FF',
    sky: '#E0F2FE',
    text: '#1F1F1F',
    muted: '#525252',
    subtle: '#737373',
    white: '#FFFFFF'
  };

  const Logo = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="logoG" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.amberDark} />
          <stop offset="50%" stopColor={colors.amber} />
          <stop offset="100%" stopColor={colors.gold} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#logoG)" />
      <g fill="white" opacity="0.9">
        <rect x="8" y="28" width="5" height="12" rx="2" opacity="0.4" />
        <rect x="15" y="24" width="5" height="16" rx="2" opacity="0.55" />
        <rect x="22" y="18" width="5" height="22" rx="2" opacity="0.7" />
        <rect x="29" y="14" width="5" height="26" rx="2" opacity="0.85" />
        <rect x="36" y="20" width="5" height="20" rx="2" opacity="0.7" />
      </g>
      <path d="M10 34 L17.5 30 L24.5 22 L31.5 16 L38.5 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="31.5" cy="16" r="3" fill="white" />
    </svg>
  );

  const Icon = ({ type, size = 20 }) => {
    const icons = {
      arrow: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>,
      play: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10" /><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" /></svg>,
      users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>,
      building: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22V12h6v10M9 6h.01M15 6h.01M9 10h.01M15 10h.01" /></svg>,
      cart: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>,
      zap: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" /></svg>,
      star: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg>,
      check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20,6 9,17 4,12" /></svg>,
    };
    return icons[type] || null;
  };

  // ========== TALL SOFT WAVE SEPARATOR (300px, fades to white top & bottom) ==========
  const SoftWaveSeparator = ({ accentColor = colors.amber, height = 300, id = 'wave1' }) => (
    <div style={{ 
      width: '100%', 
      height: `${height}px`, 
      position: 'relative',
      overflow: 'hidden',
      background: `linear-gradient(180deg, 
        ${colors.white} 0%, 
        transparent 12%,
        transparent 88%,
        ${colors.white} 100%
      )`
    }}>
      <svg 
        style={{ position: 'absolute', width: '200%', left: '-50%', top: 0, height: '100%' }}
        viewBox={`0 0 2880 ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`softFade${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="15%" stopColor="white" stopOpacity="1" />
            <stop offset="85%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`fadeMask${id}`}>
            <rect width="100%" height="100%" fill={`url(#softFade${id})`} />
          </mask>
        </defs>
        
        <g mask={`url(#fadeMask${id})`}>
          {/* Large flowing wave 1 */}
          <path 
            d={`M0 ${height/2} C480 ${height*0.25} 960 ${height*0.75} 1440 ${height/2} C1920 ${height*0.25} 2400 ${height*0.75} 2880 ${height/2}`}
            fill="none"
            stroke={accentColor}
            strokeWidth="100"
            opacity="0.05"
            strokeLinecap="round"
          >
            <animate 
              attributeName="d" 
              dur="14s"
              repeatCount="indefinite"
              values={`
                M0 ${height/2} C480 ${height*0.25} 960 ${height*0.75} 1440 ${height/2} C1920 ${height*0.25} 2400 ${height*0.75} 2880 ${height/2};
                M0 ${height/2} C480 ${height*0.75} 960 ${height*0.25} 1440 ${height/2} C1920 ${height*0.75} 2400 ${height*0.25} 2880 ${height/2};
                M0 ${height/2} C480 ${height*0.25} 960 ${height*0.75} 1440 ${height/2} C1920 ${height*0.25} 2400 ${height*0.75} 2880 ${height/2}
              `}
            />
          </path>
          
          {/* Medium wave 2 */}
          <path 
            d={`M0 ${height/2} C360 ${height*0.35} 720 ${height*0.65} 1080 ${height/2} C1440 ${height*0.35} 1800 ${height*0.65} 2160 ${height/2} C2520 ${height*0.35} 2880 ${height*0.65} 2880 ${height/2}`}
            fill="none"
            stroke={accentColor}
            strokeWidth="60"
            opacity="0.04"
            strokeLinecap="round"
          >
            <animate 
              attributeName="d" 
              dur="10s"
              repeatCount="indefinite"
              values={`
                M0 ${height/2} C360 ${height*0.35} 720 ${height*0.65} 1080 ${height/2} C1440 ${height*0.35} 1800 ${height*0.65} 2160 ${height/2};
                M0 ${height/2} C360 ${height*0.65} 720 ${height*0.35} 1080 ${height/2} C1440 ${height*0.65} 1800 ${height*0.35} 2160 ${height/2};
                M0 ${height/2} C360 ${height*0.35} 720 ${height*0.65} 1080 ${height/2} C1440 ${height*0.35} 1800 ${height*0.65} 2160 ${height/2}
              `}
            />
          </path>

          {/* Thin accent line */}
          <path 
            d={`M0 ${height/2} Q720 ${height*0.3} 1440 ${height/2} T2880 ${height/2}`}
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
            opacity="0.15"
            strokeLinecap="round"
          >
            <animate 
              attributeName="d" 
              dur="7s"
              repeatCount="indefinite"
              values={`
                M0 ${height/2} Q720 ${height*0.3} 1440 ${height/2} T2880 ${height/2};
                M0 ${height/2} Q720 ${height*0.7} 1440 ${height/2} T2880 ${height/2};
                M0 ${height/2} Q720 ${height*0.3} 1440 ${height/2} T2880 ${height/2}
              `}
            />
          </path>
          
          {/* Second thin line */}
          <path 
            d={`M0 ${height*0.55} Q720 ${height*0.45} 1440 ${height*0.55} T2880 ${height*0.55}`}
            stroke={accentColor}
            strokeWidth="2"
            fill="none"
            opacity="0.1"
            strokeLinecap="round"
          >
            <animate 
              attributeName="d" 
              dur="9s"
              repeatCount="indefinite"
              values={`
                M0 ${height*0.55} Q720 ${height*0.45} 1440 ${height*0.55} T2880 ${height*0.55};
                M0 ${height*0.55} Q720 ${height*0.65} 1440 ${height*0.55} T2880 ${height*0.55};
                M0 ${height*0.55} Q720 ${height*0.45} 1440 ${height*0.55} T2880 ${height*0.55}
              `}
            />
          </path>
        </g>
      </svg>

      {/* Equalizer bars - left side */}
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '6%', 
        transform: 'translateY(-50%)',
        opacity: 0.07,
        filter: 'blur(0.5px)'
      }}>
        <svg width="180" height="80" viewBox="0 0 180 80">
          <defs>
            <linearGradient id={`barFadeL${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0" />
              <stop offset="25%" stopColor={accentColor} stopOpacity="1" />
              <stop offset="75%" stopColor={accentColor} stopOpacity="1" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0,1,2,3,4,5,6,7].map(i => (
            <rect key={i} x={i * 22} y={20} width="14" height={35 + Math.sin(i * 0.8) * 15} rx="5" fill={`url(#barFadeL${id})`}>
              <animate attributeName="height" values={`${35 + Math.sin(i * 0.8) * 15};${25 + Math.cos(i) * 10};${35 + Math.sin(i * 0.8) * 15}`} dur={`${1.8 + i * 0.15}s`} repeatCount="indefinite" />
            </rect>
          ))}
        </svg>
      </div>

      {/* Equalizer bars - right side */}
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        right: '6%', 
        transform: 'translateY(-50%)',
        opacity: 0.05,
        filter: 'blur(0.5px)'
      }}>
        <svg width="150" height="70" viewBox="0 0 150 70">
          {[0,1,2,3,4,5,6].map(i => (
            <rect key={i} x={i * 21} y={18} width="13" height={30 + Math.cos(i * 0.7) * 12} rx="5" fill={accentColor}>
              <animate attributeName="height" values={`${30 + Math.cos(i * 0.7) * 12};${22 + Math.sin(i) * 8};${30 + Math.cos(i * 0.7) * 12}`} dur={`${1.5 + i * 0.12}s`} repeatCount="indefinite" />
            </rect>
          ))}
        </svg>
      </div>
    </div>
  );

  // ========== TALL SOFT CHART SEPARATOR (280px) ==========
  const SoftChartSeparator = ({ color = colors.amber, height = 280, id = 'chart1' }) => (
    <div style={{ 
      width: '100%', 
      height: `${height}px`, 
      position: 'relative',
      overflow: 'hidden',
      background: `linear-gradient(180deg, 
        ${colors.white} 0%, 
        transparent 12%,
        transparent 88%,
        ${colors.white} 100%
      )`
    }}>
      <svg style={{ width: '100%', height: '100%' }} viewBox={`0 0 1440 ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`chartFade${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="20%" stopColor={color} stopOpacity="1" />
            <stop offset="80%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Chart bars */}
        {Array.from({ length: 55 }).map((_, i) => {
          const x = i * 26 + 8;
          const baseH = 60 + Math.sin(i * 0.28) * 35 + Math.cos(i * 0.45) * 25;
          return (
            <rect
              key={i}
              x={x}
              y={height/2 - baseH/2}
              width="16"
              height={baseH}
              rx="6"
              fill={`url(#chartFade${id})`}
              opacity={0.05 + Math.sin(i * 0.18) * 0.025}
            >
              <animate
                attributeName="height"
                values={`${baseH};${baseH * 0.55};${baseH * 1.15};${baseH}`}
                dur={`${2.8 + (i % 8) * 0.25}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                values={`${height/2 - baseH/2};${height/2 - baseH * 0.275};${height/2 - baseH * 0.575};${height/2 - baseH/2}`}
                dur={`${2.8 + (i % 8) * 0.25}s`}
                repeatCount="indefinite"
              />
            </rect>
          );
        })}

        {/* Trend line */}
        <path
          d={`M0 ${height/2} Q360 ${height*0.35} 720 ${height*0.45} T1440 ${height*0.4}`}
          stroke={color}
          strokeWidth="3"
          fill="none"
          opacity="0.12"
          strokeLinecap="round"
        >
          <animate
            attributeName="d"
            values={`M0 ${height/2} Q360 ${height*0.35} 720 ${height*0.45} T1440 ${height*0.4};M0 ${height*0.45} Q360 ${height*0.55} 720 ${height*0.4} T1440 ${height*0.5};M0 ${height/2} Q360 ${height*0.35} 720 ${height*0.45} T1440 ${height*0.4}`}
            dur="12s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </div>
  );

  // ========== ORANGE TRANSITION ==========
  const OrangeTransition = ({ toOrange = true, height = 200 }) => (
    <div style={{ 
      width: '100%', 
      height: `${height}px`, 
      position: 'relative',
      overflow: 'hidden',
      background: toOrange 
        ? `linear-gradient(180deg, ${colors.white} 0%, ${colors.peach} 30%, ${colors.apricot} 60%, rgba(251, 191, 36, 0.95) 100%)`
        : `linear-gradient(180deg, rgba(251, 191, 36, 0.95) 0%, ${colors.apricot} 40%, ${colors.peach} 70%, ${colors.white} 100%)`
    }}>
      <svg style={{ position: 'absolute', width: '200%', left: '-50%', top: 0, height: '100%' }} viewBox="0 0 2880 200" preserveAspectRatio="none">
        <path d="M0 100 C480 50 960 150 1440 100 C1920 50 2400 150 2880 100" fill="none" stroke="white" strokeWidth="60" opacity="0.2" strokeLinecap="round">
          <animate attributeName="d" dur="10s" repeatCount="indefinite" values="M0 100 C480 50 960 150 1440 100 C1920 50 2400 150 2880 100;M0 100 C480 150 960 50 1440 100 C1920 150 2400 50 2880 100;M0 100 C480 50 960 150 1440 100 C1920 50 2400 150 2880 100" />
        </path>
        <path d="M0 100 Q720 60 1440 100 T2880 100" stroke="white" strokeWidth="2" fill="none" opacity="0.35" strokeLinecap="round">
          <animate attributeName="d" dur="7s" repeatCount="indefinite" values="M0 100 Q720 60 1440 100 T2880 100;M0 100 Q720 140 1440 100 T2880 100;M0 100 Q720 60 1440 100 T2880 100" />
        </path>
      </svg>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: colors.white,
      position: 'relative',
      overflowX: 'hidden'
    }}>

      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.peach}50 0%, transparent 50%),
          radial-gradient(ellipse 60% 40% at 100% 30%, ${colors.rose}30 0%, transparent 40%),
          radial-gradient(ellipse 50% 30% at 0% 60%, ${colors.lavender}25 0%, transparent 35%),
          ${colors.white}
        `
      }} />

      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-5%', right: '0%', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle, ${colors.gold}12 0%, transparent 70%)`, filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: `radial-gradient(circle, ${colors.coral}08 0%, transparent 70%)`, filter: 'blur(50px)' }} />
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.3); } 50% { box-shadow: 0 0 40px rgba(251, 191, 36, 0.5); } }
        @keyframes waveTyping { 0%, 100% { transform: scaleY(0.4); opacity: 0.5; } 50% { transform: scaleY(1); opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>

      {/* Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '1rem 3rem',
        background: scrollY > 50 ? 'rgba(255,255,255,0.9)' : 'transparent',
        backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Logo size={36} />
            <span style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.text }}>Business Tuner</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {['Come funziona', 'Prezzi', 'Casi d\'uso'].map(item => (
              <a key={item} href="#" style={{ color: colors.muted, textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500' }}>{item}</a>
            ))}
            <button style={{ padding: '0.5rem 1.25rem', background: colors.text, color: colors.white, border: 'none', borderRadius: '100px', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>
              Prova gratis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: '80px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          
          <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(40px)', transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '100px', marginBottom: '1.5rem' }}>
              <div style={{ width: '8px', height: '8px', background: `linear-gradient(135deg, ${colors.gold}, ${colors.amber})`, borderRadius: '50%', animation: 'glow 2s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: '600', background: `linear-gradient(90deg, ${colors.amberDark}, ${colors.amber}, ${colors.amberDark})`, backgroundSize: '200% 100%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'shimmer 3s linear infinite' }}>
                Interviste qualitative con AI
              </span>
            </div>

            <h1 style={{ fontSize: '4rem', fontWeight: '600', color: colors.text, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '1.5rem' }}>
              Ascolta il mercato.
              <br />
              <span style={{ background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.amber} 50%, ${colors.coral} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Decidi meglio.
              </span>
            </h1>

            <p style={{ fontSize: '1.25rem', color: colors.muted, lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '480px' }}>
              Raccogli feedback qualitativi da clienti, dipendenti e stakeholder. Senza interviste manuali. Senza consulenti.
            </p>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '1rem 1.75rem', background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.amber} 100%)`, color: colors.white, border: 'none', borderRadius: '100px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', boxShadow: `0 8px 30px ${colors.amber}40`, position: 'relative', overflow: 'hidden' }}>
                Inizia gratis <Icon type="arrow" size={18} />
                <div style={{ position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', animation: 'shimmer 2s infinite' }} />
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', color: colors.muted, border: '1px solid rgba(0,0,0,0.08)', borderRadius: '100px', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' }}>
                <Icon type="play" size={18} /> Guarda demo
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              {[{ icon: 'building', label: 'B2B' }, { icon: 'cart', label: 'B2C' }, { icon: 'users', label: 'HR' }].map(uc => (
                <div key={uc.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '100px', color: colors.subtle, fontSize: '0.8125rem', fontWeight: '500' }}>
                  <Icon type={uc.icon} size={16} /> {uc.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', opacity: mounted ? 1 : 0, transform: mounted ? 'translateX(0)' : 'translateX(50px)', transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s' }}>
            <div style={{ position: 'absolute', top: '5%', left: '5%', right: '5%', bottom: '5%', background: `radial-gradient(ellipse, ${colors.gold}25 0%, transparent 60%)`, filter: 'blur(40px)' }} />

            <div style={{ position: 'relative', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderRadius: '28px', boxShadow: `0 30px 60px -10px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.8)`, overflow: 'hidden', animation: 'float 6s ease-in-out infinite' }}>
              <div style={{ background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.amber} 50%, ${colors.coral}90 100%)`, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: '600', fontSize: '1rem' }}>Feedback Clienti Q4</div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>12 risposte · 3 in corso</div>
                </div>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ width: '36px', height: '36px', background: `linear-gradient(135deg, ${colors.peach}, ${colors.apricot})`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Logo size={20} /></div>
                  <div style={{ background: 'rgba(255,255,255,0.9)', padding: '0.875rem 1rem', borderRadius: '18px', borderTopLeftRadius: '6px', maxWidth: '85%' }}>
                    <p style={{ fontSize: '0.9375rem', color: colors.text, margin: 0 }}>Cosa ti ha portato a scegliere il nostro servizio?</p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
                  <div style={{ background: `linear-gradient(135deg, ${colors.gold}, ${colors.amber})`, padding: '0.875rem 1rem', borderRadius: '18px', borderTopRightRadius: '6px', maxWidth: '85%', boxShadow: `0 4px 15px ${colors.amber}30` }}>
                    <p style={{ fontSize: '0.9375rem', color: 'white', margin: 0 }}>Cercavo più flessibilità. I competitor avevano contratti rigidi...</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: '36px', height: '36px', background: `linear-gradient(135deg, ${colors.peach}, ${colors.apricot})`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Logo size={20} /></div>
                  <div style={{ background: 'rgba(255,255,255,0.9)', padding: '0.875rem 1rem', borderRadius: '18px', borderTopLeftRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {[0,1,2,3,4].map(i => (
                      <div key={i} style={{ width: '3px', height: '14px', background: `linear-gradient(to top, ${colors.amber}, ${colors.gold})`, borderRadius: '2px', animation: 'waveTyping 0.8s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ position: 'absolute', bottom: '-30px', left: '-50px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: '18px', padding: '1rem 1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', maxWidth: '200px', transform: `translateY(${scrollY * 0.015}px)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}><Icon type="zap" size={14} /></div>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.text }}>Tema emergente</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: colors.muted, margin: 0 }}>"Flessibilità" citata dal <strong style={{ color: colors.amber }}>67%</strong></p>
            </div>

            <div style={{ position: 'absolute', top: '-20px', right: '15px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(15px)', borderRadius: '100px', padding: '0.625rem 1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem', transform: `translateY(${scrollY * -0.01}px)` }}>
              <div style={{ color: colors.gold }}><Icon type="star" size={14} /></div>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.text }}>4.9 rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Soft Wave Separator */}
      <SoftWaveSeparator accentColor={colors.amber} height={320} id="sep1" />

      {/* Stats */}
      <section style={{ position: 'relative', zIndex: 10, padding: '3rem 2rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '6rem' }}>
          {[{ value: '70%+', label: 'Tasso completamento' }, { value: '10 min', label: 'Setup intervista' }, { value: '1/10', label: 'Costo vs consulente' }].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: '600', background: `linear-gradient(135deg, ${colors.amberDark}, ${colors.gold})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stat.value}</div>
              <div style={{ fontSize: '0.9375rem', color: colors.subtle }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Soft Chart Separator */}
      <SoftChartSeparator color={colors.amber} height={300} id="sep2" />

      {/* How It Works */}
      <section style={{ position: 'relative', zIndex: 10, padding: '3rem 2rem 4rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: '600', color: colors.amberDark, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(251,191,36,0.1)', padding: '0.5rem 1rem', borderRadius: '100px', marginBottom: '1.5rem' }}>Come funziona</span>
          <h2 style={{ fontSize: '3rem', fontWeight: '600', color: colors.text, letterSpacing: '-0.02em', marginBottom: '4rem' }}>
            Da zero a insight in <span style={{ color: colors.amber }}>4 passi</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
            {[{ num: '01', title: 'Descrivi l\'obiettivo', desc: 'Scrivi cosa vuoi capire' }, { num: '02', title: 'L\'AI prepara tutto', desc: 'Domande generate in secondi' }, { num: '03', title: 'Condividi il link', desc: 'Via email, WhatsApp, etc' }, { num: '04', title: 'Ricevi gli insight', desc: 'Temi, citazioni, sentiment' }].map((step, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(15px)', borderRadius: '24px', padding: '2rem 1.5rem', boxShadow: '0 15px 40px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.8)' }}>
                <div style={{ width: '56px', height: '56px', background: `linear-gradient(135deg, ${colors.peach}, ${colors.apricot})`, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.125rem', fontWeight: '700', color: colors.amberDark }}>{step.num}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: colors.text, marginBottom: '0.5rem' }}>{step.title}</h3>
                <p style={{ fontSize: '0.875rem', color: colors.muted, lineHeight: 1.5, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Transition to Orange */}
      <OrangeTransition toOrange={true} height={200} />

      {/* Pricing */}
      <section style={{ position: 'relative', zIndex: 10, background: `linear-gradient(180deg, rgba(251, 191, 36, 0.95) 0%, ${colors.amber} 30%, ${colors.amber} 70%, rgba(251, 191, 36, 0.95) 100%)`, padding: '3rem 2rem 4rem', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 120% 60% at 50% -10%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(ellipse 100% 40% at 50% 110%, rgba(255,255,255,0.2) 0%, transparent 40%)` }} />

        <svg style={{ position: 'absolute', top: '15%', left: 0, right: 0, height: '150px', opacity: 0.15, pointerEvents: 'none' }} viewBox="0 0 1440 150" preserveAspectRatio="none">
          <path d="M0 75 Q360 40 720 75 T1440 75" stroke="white" strokeWidth="2" fill="none"><animate attributeName="d" dur="8s" repeatCount="indefinite" values="M0 75 Q360 40 720 75 T1440 75;M0 75 Q360 110 720 75 T1440 75;M0 75 Q360 40 720 75 T1440 75" /></path>
        </svg>

        <div style={{ position: 'absolute', top: '25%', left: '5%', opacity: 0.1 }}>
          <svg width="120" height="60" viewBox="0 0 120 60">{[0,1,2,3,4].map(i => (<rect key={i} x={i * 24} y={20} width="14" height={20 + Math.sin(i) * 10} rx="5" fill="white"><animate attributeName="height" values={`${20 + Math.sin(i) * 10};${30};${20 + Math.sin(i) * 10}`} dur={`${1.2 + i * 0.1}s`} repeatCount="indefinite" /></rect>))}</svg>
        </div>

        <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 5 }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: '600', color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', padding: '0.5rem 1rem', borderRadius: '100px', marginBottom: '1.5rem' }}>Prezzi semplici</span>
            <h2 style={{ fontSize: '3rem', fontWeight: '600', color: 'white', letterSpacing: '-0.02em', marginBottom: '1rem', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>Scegli il piano giusto per te</h2>
            <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.9)', maxWidth: '500px', margin: '0 auto' }}>Inizia gratis, scala quando cresci. Nessun costo nascosto.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
            {/* Starter */}
            <div style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(20px)', borderRadius: '28px', padding: '2.5rem 2rem', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '2rem' }}><h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'white', marginBottom: '0.5rem' }}>Starter</h3><p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>Per iniziare a esplorare</p></div>
              <div style={{ marginBottom: '2rem' }}><span style={{ fontSize: '3rem', fontWeight: '700', color: 'white' }}>€49</span><span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.8)' }}>/mese</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1 }}>{['3 interviste attive', '100 risposte/mese', 'Analisi base', 'Export PDF'].map((f, i) => (<li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', color: 'white', fontSize: '0.9375rem' }}><Icon type="check" size={18} />{f}</li>))}</ul>
              <button style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '100px', color: 'white', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>Inizia gratis</button>
            </div>

            {/* Professional */}
            <div style={{ background: 'white', borderRadius: '28px', padding: '2.5rem 2rem', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', transform: 'scale(1.05)', position: 'relative', zIndex: 2 }}>
              <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${colors.amberDark}, ${colors.amber})`, padding: '0.375rem 1rem', borderRadius: '100px', fontSize: '0.6875rem', fontWeight: '700', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Più popolare</div>
              <div style={{ marginBottom: '2rem' }}><h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: colors.text, marginBottom: '0.5rem' }}>Professional</h3><p style={{ fontSize: '0.875rem', color: colors.muted, margin: 0 }}>Per team in crescita</p></div>
              <div style={{ marginBottom: '2rem' }}><span style={{ fontSize: '3rem', fontWeight: '700', color: colors.text }}>€149</span><span style={{ fontSize: '1rem', color: colors.muted }}>/mese</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1 }}>{['10 interviste attive', '500 risposte/mese', 'Analisi avanzata AI', 'Temi e sentiment', 'Integrazione CRM', 'Supporto prioritario'].map((f, i) => (<li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', color: colors.text, fontSize: '0.9375rem' }}><div style={{ color: colors.amber }}><Icon type="check" size={18} /></div>{f}</li>))}</ul>
              <button style={{ width: '100%', padding: '1rem', background: `linear-gradient(135deg, ${colors.gold}, ${colors.amber})`, border: 'none', borderRadius: '100px', color: 'white', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', boxShadow: `0 8px 25px ${colors.amber}40` }}>Inizia ora →</button>
            </div>

            {/* Enterprise */}
            <div style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(20px)', borderRadius: '28px', padding: '2.5rem 2rem', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '2rem' }}><h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'white', marginBottom: '0.5rem' }}>Enterprise</h3><p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>Per grandi organizzazioni</p></div>
              <div style={{ marginBottom: '2rem' }}><span style={{ fontSize: '3rem', fontWeight: '700', color: 'white' }}>Custom</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1 }}>{['Interviste illimitate', 'Risposte illimitate', 'White-label', 'API access', 'SSO & compliance', 'Account manager'].map((f, i) => (<li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', color: 'white', fontSize: '0.9375rem' }}><Icon type="check" size={18} />{f}</li>))}</ul>
              <button style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '100px', color: 'white', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>Contattaci</button>
            </div>
          </div>
        </div>
      </section>

      {/* Transition from Orange */}
      <OrangeTransition toOrange={false} height={200} />

      {/* Testimonial */}
      <section style={{ position: 'relative', zIndex: 10, padding: '3rem 2rem 4rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderRadius: '32px', padding: '3rem', boxShadow: '0 25px 60px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.9)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginBottom: '1.5rem' }}>{[0,1,2,3,4].map(i => <div key={i} style={{ color: colors.gold }}><Icon type="star" size={20} /></div>)}</div>
            <p style={{ fontSize: '1.375rem', color: colors.text, lineHeight: 1.7, marginBottom: '1.5rem', fontStyle: 'italic' }}>"Abbiamo raccolto più insight in una settimana che in sei mesi di survey tradizionali. I clienti rispondono perché sembra una conversazione vera."</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', background: `linear-gradient(135deg, ${colors.peach}, ${colors.apricot})`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', fontWeight: '600', color: colors.amberDark }}>MR</div>
              <div style={{ textAlign: 'left' }}><div style={{ fontWeight: '600', color: colors.text }}>Marco Rossi</div><div style={{ fontSize: '0.875rem', color: colors.subtle }}>Head of CX, TechCorp Italia</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Soft Wave Separator */}
      <SoftWaveSeparator accentColor={colors.coral} height={280} id="sep3" />

      {/* CTA */}
      <section style={{ position: 'relative', zIndex: 10, padding: '3rem 2rem 5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '3rem', fontWeight: '600', color: colors.text, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
            Pronto ad <span style={{ background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ascoltare</span>?
          </h2>
          <p style={{ fontSize: '1.125rem', color: colors.muted, marginBottom: '2.5rem' }}>Crea la tua prima intervista in 10 minuti. Gratis.</p>
          <button style={{ padding: '1.125rem 2.5rem', background: `linear-gradient(135deg, ${colors.gold}, ${colors.amber})`, color: 'white', border: 'none', borderRadius: '100px', fontSize: '1.125rem', fontWeight: '600', cursor: 'pointer', boxShadow: `0 10px 40px ${colors.amber}40`, position: 'relative', overflow: 'hidden' }}>
            Inizia ora →
            <div style={{ position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', animation: 'shimmer 2s infinite' }} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 10, padding: '2rem 3rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Logo size={28} /><span style={{ fontSize: '0.9375rem', fontWeight: '600', color: colors.text }}>Business Tuner</span></div>
        <p style={{ fontSize: '0.75rem', color: colors.subtle }}>© 2025 Business Tuner. Tutti i diritti riservati.</p>
      </footer>

    </div>
  );
};

export default FinalSoftLanding;
