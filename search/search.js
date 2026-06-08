let allClips = [];
let filteredClips = [];
let selectedClipIds = [];
let currentFilters = {
  keyword: '',
  topics: [],
  tags: [],
  sources: [],
  dateRange: null,
  credibility: []
};
let outlineClips = [];
let currentOutlineId = null;
let draggedItem = null;

document.addEventListener('DOMContentLoaded', init);

function init() {
  loadData();
  setupEventListeners();
}

async function loadData() {
  try {
    const response = await sendMessage('getClips');
    if (response.success) {
      allClips = response.clips;
      filteredClips = [...allClips];
      renderFilters();
      renderClips();
    }
  } catch (e) {
    console.error('Load data error:', e);
    showToast('加载数据失败', 'error');
  }
}

function setupEventListeners() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', debounce((e) => {
    currentFilters.keyword = e.target.value;
    applyFilters();
  }, 300));

  document.getElementById('date-start').addEventListener('change', applyFilters);
  document.getElementById('date-end').addEventListener('change', applyFilters);

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      
      document.getElementById('date-start').value = startDate.toISOString().split('T')[0];
      document.getElementById('date-end').value = endDate.toISOString().split('T')[0];
      
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', b === btn));
      applyFilters();
    });
  });

  document.querySelectorAll('.credibility-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      currentFilters.credibility = Array.from(
        document.querySelectorAll('.credibility-checkbox:checked')
      ).map(cb => cb.value);
      applyFilters();
    });
  });

  document.getElementById('btn-reset-filters').addEventListener('click', resetFilters);
  document.getElementById('btn-select-all').addEventListener('click', toggleSelectAll);
  document.getElementById('btn-create-outline').addEventListener('click', openOutlineModal);
  document.getElementById('btn-back').addEventListener('click', () => window.close());

  document.querySelectorAll('[data-close="modal"]').forEach(el => {
    el.addEventListener('click', closeModals);
  });

  document.getElementById('btn-save-outline').addEventListener('click', saveOutline);
  document.getElementById('btn-generate-markdown').addEventListener('click', generateMarkdown);
  document.getElementById('btn-copy-markdown').addEventListener('click', copyMarkdown);
}

function renderFilters() {
  renderTopicFilters();
  renderTagFilters();
  renderSourceFilters();
}

function renderTopicFilters() {
  const topicCounts = {};
  allClips.forEach(clip => {
    if (clip.topic) {
      topicCounts[clip.topic] = (topicCounts[clip.topic] || 0) + 1;
    }
  });

  const topicsFilter = document.getElementById('topics-filter');
  const topics = Object.keys(topicCounts).sort();
  
  if (topics.length === 0) {
    topicsFilter.innerHTML = '<p style="color: #adb5bd; font-size: 13px;">暂无主题，剪藏时选择主题归档</p>';
    return;
  }

  topicsFilter.innerHTML = topics.map(topic => `
    <div class="topic-filter-item ${currentFilters.topics.includes(topic) ? 'active' : ''}" data-topic="${topic}">
      📁 ${escapeHtml(topic)}
      <span class="topic-count">${topicCounts[topic]}</span>
    </div>
  `).join('');

  topicsFilter.querySelectorAll('.topic-filter-item').forEach(item => {
    item.addEventListener('click', () => {
      const topic = item.dataset.topic;
      const index = currentFilters.topics.indexOf(topic);
      if (index > -1) {
        currentFilters.topics.splice(index, 1);
      } else {
        currentFilters.topics.push(topic);
      }
      applyFilters();
      renderTopicFilters();
    });
  });
}

function renderTagFilters() {
  const tagCounts = {};
  allClips.forEach(clip => {
    clip.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const tagsFilter = document.getElementById('tags-filter');
  const tags = Object.keys(tagCounts).sort();
  
  if (tags.length === 0) {
    tagsFilter.innerHTML = '<p style="color: #adb5bd; font-size: 13px;">暂无标签</p>';
    return;
  }

  tagsFilter.innerHTML = tags.map(tag => `
    <div class="tag-filter-item ${currentFilters.tags.includes(tag) ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
      ${escapeHtml(tag)}
      <span class="tag-count">${tagCounts[tag]}</span>
    </div>
  `).join('');

  tagsFilter.querySelectorAll('.tag-filter-item').forEach(item => {
    item.addEventListener('click', () => {
      const tag = item.dataset.tag;
      const index = currentFilters.tags.indexOf(tag);
      if (index > -1) {
        currentFilters.tags.splice(index, 1);
      } else {
        currentFilters.tags.push(tag);
      }
      applyFilters();
      renderTagFilters();
    });
  });
}

function renderSourceFilters() {
  const sourceCounts = {};
  allClips.forEach(clip => {
    try {
      const domain = new URL(clip.url).hostname;
      sourceCounts[domain] = (sourceCounts[domain] || 0) + 1;
    } catch (e) {}
  });

  const sourcesFilter = document.getElementById('sources-filter');
  const sources = Object.keys(sourceCounts).sort((a, b) => sourceCounts[b] - sourceCounts[a]).slice(0, 10);
  
  if (sources.length === 0) {
    sourcesFilter.innerHTML = '<p style="color: #adb5bd; font-size: 13px;">暂无来源</p>';
    return;
  }

  sourcesFilter.innerHTML = sources.map(source => `
    <label class="source-filter-item ${currentFilters.sources.includes(source) ? 'active' : ''}">
      <input type="checkbox" value="${source}" ${currentFilters.sources.includes(source) ? 'checked' : ''} class="source-checkbox">
      ${source}
      <span style="margin-left: auto; color: #adb5bd; font-size: 12px;">${sourceCounts[source]}</span>
    </label>
  `).join('');

  sourcesFilter.querySelectorAll('.source-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const source = checkbox.value;
      const index = currentFilters.sources.indexOf(source);
      if (index > -1) {
        currentFilters.sources.splice(index, 1);
      } else {
        currentFilters.sources.push(source);
      }
      applyFilters();
      renderSourceFilters();
    });
  });
}

function applyFilters() {
  let results = [...allClips];

  if (currentFilters.keyword) {
    const kw = currentFilters.keyword.toLowerCase();
    results = results.filter(c =>
      c.title?.toLowerCase().includes(kw) ||
      c.content?.toLowerCase().includes(kw) ||
      c.notes?.toLowerCase().includes(kw) ||
      c.url?.toLowerCase().includes(kw)
    );
  }

  if (currentFilters.topics.length > 0) {
    results = results.filter(c =>
      currentFilters.topics.includes(c.topic)
    );
  }

  if (currentFilters.tags.length > 0) {
    results = results.filter(c =>
      currentFilters.tags.some(t => c.tags.includes(t))
    );
  }

  if (currentFilters.sources.length > 0) {
    results = results.filter(c => {
      try {
        return currentFilters.sources.includes(new URL(c.url).hostname);
      } catch {
        return false;
      }
    });
  }

  const dateStart = document.getElementById('date-start').value;
  const dateEnd = document.getElementById('date-end').value;
  if (dateStart || dateEnd) {
    currentFilters.dateRange = { start: dateStart, end: dateEnd };
    results = results.filter(c => {
      const date = new Date(c.createdAt);
      return (!dateStart || date >= new Date(dateStart)) &&
             (!dateEnd || date <= new Date(dateEnd + 'T23:59:59'));
    });
  } else {
    currentFilters.dateRange = null;
  }

  if (currentFilters.credibility.length > 0) {
    results = results.filter(c => currentFilters.credibility.includes(c.credibility));
  }

  filteredClips = results;
  renderClips();
  updateActiveFiltersDisplay();
}

function updateActiveFiltersDisplay() {
  const container = document.getElementById('active-filters');
  const filters = [];

  if (currentFilters.keyword) {
    filters.push({ label: `"${currentFilters.keyword}"`, type: 'keyword' });
  }
  currentFilters.topics.forEach(topic => {
    filters.push({ label: `📁 ${escapeHtml(topic)}`, type: 'topic', value: topic });
  });
  currentFilters.tags.forEach(tag => {
    filters.push({ label: `#${escapeHtml(tag)}`, type: 'tag', value: tag });
  });
  currentFilters.sources.forEach(source => {
    filters.push({ label: source, type: 'source', value: source });
  });
  if (currentFilters.dateRange) {
    const { start, end } = currentFilters.dateRange;
    filters.push({ label: `${start || '...'} - ${end || '...'}`, type: 'date' });
  }
  currentFilters.credibility.forEach(c => {
    filters.push({ label: getCredibilityLabel(c), type: 'credibility', value: c });
  });

  container.innerHTML = filters.map(f => `
    <span class="active-filter-tag">
      ${f.label}
      <span class="remove" data-type="${f.type}" data-value="${f.value || ''}">×</span>
    </span>
  `).join('');

  container.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFilter(btn.dataset.type, btn.dataset.value);
    });
  });
}

function removeFilter(type, value) {
  switch (type) {
    case 'keyword':
      currentFilters.keyword = '';
      document.getElementById('search-input').value = '';
      break;
    case 'topic':
      currentFilters.topics = currentFilters.topics.filter(t => t !== value);
      break;
    case 'tag':
      currentFilters.tags = currentFilters.tags.filter(t => t !== value);
      break;
    case 'source':
      currentFilters.sources = currentFilters.sources.filter(s => s !== value);
      document.querySelector(`.source-checkbox[value="${value}"]`).checked = false;
      break;
    case 'date':
      currentFilters.dateRange = null;
      document.getElementById('date-start').value = '';
      document.getElementById('date-end').value = '';
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      break;
    case 'credibility':
      currentFilters.credibility = currentFilters.credibility.filter(c => c !== value);
      document.querySelector(`.credibility-checkbox[value="${value}"]`).checked = false;
      break;
  }
  applyFilters();
  renderTagFilters();
  renderSourceFilters();
}

function resetFilters() {
  currentFilters = {
    keyword: '',
    topics: [],
    tags: [],
    sources: [],
    dateRange: null,
    credibility: []
  };
  selectedClipIds = [];

  document.getElementById('search-input').value = '';
  document.getElementById('date-start').value = '';
  document.getElementById('date-end').value = '';
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.credibility-checkbox').forEach(cb => cb.checked = false);

  filteredClips = [...allClips];
  renderTopicFilters();
  renderTagFilters();
  renderSourceFilters();
  renderClips();
  updateActiveFiltersDisplay();
}

function renderClips() {
  const grid = document.getElementById('clips-grid');
  const emptyState = document.getElementById('empty-state');
  const countEl = document.getElementById('results-count');

  countEl.textContent = filteredClips.length;

  if (filteredClips.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  grid.innerHTML = filteredClips.map(clip => createClipCard(clip)).join('');

  grid.querySelectorAll('.clip-card').forEach(card => {
    const clipId = card.dataset.id;
    const checkbox = card.querySelector('.clip-select');

    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleClipSelection(clipId, checkbox.checked);
    });

    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('clip-select')) {
        window.open(clip.url, '_blank');
      }
    });
  });

  updateSelectAllButton();
  updateOutlineButton();
}

function createClipCard(clip) {
  const domain = extractDomain(clip.url);
  const timeAgo = formatTimeAgo(clip.createdAt);
  const isSelected = selectedClipIds.includes(clip.id);

  let credibilityBadge = '';
  if (clip.credibility && clip.credibility !== 'neutral') {
    credibilityBadge = `<span class="credibility-badge credibility-${clip.credibility}">${getCredibilityLabel(clip.credibility)}</span>`;
  }

  let topicBadge = '';
  if (clip.topic) {
    topicBadge = `<span class="clip-card-topic">📁 ${escapeHtml(clip.topic)}</span>`;
  }

  return `
    <div class="clip-card ${isSelected ? 'selected' : ''}" data-id="${clip.id}">
      <input type="checkbox" class="clip-select" ${isSelected ? 'checked' : ''}>
      <div class="clip-card-header">
        ${clip.favicon ? `<img src="${clip.favicon}" alt="" class="clip-card-favicon" onerror="this.style.display='none'">` : ''}
        <div class="clip-card-title">${escapeHtml(clip.title || '无标题')}</div>
      </div>
      ${clip.screenshot ? `<img src="${clip.screenshot}" alt="截图" class="clip-screenshot">` : ''}
      ${clip.notes ? `<div class="clip-notes">${escapeHtml(clip.notes)}</div>` : ''}
      ${clip.content ? `<div class="clip-card-content">${escapeHtml(clip.content)}</div>` : ''}
      <div class="clip-card-meta">
        <span class="clip-card-domain">${domain}</span>
        ${credibilityBadge}
        ${topicBadge}
      </div>
      <div class="clip-card-footer">
        <div class="clip-card-tags">
          ${clip.tags.slice(0, 3).map(tag => `<span class="clip-card-tag">${escapeHtml(tag)}</span>`).join('')}
          ${clip.tags.length > 3 ? `<span class="clip-card-tag">+${clip.tags.length - 3}</span>` : ''}
        </div>
        <span class="clip-card-time" title="${new Date(clip.createdAt).toLocaleString()}">${timeAgo}</span>
      </div>
    </div>
  `;
}

function toggleClipSelection(clipId, selected) {
  if (selected) {
    if (!selectedClipIds.includes(clipId)) {
      selectedClipIds.push(clipId);
    }
  } else {
    selectedClipIds = selectedClipIds.filter(id => id !== clipId);
  }

  document.querySelector(`.clip-card[data-id="${clipId}"]`)?.classList.toggle('selected', selected);
  updateSelectAllButton();
  updateOutlineButton();
}

function toggleSelectAll() {
  const allSelected = selectedClipIds.length === filteredClips.length && filteredClips.length > 0;
  
  if (allSelected) {
    selectedClipIds = [];
  } else {
    selectedClipIds = filteredClips.map(c => c.id);
  }

  document.querySelectorAll('.clip-card').forEach(card => {
    const clipId = card.dataset.id;
    const isSelected = selectedClipIds.includes(clipId);
    card.classList.toggle('selected', isSelected);
    card.querySelector('.clip-select').checked = isSelected;
  });

  updateSelectAllButton();
  updateOutlineButton();
}

function updateSelectAllButton() {
  const btn = document.getElementById('btn-select-all');
  const allSelected = selectedClipIds.length === filteredClips.length && filteredClips.length > 0;
  btn.innerHTML = allSelected ? `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <polyline points="9 11 12 14 22 4"/>
    </svg>
    取消全选
  ` : `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <polyline points="9 11 12 14 22 4"/>
    </svg>
    全选
  `;
}

function updateOutlineButton() {
  const btn = document.getElementById('btn-create-outline');
  btn.disabled = selectedClipIds.length < 2;
}

function openOutlineModal() {
  if (selectedClipIds.length < 2) {
    showToast('请至少选择2条资料', 'error');
    return;
  }

  outlineClips = filteredClips.filter(c => selectedClipIds.includes(c.id));
  currentOutlineId = null;

  document.getElementById('outline-title').value = '';
  renderOutlineItems();

  document.getElementById('outline-modal').style.display = 'flex';
}

function renderOutlineItems() {
  const container = document.getElementById('outline-items');

  if (outlineClips.length === 0) {
    container.innerHTML = '<p class="hint">请先选择要整理的资料</p>';
    return;
  }

  container.innerHTML = outlineClips.map((clip, index) => `
    <div class="outline-item" draggable="true" data-index="${index}" data-id="${clip.id}">
      <div class="drag-handle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="5" r="1"/>
          <circle cx="9" cy="12" r="1"/>
          <circle cx="9" cy="19" r="1"/>
          <circle cx="15" cy="5" r="1"/>
          <circle cx="15" cy="12" r="1"/>
          <circle cx="15" cy="19" r="1"/>
        </svg>
      </div>
      <div class="outline-item-content">
        <div class="outline-item-title">${escapeHtml(clip.title || '无标题')}</div>
        <div class="outline-item-source">${extractDomain(clip.url)}</div>
      </div>
      <button class="outline-item-remove" data-id="${clip.id}">移除</button>
    </div>
  `).join('');

  container.querySelectorAll('.outline-item').forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
  });

  container.querySelectorAll('.outline-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      outlineClips = outlineClips.filter(c => c.id !== id);
      selectedClipIds = selectedClipIds.filter(cid => cid !== id);
      renderOutlineItems();
      updateOutlineButton();
    });
  });
}

function handleDragStart(e) {
  draggedItem = e.target.closest('.outline-item');
  draggedItem.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.closest('.outline-item')?.classList.remove('dragging');
  document.querySelectorAll('.outline-item').forEach(item => {
    item.classList.remove('drag-over');
  });
  draggedItem = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.target.closest('.outline-item');
  if (item && item !== draggedItem) {
    item.classList.add('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const dropItem = e.target.closest('.outline-item');
  if (!dropItem || !draggedItem || dropItem === draggedItem) return;

  const draggedIndex = parseInt(draggedItem.dataset.index);
  const dropIndex = parseInt(dropItem.dataset.index);

  const [removed] = outlineClips.splice(draggedIndex, 1);
  outlineClips.splice(dropIndex, 0, removed);

  renderOutlineItems();
}

async function saveOutline() {
  const title = document.getElementById('outline-title').value.trim();
  if (!title) {
    showToast('请输入提纲标题', 'error');
    return;
  }

  if (outlineClips.length < 2) {
    showToast('至少需要2条资料', 'error');
    return;
  }

  try {
    const clipIds = outlineClips.map(c => c.id);
    const response = await sendMessage('createOutline', { title, clipIds });
    
    if (response.success) {
      currentOutlineId = response.outline.id;
      showToast('提纲保存成功！', 'success');
      closeModals();
      
      await generateMarkdown();
    }
  } catch (e) {
    console.error('Save outline error:', e);
    showToast('保存失败', 'error');
  }
}

async function generateMarkdown() {
  const title = document.getElementById('outline-title').value.trim();
  if (!title || outlineClips.length < 2) {
    showToast('请先填写标题并选择资料', 'error');
    return;
  }

  let md = `# ${title}\n\n`;
  outlineClips.forEach((clip, index) => {
    md += `## ${index + 1}. ${clip.title || '无标题'}\n\n`;
    if (clip.content) {
      md += `${clip.content}\n\n`;
    }
    if (clip.notes) {
      md += `> 批注: ${clip.notes}\n\n`;
    }
    try {
      const domain = new URL(clip.url).hostname;
      md += `> 来源: [${domain}](${clip.url})\n\n`;
    } catch {
      md += `> 来源: ${clip.url}\n\n`;
    }
  });

  document.getElementById('markdown-preview').textContent = md;
  document.getElementById('outline-modal').style.display = 'none';
  document.getElementById('markdown-modal').style.display = 'flex';
}

function copyMarkdown() {
  const md = document.getElementById('markdown-preview').textContent;
  if (md) {
    navigator.clipboard.writeText(md);
    showToast('Markdown 已复制到剪贴板', 'success');
  }
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
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
    return 'unknown';
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

function getCredibilityLabel(value) {
  const labels = {
    high: '高可信度',
    neutral: '一般',
    low: '待验证',
    unreliable: '不可靠'
  };
  return labels[value] || value;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
