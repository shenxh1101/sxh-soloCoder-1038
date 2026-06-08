(function() {
  if (window.knowledgeVaultInjected) return;
  window.knowledgeVaultInjected = true;

  const HIGHLIGHT_CLASS = 'kv-highlight';
  let currentSelection = null;
  let floatingButton = null;
  let highlightColor = '#fff59d';

  init();

  function init() {
    loadSettings();
    createFloatingButton();
    setupSelectionHandler();
    setupMessageListener();
    applySavedHighlights();
  }

  async function loadSettings() {
    const response = await sendMessage('getSettings');
    if (response.success) {
      highlightColor = response.settings.highlightColor || '#fff59d';
    }
  }

  function createFloatingButton() {
    floatingButton = document.createElement('div');
    floatingButton.id = 'kv-floating-btn';
    floatingButton.className = 'kv-floating-btn';
    floatingButton.innerHTML = `
      <button class="kv-btn kv-btn-primary" id="kv-quick-save" title="剪藏选中内容">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        剪藏
      </button>
      <button class="kv-btn kv-btn-secondary" id="kv-highlight" title="高亮选中内容">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        高亮
      </button>
      <button class="kv-btn kv-btn-secondary" id="kv-add-tag" title="添加标签">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
        标签
      </button>
    `;
    floatingButton.style.display = 'none';
    document.body.appendChild(floatingButton);

    floatingButton.querySelector('#kv-quick-save').addEventListener('click', handleQuickSave);
    floatingButton.querySelector('#kv-highlight').addEventListener('click', handleHighlight);
    floatingButton.querySelector('#kv-add-tag').addEventListener('click', handleAddTag);
  }

  function setupSelectionHandler() {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        handleSelection(e);
      }
    });
  }

  function handleSelection(e) {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length > 0 && !isFloatingButtonTarget(e.target)) {
      currentSelection = {
        text,
        range: selection.getRangeAt(0).cloneRange(),
        selection: selection
      };
      showFloatingButton(e.clientX, e.clientY);
    } else if (!isFloatingButtonTarget(e.target)) {
      hideFloatingButton();
    }
  }

  function isFloatingButtonTarget(target) {
    return floatingButton && floatingButton.contains(target);
  }

  function showFloatingButton(x, y) {
    if (!floatingButton) return;
    
    const rect = floatingButton.getBoundingClientRect();
    let left = x - rect.width / 2;
    let top = y - 50;
    
    left = Math.max(10, Math.min(left, window.innerWidth - rect.width - 10));
    top = Math.max(10, top);
    
    floatingButton.style.left = left + 'px';
    floatingButton.style.top = top + 'px';
    floatingButton.style.display = 'flex';
  }

  function hideFloatingButton() {
    if (floatingButton) {
      floatingButton.style.display = 'none';
    }
    currentSelection = null;
  }

  async function handleQuickSave() {
    if (!currentSelection) return;
    
    const clip = {
      title: document.title,
      url: window.location.href,
      content: currentSelection.text,
      favicon: getFavicon(),
      author: getAuthor(),
      publishedDate: getPublishedDate()
    };
    
    const response = await sendMessage('saveClip', { clip });
    if (response.success) {
      showToast('剪藏成功！');
      hideFloatingButton();
      window.getSelection().removeAllRanges();
    }
  }

  async function handleHighlight() {
    if (!currentSelection) return;
    
    const range = currentSelection.range;
    const span = document.createElement('span');
    span.className = HIGHLIGHT_CLASS;
    span.style.backgroundColor = highlightColor;
    span.dataset.kvHighlight = 'true';
    span.dataset.kvText = currentSelection.text;
    
    try {
      range.surroundContents(span);
      
      const highlight = {
        text: currentSelection.text,
        url: window.location.href,
        color: highlightColor,
        xpath: getXPath(span)
      };
      
      showToast('已高亮');
      hideFloatingButton();
      window.getSelection().removeAllRanges();
    } catch (e) {
      showToast('无法高亮跨元素文本', 'error');
    }
  }

  async function handleAddTag() {
    if (!currentSelection) return;
    
    const tagName = prompt('请输入标签名称：');
    if (!tagName) return;
    
    const clip = {
      title: document.title,
      url: window.location.href,
      content: currentSelection.text,
      favicon: getFavicon(),
      tags: [tagName]
    };
    
    const response = await sendMessage('saveClip', { clip });
    if (response.success) {
      showToast(`已添加标签: ${tagName}`);
      hideFloatingButton();
      window.getSelection().removeAllRanges();
    }
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'getPageInfo':
          sendResponse(getPageInfo());
          break;
        case 'getSelectedText':
          const selection = window.getSelection();
          sendResponse({ text: selection.toString().trim() });
          break;
        case 'highlightText':
          highlightText(request.text, request.color);
          sendResponse({ success: true });
          break;
        case 'removeHighlights':
          removeAllHighlights();
          sendResponse({ success: true });
          break;
      }
      return true;
    });
  }

  function getPageInfo() {
    return {
      title: document.title,
      url: window.location.href,
      content: document.body.innerText.substring(0, 5000),
      meta: getMetaTags(),
      author: getAuthor(),
      publishedDate: getPublishedDate(),
      favicon: getFavicon()
    };
  }

  function getMetaTags() {
    const meta = {};
    document.querySelectorAll('meta').forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });
    return meta;
  }

  function getAuthor() {
    const metaAuthor = document.querySelector('meta[name="author"]') || 
                      document.querySelector('meta[property="article:author"]');
    return metaAuthor ? metaAuthor.getAttribute('content') : null;
  }

  function getPublishedDate() {
    const metaDate = document.querySelector('meta[name="pubdate"]') ||
                     document.querySelector('meta[property="article:published_time"]') ||
                     document.querySelector('meta[name="date"]');
    return metaDate ? metaDate.getAttribute('content') : null;
  }

  function getFavicon() {
    const link = document.querySelector("link[rel~='icon']") ||
                 document.querySelector("link[rel~='shortcut icon']");
    return link ? link.href : null;
  }

  function getXPath(element) {
    if (element.id !== '') return `id("${element.id}")`;
    if (element === document.body) return element.tagName.toLowerCase();
    
    let ix = 0;
    const siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        return `${getXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
  }

  function highlightText(text, color = highlightColor) {
    const bodyText = document.body.innerHTML;
    const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    document.body.innerHTML = bodyText.replace(regex, 
      `<span class="${HIGHLIGHT_CLASS}" style="background-color: ${color}">$&</span>`);
  }

  function removeAllHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  function applySavedHighlights() {
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `kv-toast kv-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('kv-toast-show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('kv-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function sendMessage(action, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, ...data }, resolve);
    });
  }
})();
