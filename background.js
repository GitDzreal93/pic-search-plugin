// 扇贝单词图片搜索 - 后台脚本

class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeSettings();
  }

  setupEventListeners() {
    // 插件安装或更新时的处理
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // 处理来自content script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 保持消息通道开放
    });

    // 标签页更新时重新注入脚本
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        this.injectContentScript(tabId);
      }
    });

    // 处理快捷键命令
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });
  }

  async handleInstallation(details) {
    console.log('插件安装/更新:', details.reason);
    
    if (details.reason === 'install') {
      // 首次安装
      await this.setDefaultSettings();
      this.showWelcomeNotification();
    } else if (details.reason === 'update') {
      // 更新版本
      await this.migrateSettings(details.previousVersion);
      this.showUpdateNotification();
    }
  }

  async setDefaultSettings() {
    const defaultSettings = {
      enabled: true,
      modifierKey: 'metaKey',
      searchEngine: 'bing',
      version: '1.0.0'
    };

    const defaultSiteSettings = {
      enableMode: 'disabled',
      currentSite: '',
      mainDomain: ''
    };

    try {
      await chrome.storage.sync.set({
        wordSearchSettings: defaultSettings,
        wordSearchSiteSettings: defaultSiteSettings
      });
      console.log('默认设置已保存');
    } catch (error) {
      console.error('保存默认设置失败:', error);
    }
  }

  async migrateSettings(previousVersion) {
    try {
      const result = await chrome.storage.sync.get(['wordSearchSettings']);
      const currentSettings = result.wordSearchSettings || {};
      
      // 添加新的设置项（如果需要）
      const updatedSettings = {
        enabled: true,
        modifierKey: 'metaKey',
        searchEngine: 'bing',
        ...currentSettings,
        version: '1.0.0'
      };

      await chrome.storage.sync.set({ wordSearchSettings: updatedSettings });
      console.log(`设置已从版本 ${previousVersion} 迁移到 1.0.0`);
    } catch (error) {
      console.error('设置迁移失败:', error);
    }
  }

  async initializeSettings() {
    try {
      const result = await chrome.storage.sync.get(['wordSearchSettings', 'wordSearchSiteSettings']);
      if (!result.wordSearchSettings || !result.wordSearchSiteSettings) {
        await this.setDefaultSettings();
      }
    } catch (error) {
      console.error('初始化设置失败:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'GET_SETTINGS':
        try {
          const result = await chrome.storage.sync.get(['wordSearchSettings']);
          sendResponse({
            success: true,
            settings: result.wordSearchSettings || {
              enabled: true,
              modifierKey: 'metaKey',
              searchEngine: 'bing'
            }
          });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SAVE_SETTINGS':
        try {
          await chrome.storage.sync.set({ wordSearchSettings: message.settings });
          sendResponse({ success: true });

          // 通知所有标签页设置已更新
          this.broadcastSettingsUpdate(message.settings);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SAVE_SITE_SETTINGS':
        try {
          await chrome.storage.sync.set({ wordSearchSiteSettings: message.siteSettings });
          sendResponse({ success: true });

          // 通知所有标签页网站设置已更新
          this.broadcastSiteSettingsUpdate(message.siteSettings);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'GET_SITE_SETTINGS':
        try {
          const result = await chrome.storage.sync.get(['wordSearchSiteSettings']);
          sendResponse({
            success: true,
            siteSettings: result.wordSearchSiteSettings || {
              enableMode: 'disabled',
              currentSite: '',
              mainDomain: ''
            }
          });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SEARCH_WORD':
        this.handleWordSearch(message.word, message.searchEngine, sender.tab);
        sendResponse({ success: true });
        break;

      case 'LOG_USAGE':
        this.logUsage(message.data);
        sendResponse({ success: true });
        break;

      default:
        console.log('未知消息类型:', message.type);
        sendResponse({ success: false, error: '未知消息类型' });
    }
  }

  async broadcastSettingsUpdate(settings) {
    try {
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          }).catch(() => {
            // 忽略无法发送消息的标签页
          });
        }
      });
    } catch (error) {
      console.error('广播设置更新失败:', error);
    }
  }

  async broadcastSiteSettingsUpdate(siteSettings) {
    try {
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SITE_SETTINGS_UPDATED',
            siteSettings: siteSettings
          }).catch(() => {
            // 忽略无法发送消息的标签页
          });
        }
      });
    } catch (error) {
      console.error('广播网站设置更新失败:', error);
    }
  }

  async injectContentScript(tabId) {
    try {
      // 检查是否已经注入
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => window.wordSearchInjected
      });

      if (!results[0]?.result) {
        // 注入content script
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });

        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content.css']
        });

        console.log(`Content script已注入到标签页 ${tabId}`);
      }
    } catch (error) {
      // 忽略无法注入的页面（如chrome://页面）
      console.log(`无法注入到标签页 ${tabId}:`, error.message);
    }
  }

  handleWordSearch(word, searchEngine, tab) {
    const encodedWord = encodeURIComponent(word);
    let searchUrl;

    switch (searchEngine) {
      case 'bing':
        searchUrl = `https://cn.bing.com/images/search?q=${encodedWord}&form=HDRSC2&first=1`;
        break;
      case 'google':
        searchUrl = `https://www.google.com/search?q=${encodedWord}&tbm=isch`;
        break;
      case 'duckduckgo':
        searchUrl = `https://duckduckgo.com/?q=${encodedWord}&iax=images&ia=images`;
        break;
      default:
        searchUrl = `https://cn.bing.com/images/search?q=${encodedWord}&form=HDRSC2&first=1`;
    }

    // 在新标签页打开搜索结果
    chrome.tabs.create({
      url: searchUrl,
      index: tab.index + 1
    });

    // 记录使用统计
    this.logUsage({
      action: 'word_search',
      word: word,
      searchEngine: searchEngine,
      timestamp: Date.now(),
      sourceUrl: tab.url
    });
  }

  async handleCommand(command) {
    switch (command) {
      case 'toggle-plugin':
        await this.togglePlugin();
        break;
      case 'open-settings':
        chrome.runtime.openOptionsPage();
        break;
    }
  }

  async togglePlugin() {
    try {
      const result = await chrome.storage.sync.get(['wordSearchSettings']);
      const settings = result.wordSearchSettings || { enabled: true };
      
      settings.enabled = !settings.enabled;
      await chrome.storage.sync.set({ wordSearchSettings: settings });
      
      // 通知所有标签页
      this.broadcastSettingsUpdate(settings);
      
      // 显示状态通知
      this.showToggleNotification(settings.enabled);
    } catch (error) {
      console.error('切换插件状态失败:', error);
    }
  }

  logUsage(data) {
    // 记录使用统计（可以用于改进插件）
    console.log('使用统计:', data);
    
    // 这里可以添加匿名统计逻辑
    // 注意：不要记录敏感信息，遵守隐私政策
  }

  showWelcomeNotification() {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '扇贝单词图片搜索',
      message: '插件安装成功！按住Command键点击英文单词即可搜索图片。'
    });
  }

  showUpdateNotification() {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '扇贝单词图片搜索',
      message: '插件已更新到最新版本，享受更好的使用体验！'
    });
  }

  showToggleNotification(enabled) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '扇贝单词图片搜索',
      message: enabled ? '插件已启用' : '插件已禁用'
    });
  }
}

// 初始化后台服务
new BackgroundService();

// 保持service worker活跃
setInterval(() => {
  console.log('Service worker保持活跃');
}, 20000);

// 错误处理
self.addEventListener('error', (event) => {
  console.error('Service worker错误:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
});