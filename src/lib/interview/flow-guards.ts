export function getNextMissingCandidateField(
    candidateFieldIds: string[],
    currentProfile: Record<string, unknown>,
    fieldAttemptCounts: Record<string, number> | undefined,
    maxAttempts: number = 3
): string | null {
    for (const fieldName of candidateFieldIds) {
        const attempts = fieldAttemptCounts?.[fieldName] || 0;
        const value = currentProfile[fieldName];
        const normalizedValue = typeof value === 'string' ? value.trim() : value;
        const isSkipped = normalizedValue === '__SKIPPED__';
        const isCollected = normalizedValue !== null && normalizedValue !== undefined && normalizedValue !== '';
        const exceededAttempts = attempts >= maxAttempts;

        if (isCollected || isSkipped || exceededAttempts) continue;
        return fieldName;
    }
    return null;
}

export function isConsentPendingForDataCollection(params: {
    shouldCollectData: boolean;
    candidateFieldIds: string[];
    consentGiven: boolean | null;
    dataCollectionRefused?: boolean;
}): boolean {
    const { shouldCollectData, candidateFieldIds, consentGiven, dataCollectionRefused } = params;
    if (!shouldCollectData) return false;
    if (candidateFieldIds.length === 0) return false;
    if (dataCollectionRefused) return false;
    return consentGiven !== true;
}

export function getFieldLabel(field: string, lang: string): string {
    const labels: Record<string, { it: string; en: string; fr: string; de: string; es: string }> = {
        name: { it: 'il tuo nome e cognome', en: 'your full name', fr: 'votre nom et prénom', de: 'dein Vor- und Nachname', es: 'tu nombre y apellido' },
        fullName: { it: 'il tuo nome e cognome', en: 'your full name', fr: 'votre nom et prénom', de: 'dein Vor- und Nachname', es: 'tu nombre y apellido' },
        email: { it: 'il tuo indirizzo email', en: 'your email address', fr: 'votre adresse e-mail', de: 'deine E-Mail-Adresse', es: 'tu dirección de correo electrónico' },
        phone: { it: 'il tuo numero di telefono', en: 'your phone number', fr: 'votre numéro de téléphone', de: 'deine Telefonnummer', es: 'tu número de teléfono' },
        company: { it: 'il nome della tua azienda', en: 'your company name', fr: 'le nom de votre entreprise', de: 'den Namen deines Unternehmens', es: 'el nombre de tu empresa' },
        linkedin: { it: 'il tuo profilo LinkedIn', en: 'your LinkedIn profile', fr: 'votre profil LinkedIn', de: 'dein LinkedIn-Profil', es: 'tu perfil de LinkedIn' },
        role: { it: 'il tuo ruolo attuale', en: 'your current role', fr: 'votre rôle actuel', de: 'deine aktuelle Rolle', es: 'tu rol actual' },
        location: { it: 'la tua città', en: 'your city', fr: 'votre ville', de: 'deine Stadt', es: 'tu ciudad' },
        budget: { it: 'il tuo budget', en: 'your budget', fr: 'votre budget', de: 'dein Budget', es: 'tu presupuesto' },
        availability: { it: 'la tua disponibilità', en: 'your availability', fr: 'votre disponibilité', de: 'deine Verfügbarkeit', es: 'tu disponibilidad' },
    };
    return labels[field]?.[lang as 'it' | 'en' | 'fr' | 'de' | 'es'] || field;
}
