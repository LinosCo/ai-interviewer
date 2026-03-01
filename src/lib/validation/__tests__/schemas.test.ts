import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas';

describe('loginSchema', () => {
    it('rejects empty email', () => {
        const result = loginSchema.safeParse({ email: '', password: 'abc123' });
        expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
        const result = loginSchema.safeParse({ email: 'notanemail', password: 'abc123' });
        expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
        const result = loginSchema.safeParse({ email: 'a@b.com', password: '123' });
        expect(result.success).toBe(false);
    });

    it('accepts valid credentials', () => {
        const result = loginSchema.safeParse({ email: 'user@example.com', password: 'mypassword123' });
        expect(result.success).toBe(true);
    });
});

describe('registerSchema', () => {
    it('rejects mismatched passwords', () => {
        const result = registerSchema.safeParse({
            name: 'Mario',
            email: 'mario@example.com',
            password: 'Password123',
            confirmPassword: 'differentpassword',
        });
        expect(result.success).toBe(false);
    });

    it('rejects weak password', () => {
        const result = registerSchema.safeParse({
            name: 'Mario',
            email: 'mario@example.com',
            password: '123',
            confirmPassword: '123',
        });
        expect(result.success).toBe(false);
    });

    it('accepts valid registration data', () => {
        const result = registerSchema.safeParse({
            name: 'Mario Rossi',
            email: 'mario@example.com',
            password: 'SecurePass123',
            confirmPassword: 'SecurePass123',
        });
        expect(result.success).toBe(true);
    });
});

describe('forgotPasswordSchema', () => {
    it('rejects invalid email', () => {
        const result = forgotPasswordSchema.safeParse({ email: 'notvalid' });
        expect(result.success).toBe(false);
    });

    it('accepts valid email', () => {
        const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
        expect(result.success).toBe(true);
    });
});

describe('resetPasswordSchema', () => {
    it('rejects short password', () => {
        const result = resetPasswordSchema.safeParse({ password: '123', confirmPassword: '123' });
        expect(result.success).toBe(false);
    });

    it('rejects mismatched passwords', () => {
        const result = resetPasswordSchema.safeParse({ password: 'LongPass123', confirmPassword: 'Different123' });
        expect(result.success).toBe(false);
    });

    it('accepts valid reset data', () => {
        const result = resetPasswordSchema.safeParse({ password: 'NewPass123', confirmPassword: 'NewPass123' });
        expect(result.success).toBe(true);
    });
});
