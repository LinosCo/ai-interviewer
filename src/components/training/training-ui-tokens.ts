export const TRAINING_UI = {
  motion: {
    fast: 'transition-all duration-200 ease-out',
    base: 'transition-all duration-300 ease-out',
    slow: 'transition-all duration-500 ease-out',
  },
  ring: {
    subtle: 'ring-1 ring-black/5',
    focus: 'focus:outline-none focus:ring-2 focus:ring-offset-0',
  },
  copy: {
    landingCta: 'Inizia la formazione',
    landingLoading: 'Avvio in corso...',
    chatPlaceholder: 'Scrivi la tua risposta...',
    completionCta: 'Nuova sessione',
  },
} as const

