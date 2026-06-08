let currentTab = 'clip';
let selectedTags = [];
let currentScreenshot = null;
let currentCitationFormat = 'apa';
let selectedClipForCitation = null;

const TOPICS = [
  { id: 'academic', name: '学术研究', icon: '📚' },
  { id: 'news', name: '新闻资讯', icon: '📰' },
  { id: 'tech', name: '技术资料', icon: '💻' },
  { id: 'product', name: '产品文档', icon: '📋' },
  { id: 'design', name: '设计参考', icon: '🎨' },
  { id: 'marketing', name: '营销素材', icon: '📣' },
  { id: 'other', name: '其他资料', icon: '📁' }
];

document.addEventListener('DOMContentLoaded', init);

function init() {
  setupTabs();
  setupClipPanel();
  setupTagsPanel();
  setupCitationPanel();
  setupReadLaterPanel();
  setupRecentPanel();
  setupDetailPanel();
  loadCurrentPageInfo();
  setupGlobalEvents();
}

function setupDetailPanel() {
  document.getElementById('btn-close-detail').addEventListener('click', closeDetailModal);
  document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') {
      closeDetailModal();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('detail-modal').classList.contains('show')) {
      closeDetailModal();
    }
  });
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  currentTab = tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
  
  if (tab === 'tags') {
    loadTags();
  } else if (tab === 'citation') {
    loadClipsForCitation();
  } else if (tab === 'read-later') {
    loadReadLater();
  } else if (tab === 'recent') {
    loadRecentClips();
  }
}

function setupClipPanel() {
  document.getElementById('btn-save-page').addEventListener('click', saveCurrentPage);
  document.getElementById('btn-capture').addEventListener('click', captureScreenshot);
  document.getElementById('btn-remove-screenshot').addEventListener('click', removeScreenshot);
  document.getElementById('btn-copy-url').addEventListener('click', copyUrl);
  document.getElementById('btn-save-clip').addEventListener('click', saveClip);
  
  const enableReview = document.getElementById('enable-review');
  const reviewTime = document.getElementById('review-time');
  enableReview.addEventListener('change', () => {
    reviewTime.style.display = enableReview.checked ? 'block' : 'none';
    if (enableReview.checked) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      reviewTime.value = tomorrow.toISOString().slice(0, 16);
    }
  });
  
  const newTagInput = document.getElementById('new-tag-input');
  newTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && newTagInput.value.trim()) {
      addTag(newTagInput.value.trim());
      newTagInput.value = '';
    }
  });
}

function addTag(tagName) {
  if (!selectedTags.includes(tagName)) {
    selectedTags.push(tagName);
    renderTags();
  }
}

function removeTag(tagName) {
  selectedTags = selectedTags.filter(t => t !== tagName);
  renderTags();
}

function renderTags() {
  const tagsList = document.getElementById('tags-list');
  tagsList.innerHTML = selectedTags.map(tag => `
    <span class="tag-item">
      ${escapeHtml(tag)}
      <button class="remove-tag" data-tag="${escapeHtml(tag)}">×</button>
    </span>
  `).join('');
  
  tagsList.querySelectorAll('.remove-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      removeTag(btn.dataset.tag);
    });
  });
}

async function loadCurrentPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      document.getElementById('clip-title').value = tab.title || '';
      document.getElementById('clip-url').value = tab.url || '';
    }
    
    chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, (response) => {
      if (response && response.content) {
        document.getElementById('clip-content').value = response.content.substring(0, 500);
      }
    });
    
    chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' }, (response) => {
      if (response && response.text) {
        document.getElementById('clip-content').value = response.text;
      }
    });
  } catch (e) {
    console.error('Failed to load page info:', e);
  }
}

async function saveCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    document.getElementById('clip-title').value = tab.title || '';
    document.getElementById('clip-url').value = tab.url || '';
    
    chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, (response) => {
      if (response && response.content) {
        document.getElementById('clip-content').value = response.content.substring(0, 2000);
      }
    });
    
    showToast('页面信息已加载', 'success');
  } catch (e) {
    showToast('加载页面信息失败', 'error');
  }
}

async function captureScreenshot() {
  try {
    const response = await sendMessage('captureScreenshot');
    if (response.success) {
      currentScreenshot = response.dataUrl;
      document.getElementById('screenshot-img').src = currentScreenshot;
      document.getElementById('screenshot-preview').style.display = 'block';
      showToast('截图成功', 'success');
    }
  } catch (e) {
    showToast('截图失败', 'error');
  }
}

function removeScreenshot() {
  currentScreenshot = null;
  document.getElementById('screenshot-preview').style.display = 'none';
  document.getElementById('screenshot-img').src = '';
}

function copyUrl() {
  const url = document.getElementById('clip-url').value;
  if (url) {
    navigator.clipboard.writeText(url);
    showToast('链接已复制', 'success');
  }
}

async function saveClip() {
  const title = document.getElementById('clip-title').value.trim();
  const url = document.getElementById('clip-url').value.trim();
  const content = document.getElementById('clip-content').value.trim();
  const notes = document.getElementById('clip-notes').value.trim();
  const credibility = document.getElementById('clip-credibility').value;
  const topic = document.getElementById('clip-topic').value;
  const enableReview = document.getElementById('enable-review').checked;
  const reviewTime = document.getElementById('review-time').value;
  
  if (!title || !url) {
    showToast('请填写标题和链接', 'error');
    return;
  }
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const clip = {
      title,
      url,
      content,
      notes,
      tags: [...selectedTags],
      credibility,
      topic,
      screenshot: currentScreenshot,
      favicon: tab?.favIconUrl || null
    };
    
    const response = await sendMessage('saveClip', { clip });
    
    if (response.success) {
      if (enableReview && reviewTime) {
        await sendMessage('setReviewReminder', {
          clipId: response.clip.id,
          remindAt: new Date(reviewTime).toISOString()
        });
      }
      
      showToast('保存成功！', 'success');
      resetClipForm();
      
      if (currentTab === 'recent') {
        loadRecentClips();
      }
    } else {
      showToast('保存失败', 'error');
    }
  } catch (e) {
    console.error('Save clip error:', e);
    showToast('保存失败', 'error');
  }
}

function resetClipForm() {
  document.getElementById('clip-content').value = '';
  document.getElementById('clip-notes').value = '';
  document.getElementById('clip-credibility').value = 'neutral';
  document.getElementById('clip-topic').value = '';
  document.getElementById('enable-review').checked = false;
  document.getElementById('review-time').style.display = 'none';
  selectedTags = [];
  currentScreenshot = null;
  renderTags();
  removeScreenshot();
}

function setupTagsPanel() {
  document.getElementById('tag-search').addEventListener('input', (e) => {
    loadTags(e.target.value);
  });
}

async function loadTags(searchTerm = '') {
  try {
    const [tagsResponse, clipsResponse] = await Promise.all([
      sendMessage('getTags'),
      sendMessage('getClips')
    ]);
    
    if (!tagsResponse.success || !clipsResponse.success) return;
    
    let tags = tagsResponse.tags;
    const clips = clipsResponse.clips;
    
    const topicCounts = {};
    const tagCounts = {};
    clips.forEach(clip => {
      if (clip.topic) {
        topicCounts[clip.topic] = (topicCounts[clip.topic] || 0) + 1;
      }
      clip.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const topicsCloud = document.getElementById('topics-cloud');
    const topics = Object.keys(topicCounts).sort();
    
    if (topics.length === 0) {
      topicsCloud.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/>
          </svg>
          <p>暂无主题，剪藏时选择主题归档</p>
        </div>
      `;
    } else {
      topicsCloud.innerHTML = topics.map(topic => {
        const topicInfo = TOPICS.find(t => t.name === topic) || { icon: '📁' };
        return `
        <div class="topic-cloud-item" data-topic="${escapeHtml(topic)}">
          ${topicInfo.icon} ${escapeHtml(topic)}
          <span class="topic-count">${topicCounts[topic]}</span>
        </div>
      `}).join('');
      
      topicsCloud.querySelectorAll('.topic-cloud-item').forEach(item => {
        item.addEventListener('click', () => {
          showTopicClips(item.dataset.topic, clips);
        });
      });
    }
    
    if (searchTerm) {
      tags = tags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    const tagsCloud = document.getElementById('tags-cloud');
    if (tags.length === 0) {
      tagsCloud.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <p>暂无标签，剪藏内容时添加标签</p>
        </div>
      `;
    } else {
      tagsCloud.innerHTML = tags.map(tag => `
        <div class="tag-cloud-item" data-tag="${escapeHtml(tag.name)}" style="background-color: ${tag.color}">
          ${escapeHtml(tag.name)}
          <span class="tag-count">${tagCounts[tag.name] || 0}</span>
        </div>
      `).join('');
      
      tagsCloud.querySelectorAll('.tag-cloud-item').forEach(item => {
        item.addEventListener('click', () => {
          showTaggedClips(item.dataset.tag, clips);
        });
      });
    }
  } catch (e) {
    console.error('Load tags error:', e);
  }
}

function showTopicClips(topicName, clips) {
  const topicClips = clips.filter(c => c.topic === topicName);
  const container = document.getElementById('tagged-clips');
  const title = document.getElementById('selected-tag-title');
  const list = document.getElementById('tagged-clips-list');
  
  title.textContent = `主题: ${topicName} (${topicClips.length})`;
  
  if (topicClips.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>该主题下暂无内容</p>
      </div>
    `;
  } else {
    list.innerHTML = topicClips.map(clip => createClipCard(clip)).join('');
    bindClipCardEvents(list);
  }
  
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
}

function showTaggedClips(tagName, clips) {
  const taggedClips = clips.filter(c => c.tags.includes(tagName));
  const container = document.getElementById('tagged-clips');
  const title = document.getElementById('selected-tag-title');
  const list = document.getElementById('tagged-clips-list');
  
  title.textContent = `标签: ${tagName} (${taggedClips.length})`;
  
  if (taggedClips.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>该标签下暂无内容</p>
      </div>
    `;
  } else {
    list.innerHTML = taggedClips.map(clip => createClipCard(clip)).join('');
    bindClipCardEvents(list);
  }
  
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
}

function setupCitationPanel() {
  document.getElementById('citation-clip-select').addEventListener('change', (e) => {
    const clipId = e.target.value;
    if (clipId) {
      loadClipForCitation(clipId);
    } else {
      document.getElementById('citation-card').style.display = 'none';
    }
  });
  
  document.querySelectorAll('.format-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentCitationFormat = tab.dataset.format;
      document.querySelectorAll('.format-tab').forEach(t => t.classList.toggle('active', t === tab));
      updateCitationText();
    });
  });
  
  document.getElementById('btn-copy-citation').addEventListener('click', copyCitation);
}

async function loadClipsForCitation() {
  try {
    const response = await sendMessage('getClips');
    if (response.success) {
      const select = document.getElementById('citation-clip-select');
      select.innerHTML = '<option value="">请选择剪藏资料...</option>' + 
        response.clips.map(clip => `
          <option value="${clip.id}">${clip.title || '无标题'}</option>
        `).join('');
    }
  } catch (e) {
    console.error('Load clips error:', e);
  }
}

async function loadClipForCitation(clipId) {
  try {
    const response = await sendMessage('getClips');
    if (response.success) {
      selectedClipForCitation = response.clips.find(c => c.id === clipId);
      if (selectedClipForCitation) {
        renderCitationCard(selectedClipForCitation);
      }
    }
  } catch (e) {
    console.error('Load clip error:', e);
  }
}

async function renderCitationCard(clip) {
  const card = document.getElementById('citation-card');
  
  const summaryResponse = await sendMessage('generateSummary', { clip });
  const summary = summaryResponse.success ? summaryResponse.summary : clip.content;
  
  const sourceResponse = await sendMessage('getSourceInfo', { clip });
  const sourceInfo = sourceResponse.success ? sourceResponse.sourceInfo : { domain: 'unknown', fullUrl: clip.url };
  
  document.getElementById('citation-summary-text').textContent = summary;
  document.getElementById('source-author').textContent = clip.author || '佚名';
  document.getElementById('source-domain').textContent = sourceInfo.domain;
  document.getElementById('source-date').textContent = clip.publishedDate 
    ? new Date(clip.publishedDate).toLocaleDateString()
    : new Date(clip.createdAt).toLocaleDateString();
  document.getElementById('source-url').href = clip.url;
  document.getElementById('source-url').textContent = clip.url;
  
  updateCitationText();
  card.style.display = 'block';
}

async function updateCitationText() {
  if (!selectedClipForCitation) return;
  
  const response = await sendMessage('generateCitation', {
    clip: selectedClipForCitation,
    format: currentCitationFormat
  });
  
  if (response.success) {
    document.getElementById('citation-text').textContent = response.citation;
  }
}

function copyCitation() {
  const text = document.getElementById('citation-text').textContent;
  if (text) {
    navigator.clipboard.writeText(text);
    showToast('引用已复制', 'success');
  }
}

function setupReadLaterPanel() {
}

async function loadReadLater() {
  try {
    const response = await sendMessage('getReadLater');
    if (response.success) {
      const list = document.getElementById('read-later-list');
      const count = document.getElementById('read-later-count');
      
      count.textContent = response.clips.length;
      
      if (response.clips.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <p>稍后阅读列表为空</p>
            <p style="font-size: 12px; margin-top: 4px;">使用 Ctrl+Shift+R 添加当前页面</p>
          </div>
        `;
      } else {
        list.innerHTML = response.clips.map(clip => createClipCard(clip)).join('');
        bindClipCardEvents(list);
      }
    }
  } catch (e) {
    console.error('Load read later error:', e);
  }
}

function setupRecentPanel() {
}

async function loadRecentClips() {
  try {
    const response = await sendMessage('getClips');
    if (response.success) {
      const recentClips = response.clips.slice(0, 20);
      const list = document.getElementById('recent-clips-list');
      
      if (recentClips.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            <p>暂无剪藏内容</p>
            <p style="font-size: 12px; margin-top: 4px;">使用 Ctrl+Shift+S 剪藏当前页面</p>
          </div>
        `;
      } else {
        list.innerHTML = recentClips.map(clip => createClipCard(clip)).join('');
        bindClipCardEvents(list);
      }
    }
  } catch (e) {
    console.error('Load recent clips error:', e);
  }
}

function createClipCard(clip) {
  const domain = extractDomain(clip.url);
  const timeAgo = formatTimeAgo(clip.createdAt);
  
  let credibilityBadge = '';
  if (clip.credibility && clip.credibility !== 'neutral') {
    const credibilityLabels = {
      high: '高可信度',
      low: '待验证',
      unreliable: '不可靠'
    };
    credibilityBadge = `<span class="credibility-badge credibility-${clip.credibility}">${credibilityLabels[clip.credibility]}</span>`;
  }
  
  return `
    <div class="clip-card" data-id="${clip.id}">
      <div class="clip-card-header">
        ${clip.favicon ? `<img src="${clip.favicon}" alt="" class="clip-card-favicon" onerror="this.style.display='none'">` : ''}
        <div class="clip-card-title">${escapeHtml(clip.title || '无标题')}</div>
      </div>
      ${clip.content ? `<div class="clip-card-content">${escapeHtml(clip.content)}</div>` : ''}
      ${clip.notes ? `<div class="clip-card-notes">${escapeHtml(clip.notes)}</div>` : ''}
      <div class="clip-card-footer">
        <div class="clip-card-tags">
          ${clip.tags.slice(0, 3).map(tag => `<span class="clip-card-tag">${escapeHtml(tag)}</span>`).join('')}
          ${clip.tags.length > 3 ? `<span class="clip-card-tag">+${clip.tags.length - 3}</span>` : ''}
          ${clip.topic ? `<span class="clip-card-topic">${(TOPICS.find(t => t.name === clip.topic) || { icon: '📁' }).icon} ${escapeHtml(clip.topic)}</span>` : ''}
          ${credibilityBadge}
        </div>
        <span class="clip-card-time" title="${new Date(clip.createdAt).toLocaleString()}">${timeAgo}</span>
      </div>
      <div class="clip-card-actions">
        <button class="clip-action-btn" data-action="open">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          打开
        </button>
        <button class="clip-action-btn" data-action="read-later">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          ${clip.isReadLater ? '取消' : '稍后读'}
        </button>
        <button class="clip-action-btn danger" data-action="delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          删除
        </button>
      </div>
    </div>
  `;
}

function bindClipCardEvents(container) {
  container.querySelectorAll('.clip-card').forEach(card => {
    const clipId = card.dataset.id;
    
    card.querySelector('[data-action="open"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openClip(clipId);
    });
    
    card.querySelector('[data-action="read-later"]').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleReadLater(clipId);
    });
    
    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteClip(clipId);
    });
    
    card.addEventListener('click', () => {
      openClip(clipId);
    });
  });
}

async function openClip(clipId) {
  try {
    const response = await sendMessage('getClips');
    if (response.success) {
      const clip = response.clips.find(c => c.id === clipId);
      if (clip) {
        showClipDetail(clip);
      }
    }
  } catch (e) {
    console.error('Open clip error:', e);
  }
}

let currentDetailClip = null;
let detailEditMode = false;

function showClipDetail(clip) {
  currentDetailClip = clip;
  detailEditMode = false;
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('detail-body');
  
  renderDetailBody(clip, false);
  modal.classList.add('show');
}

function closeDetailModal() {
  const modal = document.getElementById('detail-modal');
  modal.classList.remove('show');
  currentDetailClip = null;
  detailEditMode = false;
}

function renderDetailBody(clip, isEditing) {
  const body = document.getElementById('detail-body');
  const title = document.getElementById('detail-title');
  const sourceInfo = CitationManager ? CitationManager.getSourceInfo(clip) : extractDomain(clip.url);
  const domain = sourceInfo.domain || extractDomain(clip.url);
  
  title.textContent = isEditing ? '编辑资料' : '资料详情';
  
  const credibilityOptions = [
    { value: 'high', label: '高可信度' },
    { value: 'neutral', label: '一般' },
    { value: 'low', label: '待验证' },
    { value: 'unreliable', label: '不可靠' }
  ];
  
  const topics = [
    { id: 'academic', name: '学术研究', icon: '📚' },
    { id: 'news', name: '新闻资讯', icon: '📰' },
    { id: 'tech', name: '技术资料', icon: '💻' },
    { id: 'product', name: '产品文档', icon: '📋' },
    { id: 'design', name: '设计参考', icon: '🎨' },
    { id: 'marketing', name: '营销素材', icon: '📣' },
    { id: 'other', name: '其他资料', icon: '📁' }
  ];
  
  if (isEditing) {
    body.innerHTML = `
      <div class="detail-section">
        <label class="detail-label">标题</label>
        <input type="text" class="input" id="detail-edit-title" value="${escapeHtml(clip.title || '')}" />
      </div>
      <div class="detail-section">
        <label class="detail-label">来源链接</label>
        <a href="${clip.url}" target="_blank" class="detail-link">${escapeHtml(clip.url)}</a>
      </div>
      <div class="detail-section">
        <label class="detail-label">正文摘录</label>
        <textarea class="textarea" id="detail-edit-content" rows="6">${escapeHtml(clip.content || '')}</textarea>
      </div>
      <div class="detail-section">
        <label class="detail-label">个人批注</label>
        <textarea class="textarea" id="detail-edit-notes" rows="4">${escapeHtml(clip.notes || '')}</textarea>
      </div>
      <div class="detail-section">
        <label class="detail-label">标签 (用逗号分隔)</label>
        <input type="text" class="input" id="detail-edit-tags" value="${escapeHtml(clip.tags ? clip.tags.join(', ') : '')}" />
      </div>
      <div class="detail-section">
        <label class="detail-label">主题归档</label>
        <select class="select" id="detail-edit-topic">
          <option value="">不设置主题</option>
          ${topics.map(t => `<option value="${t.name}" ${clip.topic === t.name ? 'selected' : ''}>${t.icon} ${t.name}</option>`).join('')}
        </select>
      </div>
      <div class="detail-section">
        <label class="detail-label">可信度</label>
        <select class="select" id="detail-edit-credibility">
          ${credibilityOptions.map(opt => `<option value="${opt.value}" ${clip.credibility === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
        </select>
      </div>
      ${clip.screenshot ? `
        <div class="detail-section">
          <label class="detail-label">截图</label>
          <img src="${clip.screenshot}" alt="Screenshot" class="detail-screenshot" />
        </div>
      ` : ''}
      <div class="detail-actions">
        <button class="btn-secondary" id="detail-cancel-edit">取消</button>
        <button class="btn-primary" id="detail-save-edit">保存修改</button>
      </div>
    `;
    
    document.getElementById('detail-cancel-edit').addEventListener('click', () => {
      detailEditMode = false;
      renderDetailBody(currentDetailClip, false);
    });
    
    document.getElementById('detail-save-edit').addEventListener('click', saveDetailEdits);
  } else {
    const credibilityLabels = {
      high: '高可信度',
      neutral: '一般',
      low: '待验证',
      unreliable: '不可靠'
    };
    
    body.innerHTML = `
      <div class="detail-section">
        <label class="detail-label">标题</label>
        <h3 class="detail-title">${escapeHtml(clip.title || '无标题')}</h3>
      </div>
      <div class="detail-section">
        <label class="detail-label">来源</label>
        <div class="detail-source">
          ${clip.favicon ? `<img src="${clip.favicon}" alt="" class="detail-favicon" onerror="this.style.display='none'" />` : ''}
          <span class="detail-domain">${escapeHtml(domain)}</span>
          <a href="${clip.url}" target="_blank" class="detail-link">查看原文 ↗</a>
        </div>
      </div>
      ${clip.content ? `
        <div class="detail-section">
          <label class="detail-label">正文摘录</label>
          <p class="detail-content">${escapeHtml(clip.content)}</p>
        </div>
      ` : ''}
      ${clip.notes ? `
        <div class="detail-section">
          <label class="detail-label">个人批注</label>
          <p class="detail-notes">${escapeHtml(clip.notes)}</p>
        </div>
      ` : ''}
      ${clip.tags && clip.tags.length > 0 ? `
        <div class="detail-section">
          <label class="detail-label">标签</label>
          <div class="detail-tags">
            ${clip.tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      ${clip.topic ? `
        <div class="detail-section">
          <label class="detail-label">主题归档</label>
          <span class="clip-card-topic">${(TOPICS.find(t => t.name === clip.topic) || { icon: '📁' }).icon} ${escapeHtml(clip.topic)}</span>
        </div>
      ` : ''}
      <div class="detail-section">
        <label class="detail-label">可信度</label>
        <span class="credibility-badge credibility-${clip.credibility}">${credibilityLabels[clip.credibility] || '一般'}</span>
      </div>
      ${clip.highlights && clip.highlights.length > 0 ? `
        <div class="detail-section">
          <label class="detail-label">高亮内容 (${clip.highlights.length})</label>
          <div class="detail-highlights">
            ${clip.highlights.slice(0, 3).map(h => `<div class="detail-highlight">${escapeHtml(h.text)}</div>`).join('')}
            ${clip.highlights.length > 3 ? `<p class="detail-more">还有 ${clip.highlights.length - 3} 条高亮...</p>` : ''}
          </div>
        </div>
      ` : ''}
      ${clip.screenshot ? `
        <div class="detail-section">
          <label class="detail-label">截图</label>
          <img src="${clip.screenshot}" alt="Screenshot" class="detail-screenshot" />
        </div>
      ` : ''}
      ${clip.author || clip.publishedDate ? `
        <div class="detail-section">
          <label class="detail-label">引用信息</label>
          <div class="detail-citation">
            ${clip.author ? `<p>作者：${escapeHtml(clip.author)}</p>` : ''}
            ${clip.publishedDate ? `<p>发布时间：${escapeHtml(clip.publishedDate)}</p>` : ''}
          </div>
        </div>
      ` : ''}
      <div class="detail-section">
        <label class="detail-label">保存时间</label>
        <p class="detail-time">${new Date(clip.createdAt).toLocaleString()}</p>
      </div>
      <div class="detail-actions">
        <button class="btn-secondary" id="detail-open-url">打开原文</button>
        <button class="btn-primary" id="detail-edit">编辑资料</button>
      </div>
    `;
    
    document.getElementById('detail-open-url').addEventListener('click', () => {
      if (clip.url) chrome.tabs.create({ url: clip.url });
    });
    
    document.getElementById('detail-edit').addEventListener('click', () => {
      detailEditMode = true;
      renderDetailBody(currentDetailClip, true);
    });
  }
}

async function saveDetailEdits() {
  if (!currentDetailClip) return;
  
  const title = document.getElementById('detail-edit-title').value.trim();
  const content = document.getElementById('detail-edit-content').value.trim();
  const notes = document.getElementById('detail-edit-notes').value.trim();
  const tagsInput = document.getElementById('detail-edit-tags').value.trim();
  const topic = document.getElementById('detail-edit-topic').value;
  const credibility = document.getElementById('detail-edit-credibility').value;
  
  const tags = tagsInput ? tagsInput.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
  
  try {
    const response = await sendMessage('updateClip', {
      id: currentDetailClip.id,
      updates: {
        title,
        content,
        notes,
        tags,
        topic,
        credibility
      }
    });
    
    if (response.success) {
      currentDetailClip = response.clip;
      detailEditMode = false;
      renderDetailBody(currentDetailClip, false);
      showToast('已保存修改', 'success');
      
      refreshAllClipsLists();
    }
  } catch (e) {
    console.error('Save detail edits error:', e);
    showToast('保存失败', 'error');
  }
}

function refreshAllClipsLists() {
  if (currentTab === 'read-later') {
    loadReadLater();
  } else if (currentTab === 'recent') {
    loadRecentClips();
  } else if (currentTab === 'tags') {
    loadTags();
  }
}

async function toggleReadLater(clipId) {
  try {
    const response = await sendMessage('getClips');
    if (response.success) {
      const clip = response.clips.find(c => c.id === clipId);
      if (clip) {
        await sendMessage('markAsReadLater', {
          clipId,
          isReadLater: !clip.isReadLater
        });
        showToast(clip.isReadLater ? '已从稍后阅读移除' : '已添加到稍后阅读', 'success');
        
        if (currentTab === 'read-later') {
          loadReadLater();
        } else if (currentTab === 'recent') {
          loadRecentClips();
        }
      }
    }
  } catch (e) {
    console.error('Toggle read later error:', e);
  }
}

async function deleteClip(clipId) {
  if (!confirm('确定要删除这条剪藏吗？')) return;
  
  try {
    await sendMessage('deleteClip', { id: clipId });
    showToast('已删除', 'success');
    
    if (currentTab === 'read-later') {
      loadReadLater();
    } else if (currentTab === 'recent') {
      loadRecentClips();
    } else if (currentTab === 'tags') {
      loadTags(document.getElementById('tag-search').value);
    }
  } catch (e) {
    console.error('Delete clip error:', e);
    showToast('删除失败', 'error');
  }
}

function setupGlobalEvents() {
  document.getElementById('open-search').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('search/search.html') });
  });
}

function sendMessage(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, resolve);
  });
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
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

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
