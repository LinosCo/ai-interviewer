(function () {
    'use strict';

    const BusinessTunerChatbot = {
        config: {},
        state: {
            isOpen: false,
            conversationId: null,
            sessionId: null,
            messages: [],
            isThinking: false
        },

        init(config) {
            this.config = {
                botId: config.botId,
                apiUrl: config.apiUrl || 'https://businesstuner.ai', // Default prod URL
                position: config.position || 'bottom-right',
                primaryColor: config.primaryColor || '#F59E0B',
                pageContext: config.pageContext !== false,
                ...config
            };

            this.generateSessionId();
            this.injectStyles();
            this.createBubble();
            this.createChatWindow();

            if (this.config.pageContext) {
                this.extractPageContext();
            }
        },

        generateSessionId() {
            // Simple fingerprint: timestamp + random
            if (localStorage.getItem('bt_session_id')) {
                this.state.sessionId = localStorage.getItem('bt_session_id');
            } else {
                this.state.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('bt_session_id', this.state.sessionId);
            }
        },

        extractPageContext() {
            const context = {
                url: window.location.href,
                title: document.title,
                description: document.querySelector('meta[name="description"]')?.content || '',
                headings: Array.from(document.querySelectorAll('h1, h2, h3'))
                    .slice(0, 10)
                    .map(h => h.textContent.trim())
                    .filter(Boolean),
                mainContent: this.extractMainText()
            };

            this.state.pageContext = context;
        },

        extractMainText() {
            // Extract main text content (skip nav, footer, scripts)
            const main = document.querySelector('main') || document.body;
            const clone = main.cloneNode(true);

            // Remove unwanted elements
            const toRemove = clone.querySelectorAll('nav, footer, script, style, iframe, .bt-chatbot, [hidden], noscript');
            toRemove.forEach(el => el.remove());

            // Get text, limit to 3000 chars
            const text = clone.textContent
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 3000);

            return text;
        },

        injectStyles() {
            const style = document.createElement('style');
            style.textContent = `
        .bt-chatbot * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        
        /* Bubble Button */
        .bt-bubble {
          position: fixed;
          ${this.config.position.includes('right') ? 'right: 24px;' : 'left: 24px;'}
          bottom: 24px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${this.config.primaryColor}, ${this.adjustColor(this.config.primaryColor, -20)});
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        
        .bt-bubble:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        
        .bt-bubble svg {
          width: 30px;
          height: 30px;
          fill: white;
          transition: transform 0.3s ease;
        }
        
        .bt-bubble.open svg {
          transform: rotate(90deg);
          opacity: 0;
        }

        .bt-bubble .bt-close-icon {
            position: absolute;
            opacity: 0;
            transform: rotate(-90deg);
        }

        .bt-bubble.open .bt-close-icon {
            opacity: 1;
            transform: rotate(0);
        }
        
        /* Chat Window */
        .bt-chat-window {
          position: fixed;
          ${this.config.position.includes('right') ? 'right: 24px;' : 'left: 24px;'}
          bottom: 100px;
          width: 380px;
          max-width: calc(100vw - 48px);
          height: 600px;
          max-height: calc(100vh - 120px);
          background: white;
          border-radius: 20px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
          display: flex;
          flex-direction: column;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          z-index: 999998;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.05);
        }
        
        .bt-chat-window.open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: all;
        }
        
        /* Header */
        .bt-header {
          background: linear-gradient(135deg, ${this.config.primaryColor}, ${this.adjustColor(this.config.primaryColor, -20)});
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        
        .bt-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          backdrop-filter: blur(4px);
        }
        
        .bt-header-text h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .bt-header-text p {
          margin: 2px 0 0;
          font-size: 12px;
          opacity: 0.9;
        }
        
        /* Messages */
        .bt-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f9f9f9;
        }
        
        .bt-message {
          display: flex;
          gap: 8px;
          max-width: 85%;
          align-self: flex-start;
          animation: bt-slideUp 0.3s ease-out forwards;
          opacity: 0;
          transform: translateY(10px);
        }
        
        .bt-message.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        
        .bt-message-content {
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        
        .bt-message.assistant .bt-message-content {
          background: white;
          color: #1f2937;
          border-top-left-radius: 2px;
        }
        
        .bt-message.user .bt-message-content {
          background: ${this.config.primaryColor};
          color: white;
          border-top-right-radius: 2px;
        }
        
        @keyframes bt-slideUp {
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Typing Indicator */
        .bt-typing {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          background: white;
          border-radius: 12px;
          border-top-left-radius: 2px;
          width: fit-content;
          margin-bottom: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          align-self: flex-start;
        }
        
        .bt-typing span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9ca3af;
          animation: bt-bounce 1.4s infinite ease-in-out both;
        }
        
        .bt-typing span:nth-child(1) { animation-delay: -0.32s; }
        .bt-typing span:nth-child(2) { animation-delay: -0.16s; }
        
        @keyframes bt-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        
        /* Input */
        .bt-input-container {
          padding: 16px;
          background: white;
          border-top: 1px solid #f3f4f6;
          flex-shrink: 0;
        }
        
        .bt-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: center;
          background: #f3f4f6;
          border-radius: 24px;
          padding: 8px 8px 8px 16px;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        
        .bt-input-wrapper:focus-within {
          background: white;
          border-color: ${this.config.primaryColor};
          box-shadow: 0 0 0 2px ${this.config.primaryColor}20;
        }
        
        .bt-input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;
          font-size: 14px;
          color: #1f2937;
          min-height: 20px;
          max-height: 100px;
          resize: none;
          padding: 0;
          margin: 0;
        }

        .bt-input::placeholder { color: #9ca3af; }
        
        .bt-send-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        
        .bt-send-btn:hover {
          transform: scale(1.05);
          filter: brightness(1.1);
        }
        
        .bt-send-btn:disabled {
          background: #d1d5db;
          cursor: not-allowed;
          transform: none;
        }
        
        .bt-send-btn svg {
          width: 16px;
          height: 16px;
          fill: white;
          margin-left: 2px; /* Visual centering */
        }
        
        /* Lead Form */
        .bt-lead-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: white;
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            margin-top: 8px;
            align-self: flex-start;
            width: 85%;
        }

        .bt-lead-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
        }
        
        .bt-lead-input:focus {
            border-color: ${this.config.primaryColor};
        }

        .bt-lead-submit {
            background: ${this.config.primaryColor};
            color: white;
            border: none;
            padding: 8px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
        }

        /* Mobile */
        @media (max-width: 640px) {
          .bt-chat-window {
            width: 100%;
            height: 100%;
            max-height: 100%;
            bottom: 0;
            right: 0;
            left: 0;
            border-radius: 0;
            z-index: 999999; /* On top of everything */
          }
          
          .bt-bubble {
            bottom: 20px;
            right: 20px;
          }

          .bt-chat-window.open ~ .bt-bubble {
              display: none; /* Hide bubble when full screen open on mobile */
          }
           /* Close button on mobile within header maybe? For now user can use browser back or X if we add it */
        }
      `;
            document.head.appendChild(style);
        },

        adjustColor(color, amount) {
            // Simple color adjustment (darken/lighten)
            const num = parseInt(color.replace('#', ''), 16);
            const r = Math.max(0, Math.min(255, (num >> 16) + amount));
            const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
            const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
            return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
        },

        createBubble() {
            const bubble = document.createElement('div');
            bubble.className = 'bt-bubble bt-chatbot';
            bubble.innerHTML = `
        <svg class="bt-chat-icon" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <svg class="bt-close-icon" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      `;

            bubble.onclick = () => this.toggleChat();
            document.body.appendChild(bubble);
            this.elements = { bubble };
        },

        createChatWindow() {
            const window = document.createElement('div');
            window.className = 'bt-chat-window bt-chatbot';
            window.innerHTML = `
        <div class="bt-header">
          <div class="bt-avatar">🤖</div>
          <div class="bt-header-text">
            <h3>Assistente AI</h3>
            <p>Online • Risponde subito</p>
          </div>
        </div>
        <div class="bt-messages"></div>
        <div class="bt-input-container">
          <div class="bt-input-wrapper">
            <input type="text" class="bt-input" placeholder="Scrivi un messaggio..." />
            <button class="bt-send-btn">
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      `;

            document.body.appendChild(window);
            this.elements.window = window;
            this.elements.messages = window.querySelector('.bt-messages');
            this.elements.input = window.querySelector('.bt-input');
            this.elements.sendBtn = window.querySelector('.bt-send-btn');

            this.elements.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            this.elements.sendBtn.onclick = () => this.sendMessage();
        },

        toggleChat() {
            this.state.isOpen = !this.state.isOpen;
            this.elements.bubble.classList.toggle('open');
            this.elements.window.classList.toggle('open');

            if (this.state.isOpen) {
                this.elements.input.focus();
                if (this.state.messages.length === 0 && !this.state.isThinking) {
                    this.startConversation();
                }
            }
        },

        async startConversation() {
            this.showThinking();
            try {
                const response = await fetch(`${this.config.apiUrl}/api/chatbot/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        botId: this.config.botId,
                        sessionId: this.state.sessionId,
                        pageContext: this.state.pageContext
                    })
                });

                const data = await response.json();
                this.hideThinking();

                if (response.ok) {
                    this.state.conversationId = data.conversationId;
                    if (data.welcomeMessage) {
                        this.addMessage('assistant', data.welcomeMessage);
                    }
                } else {
                    console.error('Chatbot init error', data);
                    this.addMessage('assistant', 'Errore di connessione. Riprova più tardi.');
                }

            } catch (error) {
                this.hideThinking();
                console.error('Failed to start conversation:', error);
                this.addMessage('assistant', 'Mi dispiace, si è verificato un errore di rete.');
            }
        },

        async sendMessage() {
            const text = this.elements.input.value.trim();
            if (!text || this.state.isThinking) return;

            this.addMessage('user', text);
            this.elements.input.value = '';
            this.showThinking();

            try {
                const response = await fetch(`${this.config.apiUrl}/api/chatbot/message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversationId: this.state.conversationId,
                        message: text
                    })
                });

                const data = await response.json();
                this.hideThinking();

                if (data.response) {
                    this.addMessage('assistant', data.response);
                }

                if (data.shouldCaptureLead) {
                    this.showLeadCapture();
                }
            } catch (error) {
                this.hideThinking();
                console.error('Failed to send message:', error);
                this.addMessage('assistant', 'Mi dispiace, non ho ricevuto il messaggio. Riprova.');
            }
        },

        async submitLead(e) {
            e.preventDefault();
            const email = e.target.elements.email.value;
            const name = e.target.elements.name.value;
            const form = e.target;

            form.innerHTML = '<div style="text-align:center; padding: 10px;">Grazie! Ti contatteremo presto.</div>';

            try {
                // In a real app we'd have a specific endpoint or update candidate data
                // leveraging the message/context update
                await fetch(`${this.config.apiUrl}/api/chatbot/message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversationId: this.state.conversationId,
                        message: `[LEAD FORM SUBMITTED] Name: ${name}, Email: ${email}`,
                        isHidden: true // hypothetical flag to not show in chat but process
                    })
                });
            } catch (err) {
                console.error("Lead submit error", err);
            }
        },

        addMessage(role, content) {
            const msg = { role, content, timestamp: Date.now() };
            this.state.messages.push(msg);

            const msgEl = document.createElement('div');
            msgEl.className = `bt-message ${role}`;
            msgEl.innerHTML = `
        <div class="bt-message-content">${this.escapeHtml(content)}</div>
      `;
            // User avatar removed for cleaner look, Assistant avatar still in header

            this.elements.messages.appendChild(msgEl);
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        },

        showThinking() {
            this.state.isThinking = true;
            this.elements.sendBtn.disabled = true;

            const typing = document.createElement('div');
            typing.className = 'bt-typing bt-typing-indicator';
            typing.innerHTML = '<span></span><span></span>';
            this.elements.messages.appendChild(typing);
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        },

        hideThinking() {
            this.state.isThinking = false;
            this.elements.sendBtn.disabled = false;
            const typing = this.elements.messages.querySelector('.bt-typing-indicator');
            if (typing) typing.remove();
        },

        showLeadCapture() {
            const formId = `bt-lead-form-${Date.now()}`;
            const formEl = document.createElement('form');
            formEl.className = 'bt-lead-form';
            formEl.id = formId;
            formEl.innerHTML = `
            <input type="text" name="name" class="bt-lead-input" placeholder="Il tuo nome" required />
            <input type="email" name="email" class="bt-lead-input" placeholder="La tua email" required />
            <button type="submit" class="bt-lead-submit">Invia Contatto</button>
        `;

            formEl.onsubmit = (e) => this.submitLead(e);
            this.elements.messages.appendChild(formEl);
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        },

        escapeHtml(text) {
            if (!text) return '';
            // Support basic simple links
            // const linkRegex = /(https?:\/\/[^\s]+)/g;
            // return text.replace(linkRegex, '<a href="$1" target="_blank" style="color:inherit; text-decoration: underline;">$1</a>');

            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    // Expose globally
    window.BusinessTuner = BusinessTunerChatbot;
})();
