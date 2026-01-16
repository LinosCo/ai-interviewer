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
    const data = event.data;
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
  });

})(window);
