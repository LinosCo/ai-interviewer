import { z } from 'zod';

export const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email obbligatoria')
        .email('Formato email non valido'),
    password: z
        .string()
        .min(6, 'La password deve essere di almeno 6 caratteri'),
});

export const registerSchema = z
    .object({
        name: z
            .string()
            .min(2, 'Il nome deve essere di almeno 2 caratteri')
            .max(100, 'Il nome è troppo lungo'),
        email: z
            .string()
            .min(1, 'Email obbligatoria')
            .email('Formato email non valido'),
        password: z
            .string()
            .min(8, 'La password deve essere di almeno 8 caratteri')
            .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
            .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
        confirmPassword: z.string().min(1, 'Conferma la password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Le password non coincidono',
        path: ['confirmPassword'],
    });

export const forgotPasswordSchema = z.object({
    email: z
        .string()
        .min(1, 'Email obbligatoria')
        .email('Formato email non valido'),
});

export const resetPasswordSchema = z
    .object({
        password: z
            .string()
            .min(8, 'La password deve essere di almeno 8 caratteri')
            .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
            .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
        confirmPassword: z.string().min(1, 'Conferma la password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Le password non coincidono',
        path: ['confirmPassword'],
    });

// Dashboard schemas
export const inviteMemberSchema = z.object({
    email: z
        .string()
        .min(1, 'Email obbligatoria')
        .email('Formato email non valido'),
});

export const createProjectSchema = z.object({
    name: z
        .string()
        .min(2, 'Il nome deve essere di almeno 2 caratteri')
        .max(100, 'Il nome è troppo lungo'),
    description: z.string().max(500, 'La descrizione è troppo lunga').optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
