const { GoogleGenerativeAI } = require('@google/generative-ai');

class GoogleAdapter {
  constructor(agentConfig) {
    this.config = agentConfig;
    this.genAI = new GoogleGenerativeAI(agentConfig.apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: agentConfig.model || 'gemini-pro' 
    });
  }

  async sendMessage(message, context) {
    const startTime = Date.now();
    
    try {
      // Bereite Chat-Historie vor
      const chat = await this.prepareChatSession(context);
      
      // Sende Nachricht
      const result = await chat.sendMessage(message);
      const response = await result.response;
      const processingTime = Date.now() - startTime;

      return {
        content: response.text(),
        model: this.config.model || 'gemini-pro',
        tokensUsed: this.estimateTokens(message + response.text()),
        processingTime: processingTime,
        candidates: response.candidates?.length || 1
      };

    } catch (error) {
      console.error('Google AI Fehler:', error);
      throw new Error(`Google AI-Fehler: ${error.message}`);
    }
  }

  async prepareChatSession(context) {
    const history = [];

    // System-Prompt als erste Nachricht
    if (context.systemPrompt || this.config.systemPrompt) {
      history.push({
        role: 'user',
        parts: [{ text: `System: ${context.systemPrompt || this.config.systemPrompt}` }]
      });
      history.push({
        role: 'model',
        parts: [{ text: 'Verstanden. Ich werde entsprechend antworten.' }]
      });
    }

    // Konversationshistorie hinzufügen
    if (context.messages && context.messages.length > 0) {
      context.messages.forEach(msg => {
        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      });
    }

    // Chat-Session mit Historie erstellen
    const generationConfig = {
      temperature: this.config.temperature || 0.7,
      topK: 1,
      topP: 1,
      maxOutputTokens: this.config.maxTokens || 2000,
    };

    return this.model.startChat({
      history: history,
      generationConfig: generationConfig
    });
  }

  // Streaming-Support
  async *streamMessage(message, context) {
    try {
      const chat = await this.prepareChatSession(context);
      const result = await chat.sendMessageStream(message);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error) {
      console.error('Google AI Stream Fehler:', error);
      throw new Error(`Google AI Stream-Fehler: ${error.message}`);
    }
  }

  // Verfügbare Modelle
  getAvailableModels() {
    return [
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        description: 'Googles fortschrittlichstes Textmodell'
      },
      {
        id: 'gemini-pro-vision',
        name: 'Gemini Pro Vision',
        description: 'Multimodales Modell für Text und Bilder'
      },
      {
        id: 'gemini-ultra',
        name: 'Gemini Ultra',
        description: 'Leistungsstärkstes Modell (wenn verfügbar)'
      }
    ];
  }

  // Validierung
  async validateConnection() {
    try {
      // Teste die Verbindung mit einer minimalen Anfrage
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent('Test');
      await result.response;
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  // Token-Schätzung
  estimateTokens(text) {
    // Grobe Schätzung für Gemini
    return Math.ceil(text.length / 4);
  }

  // Sicherheitseinstellungen
  getSafetySettings() {
    return [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];
  }
}

module.exports = { GoogleAdapter }; 