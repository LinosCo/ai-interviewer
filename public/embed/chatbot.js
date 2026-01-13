(function (window) {
  const CONFIG = {
    apiBase: document.currentScript.getAttribute('data-domain') || 'https://interviewer.businesstuner.ai',
    botId: document.currentScript.getAttribute('data-bot-id'),
    primaryColor: '#F97316', // Orange-500 default
  };

  if (!CONFIG.botId) {
    console.error('BusinessTuner: data-bot-id is required');
    return;
  }

  // Styles
  const STYLES = `
        #bt-root {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            z-index: 2147483647; /* Max z-index */
            position: fixed;
            bottom: 20px;
            right: 20px;
            line-height: 1.5;
        }
        
        #bt-root * { box-sizing: border-box; }

        .bt-bubble {
            width: 60px;
            height: 60px;
            border-radius: 30px;
            background: linear-gradient(135deg, ${CONFIG.primaryColor}, #EA580C);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s;
            position: absolute;
            bottom: 0;
            right: 0;
        }

        .bt-bubble:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }

        .bt-bubble svg { width: 32px; height: 32px; color: white; }

        .bt-window {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 380px;
            height: 600px;
            max-height: calc(100vh - 100px);
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
            border: 1px solid rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: opacity 0.2s ease-out, transform 0.2s ease-out;
        }

        .bt-window.open {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
        }

        .bt-header {
            padding: 16px 20px;
            background: linear-gradient(to right, #FFF7ED, #FFF);
            border-bottom: 1px solid #FED7AA;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .bt-title { font-weight: 600; color: #1F2937; font-size: 16px; }
        .bt-status { font-size: 12px; color: #16A34A; display: flex; items-center; gap: 4px; }
        .bt-status::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #16A34A; display: inline-block; margin-right: 4px; }

        .bt-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #FAFAFA;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .bt-msg {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            word-wrap: break-word;
            animation: bt-fade-in 0.3s ease-out;
        }

        .bt-msg.user {
            background: ${CONFIG.primaryColor};
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 2px;
        }

        .bt-msg.assistant {
            background: white;
            color: #374151;
            align-self: flex-start;
            border-bottom-left-radius: 2px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            border: 1px solid #E5E7EB;
        }

        .bt-input-area {
            padding: 16px;
            background: white;
            border-top: 1px solid #F3F4F6;
            display: flex;
            gap: 8px;
        }

        .bt-input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid #E5E7EB;
            border-radius: 24px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }

        .bt-input:focus { border-color: ${CONFIG.primaryColor}; }

        .bt-send {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: transparent;
            color: ${CONFIG.primaryColor};
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .bt-send:hover { background: #FFF7ED; }
        .bt-send svg { width: 20px; height: 20px; }

        .bt-typing { 
            display: flex; gap: 4px; padding: 12px 16px; 
            background: white; border-radius: 12px;
            align-self: flex-start;
            width: fit-content;
        }
        .bt-dot { width: 6px; height: 6px; background: #9CA3AF; border-radius: 50%; animation: bt-bounce 1.4s infinite; }
        .bt-dot:nth-child(2) { animation-delay: 0.2s; }
        .bt-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bt-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bt-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        
        @media (max-width: 480px) {
            .bt-window { width: calc(100vw - 40px); bottom: 90px; height: calc(100vh - 120px); }
        }
    `;

  class BusinessTunerBot {
    constructor() {
      this.isOpen = false;
      this.conversationId = localStorage.getItem(`bt_cid_${CONFIG.botId}`);
      this.messages = [];
      this.isTyping = false;

      this.init();
    }

    init() {
      this.injectStyles();
      this.createUI();

      if (this.conversationId) {
        this.loadHistory();
      } else {
        this.startNewConversation();
      }
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    createUI() {
      this.root = document.createElement('div');
      this.root.id = 'bt-root';

      this.root.innerHTML = `
                <div class="bt-window" id="bt-window">
                    <div class="bt-header">
                        <div>
                            <div class="bt-title">Assistente AI</div>
                            <div class="bt-status">Online</div>
                        </div>
                        <button style="background:none; border:none; cursor:pointer;" onclick="window.BusinessTuner.toggle()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div class="bt-messages" id="bt-messages"></div>
                    <form class="bt-input-area" id="bt-form">
                        <input type="text" class="bt-input" placeholder="Scrivi un messaggio..." id="bt-input">
                        <button type="submit" class="bt-send">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </form>
                </div>
                <div class="bt-bubble" onclick="window.BusinessTuner.toggle()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                </div>
            `;

      document.body.appendChild(this.root);

      this.dom = {
        window: this.root.querySelector('#bt-window'),
        messages: this.root.querySelector('#bt-messages'),
        input: this.root.querySelector('#bt-input'),
        form: this.root.querySelector('#bt-form')
      };

      this.dom.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendMessage();
      });
    }

    toggle() {
      this.isOpen = !this.isOpen;
      this.dom.window.classList.toggle('open', this.isOpen);
      if (this.isOpen) setTimeout(() => this.dom.input.focus(), 100);
    }

    appendMessage(role, text) {
      const div = document.createElement('div');
      div.className = `bt-msg ${role}`;
      div.innerHTML = text.replace(/\n/g, '<br>'); // Simple formatting
      this.dom.messages.appendChild(div);
      this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
    }

    setTyping(typing) {
      if (typing) {
        if (this.typingEl) return;
        this.typingEl = document.createElement('div');
        this.typingEl.className = 'bt-typing';
        this.typingEl.innerHTML = '<div class="bt-dot"></div><div class="bt-dot"></div><div class="bt-dot"></div>';
        this.dom.messages.appendChild(this.typingEl);
        this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
      } else {
        if (this.typingEl) {
          this.typingEl.remove();
          this.typingEl = null;
        }
      }
    }
    async startNewConversation() {
      try {
        // Generate or retrieve Session ID (Browser Fingerprint)
        let sessionId = localStorage.getItem('bt_sid');
        if (!sessionId) {
          sessionId = 's_' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('bt_sid', sessionId);
        }

        const res = await fetch(`${CONFIG.apiBase}/api/chatbot/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botId: CONFIG.botId,
            sessionId: sessionId,
            pageContext: {
              url: window.location.href,
              title: document.title
            }
          })
        });

        const data = await res.json();

        if (data.error) {
          console.error('BusinessTuner Bot Error:', data.error);
          return;
        }

        this.conversationId = data.conversationId;
        localStorage.setItem(`bt_cid_${CONFIG.botId}`, this.conversationId);

        if (data.welcomeMessage) {
          this.appendMessage('assistant', data.welcomeMessage);
        }
      } catch (e) {
        console.error(e);
      }
    }
    async loadHistory() {
      // Restore previous messages? For now just reset if expired or keep local array?
      // Simple MVP: Just start fresh visually but keep ID.
      // Ideally fetch history.
      // For now, assume fresh session visually.
      // Or maybe start new if session is old.
    }

    async sendMessage(text = null, hidden = false) {
      const content = text || this.dom.input.value.trim();
      if (!content) return;

      if (!hidden) {
        this.appendMessage('user', content);
        this.dom.input.value = '';
      }

      this.setTyping(true);

      try {
        const res = await fetch(`${CONFIG.apiBase}/api/chatbot/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: this.conversationId,
            message: content,
            isHidden: hidden
          })
        });

        const data = await res.json();
        this.setTyping(false);

        if (data.response) {
          this.appendMessage('assistant', data.response);
        }
      } catch (e) {
        this.setTyping(false);
        if (!hidden) this.appendMessage('assistant', '⚠️ Errore di connessione. Riprova.');
      }
    }
  }

  // Expose global instance
  window.BusinessTuner = new BusinessTunerBot();

})(window);
