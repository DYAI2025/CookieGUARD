const EventEmitter = require('events');
const { OpenAIAdapter } = require('../adapters/openaiAdapter');
const { AnthropicAdapter } = require('../adapters/anthropicAdapter');
const { GoogleAdapter } = require('../adapters/googleAdapter');
const { CursorAdapter } = require('../adapters/cursorAdapter');

class ChatOrchestrator extends EventEmitter {
  constructor(agentRegistry) {
    super();
    this.agentRegistry = agentRegistry;
    this.adapters = new Map();
    this.conversations = new Map();
    this.initializeAdapters();
  }

  initializeAdapters() {
    // Adapter-Factory für verschiedene Agent-Typen
    this.adapterFactories = {
      openai: (agent) => new OpenAIAdapter(agent),
      anthropic: (agent) => new AnthropicAdapter(agent),
      google: (agent) => new GoogleAdapter(agent),
      cursor: (agent) => new CursorAdapter(agent)
    };
  }

  async processMessage(message, selectedAgentIds, projectId) {
    // Erstelle oder hole Konversation
    if (!this.conversations.has(projectId)) {
      this.conversations.set(projectId, {
        id: projectId,
        messages: [],
        createdAt: new Date().toISOString()
      });
    }

    const conversation = this.conversations.get(projectId);
    
    // Füge Benutzer-Nachricht hinzu
    const userMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    conversation.messages.push(userMessage);
    this.emit('message', { projectId, message: userMessage });

    // Verarbeite Nachricht mit ausgewählten Agenten
    const responses = await this.orchestrateResponses(
      message, 
      selectedAgentIds, 
      conversation,
      projectId
    );

    return {
      userMessage,
      responses,
      conversationId: projectId
    };
  }

  async orchestrateResponses(message, agentIds, conversation, projectId) {
    const responses = [];
    
    // Hole aktivierte Agenten
    const agents = agentIds
      .map(id => this.agentRegistry.getAgent(id))
      .filter(agent => agent && agent.enabled);

    if (agents.length === 0) {
      throw new Error('Keine aktiven Agenten ausgewählt');
    }

    // Sequenzielle Verarbeitung (kann später auf parallel umgestellt werden)
    for (const agent of agents) {
      try {
        // Status-Update senden
        this.emit('agent-status', {
          agentId: agent.id,
          status: 'thinking',
          projectId
        });

        // Hole oder erstelle Adapter
        const adapter = await this.getOrCreateAdapter(agent);
        
        // Bereite Kontext vor
        const context = this.prepareContext(conversation, agent);
        
        // Sende Anfrage an Agent
        const response = await adapter.sendMessage(message, context);
        
        // Erstelle Antwort-Objekt
        const agentMessage = {
          id: this.generateMessageId(),
          role: 'assistant',
          agentId: agent.id,
          agentName: agent.name,
          agentColor: agent.color,
          agentAvatar: agent.avatar,
          content: response.content,
          model: response.model || agent.model,
          timestamp: new Date().toISOString(),
          metadata: {
            tokensUsed: response.tokensUsed,
            processingTime: response.processingTime
          }
        };

        // Füge zur Konversation hinzu
        conversation.messages.push(agentMessage);
        responses.push(agentMessage);

        // Sende Antwort-Event
        this.emit('message', { projectId, message: agentMessage });
        
        // Status-Update
        this.emit('agent-status', {
          agentId: agent.id,
          status: 'completed',
          projectId
        });

        // Update lastUsed
        this.agentRegistry.updateAgent(agent.id, {
          lastUsed: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Fehler bei Agent ${agent.name}:`, error);
        
        // Fehler-Event
        this.emit('agent-error', {
          agentId: agent.id,
          error: error.message,
          projectId
        });

        // Status-Update
        this.emit('agent-status', {
          agentId: agent.id,
          status: 'error',
          projectId
        });
      }
    }

    return responses;
  }

  async getOrCreateAdapter(agent) {
    if (!this.adapters.has(agent.id)) {
      const factory = this.adapterFactories[agent.type];
      if (!factory) {
        throw new Error(`Unbekannter Agent-Typ: ${agent.type}`);
      }
      
      const adapter = factory(agent);
      this.adapters.set(agent.id, adapter);
    }
    
    return this.adapters.get(agent.id);
  }

  prepareContext(conversation, agent) {
    // Bereite Konversationskontext für den Agent vor
    const context = {
      messages: conversation.messages.slice(-10), // Letzte 10 Nachrichten
      systemPrompt: agent.systemPrompt,
      projectInfo: {
        messageCount: conversation.messages.length,
        startedAt: conversation.createdAt
      }
    };

    // Filtere sensible Informationen
    context.messages = context.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      agentName: msg.agentName || 'User',
      timestamp: msg.timestamp
    }));

    return context;
  }

  getConversation(projectId) {
    return this.conversations.get(projectId);
  }

  clearConversation(projectId) {
    this.conversations.delete(projectId);
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Workflow-Funktionen für spätere Iterationen
  async executeWorkflow(workflow, projectId) {
    // TODO: Implementiere Workflow-Engine
    throw new Error('Workflows noch nicht implementiert');
  }

  // Export-Funktionen
  exportConversation(projectId, format = 'json') {
    const conversation = this.conversations.get(projectId);
    if (!conversation) {
      throw new Error('Konversation nicht gefunden');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(conversation, null, 2);
      case 'markdown':
        return this.convertToMarkdown(conversation);
      default:
        throw new Error(`Unbekanntes Export-Format: ${format}`);
    }
  }

  convertToMarkdown(conversation) {
    let markdown = `# Konversation ${conversation.id}\n\n`;
    markdown += `Erstellt: ${new Date(conversation.createdAt).toLocaleString()}\n\n`;
    
    conversation.messages.forEach(msg => {
      const sender = msg.role === 'user' ? 'User' : msg.agentName;
      markdown += `## ${sender} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n`;
      markdown += `${msg.content}\n\n`;
    });
    
    return markdown;
  }
}

module.exports = { ChatOrchestrator }; 