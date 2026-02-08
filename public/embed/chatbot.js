(function (window) {
  const PAGE_CONTEXT_MAX = 3500;

  // Robust detection of the script tag and configuration
  function getScriptConfig() {
    let script = document.currentScript;

    if (!script) {
      script = document.getElementById('bt-chatbot-script');
    }

    if (!script) {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.includes('chatbot.js')) {
          script = scripts[i];
          break;
        }
      }
    }

    // Attempt to find any element with data-bot-id if still not found
    if (!script || !script.getAttribute('data-bot-id')) {
      const anyTagged = document.querySelector('[data-bot-id]');
      if (anyTagged) return {
        botId: anyTagged.getAttribute('data-bot-id'),
        apiBase: anyTagged.getAttribute('data-domain') || (script ? new URL(script.src).origin : window.location.origin)
      };
    }

    if (!script) return null;

    try {
      const scriptUrl = new URL(script.src);
      return {
        botId: script.getAttribute('data-bot-id'),
        apiBase: script.getAttribute('data-domain') || scriptUrl.origin
      };
    } catch {
      return {
        botId: script.getAttribute('data-bot-id'),
        apiBase: script.getAttribute('data-domain') || window.location.origin
      };
    }
  }

  const CONFIG = getScriptConfig();

  if (!CONFIG || !CONFIG.botId || CONFIG.botId === 'undefined') {
    console.error('BusinessTuner: data-bot-id is required and must be valid', CONFIG);
    return;
  }

  function sanitizeContextText(text, maxLen) {
    if (!text || typeof text !== 'string') return '';

    const cleaned = text
      .replace(/\[\/?[\w:-]+(?:\s+[^\]]*)?\]/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, ' ')
      .replace(/\{%\s*[\s\S]*?%\}/g, ' ')
      .replace(/<%[\s\S]*?%>/g, ' ')
      .replace(/<\?php[\s\S]*?\?>/gi, ' ')
      .replace(/<!--\s*wp:[\s\S]*?-->/g, ' ')
      .replace(/<!--\s*\/wp:[\s\S]*?-->/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.slice(0, maxLen) + '...';
  }

  function extractMainContent() {
    try {
      var source = document.querySelector('main, article, [role="main"], #content, .content, .main') || document.body;
      var clone = source.cloneNode(true);

      if (clone && clone.querySelectorAll) {
        var noisy = clone.querySelectorAll(
          'script,style,noscript,template,svg,canvas,iframe,nav,footer,header,aside,form,button,' +
          '.ad,.ads,.cookie-banner,.cookies,.popup,.modal,.sidebar,.widget,.newsletter,' +
          '[aria-hidden="true"],[hidden],[role="dialog"]'
        );
        for (var i = 0; i < noisy.length; i++) noisy[i].remove();

        var blockLike = clone.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,tr,section,article,div,br');
        for (var j = 0; j < blockLike.length; j++) {
          if (blockLike[j].tagName === 'BR') {
            blockLike[j].replaceWith('\n');
          } else {
            blockLike[j].append('\n');
          }
        }
      }

      var text = clone && clone.textContent ? clone.textContent : '';
      return sanitizeContextText(text, PAGE_CONTEXT_MAX);
    } catch {
      return '';
    }
  }

  function buildPageContext() {
    var metaDesc = '';
    var descEl = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (descEl) {
      metaDesc = descEl.getAttribute('content') || '';
    }

    return {
      url: window.location.href,
      title: document.title || '',
      description: sanitizeContextText(metaDesc, 600),
      mainContent: extractMainContent()
    };
  }

  // Create Iframe Container
  const container = document.createElement('div');
  container.id = 'bt-root';
  container.style.position = 'fixed';
  container.style.bottom = '0';
  container.style.right = '0';
  container.style.zIndex = '2147483647';
  container.style.width = '120px';
  container.style.height = '120px';
  container.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  container.style.pointerEvents = 'none'; // Background clicks go through
  container.style.display = 'flex';
  container.style.alignItems = 'flex-end';
  container.style.justifyContent = 'flex-end';
  container.style.padding = '20px';

  // Construct Iframe URL
  const widgetUrl = `${CONFIG.apiBase}/w/${CONFIG.botId}`;

  const iframe = document.createElement('iframe');
  iframe.src = widgetUrl;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '20px';
  iframe.style.pointerEvents = 'auto'; // Iframe captures clicks
  iframe.allow = 'microphone; autoplay';

  container.appendChild(iframe);
  document.body.appendChild(container);

  // Communication
  window.addEventListener('message', (event) => {
    let data = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }

    if (!data || typeof data !== 'object') return;

    if (data && data.type === 'bt-widget-resize') {
      const isMobile = window.innerWidth < 640;

      if (data.isOpen) {
        if (isMobile) {
          container.style.width = '100%';
          container.style.height = '100%';
          container.style.padding = '0';
        } else {
          container.style.width = '420px';
          container.style.height = '750px';
          container.style.padding = '20px';
        }
      } else {
        container.style.width = '120px';
        container.style.height = '120px';
        container.style.padding = '20px';
      }
    }

    if (data && data.type === 'bt-widget-get-context') {
      // Reply only to our widget iframe.
      if (event.source === iframe.contentWindow && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'bt-widget-page-context',
          pageContext: buildPageContext()
        }, '*');
      }
    }
  });

})(window);
