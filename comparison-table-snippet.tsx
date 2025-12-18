// Feature Comparison Table Component - Insert after pricing cards, before closing </div></div></section>

{/* Feature Comparison Table */ }
<div style={{ marginTop: '5rem' }}>
    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h3 style={{ fontSize: '2rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Confronto completo delle funzionalità</h3>
        <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.9)' }}>Tutto quello che devi sapere per scegliere il piano giusto</p>
    </div>

    <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Table Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '1.5rem 2rem', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 600, color: colors.text, fontSize: '0.875rem' }}>Funzionalità</div>
            <div style={{ fontWeight: 600, color: colors.text, fontSize: '0.875rem', textAlign: 'center' }}>Starter</div>
            <div style={{ fontWeight: 600, color: colors.text, fontSize: '0.875rem', textAlign: 'center' }}>Pro</div>
            <div style={{ fontWeight: 600, color: colors.text, fontSize: '0.875rem', textAlign: 'center' }}>Business</div>
        </div>

        {/* Branding */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 600, color: colors.amberDark, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Branding</div>
            {[
                { feature: 'Senza watermark', starter: false, pro: true, business: true },
                { feature: 'Colore primario personalizzato', starter: true, pro: true, business: true },
                { feature: 'Logo aziendale', starter: false, pro: true, business: true },
                { feature: 'White label completo', starter: false, pro: false, business: true }
            ].map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.75rem 0', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: colors.text }}>{row.feature}</div>
                    <div style={{ textAlign: 'center' }}>{row.starter ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                    <div style={{ textAlign: 'center' }}>{row.pro ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                    <div style={{ textAlign: 'center' }}>{row.business ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                </div>
            ))}
        </div>

        {/* Analytics */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 600, color: colors.amberDark, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Analytics</div>
            {[
                { feature: 'Sentiment analysis', starter: true, pro: true, business: true },
                { feature: 'Estrazione temi automatica', starter: true, pro: true, business: true },
                { feature: 'Trend nel tempo', starter: false, pro: true, business: true },
                { feature: 'Confronto tra interviste', starter: false, pro: true, business: true }
            ].map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.75rem 0', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: colors.text }}>{row.feature}</div>
                    <div style={{ textAlign: 'center' }}>{row.starter ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                    <div style={{ textAlign: 'center' }}>{row.pro ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                    <div style={{ textAlign: 'center' }}>{row.business ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                </div>
            ))}
        </div>

        {/* Export */}
        <div style={{ padding: '1.5rem 2rem' }}>
            <div style={{ fontWeight: 600, color: colors.amberDark, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Export e Integrazioni</div>
            {[
                { feature: 'Export PDF', starter: true, pro: true, business: true },
                { feature: 'Export CSV', starter: false, pro: true, business: true },
                { feature: 'Webhook', starter: false, pro: true, business: true },
                { feature: 'API REST + Zapier', starter: false, pro: false, business: true }
            ].map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.75rem 0', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: colors.text }}>{row.feature}</div>
                    <div style={{ textAlign: 'center' }}>{row.starter ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                    <div style={{ textAlign: 'center' }}>{row.pro ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                    <div style={{ textAlign: 'center' }}>{row.business ? <Icons.Check size={18} color={colors.amber} /> : <span style={{ color: colors.muted, fontSize: '1.25rem' }}>—</span>}</div>
                </div>
            ))}
        </div>
    </div>
</div>
