/**
 * ProjectsDashboard.js
 * ---------------------------------------------------------------------------
 * Manages the saved projects dashboard where users can view, open, duplicate,
 * and delete their saved cooler configurations.
 * ---------------------------------------------------------------------------
 */

export class ProjectsDashboard {
  constructor(configManager, onProjectLoad) {
    this.configManager = configManager;
    this.onProjectLoad = onProjectLoad;
    this.modal = null;
    this.projectsContainer = null;
    this.searchInput = null;
    this.sortSelect = null;
    this.currentSort = 'date-desc';
    this.searchTerm = '';

    this._createDashboard();
  }

  /**
   * Shows the projects dashboard
   */
  show() {
    this.modal.classList.add('is-visible');
    this._loadProjects();
  }

  /**
   * Hides the projects dashboard
   */
  hide() {
    this.modal.classList.remove('is-visible');
  }

  /**
   * Loads and displays all saved projects
   */
  _loadProjects() {
    const projects = this.configManager.getAllSavedConfigurations();
    this._renderProjects(projects);
  }

  /**
   * Renders projects list with current filters/sort
   */
  _renderProjects(projects) {
    // Filter by search term
    let filtered = projects;
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = projects.filter((p) =>
        p.projectName.toLowerCase().includes(term)
      );
    }

    // Sort projects
    filtered = this._sortProjects(filtered);

    // Render
    if (filtered.length === 0) {
      this.projectsContainer.innerHTML = `
        <div class="projects-empty">
          <div class="projects-empty__icon">📁</div>
          <p class="projects-empty__title">No saved projects</p>
          <p class="projects-empty__text">
            ${this.searchTerm ? 'No projects match your search.' : 'Save your first configuration to get started.'}
          </p>
        </div>
      `;
      return;
    }

    this.projectsContainer.innerHTML = filtered
      .map((project) => this._renderProjectCard(project))
      .join('');

    // Attach event listeners
    this._attachCardListeners();
  }

  /**
   * Renders a single project card
   */
  _renderProjectCard(project) {
    const date = new Date(project.timestamp);
    const dateStr = this._formatDate(date);
    const dimensions = `${project.dimensions.depth}' × ${project.dimensions.width}' × ${project.dimensions.height}'`;
    const type = project.appType === 'cooler' ? 'Cooler' : 'Freezer';

    return `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-card__thumbnail">
          <div class="project-card__thumbnail-placeholder">
            <svg viewBox="0 0 24 24" width="32" height="32">
              <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <rect x="6" y="8" width="5" height="8" fill="currentColor" opacity="0.3"/>
              <rect x="13" y="8" width="5" height="8" fill="currentColor" opacity="0.3"/>
            </svg>
          </div>
        </div>
        <div class="project-card__content">
          <h3 class="project-card__title">${this._escapeHtml(project.projectName)}</h3>
          <div class="project-card__meta">
            <span class="project-card__type">${type}</span>
            <span class="project-card__dimensions">${dimensions}</span>
          </div>
          <div class="project-card__date">${dateStr}</div>
        </div>
        <div class="project-card__actions">
          <button class="project-card__action project-card__action--primary" data-action="open" title="Open project">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
              <path fill="currentColor" d="M8 12l4 4 4-4H8z"/>
            </svg>
            Open
          </button>
          <button class="project-card__action" data-action="duplicate" title="Duplicate project">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
          <button class="project-card__action project-card__action--danger" data-action="delete" title="Delete project">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attaches event listeners to project cards
   */
  _attachCardListeners() {
    const cards = this.projectsContainer.querySelectorAll('.project-card');

    cards.forEach((card) => {
      const projectId = card.dataset.projectId;

      card.querySelector('[data-action="open"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this._openProject(projectId);
      });

      card.querySelector('[data-action="duplicate"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this._duplicateProject(projectId);
      });

      card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this._deleteProject(projectId);
      });

      // Click card to open
      card.addEventListener('click', () => {
        this._openProject(projectId);
      });
    });
  }

  /**
   * Opens a project
   */
  _openProject(projectId) {
    try {
      const config = this.configManager.loadFromLocalStorage(projectId, this.onProjectLoad);
      this.hide();
      this._showToast(`Opened "${config.projectName}"`);
    } catch (err) {
      console.error('Failed to open project:', err);
      this._showToast('Failed to open project', 'error');
    }
  }

  /**
   * Duplicates a project
   */
  _duplicateProject(projectId) {
    try {
      const newId = this.configManager.duplicateConfiguration(projectId);
      this._loadProjects();
      this._showToast('Project duplicated successfully');
    } catch (err) {
      console.error('Failed to duplicate project:', err);
      this._showToast('Failed to duplicate project', 'error');
    }
  }

  /**
   * Deletes a project with confirmation
   */
  _deleteProject(projectId) {
    const confirmed = confirm('Are you sure you want to delete this project? This action cannot be undone.');

    if (confirmed) {
      try {
        this.configManager.deleteConfiguration(projectId);
        this._loadProjects();
        this._showToast('Project deleted successfully');
      } catch (err) {
        console.error('Failed to delete project:', err);
        this._showToast('Failed to delete project', 'error');
      }
    }
  }

  /**
   * Sorts projects based on current sort setting
   */
  _sortProjects(projects) {
    const sorted = [...projects];

    switch (this.currentSort) {
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        break;
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        break;
      case 'name-asc':
        sorted.sort((a, b) => a.projectName.localeCompare(b.projectName));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.projectName.localeCompare(a.projectName));
        break;
    }

    return sorted;
  }

  /**
   * Creates the dashboard DOM structure
   */
  _createDashboard() {
    this.modal = document.createElement('div');
    this.modal.className = 'projects-modal';

    this.modal.innerHTML = `
      <div class="projects-modal__overlay"></div>
      <div class="projects-modal__content">
        <div class="projects-modal__header">
          <h2 class="projects-modal__title">My Projects</h2>
          <button class="projects-modal__close">&times;</button>
        </div>

        <div class="projects-modal__toolbar">
          <input
            type="text"
            class="projects-modal__search"
            placeholder="Search projects..."
          />
          <select class="projects-modal__sort">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
          </select>
        </div>

        <div class="projects-modal__list"></div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Store references
    this.projectsContainer = this.modal.querySelector('.projects-modal__list');
    this.searchInput = this.modal.querySelector('.projects-modal__search');
    this.sortSelect = this.modal.querySelector('.projects-modal__sort');

    // Event listeners
    this.modal.querySelector('.projects-modal__close').addEventListener('click', () => this.hide());
    this.modal.querySelector('.projects-modal__overlay').addEventListener('click', () => this.hide());

    this.searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value;
      this._loadProjects();
    });

    this.sortSelect.addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this._loadProjects();
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('is-visible')) {
        this.hide();
      }
    });
  }

  // Helper methods

  _formatDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('is-visible');
      setTimeout(() => toast.classList.remove('is-visible'), 3000);
    }
  }
}
