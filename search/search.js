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
let currentSubTab = 'search';
let projectSets = [];
let currentProjectSet = null;
let selectedProjectId = null;
let currentDetailClip = null;
let detailEditMode = false;

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
  loadData();
  setupEventListeners();
  setupSubTabs();
  setupDetailPanel();
}

async function loadData() {
  try {
    const clipsResponse = await sendMessage('getClips');
    if (clipsResponse.success) {
      allClips = clipsResponse.clips;
      filteredClips = [...allClips];
      renderFilters();
      renderClips();
    }
    
    await loadProjectSets();
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

  document.getElementById('btn-create-project').addEventListener('click', () => {
    currentProjectSet = null;
    document.getElementById('project-modal-title').textContent = '新建项目集';
    document.getElementById('project-name').value = '';
    document.getElementById('project-description').value = '';
    document.getElementById('project-notes').value = '';
    document.getElementById('project-modal').style.display = 'flex';
  });

  document.getElementById('btn-save-project').addEventListener('click', saveProjectSet);
  document.getElementById('btn-edit-project').addEventListener('click', () => editProjectSet(currentProjectSet));
  document.getElementById('btn-back-to-projects').addEventListener('click', closeProjectSetDetail);
  document.getElementById('btn-generate-project-summary').addEventListener('click', () => generateProjectSummary(currentProjectSet.id));

  document.getElementById('btn-add-to-project').addEventListener('click', openAddToProjectModal);
  document.getElementById('btn-create-project-inline').addEventListener('click', () => {
    closeModals();
    document.getElementById('btn-create-project').click();
  });
  document.getElementById('btn-confirm-add-to-project').addEventListener('click', () => {
    if (selectedProjectId && selectedClipIds.length > 0) {
      addClipsToProject(selectedProjectId, selectedClipIds);
    }
  });
}

function setupSubTabs() {
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.subTab;
      switchSubTab(tab);
    });
  });
}

function switchSubTab(tab) {
  currentSubTab = tab;

  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subTab === tab);
  });

  document.querySelectorAll('.sub-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `sub-tab-${tab}`);
  });

  if (tab === 'projects') {
    loadProjectSets();
  } else if (tab === 'outlines') {
    loadOutlines();
  }
}

function setupDetailPanel() {
  document.getElementById('btn-close-detail').addEventListener('click', closeDetailModal);
  document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') {
      closeDetailModal();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('detail-modal').style.display === 'flex') {
      closeDetailModal();
    }
  });
}

function showClipDetail(clip) {
  currentDetailClip = clip;
  detailEditMode = false;
  const modal = document.getElementById('detail-modal');

  renderDetailBody(clip, false);
  modal.style.display = 'flex';
}

function closeDetailModal() {
  const modal = document.getElementById('detail-modal');
  modal.style.display = 'none';
  currentDetailClip = null;
  detailEditMode = false;
}

function renderDetailBody(clip, isEditing) {
  const body = document.getElementById('detail-body');
  const title = document.getElementById('detail-title');
  const domain = extractDomain(clip.url);

  title.textContent = isEditing ? '编辑资料' : '资料详情';

  const credibilityOptions = [
    { value: 'high', label: '高可信度' },
    { value: 'neutral', label: '一般' },
    { value: 'low', label: '待验证' },
    { value: 'unreliable', label: '不可靠' }
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
          ${TOPICS.map(t => `<option value="${t.name}" ${clip.topic === t.name ? 'selected' : ''}>${t.icon} ${escapeHtml(t.name)}</option>`).join('')}
        </select>
      </div>
      <div class="detail-section">
        <label class="detail-label">可信度</label>
        <select class="select" id="detail-edit-credibility">
          ${credibilityOptions.map(opt => `<option value="${opt.value}" ${clip.credibility === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
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
        <span class="credibility-badge credibility-${clip.credibility}">${escapeHtml(credibilityLabels[clip.credibility] || '一般')}</span>
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
      if (clip.url) window.open(clip.url, '_blank');
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

      await loadData();
    }
  } catch (e) {
    console.error('Save detail edits error:', e);
    showToast('保存失败', 'error');
  }
}

async function loadProjectSets() {
  try {
    const response = await sendMessage('getProjectSets');
    if (response.success) {
      projectSets = response.projectSets;
      renderProjectSets();
    }
  } catch (e) {
    console.error('Load project sets error:', e);
    showToast('加载项目集失败', 'error');
  }
}

function renderProjectSets() {
  const grid = document.getElementById('projects-grid');
  const emptyState = document.getElementById('projects-empty-state');
  const countEl = document.getElementById('projects-count');
  const detailView = document.getElementById('project-detail-view');

  if (currentProjectSet) {
    detailView.style.display = 'block';
    grid.style.display = 'none';
    emptyState.style.display = 'none';
    return;
  }

  detailView.style.display = 'none';
  countEl.textContent = projectSets.length;

  if (projectSets.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.style.display = 'grid';

  grid.innerHTML = projectSets.map(set => `
    <div class="project-card" data-id="${set.id}">
      <div class="project-card-header">
        <h3 class="project-card-title">${escapeHtml(set.name)}</h3>
        <div class="project-card-actions">
          <button class="icon-btn project-edit-btn" data-id="${set.id}" title="编辑">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="icon-btn project-delete-btn" data-id="${set.id}" title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      ${set.description ? `<p class="project-card-desc">${escapeHtml(set.description)}</p>` : ''}
      <div class="project-card-meta">
        <span class="project-card-count">📋 ${set.clipIds.length} 条资料</span>
        <span class="project-card-date">${new Date(set.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.project-edit-btn') && !e.target.closest('.project-delete-btn')) {
        const id = card.dataset.id;
        const projectSet = projectSets.find(s => s.id === id);
        if (projectSet) {
          openProjectSet(projectSet);
        }
      }
    });
  });

  grid.querySelectorAll('.project-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const projectSet = projectSets.find(s => s.id === id);
      if (projectSet) {
        editProjectSet(projectSet);
      }
    });
  });

  grid.querySelectorAll('.project-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteProjectSet(id);
    });
  });
}

function createProjectSet() {
  const name = document.getElementById('project-name').value.trim();
  const description = document.getElementById('project-description').value.trim();
  const notes = document.getElementById('project-notes').value.trim();

  if (!name) {
    showToast('请输入项目集名称', 'error');
    return;
  }

  return { name, description, notes };
}

async function openProjectSet(projectSet) {
  currentProjectSet = projectSet;

  try {
    const response = await sendMessage('getProjectSet', { id: projectSet.id });
    if (response.success) {
      currentProjectSet = response.projectSet;
    }
  } catch (e) {
    console.error('Get project set error:', e);
  }

  document.getElementById('project-detail-title').textContent = currentProjectSet.name;
  document.getElementById('project-detail-notes').textContent = currentProjectSet.notes || '暂无备注';
  document.getElementById('project-detail-count').textContent = currentProjectSet.clipIds.length;

  renderProjectClipsList(currentProjectSet);
  renderProjectSets();
}

function closeProjectSetDetail() {
  currentProjectSet = null;
  renderProjectSets();
}

function renderProjectClipsList(projectSet) {
  const container = document.getElementById('project-clips-list');
  const clips = projectSet.clipIds
    .map(id => allClips.find(c => c.id === id))
    .filter(Boolean);

  if (clips.length === 0) {
    container.innerHTML = '<p class="hint">项目集为空，去搜索页面添加资料吧</p>';
    return;
  }

  container.innerHTML = clips.map((clip, index) => `
    <div class="project-clip-item" draggable="true" data-id="${clip.id}" data-index="${index}">
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
      <div class="project-clip-content">
        <div class="project-clip-title">${escapeHtml(clip.title || '无标题')}</div>
        <div class="project-clip-source">${extractDomain(clip.url)}</div>
      </div>
      <button class="project-clip-remove" data-id="${clip.id}">移除</button>
    </div>
  `).join('');

  container.querySelectorAll('.project-clip-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', (e) => {
      e.target.closest('.project-clip-item')?.classList.remove('dragging');
      document.querySelectorAll('.project-clip-item').forEach(i => {
        i.classList.remove('drag-over');
      });
      draggedItem = null;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.project-clip-item');
      if (target && target !== draggedItem) {
        target.classList.add('drag-over');
      }
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropItem = e.target.closest('.project-clip-item');
      if (!dropItem || !draggedItem || dropItem === draggedItem) return;

      const draggedIndex = parseInt(draggedItem.dataset.index);
      const dropIndex = parseInt(dropItem.dataset.index);

      const newOrder = [...currentProjectSet.clipIds];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(dropIndex, 0, removed);

      reorderProjectClips(newOrder);
    });

    item.addEventListener('click', () => {
      const clip = allClips.find(c => c.id === item.dataset.id);
      if (clip) {
        showClipDetail(clip);
      }
    });
  });

  container.querySelectorAll('.project-clip-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const clipId = btn.dataset.id;
      try {
        const response = await sendMessage('removeClipFromProjectSet', {
          setId: currentProjectSet.id,
          clipId
        });
        if (response.success) {
          currentProjectSet = response.projectSet;
          const projectIndex = projectSets.findIndex(s => s.id === currentProjectSet.id);
          if (projectIndex !== -1) {
            projectSets[projectIndex] = currentProjectSet;
          }
          document.getElementById('project-detail-count').textContent = currentProjectSet.clipIds.length;
          renderProjectClipsList(currentProjectSet);
          renderProjectSets();
          showToast('已移除资料', 'success');
        }
      } catch (e) {
        console.error('Remove clip error:', e);
        showToast('移除失败', 'error');
      }
    });
  });
}

async function saveProjectSet() {
  const data = createProjectSet();
  if (!data) return;

  try {
    if (currentProjectSet) {
      const response = await sendMessage('updateProjectSet', {
        id: currentProjectSet.id,
        updates: data
      });
      if (response.success) {
        currentProjectSet = response.projectSet;
        const projectIndex = projectSets.findIndex(s => s.id === currentProjectSet.id);
        if (projectIndex !== -1) {
          projectSets[projectIndex] = currentProjectSet;
        }
        showToast('项目集已更新', 'success');
        closeModals();
        await loadProjectSets();
        document.getElementById('project-detail-title').textContent = currentProjectSet.name;
        document.getElementById('project-detail-notes').textContent = currentProjectSet.notes || '暂无备注';
        document.getElementById('project-detail-count').textContent = currentProjectSet.clipIds.length;
      }
    } else {
      const response = await sendMessage('createProjectSet', data);
      if (response.success) {
        showToast('项目集创建成功', 'success');
        closeModals();
        await loadProjectSets();
      }
    }
  } catch (e) {
    console.error('Save project set error:', e);
    showToast('保存失败', 'error');
  }
}

function editProjectSet(projectSet) {
  currentProjectSet = projectSet;
  document.getElementById('project-modal-title').textContent = '编辑项目集';
  document.getElementById('project-name').value = projectSet.name || '';
  document.getElementById('project-description').value = projectSet.description || '';
  document.getElementById('project-notes').value = projectSet.notes || '';
  document.getElementById('project-modal').style.display = 'flex';
}

async function deleteProjectSet(id) {
  if (!confirm('确定要删除这个项目集吗？项目集内的资料不会被删除。')) return;

  try {
    const response = await sendMessage('deleteProjectSet', { id });
    if (response.success) {
      showToast('项目集已删除', 'success');
      if (currentProjectSet && currentProjectSet.id === id) {
        currentProjectSet = null;
      }
      await loadProjectSets();
    }
  } catch (e) {
    console.error('Delete project set error:', e);
    showToast('删除失败', 'error');
  }
}

function openAddToProjectModal() {
  if (selectedClipIds.length === 0) {
    showToast('请先选择要添加的资料', 'error');
    return;
  }

  document.getElementById('add-to-project-hint').textContent = `选择要添加到的项目集（共选中 ${selectedClipIds.length} 条资料）`;
  selectedProjectId = null;
  document.getElementById('btn-confirm-add-to-project').disabled = true;

  renderProjectSelectList();
  document.getElementById('add-to-project-modal').style.display = 'flex';
}

function renderProjectSelectList() {
  const container = document.getElementById('project-select-list');

  if (projectSets.length === 0) {
    container.innerHTML = '<p class="hint">还没有项目集，点击下方按钮新建</p>';
    return;
  }

  container.innerHTML = projectSets.map(set => `
    <div class="project-select-item ${selectedProjectId === set.id ? 'selected' : ''}" data-id="${set.id}">
      <div class="project-select-info">
        <div class="project-select-name">${escapeHtml(set.name)}</div>
        ${set.description ? `<div class="project-select-desc">${escapeHtml(set.description)}</div>` : ''}
      </div>
      <div class="project-select-count">${set.clipIds.length} 条</div>
    </div>
  `).join('');

  container.querySelectorAll('.project-select-item').forEach(item => {
    item.addEventListener('click', () => {
      selectedProjectId = item.dataset.id;
      container.querySelectorAll('.project-select-item').forEach(i => {
        i.classList.toggle('selected', i.dataset.id === selectedProjectId);
      });
      document.getElementById('btn-confirm-add-to-project').disabled = !selectedProjectId;
    });
  });
}

async function addClipsToProject(projectId, clipIds) {
  try {
    const response = await sendMessage('addClipsToProjectSet', {
      setId: projectId,
      clipIds
    });
    if (response.success) {
      const updatedProject = response.projectSet;
      const projectIndex = projectSets.findIndex(s => s.id === projectId);
      if (projectIndex !== -1) {
        projectSets[projectIndex] = updatedProject;
      }
      const project = projectSets.find(s => s.id === projectId);
      showToast(`已添加到「${project?.name || '项目集'}」`, 'success');
      closeModals();
      selectedClipIds = [];
      renderClips();
      await loadProjectSets();
    }
  } catch (e) {
    console.error('Add clips to project error:', e);
    showToast('添加失败', 'error');
  }
}

async function reorderProjectClips(newOrder) {
  try {
    const response = await sendMessage('reorderProjectSetClips', {
      setId: currentProjectSet.id,
      clipIds: newOrder
    });
    if (response.success) {
      currentProjectSet = response.projectSet;
      const projectIndex = projectSets.findIndex(s => s.id === currentProjectSet.id);
      if (projectIndex !== -1) {
        projectSets[projectIndex] = currentProjectSet;
      }
      renderProjectClipsList(currentProjectSet);
      renderProjectSets();
    }
  } catch (e) {
    console.error('Reorder clips error:', e);
  }
}

async function generateProjectSummary(projectId) {
  try {
    const response = await sendMessage('generateProjectSetSummary', { setId: projectId });
    if (response.success) {
      document.getElementById('markdown-preview').textContent = response.markdown;
      document.getElementById('markdown-modal').style.display = 'flex';
    }
  } catch (e) {
    console.error('Generate summary error:', e);
    showToast('生成汇总失败', 'error');
  }
}

async function loadOutlines() {
  try {
    const response = await sendMessage('getOutlines');
    if (response.success) {
      renderOutlines(response.outlines);
    }
  } catch (e) {
    console.error('Load outlines error:', e);
    showToast('加载提纲失败', 'error');
  }
}

function renderOutlines(outlines) {
  const container = document.getElementById('outlines-list');
  const emptyState = document.getElementById('outlines-empty-state');
  const countEl = document.getElementById('outlines-count');

  countEl.textContent = outlines.length;

  if (outlines.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = outlines.map(outline => `
    <div class="outline-card" data-id="${outline.id}">
      <div class="outline-card-header">
        <h3 class="outline-card-title">${escapeHtml(outline.title)}</h3>
        <span class="outline-card-count">${outline.clipIds.length} 条资料</span>
      </div>
      <div class="outline-card-meta">
        <span class="outline-card-date">${new Date(outline.createdAt).toLocaleString()}</span>
      </div>
      <div class="outline-card-actions">
        <button class="btn-outline small outline-view-btn" data-id="${outline.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          查看
        </button>
        <button class="btn-primary small outline-copy-btn" data-id="${outline.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          复制 Markdown
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.outline-view-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        const response = await sendMessage('generateMarkdown', { outlineId: id });
        if (response.success) {
          document.getElementById('markdown-preview').textContent = response.markdown;
          document.getElementById('markdown-modal').style.display = 'flex';
        }
      } catch (e) {
        console.error('View outline error:', e);
        showToast('加载提纲失败', 'error');
      }
    });
  });

  container.querySelectorAll('.outline-copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        const response = await sendMessage('generateMarkdown', { outlineId: id });
        if (response.success && response.markdown) {
          navigator.clipboard.writeText(response.markdown);
          showToast('Markdown 已复制到剪贴板', 'success');
        }
      } catch (e) {
        console.error('Copy outline error:', e);
        showToast('复制失败', 'error');
      }
    });
  });

  container.querySelectorAll('.outline-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.outline-view-btn') && !e.target.closest('.outline-copy-btn')) {
        card.querySelector('.outline-view-btn').click();
      }
    });
  });
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  topicsFilter.innerHTML = topics.map(topic => {
    const topicInfo = TOPICS.find(t => t.name === topic) || { icon: '📁' };
    return `
    <div class="topic-filter-item ${currentFilters.topics.includes(topic) ? 'active' : ''}" data-topic="${escapeHtml(topic)}">
      ${topicInfo.icon} ${escapeHtml(topic)}
      <span class="topic-count">${topicCounts[topic]}</span>
    </div>
  `}).join('');

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
        const clip = allClips.find(c => c.id === clipId);
        if (clip) {
          showClipDetail(clip);
        }
      }
    });
  });

  updateSelectAllButton();
  updateOutlineButton();
  updateAddToProjectButton();
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
    const topicInfo = TOPICS.find(t => t.name === clip.topic) || { icon: '📁' };
    topicBadge = `<span class="clip-card-topic">${topicInfo.icon} ${escapeHtml(clip.topic)}</span>`;
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
  updateAddToProjectButton();
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
  updateAddToProjectButton();
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

function updateAddToProjectButton() {
  const btn = document.getElementById('btn-add-to-project');
  btn.disabled = selectedClipIds.length === 0;
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
  draggedItem = e.target.closest('.outline-item, .project-clip-item');
  if (draggedItem) {
    draggedItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
}

function handleDragEnd(e) {
  e.target.closest('.outline-item, .project-clip-item')?.classList.remove('dragging');
  document.querySelectorAll('.outline-item, .project-clip-item').forEach(item => {
    item.classList.remove('drag-over');
  });
  draggedItem = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.target.closest('.outline-item, .project-clip-item');
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
    md += `## ${index + 1}. ${escapeHtml(clip.title || '无标题')}\n\n`;
    if (clip.content) {
      md += `${escapeHtml(clip.content)}\n\n`;
    }
    if (clip.notes) {
      md += `> 批注: ${escapeHtml(clip.notes)}\n\n`;
    }
    try {
      const domain = new URL(clip.url).hostname;
      md += `> 来源: [${escapeHtml(domain)}](${clip.url})\n\n`;
    } catch {
      md += `> 来源: ${escapeHtml(clip.url)}\n\n`;
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
  document.querySelectorAll('.modal, .detail-modal').forEach(modal => {
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
