// 扇贝单词图片搜索 - 内容脚本

class WordImageSearch {
  constructor() {
    this.settings = {
      modifierKey: 'metaKey', // 默认Command键 (Mac) / Ctrl键 (Windows)
      searchEngine: 'bing',
      enabled: true,
      inlinePreview: false
    };
    this.hoveredElement = null;
    this.currentHighlight = null;
    this.previewContainer = null;
    this.isActive = false; // 跟踪插件是否处于活跃状态
    this.isModifierPressed = false; // 跟踪快捷键是否被按下
    this.eventHandlers = {}; // 存储事件处理器引用
    this.init();
  }

  async init() {
    // 加载用户设置
    await this.loadSettings();

    // 检查当前网站是否启用插件
    const isEnabledForSite = await this.checkSiteEnabled();

    if (this.settings.enabled && isEnabledForSite) {
      this.bindEvents();
      this.injectStyles();
      this.isActive = true;
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['wordSearchSettings']);
      if (result.wordSearchSettings) {
        this.settings = { ...this.settings, ...result.wordSearchSettings };
      }
    } catch (error) {
      console.log('使用默认设置');
    }
  }

  async checkSiteEnabled() {
    try {
      const currentDomain = this.getCurrentDomain();
      const result = await chrome.storage.sync.get(['wordSearchSiteSettings']);
      const siteSettings = result.wordSearchSiteSettings || {
        enableMode: 'disabled',
        currentSite: '',
        mainDomain: ''
      };

      switch (siteSettings.enableMode) {
        case 'disabled':
          return false;
        case 'current':
          return currentDomain === siteSettings.currentSite;
        case 'domain':
          // 检查是否是主域名或其子域名
          return currentDomain === siteSettings.mainDomain ||
                 currentDomain.endsWith('.' + siteSettings.mainDomain);
        default:
          return false;
      }
    } catch (error) {
      console.log('检查网站启用状态失败，默认禁用');
      return false;
    }
  }

  getCurrentDomain() {
    try {
      return new URL(window.location.href).hostname;
    } catch (error) {
      return window.location.hostname || 'unknown';
    }
  }

  bindEvents() {
    // 存储绑定的事件处理器引用，以便后续移除
    this.eventHandlers.mouseOver = this.handleMouseOver.bind(this);
    this.eventHandlers.mouseOut = this.handleMouseOut.bind(this);
    this.eventHandlers.click = this.handleClick.bind(this);
    this.eventHandlers.keyDown = this.handleKeyDown.bind(this);
    this.eventHandlers.keyUp = this.handleKeyUp.bind(this);

    // 鼠标悬停事件
    document.addEventListener('mouseover', this.eventHandlers.mouseOver);
    document.addEventListener('mouseout', this.eventHandlers.mouseOut);

    // 点击事件
    document.addEventListener('click', this.eventHandlers.click, true);

    // 键盘事件
    document.addEventListener('keydown', this.eventHandlers.keyDown);
    document.addEventListener('keyup', this.eventHandlers.keyUp);
  }

  removeEvents() {
    // 移除所有事件监听器
    if (this.eventHandlers.mouseOver) {
      document.removeEventListener('mouseover', this.eventHandlers.mouseOver);
    }
    if (this.eventHandlers.mouseOut) {
      document.removeEventListener('mouseout', this.eventHandlers.mouseOut);
    }
    if (this.eventHandlers.click) {
      document.removeEventListener('click', this.eventHandlers.click, true);
    }
    if (this.eventHandlers.keyDown) {
      document.removeEventListener('keydown', this.eventHandlers.keyDown);
    }
    if (this.eventHandlers.keyUp) {
      document.removeEventListener('keyup', this.eventHandlers.keyUp);
    }

    // 清理当前状态
    this.removeHoverEffect();
    this.closeInlinePreview();
    document.body.classList.remove('word-search-active');

    // 清空事件处理器引用
    this.eventHandlers = {};
  }

  handleMouseOver(event) {
    // 只有在按住快捷键时才进行单词识别
    if (!this.isModifierPressed) {
      return;
    }

    // 如果鼠标移动到我们创建的高亮元素上，忽略这个事件
    if (event.target.hasAttribute('data-word-highlight')) {
      return;
    }

    const wordInfo = this.getWordAtPosition(event.target, event);
    if (wordInfo && this.isEnglishWord(wordInfo.word)) {
      // 如果当前已经有高亮的单词，先移除
      if (this.currentHighlight) {
        this.removeHoverEffect();
      }
      this.hoveredElement = event.target;
      this.showHoverEffect(event.target, wordInfo, event);
    } else {
      // 如果鼠标移动到非单词区域，移除高亮
      this.removeHoverEffect();
      this.hoveredElement = null;
    }
  }

  handleMouseOut(event) {
    // 只有在按住快捷键时才处理鼠标移出事件
    if (!this.isModifierPressed) {
      return;
    }

    // 如果鼠标移出到我们创建的高亮元素，忽略这个事件
    if (event.relatedTarget && event.relatedTarget.hasAttribute('data-word-highlight')) {
      return;
    }

    // 检查鼠标是否移动到另一个可能包含单词的元素
    if (event.relatedTarget) {
      const wordInfo = this.getWordAtPosition(event.relatedTarget, event);
      if (wordInfo && this.isEnglishWord(wordInfo.word)) {
        // 如果移动到另一个单词，不要移除高亮，让mouseover处理
        return;
      }
    }

    this.removeHoverEffect();
    this.hoveredElement = null;
  }

  handleKeyDown(event) {
    if (this.isModifierKeyPressed(event)) {
      this.isModifierPressed = true;
      document.body.classList.add('word-search-active');
    }
  }

  handleKeyUp(event) {
    // 检查所有修饰键是否都已释放
    if (!this.isModifierKeyPressed(event)) {
      this.isModifierPressed = false;
      document.body.classList.remove('word-search-active');
      // 移除当前的悬停效果
      this.removeHoverEffect();
      this.hoveredElement = null;
    }
  }

  handleClick(event) {
    if (!this.isModifierKeyPressed(event)) return;
    
    const wordInfo = this.getWordAtPosition(event.target, event);
    if (wordInfo && this.isEnglishWord(wordInfo.word)) {
      event.preventDefault();
      event.stopPropagation();
      
      this.showClickEffect(event.target, wordInfo);
      this.searchWordImage(wordInfo.word);
    }
  }

  isModifierKeyPressed(event) {
    switch (this.settings.modifierKey) {
      case 'metaKey': return event.metaKey;
      case 'ctrlKey': return event.ctrlKey;
      case 'altKey': return event.altKey;
      case 'shiftKey': return event.shiftKey;
      default: return event.metaKey;
    }
  }

  getWordAtPosition(element, event) {
    // 使用更现代的API获取点击位置的单词
    let range;

    // 优先使用 caretPositionFromPoint (标准API)
    if (document.caretPositionFromPoint) {
      const caretPosition = document.caretPositionFromPoint(event.clientX, event.clientY);
      if (!caretPosition) return null;

      range = document.createRange();
      range.setStart(caretPosition.offsetNode, caretPosition.offset);
      range.setEnd(caretPosition.offsetNode, caretPosition.offset);
    } else if (document.caretRangeFromPoint) {
      // 回退到 caretRangeFromPoint (WebKit)
      range = document.caretRangeFromPoint(event.clientX, event.clientY);
      if (!range) return null;
    } else {
      return null;
    }

    // 扩展选择到完整单词
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return null;

    const text = textNode.textContent;
    const offset = range.startOffset;

    // 改进的单词字符集，包含连字符、撇号等
    const wordCharRegex = /[a-zA-Z\u00C0-\u017F\u0100-\u024F'-]/;

    // 找到单词边界
    let start = offset;
    let end = offset;

    // 向前找单词开始
    while (start > 0 && wordCharRegex.test(text[start - 1])) {
      start--;
    }

    // 向后找单词结束
    while (end < text.length && wordCharRegex.test(text[end])) {
      end++;
    }

    const word = text.substring(start, end).trim();

    // 验证单词的有效性
    if (this.isValidWord(word)) {
      return {
        word: word,
        textNode: textNode,
        start: start,
        end: end
      };
    }
    return null;
  }

  isEnglishWord(word) {
    return this.isValidWord(word);
  }

  isValidWord(word) {
    if (!word || typeof word !== 'string') return false;

    // 移除首尾的标点符号
    const cleanWord = word.replace(/^[^\w\u00C0-\u017F\u0100-\u024F]+|[^\w\u00C0-\u017F\u0100-\u024F]+$/g, '');

    // 基本长度检查
    if (cleanWord.length < 2) return false;

    // 检查是否包含字母
    if (!/[a-zA-Z\u00C0-\u017F\u0100-\u024F]/.test(cleanWord)) return false;

    // 过滤掉纯数字或主要是数字的字符串
    if (/^\d+$/.test(cleanWord) || /^\d+[a-zA-Z]{1,2}$/.test(cleanWord)) return false;

    // 过滤掉常见的无意义字符组合
    const invalidPatterns = [
      /^[^a-zA-Z]*$/, // 不包含字母
      /^[a-zA-Z]{1}$/, // 单个字母
      /^(aa+|bb+|cc+|dd+|ee+|ff+|gg+|hh+|ii+|jj+|kk+|ll+|mm+|nn+|oo+|pp+|qq+|rr+|ss+|tt+|uu+|vv+|ww+|xx+|yy+|zz+)$/i, // 重复字母
      /^(la|le|li|lo|lu|da|de|di|do|du|na|ne|ni|no|nu|ta|te|ti|to|tu|ra|re|ri|ro|ru|sa|se|si|so|su|ma|me|mi|mo|mu|ba|be|bi|bo|bu|ca|ce|ci|co|cu|fa|fe|fi|fo|fu|ga|ge|gi|go|gu|ha|he|hi|ho|hu|ja|je|ji|jo|ju|ka|ke|ki|ko|ku|pa|pe|pi|po|pu|qa|qe|qi|qo|qu|va|ve|vi|vo|vu|wa|we|wi|wo|wu|xa|xe|xi|xo|xu|ya|ye|yi|yo|yu|za|ze|zi|zo|zu)$/i, // 常见的无意义音节
      /^(www|http|https|ftp|mailto|tel)$/i, // 协议名称
      /^(jpg|jpeg|png|gif|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz)$/i, // 文件扩展名
      /^(div|span|img|src|alt|href|class|style|script|link|meta|head|body|html|css|js)$/i, // HTML/CSS关键词
      /^[0-9a-f]{8,}$/i, // 可能的哈希值或ID
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(cleanWord)) return false;
    }

    // 检查是否是合理的英文单词模式
    const validWordPattern = /^[a-zA-Z\u00C0-\u017F\u0100-\u024F]([a-zA-Z\u00C0-\u017F\u0100-\u024F'-]*[a-zA-Z\u00C0-\u017F\u0100-\u024F])?$/;
    if (!validWordPattern.test(cleanWord)) return false;

    // 检查连字符和撇号的使用是否合理
    if (cleanWord.includes('-')) {
      // 连字符不能在开头或结尾，也不能连续出现
      if (/^-|-$|--/.test(cleanWord)) return false;
    }

    if (cleanWord.includes("'")) {
      // 撇号的使用应该符合英文规则
      if (/^'|'$|''/test(cleanWord)) return false;
      // 常见的撇号用法：don't, can't, it's, I'm, we're, they're, etc.
      if (!/[a-zA-Z]'[a-zA-Z]/.test(cleanWord)) return false;
    }

    return true;
  }

  showHoverEffect(element, wordInfo, event) {
    // 移除之前的高亮
    this.removeHoverEffect();
    
    // 创建Range来精确选择单词
    const range = document.createRange();
    range.setStart(wordInfo.textNode, wordInfo.start);
    range.setEnd(wordInfo.textNode, wordInfo.end);
    
    // 创建高亮元素
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'word-search-hover';
    highlightSpan.setAttribute('data-word-highlight', 'true');
    
    try {
      // 检查range是否有效且不会跨越多个元素
      if (range.collapsed || range.commonAncestorContainer !== wordInfo.textNode) {
        throw new Error('Invalid range');
      }
      
      // 用高亮元素包围选中的文本
      range.surroundContents(highlightSpan);
      this.currentHighlight = highlightSpan;
      
      // 显示提示
      this.showTooltip(highlightSpan, wordInfo.word);
    } catch (error) {
      // 如果无法包围内容，创建一个临时的高亮效果
      // 但不对整个元素应用样式，而是创建一个绝对定位的覆盖层
      this.createOverlayHighlight(element, wordInfo, event);
    }
  }

  removeHoverEffect() {
    if (this.currentHighlight) {
      if (this.currentHighlight.hasAttribute('data-word-highlight')) {
        if (this.currentHighlight.className === 'word-search-overlay') {
          // 移除覆盖层
          this.currentHighlight.remove();
        } else {
          // 移除高亮包装，恢复原始文本
          const parent = this.currentHighlight.parentNode;
          const textContent = this.currentHighlight.textContent;
          parent.replaceChild(document.createTextNode(textContent), this.currentHighlight);
          // 合并相邻的文本节点
          parent.normalize();
        }
      } else {
        // 移除类名
        this.currentHighlight.classList.remove('word-search-hover');
      }
      this.currentHighlight = null;
    }
    this.hideTooltip();
  }

  showClickEffect(element, wordInfo) {
    if (this.currentHighlight && this.currentHighlight.hasAttribute('data-word-highlight')) {
      // 如果当前有精确高亮的单词，对其应用点击效果
      this.currentHighlight.classList.add('word-search-clicked');
      setTimeout(() => {
        if (this.currentHighlight) {
          this.currentHighlight.classList.remove('word-search-clicked');
        }
      }, 300);
    } else {
      // 回退到元素级别的点击效果
      element.classList.add('word-search-clicked');
      setTimeout(() => {
        element.classList.remove('word-search-clicked');
      }, 300);
    }
  }

  createOverlayHighlight(element, wordInfo, event) {
    // 创建一个绝对定位的覆盖层来高亮单词
    const overlay = document.createElement('div');
    overlay.className = 'word-search-overlay';
    overlay.setAttribute('data-word-highlight', 'true');
    
    // 计算单词在页面中的精确位置
    const range = document.createRange();
    range.setStart(wordInfo.textNode, wordInfo.start);
    range.setEnd(wordInfo.textNode, wordInfo.end);
    
    const rect = range.getBoundingClientRect();
    
    // 设置覆盖层样式和位置
    overlay.style.cssText = `
      position: fixed !important;
      left: ${rect.left}px !important;
      top: ${rect.top}px !important;
      width: ${rect.width}px !important;
      height: ${rect.height}px !important;
      background: linear-gradient(135deg, rgba(74, 144, 226, 0.12), rgba(80, 200, 120, 0.12)) !important;
      border-radius: 4px !important;
      box-shadow: 0 2px 12px rgba(74, 144, 226, 0.25), 0 1px 4px rgba(74, 144, 226, 0.15), 0 0 0 1px rgba(74, 144, 226, 0.2) !important;
      pointer-events: none !important;
      z-index: 10000 !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    `;
    
    document.body.appendChild(overlay);
    this.currentHighlight = overlay;
    
    // 显示提示，使用原始元素的位置
    this.showTooltip(element, wordInfo.word);
  }

  showTooltip(element, word) {
    this.hideTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'word-search-tooltip';

    tooltip.innerHTML = `
      <div class="tooltip-content">
        <span class="tooltip-icon">🔍</span>
        <span class="tooltip-text">点击搜索 "${word}" 的图片</span>
      </div>
    `;
    
    document.body.appendChild(tooltip);
    
    // 智能定位提示框，优先向下显示
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 10; // 减小边距
    
    // 验证rect是否有效，防止出现在左上角的bug
    if (rect.width === 0 && rect.height === 0) {
      // 如果元素不可见，隐藏tooltip并返回
      this.hideTooltip();
      return;
    }
    
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + margin; // 优先显示在下方
    
    // 确保计算出的位置不会是负数或异常值
    if (isNaN(left) || left < 0) {
      left = window.scrollX + margin;
    }
    if (isNaN(top) || top < 0) {
      top = window.scrollY + margin;
    }
    
    // 如果下方空间不足，显示在上方
    if (top + tooltipRect.height > window.scrollY + window.innerHeight - margin) {
      top = rect.top + window.scrollY - tooltipRect.height - margin;
    }
    
    // 水平位置调整 - 居中对齐单词
    left = rect.left + window.scrollX + (rect.width - tooltipRect.width) / 2;
    
    // 确保提示框完全在视窗内
    if (left < window.scrollX + margin) {
      left = window.scrollX + margin;
    } else if (left + tooltipRect.width > window.scrollX + window.innerWidth - margin) {
      left = window.scrollX + window.innerWidth - tooltipRect.width - margin;
    }
    
    // 如果上下都没有足够空间，显示在右侧
    if (top + tooltipRect.height > window.scrollY + window.innerHeight - margin && 
        rect.top + window.scrollY - tooltipRect.height - margin < window.scrollY + margin) {
      left = rect.right + window.scrollX + margin;
      top = rect.top + window.scrollY + (rect.height - tooltipRect.height) / 2;
      
      // 如果右侧空间不足，显示在左侧
      if (left + tooltipRect.width > window.scrollX + window.innerWidth - margin) {
        left = rect.left + window.scrollX - tooltipRect.width - margin;
      }
    }
    
    // 最终验证位置，确保不会出现在左上角
    if (isNaN(left) || left < 0) {
      left = window.scrollX + margin;
    }
    if (isNaN(top) || top < 0) {
      top = window.scrollY + margin;
    }
    
    // 确保位置在合理范围内
    left = Math.max(left, window.scrollX + margin);
    top = Math.max(top, window.scrollY + margin);
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  hideTooltip() {
    const existing = document.querySelector('.word-search-tooltip');
    if (existing) {
      existing.remove();
    }
  }

  searchWordImage(word) {
    const encodedWord = encodeURIComponent(word);
    let searchUrl;
    
    switch (this.settings.searchEngine) {
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
    
    if (this.settings.inlinePreview) {
      // 在当前页面显示预览
      this.showInlinePreview(searchUrl, word);
    } else {
      // 在新标签页打开
      window.open(searchUrl, '_blank');
    }
  }

  showInlinePreview(searchUrl, word) {
    // 如果已经有预览窗口，先关闭
    this.closeInlinePreview();
    
    // 创建预览容器
    this.previewContainer = document.createElement('div');
    this.previewContainer.className = 'word-search-preview-container';
    this.previewContainer.innerHTML = `
      <div class="word-search-preview-overlay"></div>
      <div class="word-search-preview-content">
        <div class="word-search-preview-header">
          <div class="word-search-preview-title">
            <span class="word-search-preview-icon">🔍</span>
            <span class="word-search-preview-text">搜索结果: "${word}"</span>
          </div>
          <div class="word-search-preview-controls">
            <button class="word-search-preview-btn word-search-preview-new-tab" title="在新标签页打开">
              <span>↗</span>
            </button>
            <button class="word-search-preview-btn word-search-preview-close" title="关闭预览">
              <span>✕</span>
            </button>
          </div>
        </div>
        <div class="word-search-preview-body">
          <iframe class="word-search-preview-iframe" src="${searchUrl}" frameborder="0"></iframe>
        </div>
      </div>
    `;
    
    // 添加到页面
    document.body.appendChild(this.previewContainer);
    
    // 绑定事件
    this.bindPreviewEvents(searchUrl);
    
    // 添加动画效果
    setTimeout(() => {
      this.previewContainer.classList.add('word-search-preview-show');
    }, 10);
  }
  
  bindPreviewEvents(searchUrl) {
    if (!this.previewContainer) return;
    
    // 关闭按钮
    const closeBtn = this.previewContainer.querySelector('.word-search-preview-close');
    closeBtn.addEventListener('click', () => {
      this.closeInlinePreview();
    });
    
    // 新标签页按钮
    const newTabBtn = this.previewContainer.querySelector('.word-search-preview-new-tab');
    newTabBtn.addEventListener('click', () => {
      window.open(searchUrl, '_blank');
      this.closeInlinePreview();
    });
    
    // 点击遮罩层关闭
    const overlay = this.previewContainer.querySelector('.word-search-preview-overlay');
    overlay.addEventListener('click', () => {
      this.closeInlinePreview();
    });
    
    // ESC键关闭
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.closeInlinePreview();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }
  
  closeInlinePreview() {
    if (this.previewContainer) {
      this.previewContainer.classList.add('word-search-preview-hide');
      setTimeout(() => {
        if (this.previewContainer && this.previewContainer.parentNode) {
          this.previewContainer.parentNode.removeChild(this.previewContainer);
        }
        this.previewContainer = null;
      }, 300);
    }
  }

  getModifierKeyDisplayName() {
    // 使用更现代的方式检测操作系统
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

    switch (this.settings.modifierKey) {
      case 'metaKey':
        return isMac ? 'Cmd' : 'Win';
      case 'ctrlKey':
        return 'Ctrl';
      case 'altKey':
        return isMac ? 'Option' : 'Alt';
      case 'shiftKey':
        return 'Shift';
      default:
        return isMac ? 'Cmd' : 'Win';
    }
  }

  injectStyles() {
    if (document.querySelector('#word-search-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'word-search-styles';
    style.textContent = `
      .word-search-active {
        cursor: crosshair !important;
      }
      
      .word-search-active * {
        cursor: crosshair !important;
      }
      
      .word-search-hover {
        background: linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(80, 200, 120, 0.2)) !important;
        border-radius: 3px !important;
        box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3) !important;
        transition: all 0.2s ease !important;
      }
      
      .word-search-clicked {
        background: linear-gradient(135deg, rgba(74, 144, 226, 0.4), rgba(80, 200, 120, 0.4)) !important;
        transform: scale(1.05) !important;
        animation: wordSearchPulse 0.3s ease !important;
      }
      
      @keyframes wordSearchPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1.05); }
      }
      
      .word-search-tooltip {
        position: absolute;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        padding: 8px 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        color: white;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        animation: tooltipFadeIn 0.2s ease;
        pointer-events: none;
      }
      
      .tooltip-content {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .tooltip-icon {
        font-size: 14px;
      }
      
      @keyframes tooltipFadeIn {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @media (prefers-color-scheme: dark) {
        .word-search-tooltip {
          background: rgba(255, 255, 255, 0.9);
          color: black;
        }
      }
      
      /* 预览窗口样式 */
      .word-search-preview-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 2147483647 !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      
      .word-search-preview-container.word-search-preview-show {
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      .word-search-preview-container.word-search-preview-hide {
        opacity: 0 !important;
        visibility: hidden !important;
      }
      
      .word-search-preview-overlay {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.5) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
      }
      
      .word-search-preview-content {
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 90vw !important;
        height: 85vh !important;
        max-width: 1200px !important;
        max-height: 800px !important;
        background: white !important;
        border-radius: 12px !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }
      
      .word-search-preview-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 16px 20px !important;
        background: #f8f9fa !important;
        border-bottom: 1px solid #e9ecef !important;
        flex-shrink: 0 !important;
      }
      
      .word-search-preview-title {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #333 !important;
      }
      
      .word-search-preview-icon {
        font-size: 18px !important;
      }
      
      .word-search-preview-controls {
        display: flex !important;
        gap: 8px !important;
      }
      
      .word-search-preview-btn {
        width: 32px !important;
        height: 32px !important;
        border: none !important;
        border-radius: 6px !important;
        background: #fff !important;
        color: #666 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 14px !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
      }
      
      .word-search-preview-btn:hover {
        background: #f0f0f0 !important;
        color: #333 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
      }
      
      .word-search-preview-close:hover {
        background: #ff4757 !important;
        color: white !important;
      }
      
      .word-search-preview-new-tab:hover {
        background: #4a90e2 !important;
        color: white !important;
      }
      
      .word-search-preview-body {
        flex: 1 !important;
        overflow: hidden !important;
      }
      
      .word-search-preview-iframe {
        width: 100% !important;
        height: 100% !important;
        border: none !important;
        background: white !important;
      }
      
      @media (max-width: 768px) {
        .word-search-preview-content {
          width: 95vw !important;
          height: 90vh !important;
        }
        
        .word-search-preview-header {
          padding: 12px 16px !important;
        }
        
        .word-search-preview-title {
          font-size: 14px !important;
        }
        
        .word-search-preview-btn {
          width: 28px !important;
          height: 28px !important;
          font-size: 12px !important;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
}

// 监听来自popup的设置更新消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'SETTINGS_UPDATED') {
    // 更新设置
    if (window.wordImageSearchInstance) {
      window.wordImageSearchInstance.settings = { ...window.wordImageSearchInstance.settings, ...message.settings };
    }
  } else if (message.type === 'SITE_SETTINGS_UPDATED') {
    // 网站设置更新，重新检查当前网站状态
    if (window.wordImageSearchInstance) {
      const isEnabledForSite = await window.wordImageSearchInstance.checkSiteEnabled();
      if (window.wordImageSearchInstance.settings.enabled && isEnabledForSite) {
        // 如果插件应该启用但当前未启用，重新初始化
        if (!window.wordImageSearchInstance.isActive) {
          window.wordImageSearchInstance.bindEvents();
          window.wordImageSearchInstance.injectStyles();
          window.wordImageSearchInstance.isActive = true;
        }
      } else {
        // 如果插件应该禁用，移除事件监听器
        if (window.wordImageSearchInstance.isActive) {
          window.wordImageSearchInstance.removeEvents();
          window.wordImageSearchInstance.isActive = false;
        }
      }
    }
  } else if (message.type === 'GET_CURRENT_DOMAIN') {
    // 返回当前域名
    if (window.wordImageSearchInstance) {
      sendResponse({ domain: window.wordImageSearchInstance.getCurrentDomain() });
    }
  }
});

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.wordImageSearchInstance = new WordImageSearch();
  });
} else {
  window.wordImageSearchInstance = new WordImageSearch();
}