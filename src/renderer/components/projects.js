// Projekt-Verwaltungskomponente
class ProjectsManager {
  constructor() {
    this.projects = [];
    this.currentProject = null;
    this.initializeElements();
    this.attachEventListeners();
    this.loadProjects();
  }

  initializeElements() {
    this.elements = {
      projectsList: document.getElementById('projectsList'),
      btnNewProject: document.getElementById('btnNewProject'),
      btnExport: document.getElementById('btnExport')
    };
  }

  attachEventListeners() {
    // New Project Button
    this.elements.btnNewProject.addEventListener('click', () => {
      this.createNewProject();
    });

    // Export Button
    this.elements.btnExport.addEventListener('click', () => {
      this.exportCurrentProject();
    });

    // IPC Events
    api.on('create-new-project', () => {
      this.createNewProject();
    });

    api.on('open-project', () => {
      this.showOpenProjectDialog();
    });

    api.on('save-project', () => {
      this.saveCurrentProject();
    });

    api.on('export-project', () => {
      this.exportCurrentProject();
    });
  }

  async loadProjects() {
    try {
      this.projects = await api.projects.getAll();
      this.updateProjectsList();
      
      // Lade letztes Projekt oder erstelle neues
      if (this.projects.length > 0) {
        const lastProjectId = utils.storage.get('lastProjectId');
        const projectToLoad = this.projects.find(p => p.id === lastProjectId) || this.projects[0];
        this.loadProject(projectToLoad);
      } else {
        this.createNewProject();
      }
    } catch (error) {
      console.error('Fehler beim Laden der Projekte:', error);
      this.createNewProject();
    }
  }

  updateProjectsList() {
    if (this.projects.length === 0) {
      this.elements.projectsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-text">Keine Projekte vorhanden</div>
        </div>
      `;
      return;
    }

    this.elements.projectsList.innerHTML = this.projects.map(project => {
      const messageCount = project.messages?.length || 0;
      const lastMessage = project.lastMessageAt ? 
        utils.formatDate(project.lastMessageAt) : 
        utils.formatDate(project.createdAt);
      
      return `
        <div class="project-item ${project.id === this.currentProject?.id ? 'active' : ''}" 
             data-project-id="${project.id}">
          <div class="project-name">${project.name}</div>
          <div class="project-meta">
            <span>${messageCount} Nachrichten</span>
            <span>${lastMessage}</span>
          </div>
        </div>
      `;
    }).join('');

    // Füge Click-Handler hinzu
    this.elements.projectsList.querySelectorAll('.project-item').forEach(item => {
      item.addEventListener('click', () => {
        const projectId = item.dataset.projectId;
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
          this.loadProject(project);
        }
      });
    });
  }

  createNewProject() {
    const projectName = prompt('Projektname:', `Projekt ${this.projects.length + 1}`);
    if (!projectName) return;

    const newProject = {
      id: utils.generateId(),
      name: projectName,
      createdAt: new Date().toISOString(),
      lastMessageAt: null,
      messages: []
    };

    this.projects.unshift(newProject);
    this.loadProject(newProject);
    this.saveCurrentProject();
    this.updateProjectsList();
  }

  loadProject(project) {
    this.currentProject = project;
    utils.storage.set('lastProjectId', project.id);
    
    // Update UI
    window.chatManager.setCurrentProject(project.id, project.name);
    
    // Lade Nachrichten wenn vorhanden
    if (project.messages && project.messages.length > 0) {
      project.messages.forEach(message => {
        window.chatManager.addMessage(message);
      });
    }
    
    this.updateProjectsList();
  }

  async saveCurrentProject() {
    if (!this.currentProject) return;

    try {
      // Update project data
      this.currentProject.messages = window.chatManager.messages;
      this.currentProject.lastMessageAt = new Date().toISOString();
      
      // Save to backend
      await api.projects.save(this.currentProject);
      
      utils.showNotification('Projekt gespeichert', 'success');
    } catch (error) {
      console.error('Fehler beim Speichern des Projekts:', error);
      utils.showNotification('Fehler beim Speichern', 'error');
    }
  }

  async exportCurrentProject() {
    if (!this.currentProject || !window.chatManager.messages.length) {
      utils.showNotification('Nichts zu exportieren', 'info');
      return;
    }

    const format = prompt('Export-Format (json/markdown):', 'markdown');
    if (!format) return;

    try {
      let content;
      let filename;
      let mimeType;

      if (format === 'json') {
        content = JSON.stringify({
          project: this.currentProject,
          messages: window.chatManager.messages,
          exportedAt: new Date().toISOString()
        }, null, 2);
        filename = `${this.currentProject.name.replace(/\s+/g, '_')}_export.json`;
        mimeType = 'application/json';
      } else {
        content = this.convertToMarkdown();
        filename = `${this.currentProject.name.replace(/\s+/g, '_')}_export.md`;
        mimeType = 'text/markdown';
      }

      // Download-Link erstellen
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      utils.showNotification('Export erfolgreich', 'success');
    } catch (error) {
      console.error('Fehler beim Exportieren:', error);
      utils.showNotification('Export fehlgeschlagen', 'error');
    }
  }

  convertToMarkdown() {
    let markdown = `# ${this.currentProject.name}\n\n`;
    markdown += `Erstellt: ${utils.formatDate(this.currentProject.createdAt)}\n`;
    markdown += `Exportiert: ${utils.formatDate(new Date().toISOString())}\n\n`;
    markdown += `---\n\n`;

    window.chatManager.messages.forEach(message => {
      if (message.role === 'user') {
        markdown += `## 👤 User\n`;
        markdown += `*${utils.formatTime(message.timestamp)}*\n\n`;
        markdown += `${message.content}\n\n`;
      } else {
        markdown += `## ${message.agentAvatar} ${message.agentName}\n`;
        markdown += `*${utils.formatTime(message.timestamp)}*\n\n`;
        markdown += `${message.content}\n\n`;
        
        if (message.metadata) {
          markdown += `> **Metadata:**\n`;
          if (message.metadata.tokensUsed) {
            markdown += `> - Tokens: ${message.metadata.tokensUsed}\n`;
          }
          if (message.metadata.processingTime) {
            markdown += `> - Verarbeitungszeit: ${(message.metadata.processingTime / 1000).toFixed(1)}s\n`;
          }
          markdown += '\n';
        }
      }
      
      markdown += `---\n\n`;
    });

    return markdown;
  }

  showOpenProjectDialog() {
    // TODO: Implementiere Projekt-Öffnen-Dialog
    utils.showNotification('Projekt-Dialog noch nicht implementiert', 'info');
  }

  deleteProject(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    if (confirm(`Möchtest du das Projekt "${project.name}" wirklich löschen?`)) {
      this.projects = this.projects.filter(p => p.id !== projectId);
      
      if (this.currentProject?.id === projectId) {
        // Lade ein anderes Projekt oder erstelle neues
        if (this.projects.length > 0) {
          this.loadProject(this.projects[0]);
        } else {
          this.createNewProject();
        }
      }
      
      this.updateProjectsList();
      utils.showNotification(`Projekt "${project.name}" gelöscht`, 'success');
    }
  }

  renameProject(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    const newName = prompt('Neuer Projektname:', project.name);
    if (newName && newName !== project.name) {
      project.name = newName;
      this.saveCurrentProject();
      this.updateProjectsList();
      
      if (this.currentProject?.id === projectId) {
        document.getElementById('projectTitle').textContent = newName;
      }
    }
  }
}

// Initialisiere Projekt-Manager
window.projectsManager = new ProjectsManager(); 