// Shared plan gate for Training Tool feature
// Training Tool is reserved for Business plans and above
export const TRAINING_BUSINESS_PLANS: string[] = ['BUSINESS', 'PARTNER', 'ENTERPRISE', 'ADMIN']

export function hasTrainingAccess(planType: string): boolean {
  return TRAINING_BUSINESS_PLANS.includes(planType)
}

// Shared date formatter used across training pages and components
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
