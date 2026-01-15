(function (window) {
  // Determine API Base from the script tag itself if no data-domain is provided
  const scriptTag = document.currentScript;
  const scriptUrl = new URL(scriptTag.src);
  const detectedBase = `${scriptUrl.protocol}//${scriptUrl.host}`;

  const CONFIG = {
    apiBase: scriptTag.getAttribute('data-domain') || detectedBase,
    botId: scriptTag.getAttribute('data-bot-id'),
  };

  if (!CONFIG.botId) {
    console.error('BusinessTuner: data-bot-id is required');
    return;
  }

  // Create Iframe Container
  const container = document.createElement('div');
  container.id = 'bt-root';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '2147483647'; // Max z-index
  container.style.width = '100px'; // Initial small size for bubble
  container.style.height = '100px';
  container.style.transition = 'width 0.2s, height 0.2s';

  // Construct Iframe URL
  // We point to the new public route /w/[botId]
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
    // Basic origin check (optional if we want to support any domain)
    const data = event.data;
    if (data && data.type === 'bt-widget-resize') {
      if (data.isOpen) {
        // Expanded state
        container.style.width = '420px';
        container.style.height = '720px';
        container.style.maxHeight = '90vh';
        container.style.maxWidth = '90vw';
      } else {
        // Collapsed state (Bubble only)
        container.style.width = '100px';
        container.style.height = '100px';
      }
    }
  });

})(window);
