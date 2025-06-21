// Agenten-Verwaltungskomponente
class AgentsManager {
  constructor() {
    this.agents = [];
    this.initializeElements();
    this.attachEventListeners();
    this.loadAgents();
  }

  initializeElements() {
    this.elements = {
      agentsList: document.getElementById('agentsList'),
      btnManageAgents: document.getElementById('btnManageAgents'),
      addAgentModal: document.getElementById('addAgentModal'),
      addAgentForm: document.getElementById('addAgentForm'),
      agentType: document.getElementById('agentType'),
      agentModel: document.getElementById('agentModel'),
      apiKeyGroup: document.getElementById('apiKeyGroup'),
      assistantIdGroup: document.getElementById('assistantIdGroup'),
      organizationIdGroup: document.getElementById('organizationIdGroup')
    };
  }

  attachEventListeners() {
    // Manage Agents Button
    this.elements.btnManageAgents.addEventListener('click', () => {
      this.showAddAgentModal();
    });

    // Agent Type Change
    this.elements.agentType.addEventListener('change', (e) => {
      this.handleAgentTypeChange(e.target.value);
    });

    // Add Agent Form Submit
    this.elements.addAgentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAddAgent();
    });

    // IPC Events
    api.on('add-agent', () => {
      this.showAddAgentModal();
    });

    api.on('manage-agents', () => {
      this.showManageAgentsModal();
    });
  }

  async loadAgents() {
    try {
      this.agents = await api.agents.getAll();
      this.updateAgentsList();
      this.updateChatAgentCheckboxes();
    } catch (error) {
      console.error('Fehler beim Laden der Agenten:', error);
    }
  }

  updateAgentsList() {
    if (this.agents.length === 0) {
      this.elements.agentsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🤖</div>
          <div class="empty-state-text">Keine Agenten konfiguriert</div>
          <button class="empty-state-action" onclick="agentsManager.showAddAgentModal()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
            </svg>
            Agent hinzufügen
          </button>
        </div>
      `;
      return;
    }

    this.elements.agentsList.innerHTML = this.agents.map(agent => {
      let displayName = agent.name;
      let displayModel = agent.model || agent.type;
      
      // Spezielle Anzeige für OpenAI Assistants
      if (agent.type === 'openai-assistant') {
        displayModel = 'Assistant';
      }
      
      return `
        <div class="agent-item ${!agent.enabled ? 'disabled' : ''}" data-agent-id="${agent.id}">
          <div class="agent-icon" style="background-color: ${agent.color}">
            ${agent.avatar}
          </div>
          <div class="agent-info">
            <h4>${displayName}</h4>
            <div class="agent-model">${displayModel}</div>
          </div>
          <div class="agent-status-indicator ${agent.enabled ? '' : 'offline'}"></div>
        </div>
      `;
    }).join('');

    // Füge Click-Handler hinzu
    this.elements.agentsList.querySelectorAll('.agent-item').forEach(item => {
      item.addEventListener('click', () => {
        const agentId = item.dataset.agentId;
        this.showAgentDetails(agentId);
      });
    });
  }

  updateChatAgentCheckboxes() {
    if (window.chatManager) {
      window.chatManager.updateAgentCheckboxes(this.agents.filter(a => a.enabled));
    }
  }

  showAddAgentModal() {
    this.elements.addAgentModal.classList.add('show');
    this.elements.addAgentForm.reset();
    this.handleAgentTypeChange('');
  }

  hideAddAgentModal() {
    this.elements.addAgentModal.classList.remove('show');
  }

  handleAgentTypeChange(type) {
    // Zeige/Verstecke API-Key Feld
    if (type === 'cursor') {
      this.elements.apiKeyGroup.style.display = 'none';
      document.getElementById('agentApiKey').removeAttribute('required');
    } else {
      this.elements.apiKeyGroup.style.display = 'block';
      document.getElementById('agentApiKey').setAttribute('required', 'required');
    }

    // Zeige/Verstecke Assistant ID und Organization ID Felder
    if (type === 'openai-assistant') {
      this.elements.assistantIdGroup.style.display = 'block';
      this.elements.organizationIdGroup.style.display = 'block';
      document.getElementById('assistantId').setAttribute('required', 'required');
    } else {
      this.elements.assistantIdGroup.style.display = 'none';
      this.elements.organizationIdGroup.style.display = 'none';
      document.getElementById('assistantId').removeAttribute('required');
    }

    // Update Model-Dropdown
    this.updateModelDropdown(type);
  }

  updateModelDropdown(type) {
    const modelSelect = this.elements.agentModel;
    modelSelect.innerHTML = '<option value="">Standard</option>';

    // Für OpenAI Assistants keine Model-Auswahl
    if (type === 'openai-assistant') {
      modelSelect.disabled = true;
      modelSelect.innerHTML = '<option value="">Verwendet Assistant-Konfiguration</option>';
      return;
    } else {
      modelSelect.disabled = false;
    }

    if (type && window.modelConfigs[type]) {
      const models = window.modelConfigs[type].models;
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelect.appendChild(option);
      });
    }
  }

  async handleAddAgent() {
    const formData = new FormData(this.elements.addAgentForm);
    const agentConfig = {
      name: formData.get('agentName'),
      type: formData.get('agentType'),
      apiKey: formData.get('agentApiKey'),
      model: formData.get('agentModel'),
      systemPrompt: formData.get('agentSystemPrompt'),
      assistantId: formData.get('assistantId'),
      organizationId: formData.get('organizationId')
    };

    try {
      const newAgent = await api.agents.add(agentConfig);
      this.agents.push(newAgent);
      this.updateAgentsList();
      this.updateChatAgentCheckboxes();
      this.hideAddAgentModal();
      utils.showNotification(`Agent "${newAgent.name}" erfolgreich hinzugefügt`, 'success');
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Agenten:', error);
      alert('Fehler beim Hinzufügen des Agenten: ' + error.message);
    }
  }

  async showAgentDetails(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;

    // TODO: Implementiere detaillierte Agent-Ansicht
    console.log('Agent Details:', agent);
  }

  async removeAgent(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;

    if (confirm(`Möchtest du den Agent "${agent.name}" wirklich entfernen?`)) {
      try {
        await api.agents.remove(agentId);
        this.agents = this.agents.filter(a => a.id !== agentId);
        this.updateAgentsList();
        this.updateChatAgentCheckboxes();
        utils.showNotification(`Agent "${agent.name}" wurde entfernt`, 'success');
      } catch (error) {
        console.error('Fehler beim Entfernen des Agenten:', error);
        alert('Fehler beim Entfernen des Agenten: ' + error.message);
      }
    }
  }

  getAgentById(agentId) {
    return this.agents.find(a => a.id === agentId);
  }

  getEnabledAgents() {
    return this.agents.filter(a => a.enabled);
  }

  async toggleAgent(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;

    try {
      // TODO: Implementiere Agent-Toggle im Backend
      agent.enabled = !agent.enabled;
      this.updateAgentsList();
      this.updateChatAgentCheckboxes();
    } catch (error) {
      console.error('Fehler beim Umschalten des Agenten:', error);
    }
  }
}

// Modal-Hilfsfunktionen
window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
};

window.showModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
  }
};

// Initialisiere Agenten-Manager
window.agentsManager = new AgentsManager(); 