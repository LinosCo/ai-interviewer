(function (window) {
  const CONFIG = {
    apiBase: document.currentScript.getAttribute('data-domain') || 'https://interviewer.businesstuner.ai',
    botId: document.currentScript.getAttribute('data-bot-id'),
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
  // We don't want to block clicks outside the widget area, 
  // but if the iframe is rectangular and the widget is circular, clicks on corners might be intercepted.
  // Standard solution: Iframe is full size but allows pointer-events: none on background?
  // Or resize iframe dinamically. 
  // Let's go with dynamic resizing.

  // Construct Iframe URL
  // We point to /dashboard/bots/[botId]/widget
  // We need to ensure the domain is correct.
  const widgetUrl = `${CONFIG.apiBase}/dashboard/bots/${CONFIG.botId}/widget`;

  const iframe = document.createElement('iframe');
  iframe.src = widgetUrl;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '20px'; // Rounded corners for aesthetics
  iframe.allow = 'microphone; autoplay';

  container.appendChild(iframe);
  document.body.appendChild(container);

  // Communication
  window.addEventListener('message', (event) => {
    // Verify origin if possible, or check structure
    const data = event.data;
    if (data && data.type === 'bt-widget-resize') {
      if (data.isOpen) {
        // Expanded state
        container.style.width = '420px'; // Slightly larger than typical bot width
        container.style.height = '720px';
        container.style.maxHeight = '90vh';
        container.style.maxWidth = '90vw';
        // Adjust position for mobile if needed
      } else {
        // Collapsed state (Bubble only)
        container.style.width = '100px';
        container.style.height = '100px';
      }
    }
  });

  // Mobile responsiveness logic could be added here to change container styles on window resize.

})(window);
