const Anthropic = require('@anthropic-ai/sdk');

class AnthropicAdapter {
  constructor(agentConfig) {
    this.config = agentConfig;
    this.client = new Anthropic({
      apiKey: agentConfig.apiKey,
      baseURL: agentConfig.endpoint || undefined
    });
  }

  async sendMessage(message, context) {
    const startTime = Date.now();
    
    try {
      // Bereite Nachrichten für Anthropic vor
      const messages = this.prepareMessages(message, context);
      const systemPrompt = context.systemPrompt || this.config.systemPrompt || '';
      
      // Sende Anfrage an Anthropic
      const completion = await this.client.messages.create({
        model: this.config.model || 'claude-3-opus-20240229',
        messages: messages,
        system: systemPrompt,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000
      });

      const processingTime = Date.now() - startTime;

      return {
        content: completion.content[0].text,
        model: completion.model,
        tokensUsed: completion.usage?.input_tokens + completion.usage?.output_tokens || 0,
        processingTime: processingTime,
        stopReason: completion.stop_reason
      };

    } catch (error) {
      console.error('Anthropic API Fehler:', error);
      throw new Error(`Anthropic-Fehler: ${error.message}`);
    }
  }

  prepareMessages(currentMessage, context) {
    const messages = [];

    // Konversationshistorie hinzufügen
    if (context.messages && context.messages.length > 0) {
      context.messages.forEach(msg => {
        // Anthropic erwartet spezifisches Format
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      });
    }

    // Aktuelle Nachricht hinzufügen
    messages.push({
      role: 'user',
      content: currentMessage
    });

    // Anthropic benötigt alternierende user/assistant Nachrichten
    // Füge ggf. eine leere Assistant-Nachricht ein
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      messages.push({
        role: 'user',
        content: '.'
      });
    }

    return messages;
  }

  // Streaming-Support
  async *streamMessage(message, context) {
    const messages = this.prepareMessages(message, context);
    const systemPrompt = context.systemPrompt || this.config.systemPrompt || '';
    
    const stream = await this.client.messages.create({
      model: this.config.model || 'claude-3-opus-20240229',
      messages: messages,
      system: systemPrompt,
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 2000,
      stream: true
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
        yield chunk.delta.text;
      }
    }
  }

  // Verfügbare Modelle
  getAvailableModels() {
    // Anthropic hat keine API zum Abrufen von Modellen
    // Gebe statische Liste zurück
    return [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Leistungsstärkstes Modell für komplexe Aufgaben'
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Ausgewogenes Modell für die meisten Aufgaben'
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Schnellstes Modell für einfache Aufgaben'
      },
      {
        id: 'claude-2.1',
        name: 'Claude 2.1',
        description: 'Vorherige Generation'
      }
    ];
  }

  // Validierung
  async validateConnection() {
    try {
      // Teste die Verbindung mit einer minimalen Anfrage
      await this.client.messages.create({
        model: this.config.model || 'claude-3-haiku-20240307',
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

  // Hilfsfunktion für Token-Schätzung
  estimateTokens(text) {
    // Grobe Schätzung: ~4 Zeichen pro Token
    return Math.ceil(text.length / 4);
  }
}

module.exports = { AnthropicAdapter }; 