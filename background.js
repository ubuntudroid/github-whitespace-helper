// GitHub Whitespace Helper - Background Script
class BackgroundManager {
  constructor() {
    this.init();
  }

  init() {
    // Set up default configuration on first install
    chrome.runtime.onInstalled.addListener(() => {
      this.setDefaults();
    });

    // Handle storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        console.log('Storage changed:', changes);
      }
    });
  }

  async setDefaults() {
    try {
      // Check if this is the first install
      const items = await chrome.storage.sync.get(null);
      
      if (Object.keys(items).length === 0) {
        // Start with empty configuration - users will add repos manually
        console.log('GitHub Whitespace Helper installed with empty configuration');
      }
    } catch (error) {
      console.error('Error setting defaults:', error);
    }
  }

  // Method to get all configured repositories
  async getAllRepos() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (items) => {
        const repos = Object.keys(items).filter(key => key.includes('/'));
        resolve(repos.map(repo => ({
          name: repo,
          enabled: items[repo] !== false
        })));
      });
    });
  }

  // Method to update repository configuration
  async updateRepo(repoName, enabled) {
    try {
      await chrome.storage.sync.set({ [repoName]: enabled });
      return { success: true };
    } catch (error) {
      console.error('Error updating repo:', error);
      return { success: false, error: error.message };
    }
  }

  // Method to remove repository configuration
  async removeRepo(repoName) {
    try {
      await chrome.storage.sync.remove(repoName);
      return { success: true };
    } catch (error) {
      console.error('Error removing repo:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize background manager
new BackgroundManager();
