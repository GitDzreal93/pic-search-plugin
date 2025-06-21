// 扇贝单词图片搜索 - 弹窗脚本

class PopupManager {
  constructor() {
    this.defaultSettings = {
      enabled: true,
      modifierKey: 'metaKey',
      searchEngine: 'bing',
      inlinePreview: false
    };
    this.defaultSiteSettings = {
      enableMode: 'disabled', // 'disabled', 'current', 'domain'
      currentSite: '',
      mainDomain: ''
    };
    this.currentDomain = null;
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadSiteSettings();
    await this.getCurrentDomain();
    this.bindEvents();
    this.updateUI();
    this.updateSiteUI();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['wordSearchSettings']);
      this.settings = result.wordSearchSettings || this.defaultSettings;
    } catch (error) {
      console.log('加载设置失败，使用默认设置');
      this.settings = this.defaultSettings;
    }
  }

  async loadSiteSettings() {
    try {
      const result = await chrome.storage.sync.get(['wordSearchSiteSettings']);
      this.siteSettings = result.wordSearchSiteSettings || this.defaultSiteSettings;
    } catch (error) {
      console.log('加载网站设置失败，使用默认设置');
      this.siteSettings = this.defaultSiteSettings;
    }
  }

  async getCurrentDomain() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        this.currentDomain = url.hostname;
        this.currentUrl = tabs[0].url;

        // 解析主域名和顶级域名
        this.parseDomainsFromCurrent();
      } else {
        this.currentDomain = 'unknown';
        this.currentUrl = '';
      }
    } catch (error) {
      console.log('获取当前域名失败');
      this.currentDomain = 'unknown';
      this.currentUrl = '';
    }
  }

  parseDomainsFromCurrent() {
    if (!this.currentDomain || this.currentDomain === 'unknown') {
      this.mainDomain = '';
      return;
    }

    const parts = this.currentDomain.split('.');

    if (parts.length >= 2) {
      // 主域名：取最后两部分 (example.com)
      this.mainDomain = parts.slice(-2).join('.');
    } else {
      this.mainDomain = this.currentDomain;
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({ wordSearchSettings: this.settings });
      this.showNotification('设置已保存', 'success');

      // 通知所有标签页更新设置
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: this.settings
        }).catch(() => {
          // 忽略无法发送消息的标签页
        });
      });
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showNotification('保存设置失败', 'error');
    }
  }

  async saveSiteSettings() {
    try {
      await chrome.storage.sync.set({ wordSearchSiteSettings: this.siteSettings });
      this.showNotification('网站设置已保存', 'success');

      // 通知所有标签页更新网站设置
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SITE_SETTINGS_UPDATED',
          siteSettings: this.siteSettings
        }).catch(() => {
          // 忽略无法发送消息的标签页
        });
      });

      // 更新UI显示
      this.updateSiteUI();
    } catch (error) {
      console.error('保存网站设置失败:', error);
      this.showNotification('保存网站设置失败', 'error');
    }
  }

  bindEvents() {
    // 启用开关
    const enableToggle = document.getElementById('enablePlugin');
    enableToggle.addEventListener('change', (e) => {
      this.settings.enabled = e.target.checked;
      this.saveSettings();
    });

    // 修饰键选择
    const modifierSelect = document.getElementById('modifierKey');
    modifierSelect.addEventListener('change', (e) => {
      this.settings.modifierKey = e.target.value;
      this.saveSettings();
    });

    // 搜索引擎选择
    const searchEngineRadios = document.querySelectorAll('input[name="searchEngine"]');
    searchEngineRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.settings.searchEngine = e.target.value;
          this.saveSettings();
        }
      });
    });

    // 页面内预览开关
    const inlinePreviewToggle = document.getElementById('inlinePreview');
    inlinePreviewToggle.addEventListener('change', (e) => {
      this.settings.inlinePreview = e.target.checked;
      this.saveSettings();
    });

    // 启用模式选择
    const enableModeRadios = document.querySelectorAll('input[name="enableMode"]');
    enableModeRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        if (e.target.checked) {
          this.siteSettings.enableMode = e.target.value;
          this.updateSiteSettingsFromMode();
          await this.saveSiteSettings();
        }
      });
    });

    // 重置设置
    const resetButton = document.getElementById('resetSettings');
    resetButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.resetSettings();
    });

    // 反馈建议
    const feedbackButton = document.getElementById('feedback');
    feedbackButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    });
  }

  updateUI() {
    // 更新启用开关
    const enableToggle = document.getElementById('enablePlugin');
    enableToggle.checked = this.settings.enabled;

    // 更新修饰键选择
    const modifierSelect = document.getElementById('modifierKey');
    modifierSelect.value = this.settings.modifierKey;

    // 更新搜索引擎选择
    const searchEngineRadio = document.querySelector(`input[name="searchEngine"][value="${this.settings.searchEngine}"]`);
    if (searchEngineRadio) {
      searchEngineRadio.checked = true;
    }

    // 更新页面内预览开关
    const inlinePreviewToggle = document.getElementById('inlinePreview');
    inlinePreviewToggle.checked = this.settings.inlinePreview || false;
  }

  updateSiteUI() {
    // 更新当前网站信息
    this.updateCurrentSiteInfo();

    // 更新选项描述
    this.updateOptionDescriptions();

    // 更新选中状态
    this.updateSelectedMode();
  }

  updateCurrentSiteInfo() {
    const currentSiteName = document.getElementById('currentSiteName');
    const currentSiteUrl = document.getElementById('currentSiteUrl');

    if (currentSiteName) {
      currentSiteName.textContent = this.currentDomain || '未知网站';
    }

    if (currentSiteUrl) {
      if (this.currentUrl) {
        // 显示简化的URL
        try {
          const url = new URL(this.currentUrl);
          currentSiteUrl.textContent = url.hostname + url.pathname;
        } catch {
          currentSiteUrl.textContent = this.currentUrl;
        }
      } else {
        currentSiteUrl.textContent = '无法获取网站信息';
      }
    }
  }

  updateOptionDescriptions() {
    // 更新"仅在当前网站启用"描述
    const currentSiteDesc = document.getElementById('currentSiteDesc');
    if (currentSiteDesc && this.currentDomain) {
      currentSiteDesc.textContent = `仅在 ${this.currentDomain} 启用`;
    }

    // 更新"在主域名启用"描述
    const domainDesc = document.getElementById('domainDesc');
    if (domainDesc && this.mainDomain) {
      domainDesc.textContent = `在 ${this.mainDomain} 及其子域名启用`;
    }
  }

  updateSelectedMode() {
    const enableModeRadio = document.querySelector(`input[name="enableMode"][value="${this.siteSettings.enableMode}"]`);
    if (enableModeRadio) {
      enableModeRadio.checked = true;
    }
  }

  updateSiteSettingsFromMode() {
    // 根据选择的模式更新网站设置
    this.siteSettings.currentSite = this.currentDomain || '';
    this.siteSettings.mainDomain = this.mainDomain || '';
  }

  isSiteEnabled(domain) {
    if (!this.settings.enabled) return false;

    switch (this.siteSettings.enableMode) {
      case 'disabled':
        return false;
      case 'current':
        return domain === this.siteSettings.currentSite;
      case 'domain':
        // 检查是否是主域名或其子域名
        return domain === this.siteSettings.mainDomain || domain.endsWith('.' + this.siteSettings.mainDomain);
      default:
        return false;
    }
  }



  async resetSettings() {
    if (confirm('确定要重置所有设置吗？这将恢复到默认配置。')) {
      this.settings = { ...this.defaultSettings };
      this.siteSettings = { ...this.defaultSiteSettings };
      await this.saveSettings();
      await this.saveSiteSettings();
      this.updateUI();
      this.updateSiteUI();
      this.showNotification('设置已重置', 'success');
    }
  }

  openFeedback() {
    const feedbackUrl = 'mailto:feedback@example.com?subject=扇贝单词图片搜索插件反馈&body=请在此处描述您的建议或问题：';
    chrome.tabs.create({ url: feedbackUrl });
  }

  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
      </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        animation: notificationSlideIn 0.3s ease;
        backdrop-filter: blur(10px);
      }
      
      .notification-success {
        background: rgba(72, 187, 120, 0.9);
      }
      
      .notification-error {
        background: rgba(245, 101, 101, 0.9);
      }

      .notification-warning {
        background: rgba(237, 137, 54, 0.9);
      }
      
      .notification-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      @keyframes notificationSlideIn {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes notificationSlideOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(notification);

    // 自动移除通知
    setTimeout(() => {
      notification.style.animation = 'notificationSlideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 300);
    }, 3000);
  }

  getNotificationIcon(type) {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }
}

// 添加一些实用功能
class UIEnhancements {
  constructor() {
    this.init();
  }

  init() {
    this.addHoverEffects();
    this.addKeyboardNavigation();
    this.addAccessibility();
  }

  addHoverEffects() {
    // 为卡片添加悬停效果
    const cards = document.querySelectorAll('.setting-item, .radio-card, .instruction-item');
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
      });
    });
  }

  addKeyboardNavigation() {
    // Tab键导航增强
    const focusableElements = document.querySelectorAll(
      'input, select, button, a, [tabindex]:not([tabindex="-1"])'
    );
    
    focusableElements.forEach((element, index) => {
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          // 自定义Tab导航逻辑
          if (e.shiftKey && index === 0) {
            e.preventDefault();
            focusableElements[focusableElements.length - 1].focus();
          } else if (!e.shiftKey && index === focusableElements.length - 1) {
            e.preventDefault();
            focusableElements[0].focus();
          }
        }
      });
    });
  }

  addAccessibility() {
    // 添加ARIA标签
    const toggles = document.querySelectorAll('.toggle input');
    toggles.forEach(toggle => {
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', toggle.checked);
      
      toggle.addEventListener('change', () => {
        toggle.setAttribute('aria-checked', toggle.checked);
      });
    });

    // 添加键盘支持
    const radioCards = document.querySelectorAll('.radio-card');
    radioCards.forEach(card => {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'radio');
      
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const radio = card.querySelector('input[type="radio"]');
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      });
    });
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
  new UIEnhancements();
  
  // 添加加载动画
  document.body.style.opacity = '0';
  document.body.style.transform = 'translateY(20px)';
  
  setTimeout(() => {
    document.body.style.transition = 'all 0.3s ease';
    document.body.style.opacity = '1';
    document.body.style.transform = 'translateY(0)';
  }, 100);
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    // 返回当前设置
    chrome.storage.sync.get(['wordSearchSettings']).then(result => {
      sendResponse(result.wordSearchSettings || {
        enabled: true,
        modifierKey: 'metaKey',
        searchEngine: 'bing',
        inlinePreview: false
      });
    });
    return true; // 保持消息通道开放
  }
});