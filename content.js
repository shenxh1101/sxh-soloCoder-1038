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
    const text = currentSelection.text;
    const span = document.createElement('span');
    span.className = HIGHLIGHT_CLASS;
    span.style.backgroundColor = highlightColor;
    span.dataset.kvHighlight = 'true';
    span.dataset.kvText = text;
    
    try {
      range.surroundContents(span);
      
      const context = getSurroundingText(text);
      const position = getTextPosition(text);
      
      const highlight = {
        text: text,
        url: window.location.href,
        color: highlightColor,
        context: context,
        position: position
      };
      
      const saved = await sendMessage('saveHighlight', { highlight });
      if (saved && saved.highlight) {
        span.dataset.kvHighlightId = saved.highlight.id;
      }
      
      showToast('已高亮（已保存）');
      hideFloatingButton();
      window.getSelection().removeAllRanges();
    } catch (e) {
      try {
        await highlightTextSmart(text, highlightColor);
        showToast('已高亮（已保存）');
        hideFloatingButton();
        window.getSelection().removeAllRanges();
      } catch (e2) {
        showToast('无法高亮该文本', 'error');
      }
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

  function getSurroundingText(text, charCount = 80) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const fullText = container.textContent || document.body.innerText;
      const textContent = container.textContent || '';
      const selectedText = selection.toString();
      const index = textContent.indexOf(selectedText);
      
      if (index !== -1 && container.nodeType === Node.TEXT_NODE) {
        const start = Math.max(0, index - charCount);
        const end = Math.min(textContent.length, index + selectedText.length + charCount);
        return {
          before: textContent.substring(start, index),
          after: textContent.substring(index + selectedText.length, end),
          full: textContent.substring(start, end)
        };
      }
    }
    
    const fullText = document.body.innerText;
    const index = fullText.indexOf(text);
    if (index === -1) return null;
    const start = Math.max(0, index - charCount);
    const end = Math.min(fullText.length, index + text.length + charCount);
    return {
      before: fullText.substring(start, index),
      after: fullText.substring(index + text.length, end),
      full: fullText.substring(start, end)
    };
  }

  function getTextPosition(text, occurrence = 0) {
    let count = 0;
    const matches = findTextNodes(text);
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (count === occurrence) {
        const xpath = getXPath(match.node);
        return {
          xpath,
          occurrence: count,
          totalMatches: matches.length,
          position: match.position
        };
      }
      count++;
    }
    return { occurrence: 0, totalMatches: matches.length, position: 0 };
  }

  function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    let matches = 0;
    const minLen = Math.min(s1.length, s2.length);
    for (let i = 0; i < minLen; i++) {
      if (s1[i] === s2[i]) matches++;
    }
    
    return matches / Math.max(s1.length, s2.length);
  }

  function findBestMatch(highlight) {
    const matches = findTextNodes(highlight.text);
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    
    if (highlight.position && highlight.position.xpath) {
      try {
        const xpathResult = document.evaluate(
          highlight.position.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const node = xpathResult.singleNodeValue;
        if (node && node.textContent.includes(highlight.text)) {
          const pos = node.textContent.indexOf(highlight.text);
          if (pos !== -1) {
            return { node, position: pos };
          }
        }
      } catch (e) {
      }
    }
    
    if (highlight.context) {
      let bestMatch = null;
      let bestScore = 0;
      
      for (const match of matches) {
        const nodeText = match.node.textContent;
        const pos = match.position;
        
        const beforeContext = nodeText.substring(
          Math.max(0, pos - 80),
          pos
        );
        const afterContext = nodeText.substring(
          pos + highlight.text.length,
          Math.min(nodeText.length, pos + highlight.text.length + 80)
        );
        
        const beforeScore = highlight.context.before 
          ? calculateSimilarity(beforeContext, highlight.context.before)
          : 0;
        const afterScore = highlight.context.after
          ? calculateSimilarity(afterContext, highlight.context.after)
          : 0;
        
        const totalScore = (beforeScore + afterScore) / 2;
        
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMatch = match;
        }
      }
      
      if (bestScore > 0.3) {
        return bestMatch;
      }
    }
    
    if (highlight.position && highlight.position.occurrence !== undefined) {
      const targetOccurrence = highlight.position.occurrence;
      if (targetOccurrence < matches.length) {
        return matches[targetOccurrence];
      }
    }
    
    return null;
  }

  function findTextNodes(searchText, contextText = null) {
    const matches = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (node.parentElement.closest(`.${HIGHLIGHT_CLASS}`)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.textContent.includes(searchText)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;
      let pos = node.textContent.indexOf(searchText);
      while (pos !== -1) {
        matches.push({ node, position: pos });
        pos = node.textContent.indexOf(searchText, pos + 1);
      }
    }
    return matches;
  }

  function highlightTextSmart(text, color = highlightColor) {
    return new Promise(async (resolve, reject) => {
      try {
        const matches = findTextNodes(text);
        if (matches.length === 0) {
          reject(new Error('Text not found'));
          return;
        }
        
        let targetMatch = matches[0];
        let targetIndex = 0;
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedNode = range.commonAncestorContainer;
          const selectedText = selection.toString();
          
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            if (match.node === selectedNode || match.node.parentNode === selectedNode) {
              targetMatch = match;
              targetIndex = i;
              break;
            }
          }
        }

        const context = getSurroundingText(text);
        const position = getTextPosition(text, targetIndex);
        
        const highlight = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          text: text,
          url: window.location.href,
          color: color,
          context: context,
          position: position
        };

        await sendMessage('saveHighlight', { highlight });

        const { node, position: pos } = targetMatch;
        const range = document.createRange();
        range.setStart(node, pos);
        range.setEnd(node, pos + text.length);

        const span = document.createElement('span');
        span.className = HIGHLIGHT_CLASS;
        span.style.backgroundColor = color;
        span.dataset.kvHighlight = 'true';
        span.dataset.kvText = text;
        span.dataset.kvHighlightId = highlight.id;

        try {
          range.surroundContents(span);
        } catch (e) {
          const extracted = range.extractContents();
          span.appendChild(extracted);
          range.insertNode(span);
        }
        
        resolve(highlight);
      } catch (e) {
        reject(e);
      }
    });
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

  async function applySavedHighlights() {
    try {
      const response = await sendMessage('getHighlightsByUrl', { 
        url: window.location.href 
      });
      
      if (!response.success || !response.highlights || response.highlights.length === 0) {
        return;
      }

      const highlights = response.highlights;
      let restoredCount = 0;

      for (const highlight of highlights) {
        try {
          const bestMatch = findBestMatch(highlight);
          
          if (bestMatch) {
            const { node, position: pos } = bestMatch;
            const range = document.createRange();
            range.setStart(node, pos);
            range.setEnd(node, pos + highlight.text.length);

            const span = document.createElement('span');
            span.className = HIGHLIGHT_CLASS;
            span.style.backgroundColor = highlight.color || highlightColor;
            span.dataset.kvHighlight = 'true';
            span.dataset.kvText = highlight.text;
            span.dataset.kvHighlightId = highlight.id;

            try {
              range.surroundContents(span);
            } catch (e) {
              const extracted = range.extractContents();
              span.appendChild(extracted);
              range.insertNode(span);
            }
            
            restoredCount++;
          } else {
            console.warn(`Could not find exact match for highlight: "${highlight.text.substring(0, 30)}..."`);
          }
        } catch (e) {
          console.warn('Failed to restore highlight:', highlight.text, e);
        }
      }

      if (restoredCount > 0) {
        console.log(`Knowledge Vault: 已恢复 ${restoredCount}/${highlights.length} 个高亮`);
      }
    } catch (e) {
      console.error('Apply saved highlights error:', e);
    }
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
