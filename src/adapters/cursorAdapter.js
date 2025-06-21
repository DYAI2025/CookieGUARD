const axios = require('axios');
const WebSocket = require('ws');

class CursorAdapter {
  constructor(agentConfig) {
    this.config = agentConfig;
    this.baseURL = agentConfig.endpoint || 'https://api.cursor.sh';
    this.sessionToken = agentConfig.apiKey; // Cursor Session Token
    this.ws = null;
    this.messageQueue = [];
    this.responseHandlers = new Map();
  }

  async sendMessage(message, context) {
    const startTime = Date.now();
    
    try {
      // Wenn WebSocket nicht verbunden, HTTP-Fallback verwenden
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return await this.sendHTTPMessage(message, context);
      }

      // WebSocket-Nachricht senden
      return await this.sendWebSocketMessage(message, context, startTime);

    } catch (error) {
      console.error('Cursor API Fehler:', error);
      // Fallback zu HTTP bei WebSocket-Fehler
      if (this.ws) {
        return await this.sendHTTPMessage(message, context);
      }
      throw new Error(`Cursor-Fehler: ${error.message}`);
    }
  }

  async sendHTTPMessage(message, context) {
    const startTime = Date.now();
    
    try {
      const response = await axios.post(
        `${this.baseURL}/v1/chat/completions`,
        {
          model: this.config.model || 'cursor-fast',
          messages: this.prepareMessages(message, context),
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 2000,
          session_id: this.config.sessionId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.sessionToken}`,
            'Content-Type': 'application/json',
            'X-Cursor-Client': 'multi-ai-desktop'
          }
        }
      );

      const processingTime = Date.now() - startTime;

      return {
        content: response.data.choices[0].message.content,
        model: response.data.model,
        tokensUsed: response.data.usage?.total_tokens || 0,
        processingTime: processingTime,
        sessionId: response.data.session_id
      };

    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Cursor-Authentifizierung fehlgeschlagen. Bitte Session-Token überprüfen.');
      }
      throw error;
    }
  }

  async sendWebSocketMessage(message, context, startTime) {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      
      // Response-Handler registrieren
      this.responseHandlers.set(messageId, { resolve, reject, startTime });
      
      // Nachricht senden
      this.ws.send(JSON.stringify({
        id: messageId,
        type: 'chat.message',
        payload: {
          message: message,
          context: this.prepareContext(context),
          model: this.config.model || 'cursor-fast',
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 2000
        }
      }));

      // Timeout nach 30 Sekunden
      setTimeout(() => {
        if (this.responseHandlers.has(messageId)) {
          this.responseHandlers.delete(messageId);
          reject(new Error('Cursor WebSocket Timeout'));
        }
      }, 30000);
    });
  }

  async connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`wss://ws.cursor.sh/v1/chat`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`
        }
      });

      this.ws.on('open', () => {
        console.log('Cursor WebSocket verbunden');
        this.processMessageQueue();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleWebSocketMessage(data);
      });

      this.ws.on('error', (error) => {
        console.error('Cursor WebSocket Fehler:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Cursor WebSocket geschlossen');
        this.ws = null;
      });
    });
  }

  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'chat.response' && message.id) {
        const handler = this.responseHandlers.get(message.id);
        if (handler) {
          const processingTime = Date.now() - handler.startTime;
          handler.resolve({
            content: message.payload.content,
            model: message.payload.model,
            tokensUsed: message.payload.usage?.total_tokens || 0,
            processingTime: processingTime,
            sessionId: message.payload.session_id
          });
          this.responseHandlers.delete(message.id);
        }
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten der WebSocket-Nachricht:', error);
    }
  }

  prepareMessages(currentMessage, context) {
    const messages = [];

    // System-Prompt
    if (context.systemPrompt || this.config.systemPrompt) {
      messages.push({
        role: 'system',
        content: context.systemPrompt || this.config.systemPrompt
      });
    }

    // Konversationshistorie
    if (context.messages && context.messages.length > 0) {
      messages.push(...context.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    }

    // Aktuelle Nachricht
    messages.push({
      role: 'user',
      content: currentMessage
    });

    return messages;
  }

  prepareContext(context) {
    return {
      messages: context.messages?.slice(-10) || [],
      systemPrompt: context.systemPrompt || this.config.systemPrompt,
      sessionId: this.config.sessionId
    };
  }

  // Verfügbare Cursor-Modelle
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseURL}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`
        }
      });

      return response.data.models.map(model => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description,
        capabilities: model.capabilities
      }));
    } catch (error) {
      // Fallback zu statischer Liste
      return [
        {
          id: 'cursor-fast',
          name: 'Cursor Fast',
          description: 'Schnelles Modell für Code-Completion'
        },
        {
          id: 'cursor-slow',
          name: 'Cursor Slow',
          description: 'Genaueres Modell für komplexe Aufgaben'
        },
        {
          id: 'gpt-4',
          name: 'GPT-4 (via Cursor)',
          description: 'OpenAI GPT-4 über Cursor Cloud'
        },
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus (via Cursor)',
          description: 'Anthropic Claude über Cursor Cloud'
        }
      ];
    }
  }

  // Cursor-Sessions abrufen
  async getCursorSessions() {
    try {
      const response = await axios.get(`${this.baseURL}/v1/sessions`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`
        }
      });

      return response.data.sessions;
    } catch (error) {
      console.error('Fehler beim Abrufen der Cursor-Sessions:', error);
      return [];
    }
  }

  // Validierung
  async validateConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/v1/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`
        }
      });
      
      return { 
        valid: true,
        user: response.data.user,
        subscription: response.data.subscription
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }

  generateMessageId() {
    return `cursor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = { CursorAdapter }; 