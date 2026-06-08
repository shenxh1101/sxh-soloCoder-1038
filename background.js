const STORAGE_KEYS = {
  CLIPS: 'kv_clips',
  TAGS: 'kv_tags',
  READ_LATER: 'kv_read_later',
  SETTINGS: 'kv_settings',
  REVIEW_REMINDERS: 'kv_review_reminders',
  OUTLINES: 'kv_outlines',
  HIGHLIGHTS: 'kv_highlights',
  PROJECT_SETS: 'kv_project_sets'
};

const TOPICS = [
  { id: 'academic', name: '学术研究', icon: '📚' },
  { id: 'news', name: '新闻资讯', icon: '📰' },
  { id: 'tech', name: '技术资料', icon: '💻' },
  { id: 'product', name: '产品文档', icon: '📋' },
  { id: 'design', name: '设计参考', icon: '🎨' },
  { id: 'marketing', name: '营销素材', icon: '📣' },
  { id: 'other', name: '其他资料', icon: '📁' }
];

const DEFAULT_SETTINGS = {
  highlightColor: '#fff59d',
  autoSave: true,
  citationFormat: 'apa',
  reviewInterval: 7,
  sidebarWidth: 400
};

class StorageManager {
  static async get(key, defaultValue = null) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? defaultValue;
  }

  static async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  static async remove(key) {
    await chrome.storage.local.remove(key);
  }
}

class ClipManager {
  static async getAll() {
    return await StorageManager.get(STORAGE_KEYS.CLIPS, []);
  }

  static async save(clip) {
    const clips = await this.getAll();
    
    if (clip.topic) {
      clip.topic = TopicManager.getTopicName(clip.topic);
    }
    
    const newClip = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      ...clip,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      highlights: clip.highlights || [],
      tags: clip.tags || [],
      credibility: clip.credibility || 'neutral',
      notes: clip.notes || '',
      topic: clip.topic || '',
      isReadLater: false
    };
    
    if (newClip.tags && newClip.tags.length > 0) {
      for (const tag of newClip.tags) {
        await TagManager.ensureTagExists(tag);
      }
    }
    
    clips.unshift(newClip);
    await StorageManager.set(STORAGE_KEYS.CLIPS, clips);
    return newClip;
  }

  static async update(id, updates) {
    const clips = await this.getAll();
    const index = clips.findIndex(c => c.id === id);
    if (index !== -1) {
      if (updates.tags && updates.tags.length > 0) {
        for (const tag of updates.tags) {
          await TagManager.ensureTagExists(tag);
        }
      }
      if (updates.topic) {
        updates.topic = TopicManager.getTopicName(updates.topic);
      }
      clips[index] = {
        ...clips[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await StorageManager.set(STORAGE_KEYS.CLIPS, clips);
      return clips[index];
    }
    return null;
  }

  static async delete(id) {
    const clips = await this.getAll();
    const filtered = clips.filter(c => c.id !== id);
    await StorageManager.set(STORAGE_KEYS.CLIPS, filtered);
    return filtered;
  }

  static async addHighlight(clipId, highlight) {
    const clip = await this.getById(clipId);
    if (clip) {
      clip.highlights.push({
        id: Date.now().toString(36),
        ...highlight,
        createdAt: new Date().toISOString()
      });
      return await this.update(clipId, { highlights: clip.highlights });
    }
    return null;
  }

  static async addTag(clipId, tag) {
    const clip = await this.getById(clipId);
    if (clip) {
      if (!clip.tags.includes(tag)) {
        clip.tags.push(tag);
        await TagManager.ensureTagExists(tag);
      }
      return await this.update(clipId, { tags: clip.tags });
    }
    return null;
  }

  static async getById(id) {
    const clips = await this.getAll();
    return clips.find(c => c.id === id);
  }

  static async search({ keyword = '', tags = [], source = '', dateRange = null, credibility = null } = {}) {
    let clips = await this.getAll();
    
    if (keyword) {
      const kw = keyword.toLowerCase();
      clips = clips.filter(c => 
        c.title?.toLowerCase().includes(kw) ||
        c.content?.toLowerCase().includes(kw) ||
        c.notes?.toLowerCase().includes(kw) ||
        c.url?.toLowerCase().includes(kw)
      );
    }
    
    if (tags && tags.length > 0) {
      clips = clips.filter(c => tags.some(t => c.tags.includes(t)));
    }
    
    if (source) {
      clips = clips.filter(c => {
        try {
          return new URL(c.url).hostname.includes(source);
        } catch {
          return false;
        }
      });
    }
    
    if (dateRange) {
      const { start, end } = dateRange;
      clips = clips.filter(c => {
        const date = new Date(c.createdAt);
        return (!start || date >= new Date(start)) && (!end || date <= new Date(end));
      });
    }
    
    if (credibility) {
      clips = clips.filter(c => c.credibility === credibility);
    }
    
    return clips;
  }

  static async markAsReadLater(id, isReadLater = true) {
    return await this.update(id, { isReadLater });
  }

  static async getReadLater() {
    const clips = await this.getAll();
    return clips.filter(c => c.isReadLater);
  }
}

class TagManager {
  static async getAll() {
    return await StorageManager.get(STORAGE_KEYS.TAGS, []);
  }

  static async ensureTagExists(tagName) {
    const tags = await this.getAll();
    if (!tags.find(t => t.name === tagName)) {
      tags.push({
        id: Date.now().toString(36),
        name: tagName,
        color: this.generateTagColor(),
        createdAt: new Date().toISOString()
      });
      await StorageManager.set(STORAGE_KEYS.TAGS, tags);
    }
    return tags;
  }

  static generateTagColor() {
    const colors = [
      '#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0',
      '#ffebee', '#e0f7fa', '#fce4ec', '#f1f8e9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  static async updateTagColor(tagName, color) {
    const tags = await this.getAll();
    const tag = tags.find(t => t.name === tagName);
    if (tag) {
      tag.color = color;
      await StorageManager.set(STORAGE_KEYS.TAGS, tags);
    }
    return tags;
  }

  static async deleteTag(tagName) {
    const tags = await this.getAll();
    const filtered = tags.filter(t => t.name !== tagName);
    await StorageManager.set(STORAGE_KEYS.TAGS, filtered);
    
    const clips = await ClipManager.getAll();
    for (const clip of clips) {
      clip.tags = clip.tags.filter(t => t !== tagName);
    }
    await StorageManager.set(STORAGE_KEYS.CLIPS, clips);
    
    return filtered;
  }
}

class ReviewReminderManager {
  static async setReminder(clipId, remindAt) {
    const reminders = await StorageManager.get(STORAGE_KEYS.REVIEW_REMINDERS, []);
    const existing = reminders.find(r => r.clipId === clipId);
    
    if (existing) {
      existing.remindAt = remindAt;
    } else {
      reminders.push({
        id: Date.now().toString(36),
        clipId,
        remindAt,
        createdAt: new Date().toISOString()
      });
    }
    
    await StorageManager.set(STORAGE_KEYS.REVIEW_REMINDERS, reminders);
    this.scheduleAlarm(remindAt, clipId);
    return reminders;
  }

  static scheduleAlarm(remindAt, clipId) {
    const when = new Date(remindAt).getTime();
    chrome.alarms.create(`review_${clipId}`, { when });
  }

  static async checkDueReminders() {
    const now = new Date().toISOString();
    const reminders = await StorageManager.get(STORAGE_KEYS.REVIEW_REMINDERS, []);
    return reminders.filter(r => r.remindAt <= now);
  }

  static async dismissReminder(clipId) {
    const reminders = await StorageManager.get(STORAGE_KEYS.REVIEW_REMINDERS, []);
    const filtered = reminders.filter(r => r.clipId !== clipId);
    await StorageManager.set(STORAGE_KEYS.REVIEW_REMINDERS, filtered);
    chrome.alarms.clear(`review_${clipId}`);
    return filtered;
  }
}

class CitationManager {
  static generateCitation(clip, format = 'apa') {
    const author = clip.author || '佚名';
    const year = clip.publishedDate 
      ? new Date(clip.publishedDate).getFullYear() 
      : new Date(clip.createdAt).getFullYear();
    const title = clip.title || '无标题';
    const url = clip.url;
    
    switch (format) {
      case 'apa':
        return `${author}. (${year}). ${title}. ${url}`;
      case 'mla':
        return `${author}. "${title}." ${new Date(clip.createdAt).toLocaleDateString()}, ${url}`;
      case 'chicago':
        return `${author}. "${title}." ${year}. ${url}.`;
      case 'gb7714':
        return `${author}. ${title}[EB/OL]. (${year}). ${url}`;
      default:
        return `${title} - ${author} (${year}) ${url}`;
    }
  }

  static generateSummary(clip) {
    const content = clip.content || '';
    if (content.length <= 200) return content;
    
    const sentences = content.match(/[^。！？.!?]+[。！？.!?]?/g) || [];
    const summarySentences = sentences.slice(0, 3);
    return summarySentences.join('').substring(0, 200) + '...';
  }

  static getSourceInfo(clip) {
    try {
      const urlObj = new URL(clip.url);
      return {
        domain: urlObj.hostname,
        protocol: urlObj.protocol,
        path: urlObj.pathname,
        fullUrl: clip.url
      };
    } catch {
      return { domain: 'unknown', fullUrl: clip.url };
    }
  }
}

class HighlightManager {
  static async getAll() {
    return await StorageManager.get(STORAGE_KEYS.HIGHLIGHTS, []);
  }

  static async save(highlight) {
    const highlights = await this.getAll();
    const newHighlight = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      ...highlight,
      createdAt: new Date().toISOString()
    };
    highlights.push(newHighlight);
    await StorageManager.set(STORAGE_KEYS.HIGHLIGHTS, highlights);
    return newHighlight;
  }

  static async getByUrl(url) {
    const highlights = await this.getAll();
    const normalizedUrl = this.normalizeUrl(url);
    return highlights.filter(h => this.normalizeUrl(h.url) === normalizedUrl);
  }

  static normalizeUrl(url) {
    try {
      const u = new URL(url);
      u.hash = '';
      u.search = '';
      return u.toString();
    } catch {
      return url;
    }
  }

  static async delete(id) {
    const highlights = await this.getAll();
    const filtered = highlights.filter(h => h.id !== id);
    await StorageManager.set(STORAGE_KEYS.HIGHLIGHTS, filtered);
    return filtered;
  }
}

class TopicManager {
  static getAll() {
    return TOPICS;
  }

  static getTopicById(id) {
    return TOPICS.find(t => t.id === id);
  }

  static getTopicByName(name) {
    return TOPICS.find(t => t.name === name);
  }

  static getTopicName(topicIdOrName) {
    const topic = this.getTopicById(topicIdOrName) || this.getTopicByName(topicIdOrName);
    return topic ? topic.name : topicIdOrName;
  }

  static getTopicIcon(topicIdOrName) {
    const topic = this.getTopicById(topicIdOrName) || this.getTopicByName(topicIdOrName);
    return topic ? topic.icon : '📁';
  }
}

class ProjectSetManager {
  static async getAll() {
    return await StorageManager.get(STORAGE_KEYS.PROJECT_SETS, []);
  }

  static async getById(id) {
    const sets = await this.getAll();
    return sets.find(s => s.id === id);
  }

  static async create(name, description = '', notes = '') {
    const sets = await this.getAll();
    const newSet = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      name,
      description,
      clipIds: [],
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    sets.unshift(newSet);
    await StorageManager.set(STORAGE_KEYS.PROJECT_SETS, sets);
    return newSet;
  }

  static async update(id, updates) {
    const sets = await this.getAll();
    const index = sets.findIndex(s => s.id === id);
    if (index !== -1) {
      sets[index] = {
        ...sets[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await StorageManager.set(STORAGE_KEYS.PROJECT_SETS, sets);
      return sets[index];
    }
    return null;
  }

  static async delete(id) {
    const sets = await this.getAll();
    const filtered = sets.filter(s => s.id !== id);
    await StorageManager.set(STORAGE_KEYS.PROJECT_SETS, filtered);
    return filtered;
  }

  static async addClips(setId, clipIds) {
    const set = await this.getById(setId);
    if (set) {
      const newClipIds = [...new Set([...set.clipIds, ...clipIds])];
      return await this.update(setId, { clipIds: newClipIds });
    }
    return null;
  }

  static async removeClip(setId, clipId) {
    const set = await this.getById(setId);
    if (set) {
      const newClipIds = set.clipIds.filter(id => id !== clipId);
      return await this.update(setId, { clipIds: newClipIds });
    }
    return null;
  }

  static async reorderClips(setId, clipIds) {
    return await this.update(setId, { clipIds });
  }

  static async generateSummary(setId) {
    const set = await this.getById(setId);
    if (!set) return '';

    const clips = await ClipManager.getAll();
    const setClips = set.clipIds
      .map(id => clips.find(c => c.id === id))
      .filter(Boolean);

    let md = `# ${set.name}\n\n`;
    if (set.description) {
      md += `> ${set.description}\n\n`;
    }
    if (set.notes) {
      md += `## 项目备注\n\n${set.notes}\n\n`;
    }
    md += `---\n\n`;
    md += `## 资料汇总 (${setClips.length} 条)\n\n`;

    setClips.forEach((clip, index) => {
      md += `### ${index + 1}. ${clip.title}\n\n`;
      if (clip.content) {
        md += `${clip.content}\n\n`;
      }
      if (clip.notes) {
        md += `**批注**: ${clip.notes}\n\n`;
      }
      md += `**来源**: [${clip.url}](${clip.url})\n\n`;
      md += `---\n\n`;
    });

    return md;
  }
}

class OutlineManager {
  static async getAll() {
    return await StorageManager.get(STORAGE_KEYS.OUTLINES, []);
  }

  static async createOutline(title, clipIds) {
    const outlines = await this.getAll();
    const clips = await ClipManager.getAll();
    const selectedClips = clips.filter(c => clipIds.includes(c.id));
    
    const outline = {
      id: Date.now().toString(36),
      title,
      clipIds,
      clips: selectedClips.map(c => ({
        id: c.id,
        title: c.title,
        content: c.content,
        order: 0
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    outlines.unshift(outline);
    await StorageManager.set(STORAGE_KEYS.OUTLINES, outlines);
    return outline;
  }

  static async updateOutline(id, updates) {
    const outlines = await this.getAll();
    const index = outlines.findIndex(o => o.id === id);
    if (index !== -1) {
      outlines[index] = {
        ...outlines[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await StorageManager.set(STORAGE_KEYS.OUTLINES, outlines);
      return outlines[index];
    }
    return null;
  }

  static async generateMarkdown(outlineId) {
    const outlines = await this.getAll();
    const outline = outlines.find(o => o.id === outlineId);
    if (!outline) return '';
    
    let md = `# ${outline.title}\n\n`;
    outline.clips.forEach((clip, index) => {
      md += `## ${index + 1}. ${clip.title}\n\n`;
      md += `${clip.content}\n\n`;
      const source = CitationManager.getSourceInfo(clip);
      md += `> 来源: [${source.domain}](${source.fullUrl})\n\n`;
    });
    
    return md;
  }
}

async function captureScreenshot() {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      resolve(dataUrl || null);
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await StorageManager.get(STORAGE_KEYS.SETTINGS, null);
  if (!settings) {
    await StorageManager.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
  
  chrome.contextMenus.create({
    id: 'save-selection',
    title: '剪藏选中内容到 Knowledge Vault',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'save-page',
    title: '剪藏当前页面到 Knowledge Vault',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'save-image',
    title: '剪藏图片到 Knowledge Vault',
    contexts: ['image']
  });
  
  chrome.contextMenus.create({
    id: 'read-later',
    title: '添加到稍后阅读',
    contexts: ['page', 'link']
  });
  
  chrome.contextMenus.create({
    id: 'add-tag',
    title: '添加标签',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'save-selection':
      await handleQuickSave(tab, info.selectionText);
      break;
    case 'save-page':
      await handleQuickSave(tab);
      break;
    case 'save-image':
      await handleQuickSave(tab, null, info.srcUrl);
      break;
    case 'read-later':
      await handleReadLater(tab);
      break;
  }
});

async function handleQuickSave(tab, selectionText = null, imageUrl = null) {
  const clip = {
    title: tab.title,
    url: tab.url,
    content: selectionText || '',
    image: imageUrl || null,
    favicon: tab.favIconUrl || null
  };
  
  if (!clip.content && !clip.image) {
    const screenshot = await captureScreenshot();
    clip.screenshot = screenshot;
  }
  
  const savedClip = await ClipManager.save(clip);
  showNotification('剪藏成功', `"${clip.title}" 已保存到知识库`);
  return savedClip;
}

async function handleReadLater(tab) {
  const existingClips = await ClipManager.search({ source: new URL(tab.url).hostname });
  let clip = existingClips.find(c => c.url === tab.url);
  
  if (!clip) {
    clip = await ClipManager.save({
      title: tab.title,
      url: tab.url,
      content: '',
      favicon: tab.favIconUrl
    });
  }
  
  await ClipManager.markAsReadLater(clip.id, true);
  showNotification('已添加到稍后阅读', `"${tab.title}"`);
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message
  });
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  try {
    switch (command) {
      case 'save-clip':
        await handleQuickSave(tab);
        break;
      case 'toggle-sidebar':
        const currentWindow = tab ? tab.windowId : (await chrome.windows.getCurrent()).id;
        chrome.sidePanel.open({ windowId: currentWindow });
        break;
      case 'read-later':
        await handleReadLater(tab);
        break;
    }
  } catch (e) {
    console.error('Command error:', e);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('review_')) {
    const clipId = alarm.name.replace('review_', '');
    const clip = await ClipManager.getById(clipId);
    if (clip) {
      showNotification('复习提醒', `是时候复习 "${clip.title}" 了`);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'saveClip':
          const savedClip = await ClipManager.save(request.clip);
          sendResponse({ success: true, clip: savedClip });
          break;
        case 'getClips':
          const clips = await ClipManager.getAll();
          sendResponse({ success: true, clips });
          break;
        case 'searchClips':
          const results = await ClipManager.search(request.filters);
          sendResponse({ success: true, clips: results });
          break;
        case 'updateClip':
          const updated = await ClipManager.update(request.id, request.updates);
          sendResponse({ success: true, clip: updated });
          break;
        case 'deleteClip':
          await ClipManager.delete(request.id);
          sendResponse({ success: true });
          break;
        case 'addTag':
          const withTag = await ClipManager.addTag(request.clipId, request.tag);
          sendResponse({ success: true, clip: withTag });
          break;
        case 'getTags':
          const tags = await TagManager.getAll();
          sendResponse({ success: true, tags });
          break;
        case 'deleteTag':
          await TagManager.deleteTag(request.tagName);
          sendResponse({ success: true });
          break;
        case 'captureScreenshot':
          const screenshot = await captureScreenshot();
          sendResponse({ success: true, dataUrl: screenshot });
          break;
        case 'generateCitation':
          const citation = CitationManager.generateCitation(request.clip, request.format);
          sendResponse({ success: true, citation });
          break;
        case 'generateSummary':
          const summary = CitationManager.generateSummary(request.clip);
          sendResponse({ success: true, summary });
          break;
        case 'setReviewReminder':
          await ReviewReminderManager.setReminder(request.clipId, request.remindAt);
          sendResponse({ success: true });
          break;
        case 'markAsReadLater':
          await ClipManager.markAsReadLater(request.clipId, request.isReadLater);
          sendResponse({ success: true });
          break;
        case 'getReadLater':
          const readLater = await ClipManager.getReadLater();
          sendResponse({ success: true, clips: readLater });
          break;
        case 'createOutline':
          const outline = await OutlineManager.createOutline(request.title, request.clipIds);
          sendResponse({ success: true, outline });
          break;
        case 'getOutlines':
          const outlines = await OutlineManager.getAll();
          sendResponse({ success: true, outlines });
          break;
        case 'generateMarkdown':
          const md = await OutlineManager.generateMarkdown(request.outlineId);
          sendResponse({ success: true, markdown: md });
          break;
        case 'getSourceInfo':
          const sourceInfo = CitationManager.getSourceInfo(request.clip);
          sendResponse({ success: true, sourceInfo });
          break;
        case 'saveHighlight':
          const savedHighlight = await HighlightManager.save(request.highlight);
          sendResponse({ success: true, highlight: savedHighlight });
          break;
        case 'getHighlightsByUrl':
          const urlHighlights = await HighlightManager.getByUrl(request.url);
          sendResponse({ success: true, highlights: urlHighlights });
          break;
        case 'deleteHighlight':
          await HighlightManager.delete(request.id);
          sendResponse({ success: true });
          break;
        case 'getSettings':
          const settings = await StorageManager.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
          sendResponse({ success: true, settings });
          break;
        case 'updateSettings':
          await StorageManager.set(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...request.settings });
          sendResponse({ success: true });
          break;
        case 'openSidePanel':
          const windowId = request.windowId || (await chrome.windows.getCurrent()).id;
          chrome.sidePanel.open({ windowId });
          sendResponse({ success: true });
          break;
        case 'openPopup':
          chrome.action.openPopup();
          sendResponse({ success: true });
          break;
        case 'getTopics':
          const topics = TopicManager.getAll();
          sendResponse({ success: true, topics });
          break;
        case 'getTopicInfo':
          const topicInfo = TopicManager.getTopicById(request.topicId) || TopicManager.getTopicByName(request.topicId);
          sendResponse({ success: true, topic: topicInfo });
          break;
        case 'getProjectSets':
          const projectSets = await ProjectSetManager.getAll();
          sendResponse({ success: true, projectSets });
          break;
        case 'getProjectSet':
          const projectSet = await ProjectSetManager.getById(request.id);
          sendResponse({ success: true, projectSet });
          break;
        case 'createProjectSet':
          const newSet = await ProjectSetManager.create(request.name, request.description, request.notes);
          sendResponse({ success: true, projectSet: newSet });
          break;
        case 'updateProjectSet':
          const updatedSet = await ProjectSetManager.update(request.id, request.updates);
          sendResponse({ success: true, projectSet: updatedSet });
          break;
        case 'deleteProjectSet':
          await ProjectSetManager.delete(request.id);
          sendResponse({ success: true });
          break;
        case 'addClipsToProjectSet':
          const setWithClips = await ProjectSetManager.addClips(request.setId, request.clipIds);
          sendResponse({ success: true, projectSet: setWithClips });
          break;
        case 'removeClipFromProjectSet':
          const setWithoutClip = await ProjectSetManager.removeClip(request.setId, request.clipId);
          sendResponse({ success: true, projectSet: setWithoutClip });
          break;
        case 'reorderProjectSetClips':
          const reorderedSet = await ProjectSetManager.reorderClips(request.setId, request.clipIds);
          sendResponse({ success: true, projectSet: reorderedSet });
          break;
        case 'generateProjectSetSummary':
          const setSummary = await ProjectSetManager.generateSummary(request.setId);
          sendResponse({ success: true, markdown: setSummary });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true;
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
