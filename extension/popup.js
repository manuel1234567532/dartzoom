document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const sceneText = document.getElementById('sceneText');
  const turnIndicator = document.getElementById('turnIndicator');
  const turnText = document.getElementById('turnText');
  const statsRow = document.getElementById('statsRow');
  const lastThrowValue = document.getElementById('lastThrowValue');
  const scoreValue = document.getElementById('scoreValue');
  
  const enabledToggle = document.getElementById('enabled');
  const obsUrlInput = document.getElementById('obsUrl');
  const obsPasswordInput = document.getElementById('obsPassword');
  const filterSceneInput = document.getElementById('filterScene');
  const filterSourceInput = document.getElementById('filterSource');
  const defaultFilterInput = document.getElementById('defaultFilter');
  const throwDurationInput = document.getElementById('throwDuration');
  const checkoutScoreInput = document.getElementById('checkoutScore');
  const filterDurationInput = document.getElementById('filterDuration');
  const filterEasingSelect = document.getElementById('filterEasing');
  const filterEasingTypeSelect = document.getElementById('filterEasingType');
  const zoomSoundInput = document.getElementById('zoomSound');
  const defaultSoundInput = document.getElementById('defaultSound');
  
  const saveBtn = document.getElementById('saveBtn');
  const reconnectBtn = document.getElementById('reconnectBtn');

  // Usernames list
  let usernames = [];

  // Action lists data - now arrays of objects
  // Format: { type: 'source'|'scene'|'filter', name: '', scene: '', source: '', filter: '' }
  const actionLists = {
    gameOnShow: [],
    gameOnHide: [],
    gameEndShow: [],
    gameEndHide: [],
    myTurnShow: [],
    myTurnHide: [],
    opponentTurnShow: [],
    opponentTurnHide: []
  };

  // Debounce timer for auto-save
  let saveTimeout = null;
  
  function autoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveSettings();
    }, 500);
  }
  
  function immediateSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveSettings();
  }

  function saveSettings() {
    const actionListValues = getActionListValues();
    
    const settings = {
      obsUrl: obsUrlInput.value.trim() || 'ws://localhost:4455',
      obsPassword: obsPasswordInput.value,
      enabled: enabledToggle.checked,
      usernames: usernames.filter(u => u && u.trim() !== ''),
      filterScene: filterSceneInput.value.trim(),
      filterSource: filterSourceInput.value.trim(),
      defaultFilter: defaultFilterInput.value.trim(),
      throwDuration: parseInt(throwDurationInput.value) || 2000,
      checkoutScore: parseInt(checkoutScoreInput.value) || 170,
      filterDuration: parseInt(filterDurationInput.value) || 800,
      filterEasing: parseInt(filterEasingSelect.value) || 2,
      filterEasingType: parseInt(filterEasingTypeSelect.value) || 3,
      zoomSound: zoomSoundInput.value.trim(),
      defaultSound: defaultSoundInput.value.trim(),
      ...actionListValues
    };
    
    chrome.runtime.sendMessage({ type: 'updateSettings', settings }, () => {
      saveBtn.textContent = '✓ Saved';
      saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      setTimeout(() => {
        saveBtn.textContent = 'Save';
        saveBtn.style.background = '';
      }, 1000);
      
      checkSetup();
    });
  }

  // ============== USERNAMES LIST ==============

  function renderUsernameList() {
    const listEl = document.getElementById('usernameList');
    if (!listEl) return;
    
    if (usernames.length === 0) {
      // Add at least one empty input
      usernames.push('');
    }
    
    listEl.innerHTML = usernames.map((username, index) => `
      <div class="username-item" data-index="${index}">
        <input type="text" class="username-input" value="${username}" placeholder="Autodarts Username">
        <button class="remove-btn" data-index="${index}" ${usernames.length <= 1 ? 'style="visibility:hidden"' : ''}>×</button>
      </div>
    `).join('');
    
    // Add event listeners
    listEl.querySelectorAll('.username-input').forEach((input, index) => {
      input.addEventListener('input', (e) => {
        usernames[index] = e.target.value;
        autoSave();
      });
    });
    
    listEl.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        usernames.splice(index, 1);
        renderUsernameList();
        immediateSave();
      });
    });
  }

  // Add username button
  document.getElementById('addUsernameBtn').addEventListener('click', () => {
    usernames.push('');
    renderUsernameList();
    
    // Focus the new input
    const listEl = document.getElementById('usernameList');
    const inputs = listEl.querySelectorAll('.username-input');
    if (inputs.length > 0) {
      inputs[inputs.length - 1].focus();
    }
  });

  // ============== ACTION LISTS ==============

  // Render an action list with type selector
  function renderActionList(listId) {
    const listEl = document.getElementById(listId + 'List');
    if (!listEl) return;
    
    const items = actionLists[listId] || [];
    
    if (items.length === 0) {
      listEl.innerHTML = '';
      return;
    }
    
    listEl.innerHTML = items.map((action, index) => {
      const isFilter = action.type === 'filter';
      const delayValue = action.delay || 0;
      return `
        <div class="action-item ${isFilter ? 'filter-type' : ''}" data-list="${listId}" data-index="${index}">
          <div class="action-row">
            <select class="action-type" data-field="type">
              <option value="source" ${action.type === 'source' ? 'selected' : ''}>Source</option>
              <option value="scene" ${action.type === 'scene' ? 'selected' : ''}>Scene</option>
              <option value="filter" ${action.type === 'filter' ? 'selected' : ''}>Filter</option>
            </select>
            <input type="text" class="action-input main-input" 
                   value="${action.type === 'filter' ? '' : (action.name || '')}" 
                   placeholder="${action.type === 'scene' ? 'Scene name' : 'Source name'}"
                   data-field="name"
                   ${isFilter ? 'style="display:none"' : ''}>
            <input type="number" class="delay-input" value="${delayValue}" placeholder="0" min="0" data-field="delay" title="Delay in seconds">
            <span class="delay-suffix">sec</span>
            <button class="remove-btn" data-list="${listId}" data-index="${index}">×</button>
          </div>
          <div class="filter-fields">
            <div class="filter-field">
              <span class="filter-label">Scene:</span>
              <input type="text" class="action-input" value="${action.scene || ''}" placeholder="Scene name" data-field="scene">
            </div>
            <div class="filter-field">
              <span class="filter-label">Source:</span>
              <input type="text" class="action-input" value="${action.source || ''}" placeholder="Source name" data-field="source">
            </div>
            <div class="filter-field">
              <span class="filter-label">Filter:</span>
              <input type="text" class="action-input" value="${action.filter || ''}" placeholder="Filter name" data-field="filter">
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Add event listeners
    listEl.querySelectorAll('.action-item').forEach(item => {
      const listId = item.dataset.list;
      const index = parseInt(item.dataset.index);
      
      // Type selector change
      const typeSelect = item.querySelector('.action-type');
      typeSelect.addEventListener('change', (e) => {
        const newType = e.target.value;
        actionLists[listId][index].type = newType;
        
        // Toggle filter-type class
        if (newType === 'filter') {
          item.classList.add('filter-type');
          item.querySelector('.main-input').style.display = 'none';
        } else {
          item.classList.remove('filter-type');
          item.querySelector('.main-input').style.display = '';
          item.querySelector('.main-input').placeholder = newType === 'scene' ? 'Scene name' : 'Source name';
        }
        autoSave();
      });
      
      // Input changes
      item.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
          const field = e.target.dataset.field;
          let value = e.target.value;
          // Convert delay to number
          if (field === 'delay') {
            value = parseInt(value) || 0;
          }
          actionLists[listId][index][field] = value;
          autoSave();
        });
      });
    });
    
    // Remove buttons
    listEl.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const list = e.target.dataset.list;
        const index = parseInt(e.target.dataset.index);
        actionLists[list].splice(index, 1);
        renderActionList(list);
        immediateSave();
      });
    });
  }

  // Add new action item
  function addActionItem(listId) {
    actionLists[listId].push({ type: 'source', name: '' });
    renderActionList(listId);
    
    // Focus the new input
    const listEl = document.getElementById(listId + 'List');
    const items = listEl.querySelectorAll('.action-item');
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      const input = lastItem.querySelector('.main-input');
      if (input) input.focus();
    }
  }

  // Setup add buttons
  document.querySelectorAll('.add-btn[data-list]').forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = btn.dataset.list;
      addActionItem(listId);
    });
  });

  // Setup collapsible sections
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const collapsible = header.parentElement;
      collapsible.classList.toggle('open');
    });
  });

  // Migrate old string format to new object format
  function migrateOldFormat(list) {
    if (!list || !Array.isArray(list)) return [];
    return list.map(item => {
      if (typeof item === 'string') {
        return { type: 'source', name: item };
      }
      return item;
    });
  }

  function loadStatus() {
    chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
      if (response) {
        // Don't set obsUrl here - let storage.local.get handle it
        enabledToggle.checked = response.enabled !== false;
        updateStatusUI(response.connected, response.currentScene);
        
        if (response.score) {
          scoreValue.textContent = response.score;
          statsRow.style.display = 'flex';
        }
        
        window._lastTurnState = response.isMyTurn;
      }
    });

    chrome.storage.local.get([
      'obsUrl', 'obsPassword', 'usernames', 'username', 'filterScene', 'filterSource', 
      'defaultFilter', 'throwDuration', 'checkoutScore', 'filterDuration', 'filterEasing', 'filterEasingType', 'lastThrow',
      'zoomSound', 'defaultSound',
      'gameOnShow', 'gameOnHide', 'gameEndShow', 'gameEndHide',
      'myTurnShow', 'myTurnHide', 'opponentTurnShow', 'opponentTurnHide'
    ], (result) => {
      obsUrlInput.value = result.obsUrl || 'ws://localhost:4455';
      if (result.obsPassword) obsPasswordInput.value = result.obsPassword;
      
      // Handle migration from old single username to usernames array
      if (result.usernames && Array.isArray(result.usernames)) {
        usernames = result.usernames;
      } else if (result.username) {
        usernames = [result.username];
      } else {
        usernames = [''];
      }
      renderUsernameList();
      
      if (result.filterScene) filterSceneInput.value = result.filterScene;
      if (result.filterSource) filterSourceInput.value = result.filterSource;
      if (result.defaultFilter) defaultFilterInput.value = result.defaultFilter;
      if (result.throwDuration) throwDurationInput.value = result.throwDuration;
      if (result.checkoutScore) checkoutScoreInput.value = result.checkoutScore;
      if (result.filterDuration) filterDurationInput.value = result.filterDuration;
      if (result.filterEasing !== undefined) filterEasingSelect.value = result.filterEasing;
      if (result.filterEasingType !== undefined) filterEasingTypeSelect.value = result.filterEasingType;
      if (result.zoomSound) zoomSoundInput.value = result.zoomSound;
      if (result.defaultSound) defaultSoundInput.value = result.defaultSound;
      if (result.lastThrow) {
        lastThrowValue.textContent = result.lastThrow.name || '-';
        statsRow.style.display = 'flex';
      }
      
      // Load action lists (with migration for old format)
      if (result.gameOnShow) actionLists.gameOnShow = migrateOldFormat(result.gameOnShow);
      if (result.gameOnHide) actionLists.gameOnHide = migrateOldFormat(result.gameOnHide);
      if (result.gameEndShow) actionLists.gameEndShow = migrateOldFormat(result.gameEndShow);
      if (result.gameEndHide) actionLists.gameEndHide = migrateOldFormat(result.gameEndHide);
      if (result.myTurnShow) actionLists.myTurnShow = migrateOldFormat(result.myTurnShow);
      if (result.myTurnHide) actionLists.myTurnHide = migrateOldFormat(result.myTurnHide);
      if (result.opponentTurnShow) actionLists.opponentTurnShow = migrateOldFormat(result.opponentTurnShow);
      if (result.opponentTurnHide) actionLists.opponentTurnHide = migrateOldFormat(result.opponentTurnHide);
      
      // Render all action lists
      Object.keys(actionLists).forEach(listId => renderActionList(listId));
      
      checkSetup();
    });
  }
  
  function updateStatusUI(connected, scene) {
    statusDot.classList.toggle('connected', connected);
    statusText.textContent = connected ? 'Connected to OBS' : 'Not connected';
    sceneText.textContent = scene ? `Active Scene: ${scene}` : '';
  }
  
  function updateTurnUI(isMyTurn) {
    turnIndicator.style.display = 'flex';
    turnIndicator.className = `turn-indicator ${isMyTurn ? 'my-turn' : 'enemy-turn'}`;
    turnText.textContent = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
  }
  
  function checkSetup() {
    const validUsernames = usernames.filter(u => u && u.trim() !== '');
    const filterSource = filterSourceInput.value.trim();
    const defaultFilter = defaultFilterInput.value.trim();
    
    const setupIndicator = document.getElementById('setupIndicator');
    
    if (validUsernames.length === 0 || !filterSource || !defaultFilter) {
      setupIndicator.style.display = 'flex';
      turnIndicator.style.display = 'none';
      return false;
    } else {
      setupIndicator.style.display = 'none';
      if (window._lastTurnState !== undefined) {
        updateTurnUI(window._lastTurnState);
      }
      return true;
    }
  }

  // Get current values from action lists (filter incomplete entries)
  function getActionListValues() {
    const values = {};
    Object.keys(actionLists).forEach(listId => {
      values[listId] = actionLists[listId].filter(action => {
        if (action.type === 'filter') {
          return action.scene && action.source && action.filter;
        }
        return action.name && action.name.trim() !== '';
      });
    });
    return values;
  }

  loadStatus();

  // Auto-save on input changes
  const textInputs = [obsUrlInput, obsPasswordInput, filterSceneInput, filterSourceInput, defaultFilterInput, throwDurationInput, checkoutScoreInput, filterDurationInput, zoomSoundInput, defaultSoundInput];
  textInputs.forEach(input => {
    input.addEventListener('input', autoSave);
  });
  
  filterEasingSelect.addEventListener('change', autoSave);
  filterEasingTypeSelect.addEventListener('change', autoSave);
  enabledToggle.addEventListener('change', immediateSave);
  saveBtn.addEventListener('click', immediateSave);

  reconnectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'reconnect' }, () => {
      statusText.textContent = 'Connecting...';
      sceneText.textContent = '';
      statusDot.classList.remove('connected');
      setTimeout(loadStatus, 1500);
    });
  });

  document.querySelectorAll('.test-btn[data-segment]').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'testCamera', segment: btn.dataset.segment });
    });
  });

  document.querySelectorAll('.test-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'myTurn' || action === 'enemyTurn') {
        const isMyTurn = action === 'myTurn';
        chrome.runtime.sendMessage({ type: 'testTurn', isMyTurn });
      } else if (action === 'gameOn') {
        chrome.runtime.sendMessage({ type: 'testGameOn' });
      } else if (action === 'gameEnd') {
        chrome.runtime.sendMessage({ type: 'testGameEnd' });
      }
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'status') {
      updateStatusUI(message.status === 'connected');
    }
    if (message.type === 'turnChanged') {
      window._lastTurnState = message.isMyTurn;
      if (checkSetup()) {
        updateTurnUI(message.isMyTurn);
      }
    }
    if (message.type === 'scoreUpdate') {
      scoreValue.textContent = message.score;
      statsRow.style.display = 'flex';
    }
    if (message.type === 'filterProgress') {
      const progressFill = document.getElementById('progressFill');
      const progressText = document.getElementById('progressText');
      progressFill.style.width = `${(message.current / message.total) * 100}%`;
      progressText.textContent = `${message.current} / ${message.total} - ${message.filterName}`;
    }
    if (message.type === 'filtersDone') {
      document.getElementById('progressModal').classList.remove('show');
      const createFiltersBtn = document.getElementById('createFiltersBtn');
      
      if (message.success) {
        createFiltersBtn.innerHTML = '<span class="btn-icon">✓</span> Filters Created!';
        createFiltersBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      } else if (message.successCount > 0) {
        createFiltersBtn.innerHTML = `<span class="btn-icon">⚠</span> ${message.successCount}/${message.successCount + message.errorCount} Created`;
        createFiltersBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      } else {
        createFiltersBtn.innerHTML = '<span class="btn-icon">✗</span> Failed - Check Console';
        createFiltersBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      }
      
      setTimeout(() => {
        createFiltersBtn.innerHTML = '<span class="btn-icon">⚡</span> Create All Cam Filters';
        createFiltersBtn.style.background = '';
        createFiltersBtn.disabled = false;
      }, 3000);
    }
    if (message.type === 'filterUpdateProgress') {
      const progressFill = document.getElementById('progressFill');
      const progressText = document.getElementById('progressText');
      progressFill.style.width = `${(message.current / message.total) * 100}%`;
      progressText.textContent = `${message.current} / ${message.total} - ${message.filterName}`;
    }
    if (message.type === 'filterUpdateDone') {
      document.getElementById('progressModal').classList.remove('show');
      const updateFiltersBtn = document.getElementById('updateFiltersBtn');
      
      if (message.success) {
        updateFiltersBtn.innerHTML = '<span class="btn-icon">✓</span> Filters Updated!';
        updateFiltersBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      } else if (message.successCount > 0) {
        updateFiltersBtn.innerHTML = `<span class="btn-icon">⚠</span> ${message.successCount}/${message.successCount + message.errorCount} Updated`;
        updateFiltersBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      } else {
        updateFiltersBtn.innerHTML = '<span class="btn-icon">✗</span> Failed - Check Console';
        updateFiltersBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      }
      
      setTimeout(() => {
        updateFiltersBtn.innerHTML = '<span class="btn-icon">🔄</span> Update Filter Settings';
        updateFiltersBtn.style.background = '';
        updateFiltersBtn.disabled = false;
      }, 3000);
    }
  });

  // Create Filters Button Logic
  const createFiltersBtn = document.getElementById('createFiltersBtn');
  const confirmModal = document.getElementById('confirmModal');
  const progressModal = document.getElementById('progressModal');
  const progressHeader = document.getElementById('progressHeader');
  const modalSourceName = document.getElementById('modalSourceName');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');

  createFiltersBtn.addEventListener('click', () => {
    const source = filterSourceInput.value.trim();
    if (!source) {
      alert('Please enter a Source name first!');
      return;
    }
    modalSourceName.textContent = source;
    confirmModal.classList.add('show');
  });

  modalCancel.addEventListener('click', () => {
    confirmModal.classList.remove('show');
  });

  modalConfirm.addEventListener('click', () => {
    confirmModal.classList.remove('show');
    progressHeader.textContent = 'Creating Filters...';
    progressModal.classList.add('show');
    
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    progressFill.style.width = '0%';
    progressText.textContent = '0 / 64';
    
    createFiltersBtn.disabled = true;
    
    chrome.runtime.sendMessage({
      type: 'createAllFilters',
      sourceName: filterSourceInput.value.trim()
    });
  });

  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      confirmModal.classList.remove('show');
    }
  });

  // Update Filters Button Logic
  const updateFiltersBtn = document.getElementById('updateFiltersBtn');
  
  updateFiltersBtn.addEventListener('click', () => {
    const source = filterSourceInput.value.trim();
    if (!source) {
      alert('Please enter a Source name first!');
      return;
    }
    
    const duration = parseInt(filterDurationInput.value) || 800;
    const easing = parseInt(filterEasingSelect.value) || 6;
    const easingType = parseInt(filterEasingTypeSelect.value) || 2;
    
    progressHeader.textContent = 'Updating Filters...';
    progressModal.classList.add('show');
    
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    progressFill.style.width = '0%';
    progressText.textContent = '0 / 64';
    
    updateFiltersBtn.disabled = true;
    
    chrome.runtime.sendMessage({
      type: 'updateAllFilters',
      sourceName: source,
      duration: duration,
      easing: easing,
      easingType: easingType
    });
  });
});
