import { ToneProfile } from './tone-analyzer';

export function buildToneAdaptationPrompt(profile: ToneProfile, language: string = 'it'): string {
    const instructions: string[] = [];
    const isItalian = language.toLowerCase().startsWith('it');

    if (isItalian) {
        // Register
        if (profile.register === 'formal') {
            instructions.push("Mantieni un tono professionale e rispettoso.");
        } else if (profile.register === 'casual') {
            instructions.push("Usa un tono colloquiale e rilassato, come una chiacchierata tra colleghi.");
        }

        // Verbosity
        if (profile.verbosity === 'brief') {
            instructions.push("Sii conciso e diretto. Evita giri di parole.");
        } else if (profile.verbosity === 'verbose') {
            instructions.push("Sentiti libero di articolare le domande in modo più discorsivo, ma senza perdere il focus.");
        }

        // Emotionality & Emoji
        if (profile.emotionality === 'expressive' || profile.usesEmoji) {
            instructions.push("Puoi usare occasionalmente emoji per rendere la conversazione più calda.");
        } else if (profile.emotionality === 'reserved') {
            instructions.push("Evita emoji o eccessiva empatia manifesta; rimani oggettivo.");
        }

        // Complexity
        if (profile.complexity === 'simple') {
            instructions.push("Usa un linguaggio semplice e chiaro.");
        } else if (profile.complexity === 'complex') {
            instructions.push("Puoi usare una terminologia più tecnica o specifica se il contesto lo richiede.");
        }

        if (instructions.length === 0) return "";

        return `
### ADATTAMENTO TONO (Dynamic Tone Adaptation)
L'utente ha uno stile comunicativo specifico. Adattati come segue:
${instructions.map(i => `- ${i}`).join('\n')}
`.trim();
    } else {
        // English (and other languages — default to English instructions)
        if (profile.register === 'formal') {
            instructions.push("Maintain a professional and respectful tone.");
        } else if (profile.register === 'casual') {
            instructions.push("Use a conversational and relaxed tone, like chatting with a colleague.");
        }

        if (profile.verbosity === 'brief') {
            instructions.push("Be concise and direct. Avoid unnecessary elaboration.");
        } else if (profile.verbosity === 'verbose') {
            instructions.push("Feel free to articulate questions in a more discursive way, while staying focused.");
        }

        if (profile.emotionality === 'expressive' || profile.usesEmoji) {
            instructions.push("You may occasionally use emoji to make the conversation warmer.");
        } else if (profile.emotionality === 'reserved') {
            instructions.push("Avoid emoji or excessive displayed empathy; remain objective.");
        }

        if (profile.complexity === 'simple') {
            instructions.push("Use simple, clear language.");
        } else if (profile.complexity === 'complex') {
            instructions.push("You may use more technical or domain-specific terminology where appropriate.");
        }

        if (instructions.length === 0) return "";

        return `
### TONE ADAPTATION (Dynamic Tone Adaptation)
The user has a specific communication style. Adapt accordingly:
${instructions.map(i => `- ${i}`).join('\n')}
`.trim();
    }
}
