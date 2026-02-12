export function buildQualityCorrectionPrompt(params: {
  language: string;
  enforceTopic: string;
  userContext: string;
  previousAssistant: string;
  clarifyPreviousQuestion?: boolean;
  scopeBoundaryRequired?: boolean;
}): string {
  const {
    language,
    enforceTopic,
    userContext,
    previousAssistant,
    clarifyPreviousQuestion = false,
    scopeBoundaryRequired = false
  } = params;
  if ((language || '').toLowerCase().startsWith('it')) {
    return `Rigenera in modo naturale.
Vincoli:
1) Mantieni una breve frase di legame con l'ultimo messaggio utente.
2) Fai ESATTAMENTE una sola domanda.
3) Evita ripetizioni rispetto alla domanda precedente.
4) Rimani sul topic "${enforceTopic}".
5) Non chiudere e non chiedere contatti.
6) Evita formule generiche ("molto interessante", "e un punto importante", "grazie per aver condiviso"): agganciati a un dettaglio concreto del messaggio utente.
${clarifyPreviousQuestion ? `7) L'utente chiede chiarimento: rispondi prima chiarendo in modo diretto cosa intendevi, poi fai una sola domanda coerente.` : ''}
${scopeBoundaryRequired ? `8) L'utente ha posto una domanda fuori scopo: esplicita gentilmente il perimetro dell'intervista e poi reindirizza al topic con una sola domanda.` : ''}
Ultimo messaggio utente: "${userContext}"
Domanda precedente assistente (da non ripetere): "${previousAssistant}"`;
  }

  return `Regenerate naturally.
Constraints:
1) Keep a short bridging sentence with the user's latest message.
2) Ask EXACTLY one question.
3) Avoid repeating the previous assistant question.
4) Stay on topic "${enforceTopic}".
5) Do not close and do not ask for contacts.
6) Avoid generic openers ("very interesting", "that's an important point", "thanks for sharing"): ground your bridge in one concrete user detail.
${clarifyPreviousQuestion ? `7) The user asked for clarification: first clarify directly what you meant, then ask one coherent follow-up question.` : ''}
${scopeBoundaryRequired ? `8) The user asked an out-of-scope question: politely state the interview scope, then redirect to the topic with one focused question.` : ''}
Latest user message: "${userContext}"
Previous assistant question (do not repeat): "${previousAssistant}"`;
}

export function buildAdditiveQuestionPrompt(params: {
  language: string;
  hasMultipleQuestionsNow: boolean;
  enforceTopic: string;
  userContext?: string;
}): string {
  const { language, hasMultipleQuestionsNow, enforceTopic, userContext } = params;
  if ((language || '').toLowerCase().startsWith('it')) {
    return `La tua risposta è buona ma ${hasMultipleQuestionsNow ? 'contiene più di una domanda' : 'manca la domanda'}.
Mantieni il riconoscimento della risposta dell'utente e usa una sola domanda naturale di follow-up su "${enforceTopic}".
Evita formule di cortesia generiche ("molto interessante", "e un punto importante", "grazie per aver condiviso"): cita invece un dettaglio concreto emerso ora.
${userContext ? `Contesto utente: "${userContext}"` : ''}
Rispondi con il messaggio completo (riconoscimento + domanda).`;
  }

  return `Your response is good but ${hasMultipleQuestionsNow ? 'contains more than one question' : 'is missing the question'}.
Keep your acknowledgment of the user's response and use one natural follow-up question about "${enforceTopic}".
Avoid generic courtesy openers ("very interesting", "that's an important point", "thanks for sharing"): anchor on one concrete detail from the user response.
${userContext ? `User context: "${userContext}"` : ''}
Reply with the complete message (acknowledgment + question).`;
}
