export function normalizeGscSiteUrl(rawSiteUrl: string): { value: string; error?: string } {
  const trimmed = rawSiteUrl.trim();

  if (!trimmed) {
    return { value: '', error: 'GSC site URL not configured' };
  }

  if (/^sc-domain:/i.test(trimmed)) {
    const domain = trimmed.replace(/^sc-domain:/i, '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!domain) {
      return { value: '', error: 'GSC Site URL non valido: per la proprietà dominio usa sc-domain:dominio.tld' };
    }
    if (domain.includes('://')) {
      return { value: '', error: 'GSC Site URL non valido: non inserire protocollo in sc-domain:dominio.tld' };
    }
    return { value: `sc-domain:${domain}` };
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      value: '',
      error: 'GSC Site URL non valido: usa https://dominio.tld/ per URL-prefix oppure sc-domain:dominio.tld',
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        value: '',
        error: 'GSC Site URL non valido: protocollo supportato solo http/https',
      };
    }

    const pathname = parsed.pathname || '/';
    const normalizedPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return { value: `${parsed.protocol}//${parsed.host}${normalizedPath}` };
  } catch {
    return {
      value: '',
      error: 'GSC Site URL non valido: inserisci un URL valido (es. https://dominio.tld/)',
    };
  }
}
