'use server';

import { sendLeadNotification } from '@/lib/email';

export async function submitLeadAction(formData: FormData) {
    const name = formData.get('name') as string;
    const surname = formData.get('surname') as string;
    const email = formData.get('email') as string;
    const company = formData.get('company') as string;
    const needs = formData.get('needs') as string;

    if (!name || !surname || !email || !company || !needs) {
        return { success: false, error: 'Tutti i campi sono obbligatori.' };
    }

    try {
        const result = await sendLeadNotification({
            name,
            surname,
            email,
            company,
            needs
        });

        if (!result.success) {
            return { success: false, error: 'Si è verificato un errore durante l\'invio della richiesta.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Lead submission error:', error);
        return { success: false, error: 'Errore interno del server.' };
    }
}
