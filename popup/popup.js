document.addEventListener('DOMContentLoaded', init);

function init() {
  loadStats();
  loadRecentClips();
  setupEventListeners();
}

async function loadStats() {
  try {
    const [clipsResponse, tagsResponse, readLaterResponse] = await Promise.all([
      sendMessage('getClips'),
      sendMessage('getTags'),
      sendMessage('getReadLater')
    ]);

    if (clipsResponse.success) {
      document.getElementById('total-clips').textContent = clipsResponse.clips.length;
    }

    if (tagsResponse.success) {
      document.getElementById('total-tags').textContent = tagsResponse.tags.length;
    }

    if (readLaterResponse.success) {
      document.getElementById('read-later-count').textContent = readLaterResponse.clips.length;
    }
  } catch (e) {
    console.error('Load stats error:', e);
  }
}

async function loadRecentClips() {
  try {
    const response = await sendMessage('getClips');
    if (response.success) {
      const recentClips = response.clips.slice(0, 5);
      const container = document.getElementById('recent-list');

      if (recentClips.length === 0) {
        container.innerHTML = '<div class="empty-recent">暂无剪藏内容</div>';
        return;
      }

      container.innerHTML = recentClips.map(clip => `
        <div class="recent-item" data-id="${clip.id}" data-url="${clip.url}">
          ${clip.favicon ? `<img src="${clip.favicon}" alt="" onerror="this.style.display='none'">` : ''}
          <div class="recent-item-content">
            <div class="recent-item-title">${escapeHtml(clip.title || '无标题')}</div>
            <div class="recent-item-time">${formatTimeAgo(clip.createdAt)}</div>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.dataset.url;
          if (url) {
            chrome.tabs.create({ url });
            window.close();
          }
        });
      });
    }
  } catch (e) {
    console.error('Load recent clips error:', e);
  }
}

function setupEventListeners() {
  document.getElementById('btn-save-clip').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' }, async (response) => {
          const selectedText = response?.text || '';
          
          const clip = {
            title: tab.title,
            url: tab.url,
            content: selectedText,
            favicon: tab.favIconUrl
          };

          const saveResponse = await sendMessage('saveClip', { clip });
          if (saveResponse.success) {
            showNotification('剪藏成功', `"${clip.title}" 已保存`);
            loadStats();
            loadRecentClips();
          }
        });
      }
    } catch (e) {
      console.error('Quick save error:', e);
    }
  });

  document.getElementById('btn-read-later').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const clipsResponse = await sendMessage('searchClips', { 
          filters: { source: new URL(tab.url).hostname } 
        });
        
        let clip = clipsResponse.clips?.find(c => c.url === tab.url);
        
        if (!clip) {
          const saveResponse = await sendMessage('saveClip', {
            clip: {
              title: tab.title,
              url: tab.url,
              content: '',
              favicon: tab.favIconUrl
            }
          });
          clip = saveResponse.clip;
        }

        await sendMessage('markAsReadLater', {
          clipId: clip.id,
          isReadLater: true
        });

        showNotification('已添加到稍后阅读', `"${tab.title}"`);
        loadStats();
        loadRecentClips();
      }
    } catch (e) {
      console.error('Read later error:', e);
    }
  });

  document.getElementById('btn-capture').addEventListener('click', async () => {
    try {
      const screenshotResponse = await sendMessage('captureScreenshot');
      if (screenshotResponse.success) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const clip = {
          title: tab.title,
          url: tab.url,
          content: '',
          screenshot: screenshotResponse.dataUrl,
          favicon: tab.favIconUrl
        };

        const saveResponse = await sendMessage('saveClip', { clip });
        if (saveResponse.success) {
          showNotification('截图已保存', `"${tab.title}"`);
          loadStats();
          loadRecentClips();
        }
      }
    } catch (e) {
      console.error('Capture error:', e);
    }
  });

  document.getElementById('btn-view-all').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('search/search.html') });
    window.close();
  });

  document.getElementById('btn-open-search').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('search/search.html') });
    window.close();
  });

  document.getElementById('btn-open-sidebar').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  });
}

function sendMessage(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, resolve);
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message
  });
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
