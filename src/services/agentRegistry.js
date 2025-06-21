const { v4: uuidv4 } = require('uuid');

class AgentRegistry {
  constructor(store) {
    this.store = store;
    this.agents = new Map();
    this.loadAgents();
  }

  loadAgents() {
    const savedAgents = this.store.get('agents', []);
    savedAgents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });
  }

  saveAgents() {
    const agentsArray = Array.from(this.agents.values());
    this.store.set('agents', agentsArray);
  }

  addAgent(config) {
    const agent = {
      id: uuidv4(),
      name: config.name,
      type: config.type, // 'openai', 'anthropic', 'google', 'cursor'
      apiKey: config.apiKey,
      model: config.model,
      endpoint: config.endpoint,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000,
      systemPrompt: config.systemPrompt || '',
      color: config.color || this.generateColor(),
      avatar: config.avatar || this.getDefaultAvatar(config.type),
      enabled: true,
      createdAt: new Date().toISOString(),
      lastUsed: null
    };

    // Verschlüssele API-Key vor dem Speichern
    if (agent.apiKey) {
      agent.apiKey = this.encryptApiKey(agent.apiKey);
    }

    this.agents.set(agent.id, agent);
    this.saveAgents();
    
    return { ...agent, apiKey: '***' }; // Gebe Agent ohne API-Key zurück
  }

  removeAgent(agentId) {
    const deleted = this.agents.delete(agentId);
    if (deleted) {
      this.saveAgents();
    }
    return deleted;
  }

  updateAgent(agentId, updates) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} nicht gefunden`);
    }

    // API-Key verschlüsseln falls geändert
    if (updates.apiKey && updates.apiKey !== '***') {
      updates.apiKey = this.encryptApiKey(updates.apiKey);
    }

    const updatedAgent = { ...agent, ...updates };
    this.agents.set(agentId, updatedAgent);
    this.saveAgents();
    
    return { ...updatedAgent, apiKey: '***' };
  }

  getAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    
    // Entschlüssele API-Key für internen Gebrauch
    return {
      ...agent,
      apiKey: agent.apiKey ? this.decryptApiKey(agent.apiKey) : null
    };
  }

  getAllAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      ...agent,
      apiKey: '***' // Verstecke API-Keys in der UI
    }));
  }

  getEnabledAgents() {
    return Array.from(this.agents.values())
      .filter(agent => agent.enabled)
      .map(agent => ({
        ...agent,
        apiKey: agent.apiKey ? this.decryptApiKey(agent.apiKey) : null
      }));
  }

  // Hilfsfunktionen
  generateColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FECA57', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getDefaultAvatar(type) {
    const avatars = {
      openai: '🤖',
      anthropic: '🧠',
      google: '🔮',
      cursor: '💻',
      default: '🤔'
    };
    return avatars[type] || avatars.default;
  }

  // Einfache Verschlüsselung (in Produktion sollte crypto verwendet werden)
  encryptApiKey(apiKey) {
    // TODO: Implementiere richtige Verschlüsselung mit crypto
    return Buffer.from(apiKey).toString('base64');
  }

  decryptApiKey(encryptedKey) {
    // TODO: Implementiere richtige Entschlüsselung mit crypto
    return Buffer.from(encryptedKey, 'base64').toString('utf-8');
  }

  // Validierung
  validateAgentConfig(config) {
    const required = ['name', 'type'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Fehlende Pflichtfelder: ${missing.join(', ')}`);
    }

    const validTypes = ['openai', 'anthropic', 'google', 'cursor'];
    if (!validTypes.includes(config.type)) {
      throw new Error(`Ungültiger Agent-Typ: ${config.type}`);
    }

    // API-Key nur für nicht-Cursor-Agenten erforderlich
    if (config.type !== 'cursor' && !config.apiKey) {
      throw new Error('API-Key erforderlich für diesen Agent-Typ');
    }

    return true;
  }
}

module.exports = { AgentRegistry }; 