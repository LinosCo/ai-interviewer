
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
            fullName: z.string().nullable().describe("Candidate's full name"),
            email: z.string().nullable().describe("Email address"),
            phone: z.string().nullable().describe("Phone number"),
            currentRole: z.string().nullable().describe("Current job title or role"),
            company: z.string().nullable().describe("Current company or organization"),
            location: z.string().nullable().describe("City/Location"),
            linkedIn: z.string().nullable().describe("LinkedIn profile link/handle"),
            portfolio: z.string().nullable().describe("Portfolio or website URL"),
            budget: z.string().nullable().describe("Project budget (if applicable)"),
            availability: z.string().nullable().describe("Recruiting availability (e.g. notice period, start date)"),

            hardSkills: z.array(z.string()).describe("List of technical/hard skills mentioned"),
            softSkills: z.array(z.string()).describe("List of soft skills demonstrated"),

            experienceSummary: z.string().describe("Brief summary of experience (max 3 sentences)"),

            cultureFitScore: z.number().min(1).max(10).describe("1-10 Score on alignment with the goal"),
            recruiterNote: z.string().describe("Concise note for the recruiter about this candidate.")
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
