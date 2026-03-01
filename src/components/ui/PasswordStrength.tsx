'use client';

interface PasswordStrengthProps {
    password: string;
}

type Strength = 'weak' | 'medium' | 'strong';

function getStrength(password: string): Strength {
    if (password.length < 6) return 'weak';
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return 'weak';
    if (score <= 2) return 'medium';
    return 'strong';
}

const strengthConfig = {
    weak:   { label: 'Debole', color: '#EF4444', bars: 1 },
    medium: { label: 'Media',  color: '#F59E0B', bars: 2 },
    strong: { label: 'Forte',  color: '#10B981', bars: 3 },
} as const;

export function PasswordStrength({ password }: PasswordStrengthProps) {
    if (!password) return null;

    const strength = getStrength(password);
    const { label, color, bars } = strengthConfig[strength];

    return (
        <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                {[1, 2, 3].map((bar) => (
                    <div
                        key={bar}
                        style={{
                            flex: 1,
                            height: '4px',
                            borderRadius: '2px',
                            background: bar <= bars ? color : '#E5E7EB',
                            transition: 'background 0.2s ease',
                        }}
                    />
                ))}
            </div>
            <p style={{ fontSize: '0.75rem', color, fontWeight: 500 }}>{label}</p>
        </div>
    );
}
