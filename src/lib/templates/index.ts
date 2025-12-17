// Template registry for Voler.AI

export type { Template } from './types';
import { Template } from './types';

import { feedbackProductTemplate } from './feedback-product';
import { exitInterviewTemplate } from './exit-interview';
import { customerChurnTemplate } from './customer-churn';
import { onboardingCheckinTemplate } from './onboarding-checkin';
import { conceptTestingTemplate } from './concept-testing';

export const templates: Template[] = [
    feedbackProductTemplate,
    exitInterviewTemplate,
    customerChurnTemplate,
    onboardingCheckinTemplate,
    conceptTestingTemplate,
];

export function getTemplateBySlug(slug: string): Template | undefined {
    return templates.find(t => t.slug === slug);
}

export function getTemplatesByCategory(category: Template['category']): Template[] {
    return templates.filter(t => t.category === category);
}
