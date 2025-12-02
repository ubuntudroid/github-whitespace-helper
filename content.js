// GitHub Whitespace Helper - Content Script
class GitHubWhitespaceHelper {
  constructor() {
    this.repoName = this.extractRepoName();
    this.init();
  }

  extractRepoName() {
    const match = window.location.pathname.match(/^\/([^\/]+)\/([^\/]+)\/pull\/\d+/);
    return match ? `${match[1]}/${match[2]}` : null;
  }

  async init() {
    if (!this.repoName) return;

    // Check if this repository should hide whitespace
    const shouldHide = await this.getRepoConfig();
    if (shouldHide) {
      this.hideWhitespace();
    }

    // Set up MutationObserver for SPA navigation
    this.setupNavigationObserver();
    
    // Listen for messages from popup
    this.setupMessageListener();
  }

  async getRepoConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([this.repoName], (result) => {
        resolve(result[this.repoName] !== false); // Default to true if not set
      });
    });
  }

  hideWhitespace() {
    // Check if whitespace is already hidden
    if (window.location.search.includes('w=1')) {
      return;
    }

    // Add w=1 parameter to hide whitespace
    const url = new URL(window.location);
    url.searchParams.set('w', '1');
    
    // Use replaceState to avoid adding to history
    window.history.replaceState({}, '', url.toString());
    
    // Simply reload the page for maximum reliability
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  showWhitespace() {
    // Check if whitespace is already shown
    if (!window.location.search.includes('w=1')) {
      return;
    }

    // Remove w=1 parameter to show whitespace
    const url = new URL(window.location);
    url.searchParams.delete('w');
    
    // Use replaceState to avoid adding to history
    window.history.replaceState({}, '', url.toString());
    
    // Simply reload the page for maximum reliability
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'refreshForRepo' && request.repoName === this.repoName) {
        // Only refresh if we're on the files tab
        if (this.isOnFilesTab()) {
          // Re-check the config and apply changes immediately
          this.getRepoConfig().then(shouldHide => {
            if (shouldHide) {
              this.hideWhitespace();
            } else {
              this.showWhitespace();
            }
            sendResponse({ success: true, refreshed: true });
          });
        } else {
          sendResponse({ success: true, refreshed: false, message: 'Not on files tab' });
        }
        return true; // Keep the message channel open for async response
      }
    });
  }

  isOnFilesTab() {
    // Check if we're on the files tab of a PR
    // Method 1: Check URL hash or path
    const url = new URL(window.location);
    if (url.hash === '#files-changed' || url.pathname.endsWith('/files')) {
      return true;
    }
    
    // Method 2: Check for the files tab being active in the UI
    const filesTab = document.querySelector('[data-tab-item="files"]') || 
                    document.querySelector('.tabnav-tab[aria-selected="true"][href*="files"]') ||
                    document.querySelector('.pr-tabnav-tab.selected[href*="files"]');
    
    if (filesTab && (filesTab.getAttribute('aria-selected') === 'true' || 
                     filesTab.classList.contains('selected') ||
                     filesTab.classList.contains('active'))) {
      return true;
    }
    
    // Method 3: Check if the current URL contains files-related indicators
    if (window.location.pathname.includes('/pull/') && 
        (window.location.search.includes('w=') || 
         document.querySelector('.file-diff-split, .file-diff, .js-diff-progressive-container'))) {
      return true;
    }
    
    // Method 4: Check if we're on the main PR page but not on conversation tab
    if (window.location.pathname.includes('/pull/') && 
        !window.location.pathname.includes('/conversation') &&
        document.querySelector('.pr-toolbar, .diffbar, .js-file-header')) {
      return true;
    }
    
    return false;
  }

  setupNavigationObserver() {
    // Observe URL changes for GitHub's SPA navigation
    let currentUrl = window.location.href;
    
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        const newRepoName = this.extractRepoName();
        if (newRepoName && newRepoName !== this.repoName) {
          this.repoName = newRepoName;
          this.init();
        }
      }
    };

    // Use multiple methods to catch GitHub's navigation
    setInterval(checkUrlChange, 1000);
    
    // Also observe DOM changes
    const observer = new MutationObserver(() => {
      checkUrlChange();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize the helper
new GitHubWhitespaceHelper();
