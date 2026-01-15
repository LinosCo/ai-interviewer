import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  url: string;
  market: string;
  category?: string;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
}

interface TechnicalCheck {
  name: string;
  description: string;
  status: 'pass' | 'warning' | 'fail';
  score: number;
}

interface PlatformResult {
  name: string;
  query: string;
  response: string;
  mentioned: boolean;
  partial: boolean;
  confidence: number;
  analysis: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, market, category, userId, userEmail, sessionId }: AnalyzeRequest = await req.json();
    
    console.log('Analyzing URL:', url, 'Market:', market, 'SessionId:', sessionId || 'none');

    // Check query limit for authenticated users (non-admin)
    if (userId) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if user is admin
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      const isAdmin = roleData?.role === 'admin';

      if (!isAdmin) {
        // Count existing queries for this user
        const { count, error: countError } = await supabaseAdmin
          .from('analysis_queries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (countError) {
          console.error('Error counting queries:', countError);
        } else if (count !== null && count >= 5) {
          return new Response(
            JSON.stringify({ 
              error: 'LIMIT_REACHED',
              message: 'Hai raggiunto il limite di 5 analisi. Contatta il supporto per aumentare il limite.' 
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`User ${userId} has ${count}/5 queries`);
      } else {
        console.log(`User ${userId} is admin, no limit applied`);
      }
    }

    // 1. Extract site info (including brand, product names, and industry)
    const siteInfo = await extractSiteInfo(url);
    console.log('Site info extracted:', siteInfo);
    
    const brandName = siteInfo.brandName;
    const productName = siteInfo.productName;
    const industry = siteInfo.industry;
    console.log('Extracted - Brand:', brandName, 'Product:', productName || 'N/A', 'Industry:', industry);

    // 2. Perform technical checks
    const technicalChecks = await performTechnicalChecks(url);
    console.log('Technical checks completed:', technicalChecks.length);

    // 3. Test on AI platforms
    const platformTestResults = await testOnPlatforms(url, brandName, productName, industry, market, category, siteInfo);
    const platformResults = platformTestResults.results;
    const productAnalysis = platformTestResults.productAnalysis;
    console.log('Platform tests completed:', platformResults.length);
    
    // Separate active and coming soon platforms
    const activePlatforms = platformResults.filter(p => !p.response.startsWith('Errore durante il test: ') && !p.response.includes('not configured'));
    const comingSoonPlatforms = platformResults.filter(p => p.response.includes('not configured'));

    // 4. Calculate visibility score (only from active platforms)
    const visibilityScore = calculateVisibilityScore(technicalChecks, activePlatforms);
    console.log('Visibility score:', visibilityScore);

    // 5. Generate recommendations
    const recommendations = generateRecommendations(technicalChecks, activePlatforms, visibilityScore);
    console.log('Recommendations generated:', recommendations.length);

    // 6. Save query to database for lead generation
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin.from('analysis_queries').insert({
        url,
        brand_name: brandName,
        product_name: productName || null,
        industry,
        market,
        category,
        user_id: userId || null,
        user_email: userEmail || null,
        session_id: sessionId || null,
        visibility_score: visibilityScore,
        results: {
          siteInfo,
          technicalChecks,
          platformResults: activePlatforms,
          comingSoonPlatforms: comingSoonPlatforms.map(p => p.name),
          productAnalysis,
          recommendations
        }
      });
      
      console.log('Query saved to database');
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      // Continue even if database save fails
    }

    const response = {
      siteInfo: siteInfo,
      visibilityScore,
      technicalChecks,
      platformResults: activePlatforms,
      comingSoonPlatforms: comingSoonPlatforms.map(p => p.name),
      productAnalysis,
      recommendations,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-url function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractSiteInfo(url: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinosBot/1.0)' }
    });
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
    
    // Extract favicon
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
    let favicon = faviconMatch ? faviconMatch[1] : null;
    
    if (favicon && !favicon.startsWith('http')) {
      const baseUrl = new URL(url);
      favicon = new URL(favicon, baseUrl.origin).href;
    }
    
    // Extract brand name from various sources
    let brandName = '';
    
    // Try to extract from Open Graph site_name
    const ogSiteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    if (ogSiteNameMatch) {
      brandName = ogSiteNameMatch[1].trim();
    }
    
    // If not found, try Organization schema
    if (!brandName) {
      const orgSchemaMatch = html.match(/"@type":\s*"Organization"[^}]*"name":\s*"([^"]+)"/i);
      if (orgSchemaMatch) {
        brandName = orgSchemaMatch[1].trim();
      }
    }
    
    // If still not found, extract from title (first part before separators)
    if (!brandName && title) {
      const cleanTitle = title.split(/[|-–—]/)[0].trim();
      brandName = cleanTitle;
    }
    
    // Fallback to hostname
    if (!brandName) {
      const hostname = new URL(url).hostname;
      brandName = hostname.replace('www.', '').split('.')[0];
      brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1);
    }
    
    // Extract product name from various sources
    let productName = '';
    
    // Try to extract from Open Graph title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      productName = ogTitleMatch[1].trim();
      // Remove brand name from product name if present
      if (brandName && productName.toLowerCase().includes(brandName.toLowerCase())) {
        productName = productName.replace(new RegExp(brandName, 'gi'), '').trim();
        productName = productName.replace(/^[|-–—]\s*/, '').replace(/\s*[|-–—]$/, '').trim();
      }
    }
    
    // Try to extract from Product or Service schema
    if (!productName) {
      const schemaMatch = html.match(/"@type":\s*"(Product|Service)"[^}]*"name":\s*"([^"]+)"/i);
      if (schemaMatch) {
        productName = schemaMatch[2].trim();
      }
    }
    
    // Try h1 tag as fallback
    if (!productName) {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        productName = h1Match[1].trim();
        // Remove brand name if present
        if (brandName && productName.toLowerCase().includes(brandName.toLowerCase())) {
          productName = productName.replace(new RegExp(brandName, 'gi'), '').trim();
          productName = productName.replace(/^[|-–—]\s*/, '').replace(/\s*[|-–—]$/, '').trim();
        }
      }
    }
    
    console.log('Extracted brand:', brandName, 'product:', productName || 'none');
    
    // Extract meta description
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) || 
                         html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const metaDescription = metaDescMatch ? metaDescMatch[1] : '';
    
    // Extract industry/sector from meta keywords, description, or content
    let industry = '';
    const keywordsMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
    const keywords = keywordsMatch ? keywordsMatch[1] : '';
    
    // Common industry mappings from schema types and keywords
    // More specific keywords should come first
    const industryKeywords: Record<string, string[]> = {
      'Bellezza': ['parrucchiere', 'acconciature', 'hair', 'stylist', 'barber', 'salon', 'salone', 'estetica', 'estetista', 'beauty', 'spa', 'nails', 'unghie', 'makeup', 'trucco'],
      'E-commerce': ['store', 'shop', 'ecommerce', 'retail', 'cart', 'acquista', 'acquisto', 'negozio online'],
      'SaaS': ['software as a service', 'saas platform', 'cloud software', 'gestionale'],
      'Turismo': ['hotel', 'travel', 'tourism', 'vacation', 'resort', 'booking', 'viaggio', 'vacanza'],
      'Food & Beverage': ['restaurant', 'food', 'cafe', 'dining', 'menu', 'recipe', 'ristorante', 'cibo'],
      'Salute': ['health', 'medical', 'healthcare', 'clinic', 'hospital', 'wellness', 'salute', 'medico'],
      'Finanza': ['bank', 'finance', 'investment', 'insurance', 'credit', 'loan', 'banca', 'investimento'],
      'Educazione': ['education', 'school', 'university', 'course', 'learning', 'training', 'scuola', 'università'],
      'Immobiliare': ['real estate', 'property', 'housing', 'apartment', 'realty', 'immobili', 'casa'],
      'Moda': ['fashion', 'clothing', 'apparel', 'style', 'wear', 'boutique', 'abbigliamento'],
      'Tecnologia': ['tech', 'technology', 'digital', 'innovation', 'electronics', 'tecnologia'],
      'Arredamento': ['furniture', 'arredamento', 'design', 'interior', 'decor', 'mobili']
    };
    
    const contentLower = (metaDescription + ' ' + keywords + ' ' + title).toLowerCase();
    for (const [sector, terms] of Object.entries(industryKeywords)) {
      if (terms.some(term => contentLower.includes(term))) {
        industry = sector;
        break;
      }
    }
    
    // Fallback to generic if not detected
    if (!industry) {
      industry = 'Generale';
    }
    
    // Extract visible text content (first 3000 chars for analysis)
    let textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000);
    
    return { 
      url, 
      title, 
      favicon,
      brandName: brandName || new URL(url).hostname,
      productName: productName || undefined,
      industry: industry,
      metaDescription,
      textContent
    };
  } catch (error) {
    console.error('Error extracting site info:', error);
    const hostname = new URL(url).hostname;
    const fallbackBrand = hostname.replace('www.', '').split('.')[0];
    return { 
      url, 
      title: hostname, 
      favicon: null,
      brandName: fallbackBrand.charAt(0).toUpperCase() + fallbackBrand.slice(1),
      productName: undefined,
      industry: 'Generale'
    };
  }
}

async function performTechnicalChecks(url: string): Promise<TechnicalCheck[]> {
  const checks: TechnicalCheck[] = [];
  
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // 1. Schema.org Markup
    checks.push({
      name: 'Schema.org Markup',
      description: 'Presenza di markup semantico per i motori di ricerca',
      status: html.includes('schema.org') ? 'pass' : 'fail',
      score: html.includes('schema.org') ? 10 : 0
    });
    
    // 2. JSON-LD Implementation
    checks.push({
      name: 'JSON-LD Implementation',
      description: 'Structured data in formato JSON-LD',
      status: html.includes('application/ld+json') ? 'pass' : 'fail',
      score: html.includes('application/ld+json') ? 10 : 0
    });
    
    // 3. Organization Schema
    const hasOrgSchema = html.includes('"@type":"Organization"') || html.includes('"@type": "Organization"');
    checks.push({
      name: 'Organization Schema',
      description: 'Schema Organization per identificare il brand',
      status: hasOrgSchema ? 'pass' : 'fail',
      score: hasOrgSchema ? 10 : 0
    });
    
    // 4. Meta Description
    const hasMetaDesc = html.includes('<meta name="description"') || html.includes('<meta property="og:description"');
    checks.push({
      name: 'Meta Description',
      description: 'Meta description ottimizzata per la SEO',
      status: hasMetaDesc ? 'pass' : 'fail',
      score: hasMetaDesc ? 10 : 0
    });
    
    // 5. Open Graph Tags
    const hasOG = html.includes('og:title') && html.includes('og:description');
    checks.push({
      name: 'Open Graph Tags',
      description: 'Tag Open Graph per social sharing',
      status: hasOG ? 'pass' : 'warning',
      score: hasOG ? 10 : 5
    });
    
    // 6. HTTPS Security
    checks.push({
      name: 'HTTPS Security',
      description: 'Connessione sicura HTTPS',
      status: url.startsWith('https://') ? 'pass' : 'fail',
      score: url.startsWith('https://') ? 10 : 0
    });
    
    // 7. Robots.txt
    try {
      const robotsUrl = new URL('/robots.txt', url).href;
      const robotsResponse = await fetch(robotsUrl);
      checks.push({
        name: 'Robots.txt',
        description: 'File robots.txt presente',
        status: robotsResponse.ok ? 'pass' : 'warning',
        score: robotsResponse.ok ? 5 : 2
      });
    } catch {
      checks.push({
        name: 'Robots.txt',
        description: 'File robots.txt presente',
        status: 'warning',
        score: 2
      });
    }
    
    // 8. Sitemap XML
    try {
      const sitemapUrl = new URL('/sitemap.xml', url).href;
      const sitemapResponse = await fetch(sitemapUrl);
      checks.push({
        name: 'Sitemap XML',
        description: 'Sitemap XML per l\'indicizzazione',
        status: sitemapResponse.ok ? 'pass' : 'warning',
        score: sitemapResponse.ok ? 5 : 2
      });
    } catch {
      checks.push({
        name: 'Sitemap XML',
        description: 'Sitemap XML per l\'indicizzazione',
        status: 'warning',
        score: 2
      });
    }
    
    // 9. Mobile Optimization
    const hasMobileTag = html.includes('viewport') && html.includes('width=device-width');
    checks.push({
      name: 'Mobile Optimization',
      description: 'Meta tag viewport per dispositivi mobili',
      status: hasMobileTag ? 'pass' : 'warning',
      score: hasMobileTag ? 10 : 5
    });
    
    // 10. Structured FAQ
    const hasFAQ = html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"');
    checks.push({
      name: 'Structured FAQ',
      description: 'Schema FAQ per featured snippets',
      status: hasFAQ ? 'pass' : 'warning',
      score: hasFAQ ? 10 : 0
    });
    
  } catch (error) {
    console.error('Error performing technical checks:', error);
  }
  
  return checks;
}

async function analyzeProductNeeds(
  url: string,
  brandName: string,
  productName: string | undefined,
  industry: string,
  market: string,
  siteContent: { title: string; metaDescription: string; textContent: string }
): Promise<{
  mainFunction: string;
  needs: { primary: string[], secondary: string[] };
  contexts: string[];
  clusters: string[];
  queries: string[];
}> {
  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

    const marketText = market === 'Italia' ? 'nel mercato italiano' : market === 'Europa' ? 'nel mercato europeo' : market === 'USA' ? 'nel mercato USA' : 'a livello globale';

    const analysisPrompt = `Analizza ATTENTAMENTE il seguente prodotto/servizio nel settore ${industry} ${marketText}.

INFORMAZIONI DISPONIBILI:
- Titolo pagina: ${siteContent.title}
- Descrizione: ${siteContent.metaDescription}
- Contenuto estratto: ${siteContent.textContent}

ISTRUZIONI CRITICHE:
1. Identifica la FUNZIONE PRINCIPALE del prodotto/servizio (sia che si tratti di un bene fisico o di un servizio)
2. Identifica i PROBLEMI e BISOGNI che risolve (primari e secondari)
3. Identifica i CONTESTI D'USO reali (per prodotti: luoghi, situazioni; per servizi: scenari, tipologie di clienti)
4. Identifica le CARATTERISTICHE RILEVANTI (per prodotti: tecniche, materiali, dimensioni; per servizi: competenze, disponibilità, modalità di erogazione)

GENERA 8-12 PROMPT UTENTE REALISTICI che:
- Descrivono SOLO bisogni, obiettivi o problemi da risolvere
- NON menzionano MAI il prodotto/servizio, il brand, il nome specifico o l'URL
- Sono formulati come domande naturali che un utente farebbe a ChatGPT/Gemini/Claude
- Includono vincoli realistici e specifici quando appropriati:
  * PER PRODOTTI: Budget preciso, Provenienza, Sostenibilità, Dimensioni/Ingombri, Trasporto, Caratteristiche tecniche, Certificazioni, Garanzia, Personalizzazione
  * PER SERVIZI: Budget/tariffe, Localizzazione geografica, Disponibilità oraria, Competenze/certificazioni richieste, Esperienza minima, Tempi di risposta, Modalità (online/offline/ibrido), Lingue parlate
- Rappresentano diversi profili di utenti (famiglia, professionista, studente, pensionato, azienda, startup, etc.)
- Simulano situazioni reali e urgenti

ESEMPI DI STILE (NON usare questi, creane di nuovi appropriati):
- "Cerco una soluzione per [problema] con budget massimo €X, possibilmente Made in Italy"
- "Ho bisogno di [funzionalità] per [contesto], quali opzioni sostenibili esistono sotto i €X?"
- "Qual è il miglior [categoria generica] per [situazione specifica] con [vincolo tecnico]?"

Rispondi ESCLUSIVAMENTE in formato JSON valido:
{
  "main_function": "descrizione concisa funzione principale (max 15 parole)",
  "primary_needs": ["bisogno1", "bisogno2", "bisogno3"],
  "secondary_needs": ["bisogno1", "bisogno2", "bisogno3"],
  "contexts": ["contesto1", "contesto2", "contesto3"],
  "clusters": ["cluster1", "cluster2", "cluster3"],
  "organic_queries": [
    "prompt1 realistico con vincoli specifici",
    "prompt2 realistico con vincoli specifici",
    "prompt3 realistico con vincoli specifici",
    "prompt4 realistico con vincoli specifici",
    "prompt5 realistico con vincoli specifici",
    "prompt6 realistico con vincoli specifici",
    "prompt7 realistico con vincoli specifici",
    "prompt8 realistico con vincoli specifici",
    "prompt9 realistico con vincoli specifici",
    "prompt10 realistico con vincoli specifici",
    "prompt11 realistico con vincoli specifici",
    "prompt12 realistico con vincoli specifici"
  ]
}`;

    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Sei un esperto di consumer research, analisi dei bisogni e user intent. Analizza attentamente il contenuto della pagina web e genera prompt utente realistici basati sui bisogni, MAI sul prodotto specifico. Rispondi ESCLUSIVAMENTE con JSON valido, senza markdown, backticks o testo aggiuntivo.' 
        },
        { role: 'user', content: analysisPrompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000
    };

    console.log('Calling OpenAI with model:', requestBody.model);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error details:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('OpenAI response data structure:', JSON.stringify(data, null, 2).substring(0, 500));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response structure:', data);
      throw new Error('Invalid response structure from OpenAI');
    }
    
    const content = data.choices[0].message.content;
    
    if (!content || content.trim() === '') {
      console.error('Empty content from OpenAI. Full response:', JSON.stringify(data, null, 2));
      throw new Error('Empty content received from OpenAI');
    }
    
    console.log('OpenAI raw response (first 500 chars):', content.substring(0, 500));
    
    // Extract JSON from response (remove markdown code blocks if present)
    let jsonString = content.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from response:', content);
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      mainFunction: parsed.main_function || 'Non disponibile',
      needs: {
        primary: parsed.primary_needs || [],
        secondary: parsed.secondary_needs || []
      },
      contexts: parsed.contexts || [],
      clusters: parsed.clusters || [],
      queries: parsed.organic_queries || []
    };
  } catch (error) {
    console.error('CRITICAL: Error analyzing product needs:', error);
    console.error('URL:', url);
    console.error('Brand:', brandName);
    console.error('Product:', productName);
    console.error('Industry:', industry);
    
    // NO FALLBACK - throw error to avoid showing stale/wrong data
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    throw new Error(`Impossibile generare l'analisi dei bisogni: ${errorMessage}`);
  }
}

async function testOnPlatforms(
  url: string,
  brandName: string,
  productName: string | undefined,
  industry: string,
  market: string,
  category: string | undefined,
  siteInfo: any
): Promise<{
  results: PlatformResult[];
  productAnalysis?: {
    mainFunction: string;
    needs: { primary: string[], secondary: string[] };
    contexts: string[];
    clusters: string[];
    queries: string[];
  };
}> {
  const results: PlatformResult[] = [];
  const targetName = productName || brandName;
  const targetType = productName ? 'prodotto' : 'brand';
  
  // Check which API keys are available
  const availableAPIs = {
    openai: !!Deno.env.get('OPENAI_API_KEY'),
    anthropic: !!Deno.env.get('ANTHROPIC_API_KEY'),
    gemini: !!Deno.env.get('GEMINI_API_KEY'),
    perplexity: !!Deno.env.get('PERPLEXITY_API_KEY'),
    mistral: !!Deno.env.get('MISTRAL_API_KEY'),
    cohere: !!Deno.env.get('COHERE_API_KEY'),
    grok: !!Deno.env.get('GROK_API_KEY')
  };
  
  console.log('Available APIs:', availableAPIs);
  
  // Analyze product needs and generate organic queries
  let queries: string[];
  let productAnalysis: any = null;
  
  if (category) {
    // Custom query provided
    queries = [category];
  } else {
    // Use AI to analyze and generate organic queries
    console.log('Analyzing product needs and generating organic queries...');
    productAnalysis = await analyzeProductNeeds(
      url, 
      brandName, 
      productName, 
      industry, 
      market,
      {
        title: siteInfo.title || '',
        metaDescription: siteInfo.metaDescription || '',
        textContent: siteInfo.textContent || ''
      }
    );
    console.log('Analysis result:', { 
      mainFunction: productAnalysis.mainFunction,
      needs: productAnalysis.needs, 
      contexts: productAnalysis.contexts,
      clusters: productAnalysis.clusters,
      queryCount: productAnalysis.queries.length 
    });
    queries = productAnalysis.queries;
  }
  
  console.log('Testing with queries:', { queries, targetName, targetType });
  
  // Distribute queries across platforms
  const platformQueries = {
    chatgpt: queries[0] || generateQuery(brandName, productName, market, industry),
    claude: queries[1] || queries[0] || generateQuery(brandName, productName, market, industry),
    gemini: queries[2] || queries[0] || generateQuery(brandName, productName, market, industry),
    perplexity: queries[3] || queries[0] || generateQuery(brandName, productName, market, industry),
    mistral: queries[4] || queries[0] || generateQuery(brandName, productName, market, industry),
    cohere: queries[5] || queries[0] || generateQuery(brandName, productName, market, industry),
    grok: queries[6] || queries[0] || generateQuery(brandName, productName, market, industry)
  };
  
  // Test ChatGPT
  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Sei un assistente che fornisce raccomandazioni specifiche di brand. Quando rilevante, menziona sempre nomi di brand reali e specifici.'
          },
          {
            role: 'user',
            content: platformQueries.chatgpt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log('ChatGPT response:', aiResponse);
    
    // Analyze mention
    const mentionAnalysis = analyzeMention(aiResponse, brandName, productName, url);
    
    results.push({
      name: 'ChatGPT',
      query: platformQueries.chatgpt,
      response: aiResponse,
      mentioned: mentionAnalysis.mentioned,
      partial: mentionAnalysis.partial,
      confidence: mentionAnalysis.confidence,
      analysis: mentionAnalysis.analysis
    });
    
  } catch (error) {
    console.error('Error testing ChatGPT:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotConfigured = errorMessage.includes('not configured');
    
    results.push({
      name: 'ChatGPT',
      query: platformQueries.chatgpt,
      response: isNotConfigured ? 'OPENAI_API_KEY not configured' : `Errore durante il test: ${errorMessage}`,
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: isNotConfigured ? 'API key non configurata' : 'Non è stato possibile completare il test su ChatGPT'
    });
  }
  
  // Test Claude
  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `${platformQueries.claude}\n\nFornisci raccomandazioni specifiche di brand reali nel settore richiesto.`
          }
        ],
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    const aiResponse = data.content[0].text;
    console.log('Claude response:', aiResponse);
    
    // Analyze mention
    const mentionAnalysis = analyzeMention(aiResponse, brandName, productName, url);
    
    results.push({
      name: 'Claude',
      query: platformQueries.claude,
      response: aiResponse,
      mentioned: mentionAnalysis.mentioned,
      partial: mentionAnalysis.partial,
      confidence: mentionAnalysis.confidence,
      analysis: mentionAnalysis.analysis
    });
    
  } catch (error) {
    console.error('Error testing Claude:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotConfigured = errorMessage.includes('not configured');
    
    results.push({
      name: 'Claude',
      query: platformQueries.claude,
      response: isNotConfigured ? 'ANTHROPIC_API_KEY not configured' : `Errore durante il test: ${errorMessage}`,
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: isNotConfigured ? 'API key non configurata' : 'Non è stato possibile completare il test su Claude'
    });
  }
  
  // Test Gemini
  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    console.log('Calling Gemini with query:', platformQueries.gemini);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${platformQueries.gemini}\n\nFornisci raccomandazioni specifiche di brand reali nel settore richiesto.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Gemini raw response:', JSON.stringify(data, null, 2));
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid Gemini response structure');
    }
    
    const aiResponse = data.candidates[0].content.parts[0].text;
    console.log('Gemini response:', aiResponse);
    
    // Analyze mention
    const mentionAnalysis = analyzeMention(aiResponse, brandName, productName, url);
    
    results.push({
      name: 'Gemini',
      query: platformQueries.gemini,
      response: aiResponse,
      mentioned: mentionAnalysis.mentioned,
      partial: mentionAnalysis.partial,
      confidence: mentionAnalysis.confidence,
      analysis: mentionAnalysis.analysis
    });
    
  } catch (error) {
    console.error('Error testing Gemini:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotConfigured = errorMessage.includes('not configured');
    
    results.push({
      name: 'Gemini',
      query: platformQueries.gemini,
      response: isNotConfigured ? 'GEMINI_API_KEY not configured' : `Errore durante il test: ${errorMessage}`,
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: isNotConfigured ? 'API key non configurata' : 'Non è stato possibile completare il test su Gemini'
    });
  }
  
  // Test Perplexity
  try {
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'Be precise and provide specific brand recommendations when relevant.'
          },
          {
            role: 'user',
            content: platformQueries.perplexity
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log('Perplexity response:', aiResponse);
    
    const mentionAnalysis = analyzeMention(aiResponse, brandName, productName, url);
    
    results.push({
      name: 'Perplexity',
      query: platformQueries.perplexity,
      response: aiResponse,
      mentioned: mentionAnalysis.mentioned,
      partial: mentionAnalysis.partial,
      confidence: mentionAnalysis.confidence,
      analysis: mentionAnalysis.analysis
    });
    
  } catch (error) {
    console.error('Error testing Perplexity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotConfigured = errorMessage.includes('not configured');
    
    results.push({
      name: 'Perplexity',
      query: platformQueries.perplexity,
      response: isNotConfigured ? 'PERPLEXITY_API_KEY not configured' : `Errore durante il test: ${errorMessage}`,
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: isNotConfigured ? 'API key non configurata' : 'Non è stato possibile completare il test su Perplexity'
    });
  }
  
  // Test Mistral
  try {
    const mistralKey = Deno.env.get('MISTRAL_API_KEY');
    if (!mistralKey) {
      throw new Error('MISTRAL_API_KEY not configured');
    }
    
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides specific brand recommendations.'
          },
          {
            role: 'user',
            content: platformQueries.mistral
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log('Mistral response:', aiResponse);
    
    const mentionAnalysis = analyzeMention(aiResponse, brandName, productName, url);
    
    results.push({
      name: 'Mistral',
      query: platformQueries.mistral,
      response: aiResponse,
      mentioned: mentionAnalysis.mentioned,
      partial: mentionAnalysis.partial,
      confidence: mentionAnalysis.confidence,
      analysis: mentionAnalysis.analysis
    });
    
  } catch (error) {
    console.error('Error testing Mistral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotConfigured = errorMessage.includes('not configured');
    
    results.push({
      name: 'Mistral',
      query: platformQueries.mistral,
      response: isNotConfigured ? 'MISTRAL_API_KEY not configured' : `Errore durante il test: ${errorMessage}`,
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: isNotConfigured ? 'API key non configurata' : 'Non è stato possibile completare il test su Mistral'
    });
  }
  
  // Test Cohere
  try {
    const cohereKey = Deno.env.get('COHERE_API_KEY');
    if (!cohereKey) {
      throw new Error('COHERE_API_KEY not configured');
    }
    
    const response = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cohereKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'command-r-plus',
        message: `${platformQueries.cohere}\n\nProvide specific brand recommendations when relevant.`,
        temperature: 0.7,
        max_tokens: 500
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.text;
    console.log('Cohere response:', aiResponse);
    
    const mentionAnalysis = analyzeMention(aiResponse, brandName, productName, url);
    
    results.push({
      name: 'Cohere',
      query: platformQueries.cohere,
      response: aiResponse,
      mentioned: mentionAnalysis.mentioned,
      partial: mentionAnalysis.partial,
      confidence: mentionAnalysis.confidence,
      analysis: mentionAnalysis.analysis
    });
    
  } catch (error) {
    console.error('Error testing Cohere:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotConfigured = errorMessage.includes('not configured');
    
    results.push({
      name: 'Cohere',
      query: platformQueries.cohere,
      response: isNotConfigured ? 'COHERE_API_KEY not configured' : `Errore durante il test: ${errorMessage}`,
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: isNotConfigured ? 'API key non configurata' : 'Non è stato possibile completare il test su Cohere'
    });
  }
  
  // Test Grok
  try {
    const grokKey = Deno.env.get('GROK_API_KEY');
    if (!grokKey) {
      throw new Error('GROK_API_KEY not configured');
    }
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides specific brand recommendations.'
          },
          {
            role: 'user',
            content: platformQueries.grok
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log('Grok response:', aiResponse);
    
    const mentionAnalysis = analyzeMention(aiResponse, brandName, productName, url);
    
    results.push({
      name: 'Grok',
      query: platformQueries.grok,
      response: aiResponse,
      mentioned: mentionAnalysis.mentioned,
      partial: mentionAnalysis.partial,
      confidence: mentionAnalysis.confidence,
      analysis: mentionAnalysis.analysis
    });
    
  } catch (error) {
    console.error('Error testing Grok:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotConfigured = errorMessage.includes('not configured');
    
    results.push({
      name: 'Grok',
      query: platformQueries.grok,
      response: isNotConfigured ? 'GROK_API_KEY not configured' : `Errore durante il test: ${errorMessage}`,
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: isNotConfigured ? 'API key non configurata' : 'Non è stato possibile completare il test su Grok'
    });
  }
  
  return { results, productAnalysis };
}

function extractBrandName(url: string, siteTitle: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const domainParts = domain.split('.');
    const mainDomain = domainParts[0];
    
    // Try to extract from title first
    const titleWords = siteTitle.split(/[\s\-|•]/);
    if (titleWords.length > 0 && titleWords[0].length > 2) {
      return titleWords[0];
    }
    
    return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
  } catch {
    return siteTitle.split(' ')[0];
  }
}

function generateQuery(
  brandName: string,
  productName: string | undefined,
  market: string,
  industry: string
): string {
  const marketText = market === 'Italia' ? 'in Italia' : 
                     market === 'Europa' ? 'in Europa' : 
                     market === 'USA' ? 'negli Stati Uniti' : 
                     'a livello globale';
  
  if (productName) {
    // Query generica come se l'utente cercasse soluzioni senza conoscere il brand
    return `Quali sono i migliori prodotti nel settore ${industry} ${marketText}? Consigliami una lista dei prodotti top di gamma e dei brand leader in questa categoria.`;
  } else {
    // Query generica per trovare brand leader
    return `Quali sono i brand leader nel settore ${industry} ${marketText}? Elenca i marchi più affermati e consigliati in questo settore.`;
  }
}

function analyzeMention(
  response: string,
  brandName: string,
  productName: string | undefined,
  url: string
): {
  mentioned: boolean;
  partial: boolean;
  confidence: number;
  analysis: string;
} {
  const responseLower = response.toLowerCase();
  const brandLower = brandName.toLowerCase();
  const domain = new URL(url).hostname.replace('www.', '');
  
  // Determine what we're looking for
  const targetName = productName || brandName;
  const targetLower = targetName.toLowerCase();
  
  // Check exact match for target (product or brand)
  const targetExactMatch = responseLower.includes(targetLower);
  
  // Always check brand mention too
  const brandExactMatch = responseLower.includes(brandLower);
  
  // Check domain match
  const domainMatch = responseLower.includes(domain);
  
  // Check partial match (words from brand/product name)
  const targetWords = targetName.split(/[\s\-]/);
  const partialMatches = targetWords.filter(word => 
    word.length > 3 && responseLower.includes(word.toLowerCase())
  );
  
  let mentioned: boolean;
  let partial: boolean;
  let confidence: number;
  let analysis: string;
  
  if (productName) {
    // We're checking for a product
    if (targetExactMatch) {
      mentioned = true;
      partial = false;
      confidence = 95;
      analysis = `Il prodotto "${productName}" è stato menzionato esplicitamente nella risposta. Eccellente visibilità!`;
    } else if (brandExactMatch) {
      mentioned = false;
      partial = true;
      confidence = 60;
      analysis = `Il brand "${brandName}" è menzionato, ma non il prodotto specifico "${productName}". Buona base ma migliorabile.`;
    } else if (partialMatches.length > 0) {
      mentioned = false;
      partial = true;
      confidence = 30;
      analysis = `Trovati riferimenti parziali, ma né il brand né il prodotto sono menzionati esplicitamente.`;
    } else {
      mentioned = false;
      partial = false;
      confidence = 0;
      analysis = `Né il brand "${brandName}" né il prodotto "${productName}" sono stati menzionati. Necessario miglioramento.`;
    }
  } else {
    // We're checking for a brand only
    const exactMatch = brandExactMatch || domainMatch;
    mentioned = exactMatch;
    partial = !mentioned && partialMatches.length > 0;
    
    if (exactMatch) {
      confidence = brandExactMatch ? 90 : 85;
      analysis = `Il brand "${brandName}" è stato menzionato esplicitamente nella risposta. Ottima visibilità!`;
    } else if (partial) {
      confidence = 40;
      analysis = `Sono stati trovati riferimenti parziali al brand, ma non una menzione esplicita. Migliorabile.`;
    } else {
      confidence = 0;
      analysis = `Il brand "${brandName}" non è stato menzionato in questa risposta. Necessario miglioramento della visibilità.`;
    }
  }
  
  return { mentioned, partial, confidence, analysis };
}

function calculateVisibilityScore(checks: TechnicalCheck[], platforms: PlatformResult[]): number {
  // Technical score (max 80 points)
  const technicalScore = checks.reduce((sum, check) => sum + check.score, 0);
  
  // Platform score (max 20 points)
  const platformScore = platforms.reduce((sum, platform) => {
    if (platform.mentioned) return sum + 20;
    if (platform.partial) return sum + 10;
    return sum;
  }, 0) / platforms.length;
  
  return Math.min(100, Math.round(technicalScore + platformScore));
}

function generateRecommendations(
  checks: TechnicalCheck[],
  platforms: PlatformResult[],
  score: number
): Array<{ priority: string; title: string; description: string; impact: string }> {
  const recommendations = [];
  
  // Check for critical technical issues
  const failedChecks = checks.filter(c => c.status === 'fail');
  
  if (failedChecks.some(c => c.name === 'Schema.org Markup')) {
    recommendations.push({
      priority: 'critical',
      title: 'Implementa Schema.org Markup',
      description: 'Aggiungi markup semantico al tuo sito per aiutare gli AI a comprendere meglio il contenuto e la struttura. Implementa Organization Schema, Product Schema e FAQ Schema dove appropriato.',
      impact: 'Impatto: +15 punti | Tempo: 4-8 ore'
    });
  }
  
  if (failedChecks.some(c => c.name === 'JSON-LD Implementation')) {
    recommendations.push({
      priority: 'high',
      title: 'Aggiungi Structured Data JSON-LD',
      description: 'Implementa structured data in formato JSON-LD per fornire informazioni strutturate sui tuoi prodotti, servizi e organizzazione. Questo è fondamentale per la visibilità negli AI.',
      impact: 'Impatto: +10 punti | Tempo: 3-6 ore'
    });
  }
  
  if (failedChecks.some(c => c.name === 'Organization Schema')) {
    recommendations.push({
      priority: 'high',
      title: 'Implementa Organization Schema',
      description: 'Crea uno schema Organization completo con nome, logo, contatti, social media e descrizione dell\'azienda. Gli AI usano questi dati per identificare e raccomandare il tuo brand.',
      impact: 'Impatto: +10 punti | Tempo: 2-4 ore'
    });
  }
  
  // Check AI visibility
  const notMentioned = platforms.filter(p => !p.mentioned && !p.partial);
  if (notMentioned.length > 0) {
    recommendations.push({
      priority: 'critical',
      title: 'Migliora la Presenza nei Risultati AI',
      description: 'Il tuo brand non viene raccomandato dagli AI. Concentrati su: contenuti di qualità, backlink autorevoli, presenza su directory di settore, case study e testimonial verificabili.',
      impact: 'Impatto: +20 punti | Tempo: ongoing'
    });
  }
  
  if (score < 50) {
    recommendations.push({
      priority: 'critical',
      title: 'Crea Contenuti Ottimizzati per AI',
      description: 'Pubblica contenuti ricchi e strutturati: guide dettagliate, FAQ complete, case study con dati, comparazioni di prodotto. Usa un linguaggio chiaro e inserisci dati verificabili.',
      impact: 'Impatto: +15 punti | Tempo: 12-20 ore'
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Mantieni e Monitora',
      description: 'Il tuo sito ha una buona base tecnica. Continua a monitorare la presenza negli AI, aggiorna regolarmente i contenuti e mantieni attiva la struttura SEO.',
      impact: 'Impatto: mantenimento | Tempo: 2 ore/mese'
    });
  }
  
  return recommendations.slice(0, 5);
}
