// ============================================
// CONFIGURATION
// ============================================
const LICENSE_API_URL = 'https://followdarts.com/api/license';
const APP_KEY = 'DartZoom';

document.addEventListener('DOMContentLoaded', () => {

  // ============== AUTH GUARD ==============

  chrome.storage.local.get(['authUsername', 'authPassword', 'authValid'], (result) => {
    if (!result.authUsername || !result.authPassword || !result.authValid) {
      window.location.href = 'auth.html';
      return;
    }

    verifySession(result.authUsername, result.authPassword);
    initMainApp();
  });

  async function verifySession(username, password) {
    try {
      const res = await fetch(`${LICENSE_API_URL}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, app: APP_KEY, version: chrome.runtime.getManifest().version })
      });
      const data = await res.json();

      if (data.success) {
        chrome.storage.local.set({ authCheckedAt: Date.now() });
        // ★ Update-Info speichern
        if (data.updateAvailable) {
          chrome.storage.local.set({ updateAvailable: true, downloadUrl: data.downloadUrl || null });
        } else if (data.latestVersion) {
          chrome.storage.local.set({ latestVersion: data.latestVersion, downloadUrl: data.downloadUrl || null });
          chrome.storage.local.remove('updateAvailable');
        }
        // ★ Subscription-Info speichern
        if (data.subscription) chrome.storage.local.set({ subscription: data.subscription });
        if (data.expiry) chrome.storage.local.set({ expiry: data.expiry });
        if (data.timeleft) chrome.storage.local.set({ timeleft: data.timeleft });
      } else if (data.banned) {
        chrome.storage.local.set({ authValid: false }, () => {
          window.location.href = 'auth.html';
        });
      } else {
        chrome.storage.local.set({ authValid: false }, () => {
          window.location.href = 'auth.html';
        });
      }
    } catch (e) {
      console.log('[Auth] Server unreachable, grace period active');
    }
  }

  // ============== LOGOUT ==============

  function logout() {
    if (!confirm('Are you sure you want to log out?')) return;
    chrome.storage.local.remove(['authUsername', 'authPassword', 'authValid', 'authCheckedAt'], () => {
      window.location.href = 'auth.html';
    });
  }

  // ============== UPDATE CHECK ==============

  async function checkForUpdate() {
    const updateBanner = document.getElementById('updateBanner');
    if (!updateBanner) return;

    try {
      const stored = await new Promise(r => chrome.storage.local.get(['updateAvailable', 'latestVersion', 'downloadUrl'], r));
      
      let hasUpdate = false;
      
      // Weg 1: Server hat invalidver erkannt (KeyAuth Version höher als Server)
      if (stored.updateAvailable) {
        hasUpdate = true;
      }
      
      // Weg 2: Version aus KeyAuth ist höher als Extension
      if (stored.latestVersion) {
        const local = chrome.runtime.getManifest().version;
        if (stored.latestVersion !== local && isNewerVersion(stored.latestVersion, local)) {
          hasUpdate = true;
        }
      }
      
      if (hasUpdate) {
        updateBanner.classList.add('show');
        
        // Show version number if available
        const updateText = document.getElementById('updateText');
        if (updateText && stored.latestVersion) {
          updateText.textContent = `A new version v${stored.latestVersion} of DartZoom is ready`;
        }
        
        const updateBtn = document.getElementById('updateBtn');
        if (updateBtn) {
          const url = stored.downloadUrl || 'https://discord.gg/nMb3X9sWgv';
          updateBtn.addEventListener('click', () => {
            window.open(url, '_blank');
          });
        }
      }
    } catch (e) {
      console.log('[Update] Could not check for updates');
    }
  }

  function isNewerVersion(remote, local) {
    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

function initMainApp() {
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

      const licenseInfoBtn = document.getElementById('licenseInfoBtn');
    const licenseInfoModal = document.getElementById('licenseInfoModal');
    const licenseInfoClose = document.getElementById('licenseInfoClose');
    const licenseInfoCloseBtn = document.getElementById('licenseInfoCloseBtn');
    const licenseInfoKey = document.getElementById('licenseInfoKey');
    const deactivateLicenseBtn = document.getElementById('deactivateLicenseBtn');
  
  const saveBtn = document.getElementById('saveBtn');
  const reconnectBtn = document.getElementById('reconnectBtn');

  // CSP-safe dynamic style sheet for progress bar width
  const progressSheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, progressSheet];

  function setProgressWidth(percent) {
    progressSheet.replaceSync(`#progressFill { width: ${percent}%; }`);
  }

  // Usernames list
  let usernames = [];

  // Action lists data
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
      saveBtn.innerHTML = '<i class="bx bx-check"></i> Saved';
      saveBtn.classList.add('btn-state-success');
      setTimeout(() => {
        saveBtn.textContent = 'Save';
        saveBtn.classList.remove('btn-state-success');
      }, 1000);
      
      checkSetup();
    });
  }

  // ============== USERNAMES LIST ==============

  function renderUsernameList() {
    const listEl = document.getElementById('usernameList');
    if (!listEl) return;
    
    if (usernames.length === 0) {
      usernames.push('');
    }
    
    listEl.innerHTML = usernames.map((username, index) => `
      <div class="username-item" data-index="${index}">
        <input type="text" class="username-input" value="${username}" placeholder="Autodarts Username">
        <button class="remove-btn ${usernames.length <= 1 ? 'invisible' : ''}" data-index="${index}">×</button>
      </div>
    `).join('');
    
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

  document.getElementById('addUsernameBtn').addEventListener('click', () => {
    usernames.push('');
    renderUsernameList();
    
    const listEl = document.getElementById('usernameList');
    const inputs = listEl.querySelectorAll('.username-input');
    if (inputs.length > 0) {
      inputs[inputs.length - 1].focus();
    }
  });

  // ============== ACTION LISTS ==============

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
            <input type="text" class="action-input main-input ${isFilter ? 'is-hidden' : ''}" 
                   value="${action.type === 'filter' ? '' : (action.name || '')}" 
                   placeholder="${action.type === 'scene' ? 'Scene name' : 'Source name'}"
                   data-field="name">
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
    
    listEl.querySelectorAll('.action-item').forEach(item => {
      const listId = item.dataset.list;
      const index = parseInt(item.dataset.index);
      
      const typeSelect = item.querySelector('.action-type');
      typeSelect.addEventListener('change', (e) => {
        const newType = e.target.value;
        actionLists[listId][index].type = newType;
        
        const mainInput = item.querySelector('.main-input');
        
        if (newType === 'filter') {
          item.classList.add('filter-type');
          mainInput.classList.add('is-hidden');
        } else {
          item.classList.remove('filter-type');
          mainInput.classList.remove('is-hidden');
          mainInput.placeholder = newType === 'scene' ? 'Scene name' : 'Source name';
        }
        autoSave();
      });
      
      item.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
          const field = e.target.dataset.field;
          let value = e.target.value;
          if (field === 'delay') {
            value = parseInt(value) || 0;
          }
          actionLists[listId][index][field] = value;
          autoSave();
        });
      });
    });
    
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

  function addActionItem(listId) {
    actionLists[listId].push({ type: 'source', name: '' });
    renderActionList(listId);
    
    const listEl = document.getElementById(listId + 'List');
    const items = listEl.querySelectorAll('.action-item');
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      const input = lastItem.querySelector('.main-input');
      if (input) input.focus();
    }
  }

  document.querySelectorAll('.add-btn[data-list]').forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = btn.dataset.list;
      addActionItem(listId);
    });
  });

  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const collapsible = header.parentElement;
      collapsible.classList.toggle('open');
    });
  });

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
        enabledToggle.checked = response.enabled !== false;
        updateStatusUI(response.connected, response.currentScene);
        
        if (response.score) {
          scoreValue.textContent = response.score;
          statsRow.classList.add('show');
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
        statsRow.classList.add('show');
      }
      
      if (result.gameOnShow) actionLists.gameOnShow = migrateOldFormat(result.gameOnShow);
      if (result.gameOnHide) actionLists.gameOnHide = migrateOldFormat(result.gameOnHide);
      if (result.gameEndShow) actionLists.gameEndShow = migrateOldFormat(result.gameEndShow);
      if (result.gameEndHide) actionLists.gameEndHide = migrateOldFormat(result.gameEndHide);
      if (result.myTurnShow) actionLists.myTurnShow = migrateOldFormat(result.myTurnShow);
      if (result.myTurnHide) actionLists.myTurnHide = migrateOldFormat(result.myTurnHide);
      if (result.opponentTurnShow) actionLists.opponentTurnShow = migrateOldFormat(result.opponentTurnShow);
      if (result.opponentTurnHide) actionLists.opponentTurnHide = migrateOldFormat(result.opponentTurnHide);
      
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
    turnIndicator.classList.add('show');
    turnIndicator.classList.remove('is-hidden');
    turnIndicator.className = `turn-indicator show ${isMyTurn ? 'my-turn' : 'enemy-turn'}`;
    turnText.textContent = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
  }
  
  function checkSetup() {
    const validUsernames = usernames.filter(u => u && u.trim() !== '');
    const filterSource = filterSourceInput.value.trim();
    const defaultFilter = defaultFilterInput.value.trim();
    
    const setupIndicator = document.getElementById('setupIndicator');
    
    if (validUsernames.length === 0 || !filterSource || !defaultFilter) {
      setupIndicator.classList.remove('is-hidden');
      turnIndicator.classList.remove('show');
      turnIndicator.classList.add('is-hidden');
      return false;
    } else {
      setupIndicator.classList.add('is-hidden');
      if (window._lastTurnState !== undefined) {
        updateTurnUI(window._lastTurnState);
      }
      return true;
    }
  }

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

  // ★ Update-Check beim Start
  checkForUpdate();

  // Dismiss update banner
  const updateDismiss = document.getElementById('updateDismiss');
  if (updateDismiss) {
    updateDismiss.addEventListener('click', () => {
      document.getElementById('updateBanner').classList.remove('show');
    });
  }

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

      // Account Info Modal
    licenseInfoBtn.addEventListener('click', () => {
      chrome.storage.local.get(['authUsername', 'subscription', 'expiry', 'timeleft'], (result) => {
        licenseInfoKey.textContent = result.authUsername || 'Unknown';
        
        // Plan
        const planEl = document.getElementById('licenseInfoPlan');
        if (planEl) {
          planEl.textContent = result.subscription || 'Unknown';
        }
        
        // Expiry
        const expiryEl = document.getElementById('licenseInfoExpiry');
        if (expiryEl && result.expiry) {
          const expiryDate = new Date(result.expiry * 1000);
          const now = Date.now();
          const timeleft = result.timeleft || Math.floor((expiryDate.getTime() - now) / 1000);
          
          if (timeleft > 315360000) {
            // Mehr als 10 Jahre = Lifetime
            expiryEl.innerHTML = '<span class="license-lifetime"><i class="bx bx-infinite"></i> Lifetime</span>';
          } else if (timeleft > 86400) {
            const days = Math.floor(timeleft / 86400);
            expiryEl.textContent = `${days} day${days !== 1 ? 's' : ''} remaining`;
          } else if (timeleft > 3600) {
            const hours = Math.floor(timeleft / 3600);
            expiryEl.textContent = `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
          } else if (timeleft > 0) {
            const mins = Math.floor(timeleft / 60);
            expiryEl.textContent = `${mins} minute${mins !== 1 ? 's' : ''} remaining`;
          } else {
            expiryEl.innerHTML = '<span class="license-expired">Expired</span>';
          }
        } else if (expiryEl) {
          expiryEl.textContent = '-';
        }
        
        licenseInfoModal.classList.add('show');
      });
    });

    licenseInfoClose.addEventListener('click', () => licenseInfoModal.classList.remove('show'));
    licenseInfoCloseBtn.addEventListener('click', () => licenseInfoModal.classList.remove('show'));
    deactivateLicenseBtn.addEventListener('click', logout);

    licenseInfoModal.addEventListener('click', (e) => {
      if (e.target === licenseInfoModal) licenseInfoModal.classList.remove('show');
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
      statsRow.classList.add('show');
    }
    if (message.type === 'filterProgress') {
      const pct = (message.current / message.total) * 100;
      setProgressWidth(pct);
      document.getElementById('progressText').textContent = `${message.current} / ${message.total} - ${message.filterName}`;
    }
    if (message.type === 'filtersDone') {
      document.getElementById('progressModal').classList.remove('show');
      const createFiltersBtn = document.getElementById('createFiltersBtn');
      
      createFiltersBtn.classList.remove('btn-state-success', 'btn-state-warning', 'btn-state-error');
      
      if (message.success) {
        createFiltersBtn.innerHTML = '<i class="bx bx-check"></i> Filters Created!';
        createFiltersBtn.classList.add('btn-state-success');
      } else if (message.successCount > 0) {
        createFiltersBtn.innerHTML = `<i class="bx bx-error"></i> ${message.successCount}/${message.successCount + message.errorCount} Created`;
        createFiltersBtn.classList.add('btn-state-warning');
      } else {
        createFiltersBtn.innerHTML = '<i class="bx bx-x"></i> Failed - Check Console';
        createFiltersBtn.classList.add('btn-state-error');
      }
      
      setTimeout(() => {
        createFiltersBtn.innerHTML = '<i class="bx bx-bolt-circle"></i> Create All Cam Filters';
        createFiltersBtn.classList.remove('btn-state-success', 'btn-state-warning', 'btn-state-error');
        createFiltersBtn.disabled = false;
      }, 3000);
    }
    if (message.type === 'filterUpdateProgress') {
      const pct = (message.current / message.total) * 100;
      setProgressWidth(pct);
      document.getElementById('progressText').textContent = `${message.current} / ${message.total} - ${message.filterName}`;
    }
    if (message.type === 'filterUpdateDone') {
      document.getElementById('progressModal').classList.remove('show');
      const updateFiltersBtn = document.getElementById('updateFiltersBtn');
      
      updateFiltersBtn.classList.remove('btn-state-success', 'btn-state-warning', 'btn-state-error');
      
      if (message.success) {
        updateFiltersBtn.innerHTML = '<i class="bx bx-check"></i> Filters Updated!';
        updateFiltersBtn.classList.add('btn-state-success');
      } else if (message.successCount > 0) {
        updateFiltersBtn.innerHTML = `<i class="bx bx-error"></i> ${message.successCount}/${message.successCount + message.errorCount} Updated`;
        updateFiltersBtn.classList.add('btn-state-warning');
      } else {
        updateFiltersBtn.innerHTML = '<i class="bx bx-x"></i> Failed - Check Console';
        updateFiltersBtn.classList.add('btn-state-error');
      }
      
      setTimeout(() => {
        updateFiltersBtn.innerHTML = '<i class="bx bx-refresh"></i> Update Filter Settings';
        updateFiltersBtn.classList.remove('btn-state-success', 'btn-state-warning', 'btn-state-error');
        updateFiltersBtn.disabled = false;
      }, 3000);
    }

    if (message.type === 'exportProgress') {
      const pct = (message.current / message.total) * 100;
      setProgressWidth(pct);
      document.getElementById('progressText').textContent = `${message.current} / ${message.total} - ${message.filterName}`;
    }
    if (message.type === 'exportFilterSettingsDone') {
      document.getElementById('progressModal').classList.remove('show');
      const exportBtn = document.getElementById('exportFiltersBtn');
      
      exportBtn.classList.remove('btn-state-success', 'btn-state-error');
      
      if (message.success) {
        // Retrieve the full data from chrome.storage.local (too large for message passing)
        chrome.storage.local.get('_exportedFilterData', (result) => {
          const data = result._exportedFilterData;
          if (data) {
            // Trigger JSON download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const filename = `dartzoom-filters-${data.sourceName}-${new Date().toISOString().slice(0,10)}.json`;
            
            // Use chrome.downloads API if available, fallback to window.open
            if (chrome.downloads && chrome.downloads.download) {
              chrome.downloads.download({ url: url, filename: filename, saveAs: true }, () => {
                URL.revokeObjectURL(url);
              });
            } else {
              // Fallback: open in new tab (user can save with Ctrl+S)
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              a.target = '_blank';
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }, 100);
            }
            
            // Clean up storage
            chrome.storage.local.remove('_exportedFilterData');
            
            exportBtn.innerHTML = `<i class="bx bx-check"></i> Exported ${data.filterCount} Filters!`;
            exportBtn.classList.add('btn-state-success');
          } else {
            exportBtn.innerHTML = '<i class="bx bx-x"></i> Export Failed (no data)';
            exportBtn.classList.add('btn-state-error');
          }
          
          setTimeout(() => {
            exportBtn.innerHTML = '<i class="bx bx-download"></i> Export Settings';
            exportBtn.classList.remove('btn-state-success', 'btn-state-error');
            exportBtn.disabled = false;
          }, 3000);
        });
        return; // Early return — the timeout is handled inside the callback
      } else {
        exportBtn.innerHTML = '<i class="bx bx-x"></i> Export Failed';
        exportBtn.classList.add('btn-state-error');
      }
      
      setTimeout(() => {
        exportBtn.innerHTML = '<i class="bx bx-download"></i> Export Settings';
        exportBtn.classList.remove('btn-state-success', 'btn-state-error');
        exportBtn.disabled = false;
      }, 3000);
    }

    // === IMPORT PROGRESS ===
    if (message.type === 'importProgress') {
      const pct = (message.current / message.total) * 100;
      setProgressWidth(pct);
      document.getElementById('progressText').textContent = `${message.current} / ${message.total} - ${message.filterName}`;
    }
    if (message.type === 'importFilterSettingsDone') {
      document.getElementById('progressModal').classList.remove('show');
      const importBtn = document.getElementById('importFiltersBtn');
      
      importBtn.classList.remove('btn-state-success', 'btn-state-warning', 'btn-state-error');
      
      if (message.success) {
        let label = `<i class="bx bx-check"></i> Restored ${message.successCount} Filters!`;
        if (message.skippedCount > 0) {
          label = `<i class="bx bx-check"></i> ${message.successCount} Restored, ${message.skippedCount} Skipped`;
        }
        importBtn.innerHTML = label;
        importBtn.classList.add(message.skippedCount > 0 ? 'btn-state-warning' : 'btn-state-success');
      } else if (message.successCount > 0) {
        importBtn.innerHTML = `<i class="bx bx-error"></i> ${message.successCount} OK, ${message.errorCount} Failed`;
        importBtn.classList.add('btn-state-warning');
      } else {
        importBtn.innerHTML = '<i class="bx bx-x"></i> Import Failed';
        importBtn.classList.add('btn-state-error');
      }
      
      setTimeout(() => {
        importBtn.innerHTML = '<i class="bx bx-upload"></i> Import Settings';
        importBtn.classList.remove('btn-state-success', 'btn-state-warning', 'btn-state-error');
        importBtn.disabled = false;
      }, 4000);
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
    
    setProgressWidth(0);
    document.getElementById('progressText').textContent = '0 / 64';
    
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
    
    setProgressWidth(0);
    document.getElementById('progressText').textContent = '0 / 64';
    
    updateFiltersBtn.disabled = true;
    
    chrome.runtime.sendMessage({
      type: 'updateAllFilters',
      sourceName: source,
      duration: duration,
      easing: easing,
      easingType: easingType
    });
  });

  // ============== FILTER BACKUP / RESTORE ==============

  const exportFiltersBtn = document.getElementById('exportFiltersBtn');
  const importFiltersBtn = document.getElementById('importFiltersBtn');
  const importFileInput = document.getElementById('importFileInput');

  exportFiltersBtn.addEventListener('click', () => {
    const source = filterSourceInput.value.trim();
    if (!source) {
      alert('Please enter a Source name first!');
      return;
    }

    progressHeader.textContent = 'Exporting Filter Settings...';
    progressModal.classList.add('show');
    setProgressWidth(0);
    document.getElementById('progressText').textContent = '0 / 64';
    exportFiltersBtn.disabled = true;

    chrome.runtime.sendMessage({
      type: 'exportFilterSettings',
      sourceName: source
    });
  });

  importFiltersBtn.addEventListener('click', () => {
    const source = filterSourceInput.value.trim();
    if (!source) {
      alert('Please enter a Source name first!');
      return;
    }
    // Trigger file picker
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const source = filterSourceInput.value.trim();

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const filterData = JSON.parse(event.target.result);

        // Validate JSON structure
        if (!filterData.filters || !Array.isArray(filterData.filters)) {
          alert('Invalid backup file: no filters found.');
          return;
        }

        const count = filterData.filters.length;
        const origSource = filterData.sourceName || '?';
        const date = filterData.exportDate ? new Date(filterData.exportDate).toLocaleString() : '?';

        if (!confirm(
          `Import ${count} filter settings?\n\n` +
          `From: ${origSource}\n` +
          `Date: ${date}\n` +
          `To: ${source}\n\n` +
          `This will overwrite all current filter positions on "${source}".\n` +
          `Filters that don't exist on the source will be skipped.`
        )) {
          return;
        }

        progressHeader.textContent = 'Importing Filter Settings...';
        progressModal.classList.add('show');
        setProgressWidth(0);
        document.getElementById('progressText').textContent = `0 / ${count}`;
        importFiltersBtn.disabled = true;

        chrome.runtime.sendMessage({
          type: 'importFilterSettings',
          sourceName: source,
          filterData: filterData
        });
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  }   // ← schließt initMainApp()
});   // ← schließt DOMContentLoaded