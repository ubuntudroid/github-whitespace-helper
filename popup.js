// GitHub Whitespace Helper - Popup Script
class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadCurrentRepo();
    await this.loadConfiguredRepos();
    this.setupEventListeners();
  }

  async loadCurrentRepo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      
      if (url.hostname === 'github.com') {
        const match = url.pathname.match(/^\/([^\/]+)\/([^\/]+)\/pull\/\d+/);
        if (match) {
          const repoName = `${match[1]}/${match[2]}`;
          document.getElementById('current-repo-name').textContent = repoName;
          
          const toggle = document.getElementById('current-repo-toggle');
          const config = await this.getRepoConfig(repoName);
          toggle.checked = config !== false;
          
          toggle.dataset.repo = repoName;
          toggle.disabled = false;
          return;
        }
      }
      
      document.getElementById('current-repo-name').textContent = 'Not on a GitHub PR page';
      document.getElementById('current-repo-toggle').disabled = true;
    } catch (error) {
      console.error('Error loading current repo:', error);
      document.getElementById('current-repo-name').textContent = 'Error loading repo';
      document.getElementById('current-repo-toggle').disabled = true;
    }
  }

  async loadConfiguredRepos() {
    try {
      const items = await chrome.storage.sync.get(null);
      const reposList = document.getElementById('repos-list');
      
      const configuredRepos = Object.keys(items).filter(key => key.includes('/'));
      
      if (configuredRepos.length === 0) {
        reposList.innerHTML = '<p class="empty-state">No repositories configured yet</p>';
        return;
      }

      reposList.innerHTML = '';
      configuredRepos.forEach(repo => {
        const repoItem = this.createRepoItem(repo, items[repo] !== false);
        reposList.appendChild(repoItem);
      });
    } catch (error) {
      console.error('Error loading configured repos:', error);
    }
  }

  createRepoItem(repoName, enabled) {
    const item = document.createElement('div');
    item.className = 'repo-item';
    
    item.innerHTML = `
      <span class="repo-name">${repoName}</span>
      <div class="repo-actions">
        <label class="toggle">
          <input type="checkbox" ${enabled ? 'checked' : ''} data-repo="${repoName}">
          <span class="slider"></span>
        </label>
        <button class="remove-btn" data-repo="${repoName}">Remove</button>
      </div>
    `;
    
    // Add event listeners
    const toggle = item.querySelector('input[type="checkbox"]');
    toggle.addEventListener('change', (e) => this.toggleRepo(repoName, e.target.checked));
    
    const removeBtn = item.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => this.removeRepo(repoName));
    
    return item;
  }

  async getRepoConfig(repoName) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([repoName], (result) => {
        resolve(result[repoName] !== false);
      });
    });
  }

  async toggleRepo(repoName, enabled) {
    try {
      await chrome.storage.sync.set({ [repoName]: enabled });
      await this.loadConfiguredRepos();
      
      // If this is the current repository, refresh the page immediately
      const currentToggle = document.getElementById('current-repo-toggle');
      if (currentToggle.dataset.repo === repoName) {
        await this.refreshCurrentTab(repoName);
      }
    } catch (error) {
      console.error('Error toggling repo:', error);
    }
  }

  async refreshCurrentTab(repoName) {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script to refresh
      chrome.tabs.sendMessage(tab.id, { 
        action: 'refreshForRepo', 
        repoName: repoName 
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script might not be ready, that's okay
          console.log('Could not reach content script:', chrome.runtime.lastError.message);
          this.showMessage('Setting saved. Refresh to see changes.', 'info');
        } else if (response && !response.refreshed) {
          // Show feedback when refresh was skipped
          this.showMessage('Setting updated (will apply when viewing files)', 'info');
        }
      });
    } catch (error) {
      console.error('Error refreshing current tab:', error);
      this.showMessage('Setting saved. Refresh to see changes.', 'info');
    }
  }

  async removeRepo(repoName) {
    try {
      await chrome.storage.sync.remove(repoName);
      await this.loadConfiguredRepos();
      
      // If we removed the current repo, update its display
      const currentToggle = document.getElementById('current-repo-toggle');
      if (currentToggle.dataset.repo === repoName) {
        currentToggle.checked = true; // Reset to default
      }
    } catch (error) {
      console.error('Error removing repo:', error);
    }
  }

  setupEventListeners() {
    // Current repo toggle
    document.getElementById('current-repo-toggle').addEventListener('change', async (e) => {
      const repoName = e.target.dataset.repo;
      if (repoName) {
        await this.toggleRepo(repoName, e.target.checked);
      }
    });

    // Add repo button
    document.getElementById('add-repo-btn').addEventListener('click', () => this.addRepo());
    
    // Enter key on repo input
    document.getElementById('repo-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addRepo();
      }
    });
  }

  async addRepo() {
    const input = document.getElementById('repo-input');
    const repoName = input.value.trim();
    
    if (!repoName) {
      this.showMessage('Please enter a repository name');
      return;
    }
    
    if (!repoName.includes('/')) {
      this.showMessage('Repository name must be in format: owner/repository');
      return;
    }
    
    try {
      await chrome.storage.sync.set({ [repoName]: true });
      input.value = '';
      await this.loadConfiguredRepos();
      this.showMessage(`Added ${repoName}`, 'success');
    } catch (error) {
      console.error('Error adding repo:', error);
      this.showMessage('Error adding repository', 'error');
    }
  }

  showMessage(message, type = 'info') {
    // Create a temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      messageEl.remove();
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
