/**
 * TaskFlow - Kanban Task Board Application
 * Pure Vanilla JavaScript implementation with LocalStorage persistence,
 * Drag-and-Drop, Realtime Metrics, Filtering, Search, and Import/Export.
 */

(() => {
  'use strict';

  // ==========================================================================
  // 1. Constants & Configuration
  // ==========================================================================
  const STORAGE_KEY = 'taskflow_tasks_data';
  const THEME_KEY = 'taskflow_theme_pref';

  const COLUMNS = [
    { id: 'todo', title: 'To Do' },
    { id: 'in-progress', title: 'In Progress' },
    { id: 'review', title: 'Under Review' },
    { id: 'completed', title: 'Completed' }
  ];

  const PRIORITY_MAP = {
    urgent: { rank: 4, label: 'Urgent', icon: '🔴', className: 'priority-urgent' },
    high: { rank: 3, label: 'High', icon: '🟠', className: 'priority-high' },
    medium: { rank: 2, label: 'Medium', icon: '🟡', className: 'priority-medium' },
    low: { rank: 1, label: 'Low', icon: '🟢', className: 'priority-low' }
  };

  // ==========================================================================
  // 2. Application State
  // ==========================================================================
  let state = {
    tasks: [],
    filter: {
      search: '',
      priority: 'all',
      tag: 'all',
      sortBy: 'created-desc'
    },
    editingTaskId: null,
    modalSubtasks: [],
    confirmAction: null,
    draggedTaskId: null
  };

  // ==========================================================================
  // 3. Storage Layer
  // ==========================================================================
  const Storage = {
    loadTasks() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.error('Error loading tasks from localStorage:', err);
        return [];
      }
    },

    saveTasks(tasks) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (err) {
        console.error('Error saving tasks to localStorage:', err);
        UI.showToast('Failed to save tasks to local storage.', 'danger');
      }
    },

    loadTheme() {
      return localStorage.getItem(THEME_KEY) || 'dark';
    },

    saveTheme(theme) {
      localStorage.setItem(THEME_KEY, theme);
    }
  };

  // ==========================================================================
  // 4. Helper Utilities
  // ==========================================================================
  const Utils = {
    generateId() {
      return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    },

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    formatDate(dateStr) {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return dateStr;
      }
    },

    getDueDateStatus(dateStr, isCompleted) {
      if (!dateStr || isCompleted) return null;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dateStr + 'T00:00:00');
        if (isNaN(due.getTime())) return null;

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          return { status: 'overdue', label: `Overdue by ${Math.abs(diffDays)}d` };
        } else if (diffDays === 0) {
          return { status: 'due-soon', label: 'Due today' };
        } else if (diffDays === 1) {
          return { status: 'due-soon', label: 'Due tomorrow' };
        } else if (diffDays <= 3) {
          return { status: 'due-soon', label: `Due in ${diffDays}d` };
        }
        return { status: 'normal', label: `Due ${Utils.formatDate(dateStr)}` };
      } catch {
        return null;
      }
    },

    isOverdue(dateStr, column) {
      if (!dateStr || column === 'completed') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(dateStr + 'T00:00:00');
      return !isNaN(due.getTime()) && due.getTime() < today.getTime();
    }
  };

  // ==========================================================================
  // 5. DOM Element References
  // ==========================================================================
  const DOM = {
    // Header & Actions
    btnOpenAddTask: document.getElementById('btn-open-add-task'),
    btnExportTasks: document.getElementById('btn-export-tasks'),
    btnImportTrigger: document.getElementById('btn-import-trigger'),
    fileImportTasks: document.getElementById('file-import-tasks'),
    btnClearBoard: document.getElementById('btn-clear-board'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    iconThemeDark: document.getElementById('icon-theme-dark'),
    iconThemeLight: document.getElementById('icon-theme-light'),

    // Metrics
    statTotal: document.getElementById('stat-total'),
    statProgress: document.getElementById('stat-progress'),
    statCompleted: document.getElementById('stat-completed'),
    statOverdue: document.getElementById('stat-overdue'),

    // Filter & Search Controls
    searchInput: document.getElementById('search-input'),
    filterPriority: document.getElementById('filter-priority'),
    filterTag: document.getElementById('filter-tag'),
    sortBy: document.getElementById('sort-by'),
    btnResetFilters: document.getElementById('btn-reset-filters'),

    // Board & Lists
    boardContainer: document.getElementById('board-container'),
    boardColumns: document.getElementById('board-columns'),
    lists: {
      'todo': document.getElementById('list-todo'),
      'in-progress': document.getElementById('list-in-progress'),
      'review': document.getElementById('list-review'),
      'completed': document.getElementById('list-completed')
    },
    counts: {
      'todo': document.getElementById('count-todo'),
      'in-progress': document.getElementById('count-in-progress'),
      'review': document.getElementById('count-review'),
      'completed': document.getElementById('count-completed')
    },

    // Task Modal
    taskModalOverlay: document.getElementById('task-modal-overlay'),
    taskForm: document.getElementById('task-form'),
    modalTitle: document.getElementById('modal-title'),
    btnCloseTaskModal: document.getElementById('btn-close-task-modal'),
    btnCancelTask: document.getElementById('btn-cancel-task'),
    btnSaveTask: document.getElementById('btn-save-task'),
    taskIdInput: document.getElementById('task-id'),
    taskTitleInput: document.getElementById('task-title-input'),
    taskDescInput: document.getElementById('task-desc-input'),
    taskColumnInput: document.getElementById('task-column-input'),
    taskPriorityInput: document.getElementById('task-priority-input'),
    taskDueInput: document.getElementById('task-due-input'),
    taskTagsInput: document.getElementById('task-tags-input'),

    // Subtasks Builder
    subtaskNewInput: document.getElementById('subtask-new-input'),
    btnAddSubtask: document.getElementById('btn-add-subtask'),
    subtaskListBuilder: document.getElementById('subtask-list-builder'),

    // Confirmation Modal
    confirmModalOverlay: document.getElementById('confirm-modal-overlay'),
    confirmModalTitle: document.getElementById('confirm-modal-title'),
    confirmModalDesc: document.getElementById('confirm-modal-desc'),
    btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
    btnConfirmProceed: document.getElementById('btn-confirm-proceed'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  // ==========================================================================
  // 6. UI & Rendering Engine
  // ==========================================================================
  const UI = {
    initTheme() {
      const savedTheme = Storage.loadTheme();
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.updateThemeIcons(savedTheme);
    },

    toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      Storage.saveTheme(next);
      this.updateThemeIcons(next);
      this.showToast(`Theme switched to ${next} mode`, 'info');
    },

    updateThemeIcons(theme) {
      if (DOM.iconThemeDark && DOM.iconThemeLight) {
        if (theme === 'dark') {
          DOM.iconThemeDark.style.display = 'block';
          DOM.iconThemeLight.style.display = 'none';
        } else {
          DOM.iconThemeDark.style.display = 'none';
          DOM.iconThemeLight.style.display = 'block';
        }
      }
    },

    showToast(message, type = 'info', duration = 3000) {
      if (!DOM.toastContainer) return;
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      
      let iconSvg = '';
      if (type === 'success') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      } else if (type === 'danger') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
      } else {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      }

      toast.innerHTML = `${iconSvg}<span>${Utils.escapeHtml(message)}</span>`;
      DOM.toastContainer.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.add('show');
      });

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }, duration);
    },

    updateTagFilterOptions() {
      const allTags = new Set();
      state.tasks.forEach(t => {
        if (Array.isArray(t.tags)) {
          t.tags.forEach(tag => tag && allTags.add(tag.trim()));
        }
      });

      const currentSelected = DOM.filterTag ? DOM.filterTag.value : 'all';
      if (DOM.filterTag) {
        DOM.filterTag.innerHTML = '<option value="all">All Tags</option>';
        Array.from(allTags).sort().forEach(tag => {
          const opt = document.createElement('option');
          opt.value = tag;
          opt.textContent = tag;
          if (tag === currentSelected) {
            opt.selected = true;
          }
          DOM.filterTag.appendChild(opt);
        });
      }
    },

    updateMetrics() {
      const total = state.tasks.length;
      const progressCount = state.tasks.filter(t => t.column === 'in-progress' || t.column === 'review').length;
      const completedCount = state.tasks.filter(t => t.column === 'completed').length;
      const overdueCount = state.tasks.filter(t => Utils.isOverdue(t.dueDate, t.column)).length;

      const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

      if (DOM.statTotal) DOM.statTotal.textContent = total;
      if (DOM.statProgress) DOM.statProgress.textContent = progressCount;
      if (DOM.statCompleted) DOM.statCompleted.textContent = `${completionRate}%`;
      if (DOM.statOverdue) DOM.statOverdue.textContent = overdueCount;
    },

    getFilteredTasks() {
      let result = [...state.tasks];

      // 1. Search Query
      if (state.filter.search) {
        const query = state.filter.search.toLowerCase().trim();
        result = result.filter(task => {
          const inTitle = task.title && task.title.toLowerCase().includes(query);
          const inDesc = task.description && task.description.toLowerCase().includes(query);
          const inTags = Array.isArray(task.tags) && task.tags.some(t => t.toLowerCase().includes(query));
          const inSubtasks = Array.isArray(task.subtasks) && task.subtasks.some(st => st.text && st.text.toLowerCase().includes(query));
          return inTitle || inDesc || inTags || inSubtasks;
        });
      }

      // 2. Priority Filter
      if (state.filter.priority !== 'all') {
        result = result.filter(task => task.priority === state.filter.priority);
      }

      // 3. Tag Filter
      if (state.filter.tag !== 'all') {
        result = result.filter(task => Array.isArray(task.tags) && task.tags.includes(state.filter.tag));
      }

      // 4. Sorting
      result.sort((a, b) => {
        switch (state.filter.sortBy) {
          case 'created-asc':
            return (a.createdAt || 0) - (b.createdAt || 0);
          case 'created-desc':
            return (b.createdAt || 0) - (a.createdAt || 0);
          case 'due-date': {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
          }
          case 'priority': {
            const rankA = PRIORITY_MAP[a.priority]?.rank || 0;
            const rankB = PRIORITY_MAP[b.priority]?.rank || 0;
            return rankB - rankA;
          }
          default:
            return (b.createdAt || 0) - (a.createdAt || 0);
        }
      });

      return result;
    },

    renderBoard() {
      this.updateMetrics();
      this.updateTagFilterOptions();

      const filtered = this.getFilteredTasks();
      const isFiltered = state.filter.search || state.filter.priority !== 'all' || state.filter.tag !== 'all';

      // Reset Column lists
      COLUMNS.forEach(col => {
        const listEl = DOM.lists[col.id];
        const countEl = DOM.counts[col.id];
        if (!listEl) return;

        listEl.innerHTML = '';
        const columnTasks = filtered.filter(t => t.column === col.id);
        if (countEl) countEl.textContent = columnTasks.length;

        if (columnTasks.length === 0) {
          const emptyMsg = isFiltered ? 'No matching tasks' : 'No tasks in this column';
          listEl.innerHTML = `
            <div class="column-empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
              <p>${emptyMsg}</p>
            </div>
          `;
        } else {
          columnTasks.forEach(task => {
            const cardEl = this.createTaskCardElement(task);
            listEl.appendChild(cardEl);
          });
        }
      });
    },

    createTaskCardElement(task) {
      const isCompleted = task.column === 'completed';
      const card = document.createElement('div');
      card.className = `task-card ${isCompleted ? 'is-completed' : ''}`;
      card.id = `card-${task.id}`;
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-task-id', task.id);

      const priorityInfo = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
      const dueInfo = Utils.getDueDateStatus(task.dueDate, isCompleted);

      // Tags HTML
      let tagsHtml = '';
      if (Array.isArray(task.tags) && task.tags.length > 0) {
        tagsHtml = `
          <div class="card-tags">
            ${task.tags.map(t => `<span class="task-tag">${Utils.escapeHtml(t)}</span>`).join('')}
          </div>
        `;
      }

      // Subtasks HTML
      let subtasksHtml = '';
      if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
        const total = task.subtasks.length;
        const done = task.subtasks.filter(st => st.completed).length;
        const pct = Math.round((done / total) * 100);

        subtasksHtml = `
          <div class="subtasks-container">
            <div class="subtasks-header">
              <span>Checklist</span>
              <span>${done}/${total} (${pct}%)</span>
            </div>
            <div class="subtasks-progress-track">
              <div class="subtasks-progress-fill" style="width: ${pct}%"></div>
            </div>
            <div class="subtasks-list" style="margin-top: 0.25rem;">
              ${task.subtasks.map((st, idx) => `
                <label class="subtask-item ${st.completed ? 'completed' : ''}">
                  <input type="checkbox" ${st.completed ? 'checked' : ''} data-task-id="${task.id}" data-st-idx="${idx}" class="subtask-checkbox">
                  <span>${Utils.escapeHtml(st.text)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Due Date Badge HTML
      let dueHtml = '';
      if (dueInfo) {
        dueHtml = `
          <div class="due-date ${dueInfo.status === 'overdue' ? 'overdue' : dueInfo.status === 'due-soon' ? 'due-soon' : ''}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>${Utils.escapeHtml(dueInfo.label)}</span>
          </div>
        `;
      } else {
        dueHtml = `<span></span>`;
      }

      // Quick move dropdown for mobile / accessibility
      const moveOptions = COLUMNS.map(col => `
        <option value="${col.id}" ${col.id === task.column ? 'selected disabled' : ''}>Move: ${col.title}</option>
      `).join('');

      card.innerHTML = `
        <div class="card-top">
          <span class="priority-badge ${priorityInfo.className}">
            <span>${priorityInfo.icon}</span>
            <span>${priorityInfo.label}</span>
          </span>
          <div style="display: flex; align-items: center; gap: 0.25rem;">
            <button class="card-options-btn btn-task-duplicate" title="Duplicate Task" data-task-id="${task.id}" aria-label="Duplicate task">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="card-options-btn btn-task-edit" title="Edit Task" data-task-id="${task.id}" aria-label="Edit task">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="card-options-btn btn-task-delete" title="Delete Task" data-task-id="${task.id}" aria-label="Delete task">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        <div class="task-title-row">
          <label class="task-checkbox-label" title="${isCompleted ? 'Mark as incomplete' : 'Mark as completed'}">
            <input type="checkbox" class="task-main-checkbox" data-task-id="${task.id}" ${isCompleted ? 'checked' : ''}>
            <span class="task-custom-checkbox">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </label>
          <h3 class="task-title ${isCompleted ? 'task-title-completed' : ''}">${Utils.escapeHtml(task.title)}</h3>
        </div>

        ${task.description ? `<p class="task-desc">${Utils.escapeHtml(task.description)}</p>` : ''}
        ${tagsHtml}
        ${subtasksHtml}

        <div class="card-footer">
          ${dueHtml}
          <select class="mobile-move-select" data-task-id="${task.id}" title="Move task to column">
            ${moveOptions}
          </select>
        </div>
      `;

      // Attach Drag Events
      card.addEventListener('dragstart', DragDrop.handleDragStart);
      card.addEventListener('dragend', DragDrop.handleDragEnd);

      return card;
    },

    // Modal Operations
    openTaskModal(taskId = null, defaultColumn = 'todo') {
      state.editingTaskId = taskId;
      state.modalSubtasks = [];

      if (taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        DOM.modalTitle.textContent = 'Edit Task';
        DOM.taskIdInput.value = task.id;
        DOM.taskTitleInput.value = task.title || '';
        DOM.taskDescInput.value = task.description || '';
        DOM.taskColumnInput.value = task.column || 'todo';
        DOM.taskPriorityInput.value = task.priority || 'medium';
        DOM.taskDueInput.value = task.dueDate || '';
        DOM.taskTagsInput.value = Array.isArray(task.tags) ? task.tags.join(', ') : '';
        state.modalSubtasks = Array.isArray(task.subtasks) ? JSON.parse(JSON.stringify(task.subtasks)) : [];
      } else {
        DOM.modalTitle.textContent = 'Create New Task';
        DOM.taskIdInput.value = '';
        DOM.taskTitleInput.value = '';
        DOM.taskDescInput.value = '';
        DOM.taskColumnInput.value = defaultColumn;
        DOM.taskPriorityInput.value = 'medium';
        DOM.taskDueInput.value = '';
        DOM.taskTagsInput.value = '';
        DOM.subtaskNewInput.value = '';
        state.modalSubtasks = [];
      }

      this.renderModalSubtasks();
      DOM.taskModalOverlay.classList.add('active');
      DOM.taskModalOverlay.setAttribute('aria-hidden', 'false');
      setTimeout(() => DOM.taskTitleInput.focus(), 50);
    },

    closeTaskModal() {
      DOM.taskModalOverlay.classList.remove('active');
      DOM.taskModalOverlay.setAttribute('aria-hidden', 'true');
      state.editingTaskId = null;
      state.modalSubtasks = [];
    },

    renderModalSubtasks() {
      if (!DOM.subtaskListBuilder) return;
      DOM.subtaskListBuilder.innerHTML = '';
      state.modalSubtasks.forEach((st, idx) => {
        const item = document.createElement('div');
        item.className = 'subtask-builder-item';
        item.innerHTML = `
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${Utils.escapeHtml(st.text)}</span>
          <button type="button" data-index="${idx}" title="Remove subtask" aria-label="Remove item">&times;</button>
        `;
        DOM.subtaskListBuilder.appendChild(item);
      });
    },

    // Confirm Dialog
    openConfirmModal(title, desc, onConfirm) {
      DOM.confirmModalTitle.textContent = title;
      DOM.confirmModalDesc.textContent = desc;
      state.confirmAction = onConfirm;
      DOM.confirmModalOverlay.classList.add('active');
      DOM.confirmModalOverlay.setAttribute('aria-hidden', 'false');
    },

    closeConfirmModal() {
      DOM.confirmModalOverlay.classList.remove('active');
      DOM.confirmModalOverlay.setAttribute('aria-hidden', 'true');
      state.confirmAction = null;
    }
  };

  // ==========================================================================
  // 7. Drag and Drop Engine
  // ==========================================================================
  const DragDrop = {
    handleDragStart(e) {
      const taskId = this.getAttribute('data-task-id');
      state.draggedTaskId = taskId;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', taskId);
    },

    handleDragEnd() {
      this.classList.remove('dragging');
      state.draggedTaskId = null;
      document.querySelectorAll('.board-column').forEach(col => col.classList.remove('drag-over'));
    },

    init() {
      // Set up drop zones on column elements
      document.querySelectorAll('.board-column').forEach(col => {
        col.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          col.classList.add('drag-over');
        });

        col.addEventListener('dragleave', (e) => {
          if (!col.contains(e.relatedTarget)) {
            col.classList.remove('drag-over');
          }
        });

        col.addEventListener('drop', (e) => {
          e.preventDefault();
          col.classList.remove('drag-over');
          const targetColumnId = col.getAttribute('data-column');
          const taskId = e.dataTransfer.getData('text/plain') || state.draggedTaskId;

          if (taskId && targetColumnId) {
            TaskOperations.moveTaskToColumn(taskId, targetColumnId);
          }
        });
      });
    }
  };

  // ==========================================================================
  // 8. Task Operations (CRUD & State)
  // ==========================================================================
  const TaskOperations = {
    saveTaskFromForm() {
      const title = DOM.taskTitleInput.value.trim();
      if (!title) {
        UI.showToast('Please enter a task title.', 'danger');
        DOM.taskTitleInput.focus();
        return false;
      }

      const rawTags = DOM.taskTagsInput.value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const taskId = DOM.taskIdInput.value.trim();
      const now = Date.now();

      if (taskId) {
        // Edit existing
        const index = state.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
          state.tasks[index] = {
            ...state.tasks[index],
            title,
            description: DOM.taskDescInput.value.trim(),
            column: DOM.taskColumnInput.value,
            priority: DOM.taskPriorityInput.value,
            dueDate: DOM.taskDueInput.value,
            tags: rawTags,
            subtasks: [...state.modalSubtasks],
            updatedAt: now
          };
          Storage.saveTasks(state.tasks);
          UI.renderBoard();
          UI.closeTaskModal();
          UI.showToast('Task updated successfully.', 'success');
          return true;
        }
      }

      // Create new
      const newTask = {
        id: Utils.generateId(),
        title,
        description: DOM.taskDescInput.value.trim(),
        column: DOM.taskColumnInput.value || 'todo',
        priority: DOM.taskPriorityInput.value || 'medium',
        dueDate: DOM.taskDueInput.value || '',
        tags: rawTags,
        subtasks: [...state.modalSubtasks],
        createdAt: now,
        updatedAt: now
      };
      state.tasks.unshift(newTask);
      Storage.saveTasks(state.tasks);
      UI.renderBoard();
      UI.closeTaskModal();
      UI.showToast('Task created successfully.', 'success');
      return true;
    },

    toggleTaskCompletion(taskId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.column === 'completed') {
        task.column = 'todo';
        delete task.completedAt;
        task.updatedAt = Date.now();
        Storage.saveTasks(state.tasks);
        UI.renderBoard();
        UI.showToast(`Task "${task.title}" moved to To Do`, 'info');
      } else {
        task.column = 'completed';
        task.completedAt = Date.now();
        task.updatedAt = Date.now();
        Storage.saveTasks(state.tasks);
        UI.renderBoard();
        UI.showToast(`Task "${task.title}" marked as completed!`, 'success');
      }
    },

    duplicateTask(taskId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      const duplicated = {
        ...JSON.parse(JSON.stringify(task)),
        id: Utils.generateId(),
        title: `${task.title} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      state.tasks.unshift(duplicated);
      Storage.saveTasks(state.tasks);
      UI.renderBoard();
      UI.showToast('Task duplicated.', 'info');
    },

    deleteTask(taskId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      UI.openConfirmModal(
        'Delete Task',
        `Are you sure you want to permanently delete "${task.title}"?`,
        () => {
          state.tasks = state.tasks.filter(t => t.id !== taskId);
          Storage.saveTasks(state.tasks);
          UI.renderBoard();
          UI.closeConfirmModal();
          UI.showToast('Task deleted.', 'danger');
        }
      );
    },

    clearBoard() {
      if (state.tasks.length === 0) {
        UI.showToast('The board is already empty.', 'info');
        return;
      }

      UI.openConfirmModal(
        'Clear Entire Board',
        'Are you sure you want to delete all tasks on this board? This action cannot be undone.',
        () => {
          state.tasks = [];
          Storage.saveTasks(state.tasks);
          UI.renderBoard();
          UI.closeConfirmModal();
          UI.showToast('All tasks cleared.', 'danger');
        }
      );
    },

    moveTaskToColumn(taskId, targetColumnId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task || task.column === targetColumnId) return;

      task.column = targetColumnId;
      task.updatedAt = Date.now();
      Storage.saveTasks(state.tasks);
      UI.renderBoard();
      const colObj = COLUMNS.find(c => c.id === targetColumnId);
      UI.showToast(`Moved to "${colObj ? colObj.title : targetColumnId}"`, 'info');
    },

    toggleSubtask(taskId, subtaskIndex) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task || !Array.isArray(task.subtasks) || !task.subtasks[subtaskIndex]) return;

      task.subtasks[subtaskIndex].completed = !task.subtasks[subtaskIndex].completed;
      task.updatedAt = Date.now();
      Storage.saveTasks(state.tasks);
      UI.renderBoard();
    },

    exportTasks() {
      if (state.tasks.length === 0) {
        UI.showToast('No tasks to export.', 'info');
        return;
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.tasks, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `taskflow_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      UI.showToast(`Exported ${state.tasks.length} task(s) to JSON.`, 'success');
    },

    importTasks(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) {
            throw new Error('Invalid JSON format: root element must be an array of tasks.');
          }

          const validTasks = imported.map(item => ({
            id: item.id || Utils.generateId(),
            title: String(item.title || 'Untitled Task'),
            description: String(item.description || ''),
            column: ['todo', 'in-progress', 'review', 'completed'].includes(item.column) ? item.column : 'todo',
            priority: ['low', 'medium', 'high', 'urgent'].includes(item.priority) ? item.priority : 'medium',
            dueDate: item.dueDate || '',
            tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
            subtasks: Array.isArray(item.subtasks) ? item.subtasks.map(st => ({
              text: String(st.text || ''),
              completed: Boolean(st.completed)
            })) : [],
            createdAt: item.createdAt || Date.now(),
            updatedAt: Date.now()
          }));

          state.tasks = validTasks;
          Storage.saveTasks(state.tasks);
          UI.renderBoard();
          UI.showToast(`Successfully imported ${validTasks.length} task(s).`, 'success');
        } catch (err) {
          console.error('Import error:', err);
          UI.showToast('Failed to import JSON file. Please verify format.', 'danger');
        }
      };
      reader.readAsText(file);
    }
  };

  // ==========================================================================
  // 9. Event Listeners & Initialization
  // ==========================================================================
  function setupEventListeners() {
    // Theme Toggle
    if (DOM.btnThemeToggle) {
      DOM.btnThemeToggle.addEventListener('click', () => UI.toggleTheme());
    }

    // New Task Modal Trigger (Header)
    if (DOM.btnOpenAddTask) {
      DOM.btnOpenAddTask.addEventListener('click', () => UI.openTaskModal(null, 'todo'));
    }

    // Column "+ Add Task" button triggers
    document.querySelectorAll('.btn-col-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.getAttribute('data-column') || 'todo';
        UI.openTaskModal(null, col);
      });
    });

    // Task Form Submit
    if (DOM.taskForm) {
      DOM.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        TaskOperations.saveTaskFromForm();
      });
    }

    // Close Task Modal Buttons
    if (DOM.btnCloseTaskModal) {
      DOM.btnCloseTaskModal.addEventListener('click', () => UI.closeTaskModal());
    }
    if (DOM.btnCancelTask) {
      DOM.btnCancelTask.addEventListener('click', () => UI.closeTaskModal());
    }

    // Modal Subtasks builder
    if (DOM.btnAddSubtask) {
      const handleAddSubtask = () => {
        const text = DOM.subtaskNewInput.value.trim();
        if (!text) return;
        state.modalSubtasks.push({ text, completed: false });
        DOM.subtaskNewInput.value = '';
        UI.renderModalSubtasks();
        DOM.subtaskNewInput.focus();
      };

      DOM.btnAddSubtask.addEventListener('click', handleAddSubtask);
      DOM.subtaskNewInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddSubtask();
        }
      });
    }

    if (DOM.subtaskListBuilder) {
      DOM.subtaskListBuilder.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('button');
        if (removeBtn) {
          const idx = parseInt(removeBtn.getAttribute('data-index'), 10);
          if (!isNaN(idx)) {
            state.modalSubtasks.splice(idx, 1);
            UI.renderModalSubtasks();
          }
        }
      });
    }

    // Global Click Handler for dynamically rendered cards (Edit, Delete, Duplicate, Subtask toggle)
    if (DOM.boardContainer) {
      DOM.boardContainer.addEventListener('click', (e) => {
        // Edit button
        const editBtn = e.target.closest('.btn-task-edit');
        if (editBtn) {
          e.stopPropagation();
          const taskId = editBtn.getAttribute('data-task-id');
          UI.openTaskModal(taskId);
          return;
        }

        // Delete button
        const delBtn = e.target.closest('.btn-task-delete');
        if (delBtn) {
          e.stopPropagation();
          const taskId = delBtn.getAttribute('data-task-id');
          TaskOperations.deleteTask(taskId);
          return;
        }

        // Duplicate button
        const dupBtn = e.target.closest('.btn-task-duplicate');
        if (dupBtn) {
          e.stopPropagation();
          const taskId = dupBtn.getAttribute('data-task-id');
          TaskOperations.duplicateTask(taskId);
          return;
        }

        // Subtask Checkbox
        if (e.target.classList.contains('subtask-checkbox')) {
          e.stopPropagation();
          const taskId = e.target.getAttribute('data-task-id');
          const subtaskIdx = parseInt(e.target.getAttribute('data-st-idx'), 10);
          if (taskId && !isNaN(subtaskIdx)) {
            TaskOperations.toggleSubtask(taskId, subtaskIdx);
          }
          return;
        }
      });

      // Board Container Change Handler (Task completion checkbox and Mobile Quick Move)
      DOM.boardContainer.addEventListener('change', (e) => {
        // Main Task Completion Checkbox
        if (e.target.classList.contains('task-main-checkbox')) {
          e.stopPropagation();
          const taskId = e.target.getAttribute('data-task-id');
          if (taskId) {
            TaskOperations.toggleTaskCompletion(taskId);
          }
          return;
        }

        // Mobile Quick Move Select
        if (e.target.classList.contains('mobile-move-select')) {
          const taskId = e.target.getAttribute('data-task-id');
          const targetCol = e.target.value;
          if (taskId && targetCol) {
            TaskOperations.moveTaskToColumn(taskId, targetCol);
          }
          return;
        }
      });
    }

    // Filter & Search Events
    if (DOM.searchInput) {
      DOM.searchInput.addEventListener('input', (e) => {
        state.filter.search = e.target.value;
        UI.renderBoard();
      });
    }

    if (DOM.filterPriority) {
      DOM.filterPriority.addEventListener('change', (e) => {
        state.filter.priority = e.target.value;
        UI.renderBoard();
      });
    }

    if (DOM.filterTag) {
      DOM.filterTag.addEventListener('change', (e) => {
        state.filter.tag = e.target.value;
        UI.renderBoard();
      });
    }

    if (DOM.sortBy) {
      DOM.sortBy.addEventListener('change', (e) => {
        state.filter.sortBy = e.target.value;
        UI.renderBoard();
      });
    }

    if (DOM.btnResetFilters) {
      DOM.btnResetFilters.addEventListener('click', () => {
        state.filter.search = '';
        state.filter.priority = 'all';
        state.filter.tag = 'all';
        state.filter.sortBy = 'created-desc';

        if (DOM.searchInput) DOM.searchInput.value = '';
        if (DOM.filterPriority) DOM.filterPriority.value = 'all';
        if (DOM.filterTag) DOM.filterTag.value = 'all';
        if (DOM.sortBy) DOM.sortBy.value = 'created-desc';

        UI.renderBoard();
        UI.showToast('Filters reset.', 'info');
      });
    }

    // Export & Import
    if (DOM.btnExportTasks) {
      DOM.btnExportTasks.addEventListener('click', () => TaskOperations.exportTasks());
    }

    if (DOM.btnImportTrigger && DOM.fileImportTasks) {
      DOM.btnImportTrigger.addEventListener('click', () => DOM.fileImportTasks.click());
      DOM.fileImportTasks.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          TaskOperations.importTasks(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // Clear Board
    if (DOM.btnClearBoard) {
      DOM.btnClearBoard.addEventListener('click', () => TaskOperations.clearBoard());
    }

    // Confirmation Modal Actions
    if (DOM.btnConfirmCancel) {
      DOM.btnConfirmCancel.addEventListener('click', () => UI.closeConfirmModal());
    }
    if (DOM.btnConfirmProceed) {
      DOM.btnConfirmProceed.addEventListener('click', () => {
        if (typeof state.confirmAction === 'function') {
          state.confirmAction();
        }
      });
    }

    // Keyboard Shortcuts (Escape to close modals)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (DOM.taskModalOverlay && DOM.taskModalOverlay.classList.contains('active')) {
          UI.closeTaskModal();
        }
        if (DOM.confirmModalOverlay && DOM.confirmModalOverlay.classList.contains('active')) {
          UI.closeConfirmModal();
        }
      }
    });

    // Close modal on clicking backdrop overlay
    if (DOM.taskModalOverlay) {
      DOM.taskModalOverlay.addEventListener('click', (e) => {
        if (e.target === DOM.taskModalOverlay) {
          UI.closeTaskModal();
        }
      });
    }
    if (DOM.confirmModalOverlay) {
      DOM.confirmModalOverlay.addEventListener('click', (e) => {
        if (e.target === DOM.confirmModalOverlay) {
          UI.closeConfirmModal();
        }
      });
    }
  }

  // ==========================================================================
  // 10. Bootstrap Application
  // ==========================================================================
  function init() {
    UI.initTheme();
    state.tasks = Storage.loadTasks();
    setupEventListeners();
    DragDrop.init();
    UI.renderBoard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
