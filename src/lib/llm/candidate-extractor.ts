
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Message } from '@prisma/client';

export class CandidateExtractor {

    static async extractProfile(
        messages: Message[],
        apiKey: string
    ) {
        const openai = createOpenAI({ apiKey });
        const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const schema = z.object({
            fullName: z.string().nullable().describe("Candidate's full name if mentioned, else null"),
            email: z.string().nullable().describe("Email address if mentioned"),
            phone: z.string().nullable().describe("Phone number if mentioned"),
            location: z.string().nullable().describe("City/Location if mentioned"),
            linkedIn: z.string().nullable().describe("LinkedIn URL or handle if mentioned"),

            hardSkills: z.array(z.string()).describe("List of technical/hard skills demonstrated or mentioned"),
            softSkills: z.array(z.string()).describe("List of soft skills (communication, leadership, etc) demonstratred"),

            experienceSummary: z.string().describe("Brief summary of experience/background (max 3 sentences)"),

            cultureFitScore: z.number().min(1).max(10).describe("1-10 Score on fit for the role/event based on enthusiasm and alignment"),
            recruiterNote: z.string().describe("Private note for the recruiter about this candidate's potential.")
        });

        try {
            const result = await generateObject({
                model: openai('gpt-4o'),
                schema,
                prompt: `
You are an expert HR Recruiter and Profiler.
Analyze the following interview transcript and extract a structured candidate profile.
Focus on factual data provided by the user (Candidate). 
Also evaluate their skills and fit based on their answers.

TRANSCRIPT:
${transcript}
`.trim()
            });

            return result.object;
        } catch (error) {
            console.error("Candidate Extraction Error", error);
            return null;
        }
    }
}
