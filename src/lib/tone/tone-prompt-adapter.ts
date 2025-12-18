import { ToneProfile } from './tone-analyzer';

export function buildToneAdaptationPrompt(profile: ToneProfile): string {
    const instructions = [];

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
}
