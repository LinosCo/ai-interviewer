export function normalizeCandidateFieldIds(rawFields: any[]): string[] {
  if (!Array.isArray(rawFields)) return [];
  const normalized = rawFields
    .map((f: any) => (typeof f === 'string' ? f : (f?.id || f?.field || '')))
    .map((f: string) => String(f || '').trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export function responseMentionsCandidateField(responseText: string, fieldId: string): boolean {
  const text = String(responseText || '').toLowerCase();
  if (!text || !fieldId) return false;
  if (text.includes(fieldId.toLowerCase())) return true;

  if (fieldId === 'name' || fieldId === 'fullName') {
    return /\b(nome|cognome|name)\b/i.test(text);
  }
  if (fieldId === 'email') {
    return /\b(email|mail)\b/i.test(text);
  }
  if (fieldId === 'phone') {
    return /\b(telefono|phone|numero)\b/i.test(text);
  }
  if (fieldId === 'company') {
    return /\b(azienda|company|organizzazione)\b/i.test(text);
  }
  if (fieldId === 'role') {
    return /\b(ruolo|role|posizione)\b/i.test(text);
  }
  if (fieldId === 'linkedin') {
    return /\b(linkedin|profilo|profile)\b/i.test(text);
  }
  if (fieldId === 'portfolio') {
    return /\b(portfolio|sito web|website|url)\b/i.test(text);
  }
  if (fieldId === 'location') {
    return /\b(citt[àa]|city|location|localit[àa])\b/i.test(text);
  }
  if (fieldId === 'budget') {
    return /\b(budget)\b/i.test(text);
  }
  if (fieldId === 'availability') {
    return /\b(disponibilit[àa]|availability)\b/i.test(text);
  }
  return false;
}

export function extractDeterministicFieldValue(fieldName: string, userMessage: string): string | null {
  const text = userMessage.trim();
  if (!text) return null;

  if (fieldName === 'email') {
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return emailMatch ? emailMatch[0] : null;
  }

  if (fieldName === 'phone') {
    const phoneMatch = text.match(/\+?[0-9][0-9\s().-]{6,}[0-9]/);
    return phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : null;
  }

  if (fieldName === 'linkedin' || fieldName === 'portfolio') {
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    return urlMatch ? urlMatch[0] : null;
  }

  return null;
}
