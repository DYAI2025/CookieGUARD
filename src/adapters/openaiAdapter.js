const OpenAI = require('openai');

class OpenAIAdapter {
  constructor(agentConfig) {
    this.config = agentConfig;
    this.client = new OpenAI({
      apiKey: agentConfig.apiKey,
      baseURL: agentConfig.endpoint || undefined
    });
  }

  async sendMessage(message, context) {
    const startTime = Date.now();
    
    try {
      // Bereite Nachrichten für OpenAI vor
      const messages = this.prepareMessages(message, context);
      
      // Sende Anfrage an OpenAI
      const completion = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
        stream: false
      });

      const response = completion.choices[0];
      const processingTime = Date.now() - startTime;

      return {
        content: response.message.content,
        model: completion.model,
        tokensUsed: completion.usage?.total_tokens || 0,
        processingTime: processingTime,
        finishReason: response.finish_reason
      };

    } catch (error) {
      console.error('OpenAI API Fehler:', error);
      throw new Error(`OpenAI-Fehler: ${error.message}`);
    }
  }

  prepareMessages(currentMessage, context) {
    const messages = [];

    // System-Prompt hinzufügen
    if (context.systemPrompt || this.config.systemPrompt) {
      messages.push({
        role: 'system',
        content: context.systemPrompt || this.config.systemPrompt
      });
    }

    // Konversationshistorie hinzufügen
    if (context.messages && context.messages.length > 0) {
      context.messages.forEach(msg => {
        // Konvertiere Agent-Nachrichten zu Assistant-Rolle
        const role = msg.role === 'assistant' ? 'assistant' : msg.role;
        messages.push({
          role: role,
          content: msg.content
        });
      });
    }

    // Aktuelle Nachricht hinzufügen
    messages.push({
      role: 'user',
      content: currentMessage
    });

    return messages;
  }

  // Streaming-Support für zukünftige Versionen
  async *streamMessage(message, context) {
    const messages = this.prepareMessages(message, context);
    
    const stream = await this.client.chat.completions.create({
      model: this.config.model || 'gpt-4',
      messages: messages,
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 2000,
      stream: true
    });

    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  }

  // Modell-Informationen abrufen
  async getAvailableModels() {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => ({
          id: model.id,
          name: model.id,
          created: new Date(model.created * 1000)
        }));
    } catch (error) {
      console.error('Fehler beim Abrufen der Modelle:', error);
      return [];
    }
  }

  // Validierung
  async validateConnection() {
    try {
      // Teste die Verbindung mit einer minimalen Anfrage
      await this.client.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5
      });
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }
}

module.exports = { OpenAIAdapter }; 