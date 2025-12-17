import React, { useState } from 'react';

const DesignSystemComplete = () => {
  const [activeSection, setActiveSection] = useState('icons');

  const colors = {
    primary: '#F59E0B',
    primaryLight: '#FCD34D',
    primaryDark: '#D97706',
    gold: '#FBBF24',
    deep: '#B45309',
    text: '#171717',
    muted: '#525252',
    subtle: '#737373',
    light: '#A3A3A3',
    bg: '#FAFAFA',
    white: '#FFFFFF',
    success: '#22C55E',
    error: '#EF4444',
    info: '#3B82F6'
  };

  // Icon system - monocromo elegante
  const icons = {
    // Navigation
    home: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
    dashboard: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
    analytics: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    settings: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),

    // Actions
    plus: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    edit: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    trash: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3,6 5,6 21,6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
    copy: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
    ),
    share: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
    download: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7,10 12,15 17,10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    send: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22,2 15,22 11,13 2,9 22,2" />
      </svg>
    ),

    // Status
    check: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20,6 9,17 4,12" />
      </svg>
    ),
    checkCircle: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11.01" />
      </svg>
    ),
    alertCircle: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    info: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),

    // Business/Domain
    users: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    user: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    building: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="9" y1="22" x2="9" y2="18" />
        <line x1="15" y1="22" x2="15" y2="18" />
        <line x1="8" y1="6" x2="8" y2="6.01" />
        <line x1="12" y1="6" x2="12" y2="6.01" />
        <line x1="16" y1="6" x2="16" y2="6.01" />
        <line x1="8" y1="10" x2="8" y2="10.01" />
        <line x1="12" y1="10" x2="12" y2="10.01" />
        <line x1="16" y1="10" x2="16" y2="10.01" />
        <line x1="8" y1="14" x2="8" y2="14.01" />
        <line x1="12" y1="14" x2="12" y2="14.01" />
        <line x1="16" y1="14" x2="16" y2="14.01" />
      </svg>
    ),
    cart: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
      </svg>
    ),
    chat: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    inbox: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22,12 16,12 14,15 10,15 8,12 2,12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
      </svg>
    ),

    // Arrows
    arrowRight: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12,5 19,12 12,19" />
      </svg>
    ),
    arrowLeft: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12,19 5,12 12,5" />
      </svg>
    ),
    chevronDown: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6,9 12,15 18,9" />
      </svg>
    ),
    externalLink: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
        <polyline points="15,3 21,3 21,9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    ),

    // Media
    play: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5,3 19,12 5,21 5,3" />
      </svg>
    ),
    pause: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    ),

    // Misc
    search: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    filter: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3" />
      </svg>
    ),
    calendar: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    clock: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12,6 12,12 16,14" />
      </svg>
    ),
    star: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2" />
      </svg>
    ),
    menu: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
    close: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    )
  };

  const iconCategories = {
    navigation: ['home', 'dashboard', 'analytics', 'settings'],
    actions: ['plus', 'edit', 'trash', 'copy', 'share', 'download', 'send'],
    status: ['check', 'checkCircle', 'alertCircle', 'info'],
    business: ['users', 'user', 'building', 'cart', 'chat', 'inbox'],
    arrows: ['arrowRight', 'arrowLeft', 'chevronDown', 'externalLink'],
    misc: ['search', 'filter', 'calendar', 'clock', 'star', 'menu', 'close', 'play', 'pause']
  };

  const sections = ['icons', 'buttons', 'inputs', 'loaders'];

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ background: `linear-gradient(135deg, ${colors.gold}, ${colors.primary})`, padding: '2rem', color: 'white' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '600', margin: 0 }}>Business Tuner — Design System</h1>
        <p style={{ opacity: 0.8, marginTop: '0.5rem' }}>Componenti UI coordinati</p>
      </header>

      {/* Tabs */}
      <div style={{ background: colors.white, borderBottom: `1px solid ${colors.light}30`, padding: '0 2rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              style={{
                padding: '1rem 1.5rem',
                background: 'transparent',
                border: 'none',
                color: activeSection === s ? colors.primary : colors.muted,
                fontWeight: activeSection === s ? '600' : '400',
                borderBottom: activeSection === s ? `2px solid ${colors.primary}` : '2px solid transparent',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontSize: '0.9375rem'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Icons */}
        {activeSection === 'icons' && (
          <div>
            {Object.entries(iconCategories).map(([category, iconNames]) => (
              <div key={category} style={{ marginBottom: '3rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.subtle, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                  {category}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem' }}>
                  {iconNames.map(name => (
                    <div
                      key={name}
                      style={{
                        background: colors.white,
                        borderRadius: '12px',
                        padding: '1.25rem 1rem',
                        textAlign: 'center',
                        border: `1px solid ${colors.light}30`
                      }}
                    >
                      <div style={{ color: colors.text, marginBottom: '0.75rem' }}>
                        {icons[name](24)}
                      </div>
                      <p style={{ fontSize: '0.6875rem', color: colors.muted, margin: 0 }}>{name}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        {activeSection === 'buttons' && (
          <div>
            <div style={{ background: colors.white, borderRadius: '16px', padding: '2rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.subtle, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Variants</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  background: `linear-gradient(135deg, ${colors.gold}, ${colors.primary})`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  boxShadow: `0 4px 15px ${colors.primary}30`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  Primary {icons.arrowRight(16)}
                </button>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  background: colors.text,
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Secondary
                </button>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  color: colors.text,
                  border: `1.5px solid ${colors.light}50`,
                  borderRadius: '100px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Outline
                </button>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  color: colors.primary,
                  border: 'none',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Ghost
                </button>
              </div>
            </div>

            <div style={{ background: colors.white, borderRadius: '16px', padding: '2rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.subtle, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Sizes</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button style={{ padding: '0.5rem 1rem', background: colors.primary, color: 'white', border: 'none', borderRadius: '100px', fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer' }}>Small</button>
                <button style={{ padding: '0.75rem 1.5rem', background: colors.primary, color: 'white', border: 'none', borderRadius: '100px', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>Medium</button>
                <button style={{ padding: '1rem 2rem', background: colors.primary, color: 'white', border: 'none', borderRadius: '100px', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' }}>Large</button>
              </div>
            </div>

            <div style={{ background: `linear-gradient(135deg, ${colors.deep}, ${colors.primaryDark})`, borderRadius: '16px', padding: '2rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Su sfondo scuro</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button style={{ padding: '0.75rem 1.5rem', background: 'white', color: colors.primaryDark, border: 'none', borderRadius: '100px', fontWeight: '600', cursor: 'pointer' }}>Primary</button>
                <button style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '100px', fontWeight: '500', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>Secondary</button>
              </div>
            </div>
          </div>
        )}

        {/* Inputs */}
        {activeSection === 'inputs' && (
          <div style={{ maxWidth: '500px' }}>
            <div style={{ background: colors.white, borderRadius: '16px', padding: '2rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: colors.text, marginBottom: '0.5rem' }}>Text Input</label>
                <input type="text" placeholder="Inserisci testo..." style={{ width: '100%', padding: '0.875rem 1rem', border: `1.5px solid ${colors.light}50`, borderRadius: '12px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: colors.text, marginBottom: '0.5rem' }}>Focus State</label>
                <input type="text" placeholder="Focus attivo" style={{ width: '100%', padding: '0.875rem 1rem', border: `2px solid ${colors.primary}`, borderRadius: '12px', fontSize: '1rem', outline: 'none', boxShadow: `0 0 0 3px ${colors.primary}20`, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: colors.text, marginBottom: '0.5rem' }}>With Icon</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: colors.light }}>{icons.search(18)}</div>
                  <input type="text" placeholder="Cerca..." style={{ width: '100%', padding: '0.875rem 1rem 0.875rem 2.75rem', border: `1.5px solid ${colors.light}50`, borderRadius: '12px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: colors.text, marginBottom: '0.5rem' }}>Textarea</label>
                <textarea rows={3} placeholder="Descrivi l'obiettivo..." style={{ width: '100%', padding: '0.875rem 1rem', border: `1.5px solid ${colors.light}50`, borderRadius: '12px', fontSize: '1rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
        )}

        {/* Loaders */}
        {activeSection === 'loaders' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {/* Equalizer Loader */}
              <div style={{ background: colors.white, borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.subtle, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Equalizer</h4>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '4px', height: '48px', marginBottom: '1rem' }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{ width: '6px', background: `linear-gradient(to top, ${colors.primary}, ${colors.gold})`, borderRadius: '3px', animation: 'eqBar 0.6s ease-in-out infinite', animationDelay: `${i * 0.1}s`, height: '20px' }} />
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: colors.light }}>Caricamento pagine</p>
                <style>{`@keyframes eqBar { 0%, 100% { height: 14px; } 50% { height: 40px; } }`}</style>
              </div>

              {/* Pulse */}
              <div style={{ background: colors.white, borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.subtle, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Pulse</h4>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '48px', marginBottom: '1rem', position: 'relative' }}>
                  <div style={{ width: '14px', height: '14px', background: colors.primary, borderRadius: '50%', position: 'relative' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', border: `2px solid ${colors.primary}`, borderRadius: '50%', animation: 'pulseRing 2s ease-out infinite', animationDelay: `${i * 0.4}s`, opacity: 0 }} />
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: colors.light }}>Invio/broadcasting</p>
                <style>{`@keyframes pulseRing { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; } 100% { transform: translate(-50%, -50%) scale(3); opacity: 0; } }`}</style>
              </div>

              {/* Typing */}
              <div style={{ background: colors.white, borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.subtle, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Wave Typing</h4>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3px', height: '48px', marginBottom: '1rem' }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{ width: '3px', height: '16px', background: `linear-gradient(to top, ${colors.primary}, ${colors.gold})`, borderRadius: '2px', animation: 'waveType 0.8s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: colors.light }}>Chat typing</p>
                <style>{`@keyframes waveType { 0%, 100% { transform: scaleY(0.4); opacity: 0.5; } 50% { transform: scaleY(1); opacity: 1; } }`}</style>
              </div>

              {/* Spinner */}
              <div style={{ background: colors.white, borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: colors.subtle, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Dial</h4>
                <div style={{ display: 'flex', justifyContent: 'center', height: '48px', marginBottom: '1rem' }}>
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" fill="none" stroke={colors.light} strokeWidth="3" opacity="0.3" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" strokeDasharray="30 70" style={{ animation: 'spinDial 1.2s linear infinite', transformOrigin: 'center' }} />
                  </svg>
                </div>
                <p style={{ fontSize: '0.75rem', color: colors.light }}>Generazione AI</p>
                <style>{`@keyframes spinDial { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DesignSystemComplete;
