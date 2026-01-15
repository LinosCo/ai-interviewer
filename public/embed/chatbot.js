(function (window) {
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
    } catch (e) {
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

  // Create Iframe Container
  const container = document.createElement('div');
  container.id = 'bt-root';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '2147483647';
  container.style.width = '100px';
  container.style.height = '100px';
  container.style.transition = 'width 0.2s, height 0.2s';
  container.style.overflow = 'hidden'; // Keep neat

  // Construct Iframe URL
  const widgetUrl = `${CONFIG.apiBase}/w/${CONFIG.botId}`;

  const iframe = document.createElement('iframe');
  iframe.src = widgetUrl;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '20px';
  iframe.allow = 'microphone; autoplay';

  container.appendChild(iframe);
  document.body.appendChild(container);

  // Communication
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'bt-widget-resize') {
      if (data.isOpen) {
        container.style.width = '420px';
        container.style.height = '720px';
        container.style.maxHeight = '90vh';
        container.style.maxWidth = '90vw';
      } else {
        container.style.width = '100px';
        container.style.height = '100px';
      }
    }
  });

})(window);
