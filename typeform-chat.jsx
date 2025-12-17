import React, { useState, useEffect } from 'react';

const TypeformChat = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showContent, setShowContent] = useState(false);

  // Palette amber/gold
  const colors = {
    primary: '#F59E0B',
    primaryLight: '#FCD34D',
    primaryDark: '#D97706',
    gold: '#FBBF24',
    text: '#171717',
    muted: '#737373',
    subtle: '#A3A3A3',
    bg: '#FAFAFA',
    white: '#FFFFFF'
  };

  useEffect(() => {
    // Animazione d'ingresso
    setTimeout(() => setShowContent(true), 100);
    // Simula typing
    setTimeout(() => setIsTyping(true), 800);
    setTimeout(() => setIsTyping(false), 2000);
  }, [currentStep]);

  // Logo component - Resonance style
  const Logo = ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="logoGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={colors.gold} />
          <stop offset="100%" stopColor={colors.primary} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#logoGrad)" />
      <g fill="white">
        <rect x="8" y="22" width="3.5" height="10" rx="1.75" opacity="0.4" />
        <rect x="13" y="18" width="3.5" height="18" rx="1.75" opacity="0.55" />
        <rect x="18" y="14" width="3.5" height="26" rx="1.75" opacity="0.7" />
        <rect x="23" y="10" width="3.5" height="34" rx="1.75" />
        <rect x="28" y="14" width="3.5" height="26" rx="1.75" opacity="0.7" />
        <rect x="33" y="18" width="3.5" height="18" rx="1.75" opacity="0.55" />
        <rect x="38" y="22" width="3.5" height="10" rx="1.75" opacity="0.4" />
      </g>
    </svg>
  );

  // Icone monocromo eleganti
  const icons = {
    arrow: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10h12M12 6l4 4-4 4" />
      </svg>
    ),
    check: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10l4 4 8-8" />
      </svg>
    ),
    skip: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 8h8M9 5l3 3-3 3" />
      </svg>
    ),
    time: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="7" cy="7" r="5.5" />
        <path d="M7 4v3l2 1.5" />
      </svg>
    ),
    user: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="5" r="3" />
        <path d="M3 14c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
      </svg>
    )
  };

  // Typing indicator con wave animation
  const TypingIndicator = () => (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      padding: '12px 20px',
      background: colors.bg,
      borderRadius: '20px'
    }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          style={{
            width: '3px',
            height: '14px',
            background: `linear-gradient(to top, ${colors.primary}, ${colors.gold})`,
            borderRadius: '2px',
            animation: 'waveTyping 0.8s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
      <style>{`
        @keyframes waveTyping {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  // Progress bar con wave effect
  const ProgressBar = ({ value }) => (
    <div style={{ position: 'relative' }}>
      <div style={{
        height: '3px',
        background: '#E5E5E5',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: `linear-gradient(90deg, ${colors.primaryDark}, ${colors.gold})`,
          borderRadius: '2px',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>
    </div>
  );

  const questions = [
    {
      id: 1,
      text: "Cosa ti ha portato a scegliere il nostro servizio rispetto ad altri?",
      placeholder: "Racconta la tua esperienza..."
    },
    {
      id: 2,
      text: "Su una scala da 1 a 10, quanto consiglieresti il nostro servizio?",
      type: 'scale'
    },
    {
      id: 3,
      text: "Qual è stata la cosa che ti ha sorpreso di più?",
      placeholder: "Positivamente o negativamente..."
    }
  ];

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep) / questions.length) * 100;

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.white,
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      {/* Sfondo con wave pattern sottile */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.06) 0%, transparent 50%)`,
        pointerEvents: 'none'
      }} />

      {/* Wave decoration - top */}
      <svg 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.03 }} 
        viewBox="0 0 1440 200" 
        fill="none"
      >
        <path 
          d="M0 100C360 50 720 150 1080 100C1260 75 1380 50 1440 50V0H0V100Z" 
          fill={colors.primary}
        />
      </svg>

      {/* Header */}
      <header style={{
        padding: '1.25rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Logo size={36} />
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: colors.text, letterSpacing: '-0.01em' }}>
              Feedback Clienti
            </div>
            <div style={{ fontSize: '0.75rem', color: colors.muted }}>
              Acme Corp
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: colors.subtle, fontSize: '0.75rem' }}>
            {icons.time}
            <span>~5 min</span>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div style={{ padding: '0 2rem' }}>
        <ProgressBar value={progress} />
      </div>

      {/* Main content - Typeform style: centered, one question */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem 2rem',
        maxWidth: '640px',
        margin: '0 auto',
        width: '100%',
        position: 'relative',
        zIndex: 5
      }}>
        
        <div style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {/* Question number */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: colors.primary,
              background: `linear-gradient(135deg, ${colors.gold}20, ${colors.primary}20)`,
              padding: '0.25rem 0.75rem',
              borderRadius: '100px'
            }}>
              {currentStep + 1} / {questions.length}
            </span>
          </div>

          {/* Question */}
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '500',
            color: colors.text,
            lineHeight: 1.4,
            letterSpacing: '-0.02em',
            marginBottom: '2.5rem'
          }}>
            {currentQuestion.text}
          </h1>

          {/* Typing indicator or input */}
          {isTyping ? (
            <TypingIndicator />
          ) : currentQuestion.type === 'scale' ? (
            // Scale selector
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    border: '2px solid #E5E5E5',
                    background: 'white',
                    color: colors.text,
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.target.style.borderColor = colors.primary;
                    e.target.style.background = `linear-gradient(135deg, ${colors.gold}15, ${colors.primary}15)`;
                  }}
                  onMouseLeave={e => {
                    e.target.style.borderColor = '#E5E5E5';
                    e.target.style.background = 'white';
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            // Text input
            <div>
              <textarea
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={currentQuestion.placeholder}
                rows={3}
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  fontSize: '1.125rem',
                  border: '2px solid #E5E5E5',
                  borderRadius: '16px',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  color: colors.text,
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = colors.primary}
                onBlur={e => e.target.style.borderColor = '#E5E5E5'}
              />
            </div>
          )}

          {/* Actions */}
          {!isTyping && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '2rem',
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateY(0)' : 'translateY(10px)',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s'
            }}>
              <button
                onClick={() => {
                  setShowContent(false);
                  setTimeout(() => {
                    setCurrentStep(s => (s + 1) % questions.length);
                    setInputValue('');
                  }, 300);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 1.5rem',
                  background: `linear-gradient(135deg, ${colors.gold}, ${colors.primary})`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  boxShadow: `0 4px 20px ${colors.primary}40`,
                  transition: 'all 0.2s ease'
                }}
              >
                Continua
                {icons.arrow}
              </button>

              <button style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: colors.subtle,
                border: 'none',
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }}>
                Salta
                {icons.skip}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.5rem',
        position: 'relative',
        zIndex: 10
      }}>
        <span style={{ fontSize: '0.6875rem', color: colors.subtle }}>Powered by</span>
        <Logo size={20} />
        <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: colors.muted }}>Business Tuner</span>
      </footer>

      {/* Wave decoration - bottom */}
      <svg 
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.03 }} 
        viewBox="0 0 1440 200" 
        fill="none"
      >
        <path 
          d="M0 100C360 150 720 50 1080 100C1260 125 1380 150 1440 150V200H0V100Z" 
          fill={colors.primary}
        />
      </svg>
    </div>
  );
};

export default TypeformChat;
