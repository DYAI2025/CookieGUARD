// Chat-Komponente
class ChatManager {
  constructor() {
    this.currentProjectId = null;
    this.messages = [];
    this.selectedAgents = new Set();
    this.isProcessing = false;
    
    this.initializeElements();
    this.attachEventListeners();
    this.setupIpcListeners();
  }

  initializeElements() {
    this.elements = {
      chatMessages: document.getElementById('chatMessages'),
      chatInput: document.getElementById('chatInput'),
      btnSend: document.getElementById('btnSend'),
      agentCheckboxes: document.getElementById('agentCheckboxes'),
      projectTitle: document.getElementById('projectTitle'),
      projectStatus: document.getElementById('projectStatus')
    };
  }

  attachEventListeners() {
    // Sende-Button
    this.elements.btnSend.addEventListener('click', () => this.sendMessage());
    
    // Enter-Taste zum Senden (Shift+Enter für neue Zeile)
    this.elements.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Input-Validierung
    this.elements.chatInput.addEventListener('input', () => {
      this.validateInput();
    });
  }

  setupIpcListeners() {
    // Chat-Response von Agenten
    api.on('chat-response', (data) => {
      if (data.projectId === this.currentProjectId) {
        this.handleAgentResponse(data);
      }
    });
    
    // Agent-Status-Updates
    api.on('agent-status-update', (data) => {
      if (data.projectId === this.currentProjectId) {
        this.updateAgentStatus(data.agentId, data.status);
      }
    });
  }

  async sendMessage() {
    const message = this.elements.chatInput.value.trim();
    if (!message || this.isProcessing || this.selectedAgents.size === 0) {
      return;
    }
    
    this.isProcessing = true;
    this.elements.btnSend.disabled = true;
    this.elements.chatInput.disabled = true;
    
    // Füge Benutzer-Nachricht hinzu
    this.addMessage({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Leere Input
    this.elements.chatInput.value = '';
    
    // Zeige Typing-Indikatoren für ausgewählte Agenten
    this.selectedAgents.forEach(agentId => {
      this.showTypingIndicator(agentId);
    });
    
    try {
      // Sende Nachricht an Backend
      const response = await api.chat.sendMessage(
        message,
        Array.from(this.selectedAgents),
        this.currentProjectId
      );
      
      // Verarbeite Antworten
      if (response.responses) {
        response.responses.forEach(agentResponse => {
          this.addMessage(agentResponse);
        });
      }
      
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
      this.showError('Fehler beim Senden der Nachricht: ' + error.message);
    } finally {
      this.isProcessing = false;
      this.elements.btnSend.disabled = false;
      this.elements.chatInput.disabled = false;
      this.elements.chatInput.focus();
      
      // Entferne alle Typing-Indikatoren
      this.removeAllTypingIndicators();
    }
  }

  addMessage(message) {
    this.messages.push(message);
    
    const messageElement = this.createMessageElement(message);
    
    // Entferne Willkommensnachricht falls vorhanden
    const welcomeMessage = this.elements.chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    this.elements.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${message.role}`;
    messageDiv.dataset.messageId = message.id;
    
    if (message.role === 'user') {
      messageDiv.innerHTML = `
        <div class="message-content">
          ${utils.escapeHtml(message.content)}
        </div>
      `;
    } else {
      // Assistant/Agent-Nachricht
      messageDiv.innerHTML = `
        <div class="agent-avatar" style="background-color: ${message.agentColor}">
          ${message.agentAvatar}
        </div>
        <div class="message-wrapper">
          <div class="message-header">
            <span class="agent-name" style="color: ${message.agentColor}">
              ${message.agentName}
            </span>
            <span class="message-time">${utils.formatTime(message.timestamp)}</span>
          </div>
          <div class="message-content">
            ${utils.parseMarkdown(message.content)}
          </div>
          ${message.metadata ? this.createMetadata(message.metadata) : ''}
          <div class="message-actions">
            <button class="message-action" onclick="chatManager.copyMessage('${message.id}')">
              Kopieren
            </button>
            <button class="message-action" onclick="chatManager.regenerateMessage('${message.id}')">
              Neu generieren
            </button>
          </div>
        </div>
      `;
    }
    
    return messageDiv;
  }

  createMetadata(metadata) {
    let html = '<div class="message-metadata">';
    
    if (metadata.tokensUsed) {
      html += `
        <span class="metadata-item">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM4 8a4 4 0 118 0 4 4 0 01-8 0z"/>
          </svg>
          ${metadata.tokensUsed} Tokens
        </span>
      `;
    }
    
    if (metadata.processingTime) {
      const seconds = (metadata.processingTime / 1000).toFixed(1);
      html += `
        <span class="metadata-item">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3.5a.5.5 0 00-1 0V9a.5.5 0 00.252.434l3.5 2a.5.5 0 00.496-.868L8 8.71V3.5z"/>
            <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z"/>
          </svg>
          ${seconds}s
        </span>
      `;
    }
    
    html += '</div>';
    return html;
  }

  showTypingIndicator(agentId) {
    const agent = window.agentsManager?.getAgentById(agentId);
    if (!agent) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message message-assistant typing';
    typingDiv.dataset.agentId = agentId;
    typingDiv.innerHTML = `
      <div class="agent-avatar thinking" style="background-color: ${agent.color}">
        ${agent.avatar}
      </div>
      <div class="message-wrapper">
        <div class="message-header">
          <span class="agent-name" style="color: ${agent.color}">
            ${agent.name}
          </span>
          <span class="agent-status">
            <span class="status-dot thinking"></span>
            denkt nach...
          </span>
        </div>
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    
    this.elements.chatMessages.appendChild(typingDiv);
    this.scrollToBottom();
  }

  removeTypingIndicator(agentId) {
    const typingElement = this.elements.chatMessages.querySelector(
      `.typing[data-agent-id="${agentId}"]`
    );
    if (typingElement) {
      typingElement.remove();
    }
  }

  removeAllTypingIndicators() {
    const typingElements = this.elements.chatMessages.querySelectorAll('.typing');
    typingElements.forEach(el => el.remove());
  }

  updateAgentStatus(agentId, status) {
    // Update typing indicator if exists
    const typingElement = this.elements.chatMessages.querySelector(
      `.typing[data-agent-id="${agentId}"]`
    );
    
    if (typingElement && status !== 'thinking') {
      this.removeTypingIndicator(agentId);
    }
  }

  validateInput() {
    const hasText = this.elements.chatInput.value.trim().length > 0;
    const hasSelectedAgents = this.selectedAgents.size > 0;
    
    this.elements.btnSend.disabled = !hasText || !hasSelectedAgents || this.isProcessing;
  }

  updateAgentCheckboxes(agents) {
    this.elements.agentCheckboxes.innerHTML = '';
    
    agents.forEach(agent => {
      const checkboxDiv = document.createElement('div');
      checkboxDiv.className = 'agent-checkbox';
      checkboxDiv.innerHTML = `
        <input type="checkbox" id="agent-${agent.id}" value="${agent.id}">
        <label for="agent-${agent.id}">
          <span class="agent-emoji">${agent.avatar}</span>
          ${agent.name}
        </label>
      `;
      
      const checkbox = checkboxDiv.querySelector('input');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedAgents.add(agent.id);
        } else {
          this.selectedAgents.delete(agent.id);
        }
        this.validateInput();
      });
      
      this.elements.agentCheckboxes.appendChild(checkboxDiv);
    });
    
    // Wähle ersten Agent standardmäßig aus
    if (agents.length > 0 && this.selectedAgents.size === 0) {
      const firstCheckbox = this.elements.agentCheckboxes.querySelector('input');
      if (firstCheckbox) {
        firstCheckbox.checked = true;
        this.selectedAgents.add(firstCheckbox.value);
      }
    }
    
    this.validateInput();
  }

  setCurrentProject(projectId, projectName = 'Neues Projekt') {
    this.currentProjectId = projectId;
    this.messages = [];
    this.elements.projectTitle.textContent = projectName;
    this.clearChat();
  }

  clearChat() {
    this.elements.chatMessages.innerHTML = `
      <div class="welcome-message">
        <h3>Willkommen bei Multi-AI Desktop!</h3>
        <p>Beginne eine Konversation mit deinen KI-Agenten.</p>
        <p>Wähle die Agenten aus, die antworten sollen, und stelle deine Frage.</p>
      </div>
    `;
  }

  scrollToBottom() {
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message-error';
    errorDiv.textContent = message;
    this.elements.chatMessages.appendChild(errorDiv);
    this.scrollToBottom();
  }

  async copyMessage(messageId) {
    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      await utils.copyToClipboard(message.content);
    }
  }

  async regenerateMessage(messageId) {
    // TODO: Implementiere Regenerierung
    utils.showNotification('Regenerierung noch nicht implementiert', 'info');
  }
}

// Initialisiere Chat-Manager
window.chatManager = new ChatManager(); 