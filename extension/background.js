// background.js - DartZoom by Followdarts - Move Transition Filter Control

const DEBUG = false;
function log(...args) { if (DEBUG) console.log(...args); }

let ws = null;
let obsIdentified = false;
let currentScene = null;
let messageId = 1;
const pendingRequests = new Map();

// Game state
let currentPlayers = [];
let myPlayerIndex = -1;
let isMyTurn = false;
let lastActiveFilter = null;
let throwDisplayTimeout = null;
let isFirstStateUpdate = true;
let gameActive = false;  // Tracks if a game is currently running

// Score tracking
let myCurrentScore = 0;
let currentTurnScore = 0;
let checkoutGuide = null;
let dartsThrown = 0;
let isBusted = false;

// T20 Streak tracking
let t20Streak = 0;

// Prediction tracking
let predictedSegment = null;
let showingPrediction = false;

// Settings
let settings = {
  obsUrl: 'ws://localhost:4455',
  obsPassword: '',
  enabled: true,
  usernames: [],  // Changed from username to usernames array
  filterScene: 'Board',
  filterSource: 'Boardcam',
  defaultFilter: 'Default',
  throwDuration: 2000,
  checkoutScore: 170,  // Score at which checkout zoom starts
  filterDuration: 800,  // Duration for Move Source filters in ms
  filterEasing: 2,  // Easing function index (default: Kubisch/Cubic = 2)
  filterEasingType: 3,  // Easing type: 0=None, 1=In, 2=Out, 3=InOut (default: Ease In and Out = 3)
  // Sound settings
  zoomSound: '',
  defaultSound: '',
  // Source visibility lists
  gameOnShow: [],
  gameOnHide: [],
  gameEndShow: [],
  gameEndHide: [],
  myTurnShow: [],
  myTurnHide: [],
  opponentTurnShow: [],
  opponentTurnHide: []
};

// Easing function mapping for OBS Move Source filter (easing_function_match)
// 1=Quadratisch, 2=Kubisch, 3=Quartisch, 4=Quintisch, 5=Sinus, 
// 6=Kreisfunktion, 7=Exponentiell, 8=Elastisch, 9=Aufspringen, 10=Zurückfedern
const EASING_FUNCTIONS = {
  1: 'Quadratic',
  2: 'Cubic',
  3: 'Quartic',
  4: 'Quintic',
  5: 'Sine',
  6: 'Circular',
  7: 'Exponential',
  8: 'Elastic',
  9: 'Bounce',
  10: 'Back'
};

// Easing type mapping (easing_match)
// 0=None, 1=Ease In, 2=Ease Out, 3=Ease In and Out
const EASING_TYPES = {
  0: 'None',
  1: 'In',
  2: 'Out',
  3: 'InOut'
};

// Filter mapping - defined separately so it's never overwritten
const FILTER_MAPPING = {
  'S1': 'S1', 'S2': 'S2', 'S3': 'S3', 'S4': 'S4',
  'S5': 'S5', 'S6': 'S6', 'S7': 'S7', 'S8': 'S8',
  'S9': 'S9', 'S10': 'S10', 'S11': 'S11', 'S12': 'S12',
  'S13': 'S13', 'S14': 'S14', 'S15': 'S15', 'S16': 'S16',
  'S17': 'S17', 'S18': 'S18', 'S19': 'S19', 'S20': 'S20',
  'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'D4': 'D4',
  'D5': 'D5', 'D6': 'D6', 'D7': 'D7', 'D8': 'D8',
  'D9': 'D9', 'D10': 'D10', 'D11': 'D11', 'D12': 'D12',
  'D13': 'D13', 'D14': 'D14', 'D15': 'D15', 'D16': 'D16',
  'D17': 'D17', 'D18': 'D18', 'D19': 'D19', 'D20': 'D20',
  'T1': 'T1', 'T2': 'T2', 'T3': 'T3', 'T4': 'T4',
  'T5': 'T5', 'T6': 'T6', 'T7': 'T7', 'T8': 'T8',
  'T9': 'T9', 'T10': 'T10', 'T11': 'T11', 'T12': 'T12',
  'T13': 'T13', 'T14': 'T14', 'T15': 'T15', 'T16': 'T16',
  'T17': 'T17', 'T18': 'T18', 'T19': 'T19', 'T20': 'T20',
  // Bull / Single Bull
  'Bull': 'Bull', 'BULL': 'Bull', '25': 'Bull', 'SB': 'Bull', 'Single Bull': 'Bull',
  // Double Bull / Bullseye  
  'D-Bull': 'OuterBull', 'D-BULL': 'OuterBull', 'DBull': 'OuterBull', 'DBULL': 'OuterBull',
  '50': 'OuterBull', 'D25': 'OuterBull', 'DB': 'OuterBull', 'Double Bull': 'OuterBull', 'Bullseye': 'OuterBull',
  // Miss
  'MISS': 'Miss', 'Miss': 'Miss', 'OUT': 'Miss', 'Out': 'Miss', '0': 'Miss'
};

// All filter names for batch operations
const ALL_FILTER_NAMES = [
  'Default',
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10',
  'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10',
  'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
  'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20',
  'Bull', 'OuterBull', 'Miss'
];

// Function to get filter from mapping
function getFilterForSegment(segmentName) {
  if (!segmentName) return null;
  
  // Direct lookup
  if (FILTER_MAPPING[segmentName]) {
    return FILTER_MAPPING[segmentName];
  }
  
  // Case-insensitive fallback
  const lowerName = segmentName.toLowerCase();
  for (const [key, value] of Object.entries(FILTER_MAPPING)) {
    if (key.toLowerCase() === lowerName) {
      log(`[Filter] Case-insensitive match: "${segmentName}" -> "${key}" -> "${value}"`);
      return value;
    }
  }
  
  log(`[Filter] No mapping found for: "${segmentName}"`);
  return null;
}

// Check if a player name matches any of our tracked usernames
function isTrackedPlayer(playerName) {
  if (!playerName || !settings.usernames || settings.usernames.length === 0) return false;
  const lowerPlayerName = playerName.toLowerCase().trim();
  const matched = settings.usernames.some(username => 
    username && username.toLowerCase().trim() === lowerPlayerName
  );
  return matched;
}

// ============== CRYPTO HELPERS ==============

async function sha256base64(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  let binary = '';
  hashArray.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

async function generateAuthString(password, salt, challenge) {
  const secretHash = await sha256base64(password + salt);
  return await sha256base64(secretHash + challenge);
}

// ============== OBS CONNECTION ==============

function connectOBS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  
  log('[OBS] Connecting to', settings.obsUrl);
  
  try {
    ws = new WebSocket(settings.obsUrl);
    
    ws.onopen = () => log('[OBS] WebSocket connected...');
    
    ws.onmessage = async (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      
      if (msg.op === 0) {
        const identifyPayload = { op: 1, d: { rpcVersion: 1 } };
        if (msg.d.authentication && settings.obsPassword) {
          const { salt, challenge } = msg.d.authentication;
          identifyPayload.d.authentication = await generateAuthString(settings.obsPassword, salt, challenge);
        }
        ws.send(JSON.stringify(identifyPayload));
      }
      
      if (msg.op === 2) {
        obsIdentified = true;
        log('[OBS] ✓ Connected!');
        broadcastStatus('connected');
        getCurrentScene();
      }
      
      if (msg.op === 5 && msg.d.eventType === 'CurrentProgramSceneChanged') {
        currentScene = msg.d.eventData.sceneName;
      }
      
      if (msg.op === 7) {
        const { requestId, requestType, responseData, requestStatus } = msg.d;
        if (requestType === 'GetCurrentProgramScene' && responseData) {
          currentScene = responseData.currentProgramSceneName;
        }
        const callback = pendingRequests.get(requestId);
        if (callback) {
          pendingRequests.delete(requestId);
          callback(requestStatus?.result ? responseData : null, requestStatus?.result ? null : requestStatus);
        }
      }
    };
    
    ws.onclose = () => {
      obsIdentified = false;
      broadcastStatus('disconnected');
      if (settings.enabled) setTimeout(connectOBS, 5000);
    };
    
    ws.onerror = () => broadcastStatus('error');
    
  } catch (error) {
    if (settings.enabled) setTimeout(connectOBS, 5000);
  }
}

function broadcastStatus(status) {
  chrome.runtime.sendMessage({ type: 'status', status }).catch(() => {});
}

function sendRequest(requestType, requestData, callback) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !obsIdentified) {
    if (callback) callback(null, new Error('Not connected'));
    return false;
  }
  const requestId = String(messageId++);
  if (callback) pendingRequests.set(requestId, callback);
  ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
  return true;
}

function getCurrentScene() {
  sendRequest('GetCurrentProgramScene', {}, (data) => {
    if (data) currentScene = data.currentProgramSceneName;
  });
}

// ============== MOVE TRANSITION FILTER CONTROL ==============

async function setFilterEnabled(filterName, enabled) {
  if (!filterName || !settings.filterSource || !obsIdentified) {
    log(`[Filter] Cannot set - filterName=${filterName}, source=${settings.filterSource}, connected=${obsIdentified}`);
    return false;
  }
  
  return new Promise((resolve) => {
    sendRequest('SetSourceFilterEnabled', {
      sourceName: settings.filterSource,
      filterName: filterName,
      filterEnabled: enabled
    }, (_, err) => {
      if (!err) {
        log(`[Filter] ✓ ${settings.filterSource} -> ${filterName} ${enabled ? 'ON' : 'OFF'}`);
      } else {
        log(`[Filter] ✗ Error: source="${settings.filterSource}", filter="${filterName}"`, err);
      }
      resolve(!err);
    });
  });
}

// Set filter enabled on any source (for action lists)
// If activating a filter on filterSource, deactivates the previous active filter first
async function setAnyFilterEnabled(sceneName, sourceName, filterName, enabled) {
  if (!sceneName || !sourceName || !filterName || !obsIdentified) {
    return false;
  }
  
  // If activating a filter on the camera source, deactivate the previous one first
  if (enabled && sourceName === settings.filterSource && lastActiveFilter && lastActiveFilter !== filterName) {
    await setFilterEnabled(lastActiveFilter, false);
  }
  
  return new Promise((resolve) => {
    sendRequest('SetSourceFilterEnabled', {
      sourceName: sourceName,
      filterName: filterName,
      filterEnabled: enabled
    }, (_, err) => {
      if (!err) {
        // Track active filter if it's on the camera source
        if (sourceName === settings.filterSource && enabled) {
          lastActiveFilter = filterName;
        }
      } else {
      }
      resolve(!err);
    });
  });
}

// Switch to a scene
async function switchToScene(sceneName) {
  if (!sceneName || !obsIdentified) return false;
  
  return new Promise((resolve) => {
    sendRequest('SetCurrentProgramScene', {
      sceneName: sceneName
    }, (_, err) => {
      if (!err) {
        currentScene = sceneName;
      } else {
      }
      resolve(!err);
    });
  });
}

// ============== SOURCE VISIBILITY CONTROL ==============

async function setSourceVisibility(sourceName, visible) {
  if (!sourceName || !obsIdentified) return false;
  
  // Use current active scene for source visibility
  const sceneName = currentScene || settings.filterScene;
  if (!sceneName) return false;
  
  return new Promise((resolve) => {
    sendRequest('GetSceneItemId', { sceneName: sceneName, sourceName }, (data) => {
      if (!data) { 
        resolve(false); 
        return; 
      }
      sendRequest('SetSceneItemEnabled', {
        sceneName: sceneName,
        sceneItemId: data.sceneItemId,
        sceneItemEnabled: visible
      }, (_, err) => {
        if (!err) {
        } else {
        }
        resolve(!err);
      });
    });
  });
}

// Play a sound via OBS Media Source
async function playSound(mediaSourceName) {
  if (!mediaSourceName || !obsIdentified) return false;
  
  return new Promise((resolve) => {
    // Restart the media source to play from beginning
    sendRequest('TriggerMediaInputAction', {
      inputName: mediaSourceName,
      mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'
    }, (data, err) => {
      if (err) {
        log(`[Sound] Error playing "${mediaSourceName}":`, err);
        resolve(false);
      } else {
        log(`[Sound] Playing "${mediaSourceName}"`);
        resolve(true);
      }
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function activateMoveFilter(filterName) {
  if (!filterName) return;
  
  if (throwDisplayTimeout) {
    clearTimeout(throwDisplayTimeout);
    throwDisplayTimeout = null;
  }
  
  await setFilterEnabled(filterName, true);
  lastActiveFilter = filterName;
  log(`[Move] Activated: ${filterName}`);
}

async function showSegmentCamera(segmentName, keepShowing = false) {
  const filter = getFilterForSegment(segmentName);
  if (!filter) return;
  
  if (throwDisplayTimeout) {
    clearTimeout(throwDisplayTimeout);
    throwDisplayTimeout = null;
  }
  
  await activateMoveFilter(filter);
  
  // Play zoom sound
  if (settings.zoomSound) {
    playSound(settings.zoomSound);
  }
  
  if (!keepShowing) {
    throwDisplayTimeout = setTimeout(async () => {
      throwDisplayTimeout = null;
      if (!gameActive) return;  // Game ended - don't do anything
      
      if (isMyTurn) {
        await updatePredictionCamera();
      } else {
        // Turn hat gewechselt - zurück zu Default
        await returnToDefault();
      }
    }, settings.throwDuration);
  }
}

// ============== SMART PREDICTION LOGIC ==============

function getPredictedSegment() {
  const remainingScore = myCurrentScore;
  
  log(`[Predict] Score: ${remainingScore}, T20 streak: ${t20Streak}`);
  
  if (!remainingScore || remainingScore <= 0) {
    return null;
  }
  
  if (remainingScore > settings.checkoutScore) {
    if (t20Streak >= 2) {
      log(`[Predict] T20 streak ${t20Streak} - staying on T20`);
      return 'T20';
    }
    return null;
  }
  
  // CHECKOUT RANGE - Use Autodarts checkout guide
  if (checkoutGuide && checkoutGuide.length > 0) {
    const nextDart = checkoutGuide[0];
    if (nextDart && nextDart.name) {
      log(`[Predict] Checkout guide: ${nextDart.name}`);
      return nextDart.name;
    }
  }
  
  return null;
}

// ============== GAME STATE HANDLING ==============

async function handleStateUpdate(state) {
  const { player, players, gameScores, turnScore, turnBusted, checkoutGuide: guide, finished, gameFinished } = state;
  
  // Always log this for debugging multiple usernames
  
  if (!players || !settings.usernames || settings.usernames.length === 0) {
    return;
  }
  
  currentPlayers = players;
  
  // Check if current player is one of our tracked players
  const currentPlayerName = players[player]?.name;
  const currentPlayerIsTracked = currentPlayerName && isTrackedPlayer(currentPlayerName);
  
  
  // Find the tracked player for score tracking (use first found)
  myPlayerIndex = players.findIndex(p => p.name && isTrackedPlayer(p.name));
  
  if (myPlayerIndex === -1) {
    return;
  }
  
  const previousScore = myCurrentScore;
  // Use score of current player if they're tracked, otherwise keep previous score
  if (currentPlayerIsTracked && gameScores && gameScores[player] !== undefined) {
    myCurrentScore = gameScores[player];
  }
  currentTurnScore = turnScore || 0;
  checkoutGuide = guide;
  isBusted = turnBusted || false;
  
  if (state.turns && state.turns.length > 0) {
    const currentTurn = state.turns[state.turns.length - 1];
    dartsThrown = currentTurn?.throws?.length || 0;
  }
  
  const inCheckout = previousScore <= settings.checkoutScore && previousScore > 0;
  
  log(`[Game] Score: ${myCurrentScore}, Darts: ${dartsThrown}/3, Busted: ${isBusted}`);
  
  if (finished || gameFinished) {
    if (gameActive) {
      gameActive = false;
      t20Streak = 0;
      isFirstStateUpdate = true;  // Reset für nächstes Match
      
      // Stop any pending timers
      if (throwDisplayTimeout) {
        clearTimeout(throwDisplayTimeout);
        throwDisplayTimeout = null;
      }
      
      // First return to default, then apply Game End actions
      // Game End actions can override the default with their own filters
      (async () => {
        await returnToDefault();
        await sleep(100);
        await applySources(settings.gameEndHide, false);
        await sleep(50);
        await applySources(settings.gameEndShow, true);
      })();
    }
    return;
  }
  
  if (isBusted) {
    log('[Game] BUSTED!');
    await returnToDefault();
    return;
  }
  
  const wasMyTurn = isMyTurn;
  isMyTurn = currentPlayerIsTracked;  // True if ANY tracked player is currently throwing
  
  chrome.runtime.sendMessage({ type: 'turnChanged', isMyTurn }).catch(() => {});
  
  if (isFirstStateUpdate) {
    log(`[State] First state (GAME ON) - t20Streak: ${t20Streak}, dartsThrown: ${dartsThrown}, isMyTurn: ${isMyTurn}`);
    isFirstStateUpdate = false;
    gameActive = true;  // Mark game as active
    
    // Apply Game On sources
    (async () => {
      if (settings.gameOnHide && settings.gameOnHide.length > 0) {
        await applySources(settings.gameOnHide, false);
      }
      await sleep(50);
      if (settings.gameOnShow && settings.gameOnShow.length > 0) {
        await applySources(settings.gameOnShow, true);
      }
    })();
    
    // Beim ersten State den T20 Streak bewahren wenn es mein Turn ist
    handleTurnChange(isMyTurn, isMyTurn);
    return;
  }
  
  if (wasMyTurn !== isMyTurn) {
    // Echter Turn-Wechsel - Streak resetten
    handleTurnChange(isMyTurn, false);
  } else if (isMyTurn) {
    if (dartsThrown < 3) {
      if (inCheckout && dartsThrown > 0) {
        log(`[State] Checkout - waiting 1.5s`);
        setTimeout(async () => {
          if (gameActive && isMyTurn && dartsThrown < 3 && !isBusted) {
            updatePredictionCamera();
          }
        }, 1500);
      } else {
        updatePredictionCamera();
      }
    } else {
      setTimeout(async () => {
        if (gameActive && isMyTurn && dartsThrown >= 3) {
          await returnToDefault();
        }
      }, 2000);
    }
  }
}

async function handleTurnChange(myTurn, preserveStreak = false) {
  // Nur T20 Streak resetten wenn es ein echter Turn-Wechsel ist (nicht beim ersten State)
  if (!preserveStreak) {
    log(`[Turn] Resetting T20 streak (was ${t20Streak})`);
    t20Streak = 0;
  } else {
    log(`[Turn] Preserving T20 streak: ${t20Streak}`);
  }
  
  dartsThrown = 0;
  showingPrediction = false;
  predictedSegment = null;
  isBusted = false;
  
  log(`[Turn] ${myTurn ? 'MY TURN' : 'OPPONENT'}`);
  
  if (myTurn) {
    // Clear timer only when it's my turn
    if (throwDisplayTimeout) {
      clearTimeout(throwDisplayTimeout);
      throwDisplayTimeout = null;
    }
    
    // Erst hide, dann show
    await applySources(settings.myTurnHide, false);
    await sleep(50);
    await applySources(settings.myTurnShow, true);
    
    await returnToDefault();
    if (myCurrentScore <= settings.checkoutScore && myCurrentScore > 0) {
      await updatePredictionCamera();
    }
  } else {
    // Gegner ist dran - Zoom bleibt noch für throwDuration, dann Default
    // Falls noch ein Timer läuft (vom letzten Wurf), diesen weiterlaufen lassen
    // Falls nicht, neuen Timer setzen
    if (!throwDisplayTimeout && lastActiveFilter && lastActiveFilter !== settings.defaultFilter) {
      log(`[Turn] Setting timer to return to default after throw duration`);
      throwDisplayTimeout = setTimeout(async () => {
        throwDisplayTimeout = null;
        if (!gameActive) return;  // Game ended - don't do anything
        await returnToDefault();
      }, settings.throwDuration);
    }
    
    // Erst hide, dann show
    await applySources(settings.opponentTurnHide, false);
    await sleep(50);
    await applySources(settings.opponentTurnShow, true);
  }
}

// Helper: Apply actions to a list (sources, scenes, filters)
async function applySources(actionList, visible) {
  if (!actionList || actionList.length === 0) return;
  
  // Separate immediate actions (delay 0) from delayed actions
  const immediateActions = [];
  const delayedActions = [];
  
  for (const action of actionList) {
    // Handle legacy string format (just source names)
    if (typeof action === 'string') {
      immediateActions.push({ type: 'source', name: action, delay: 0 });
      continue;
    }
    
    if (!action || !action.type) continue;
    
    const delay = (action.delay || 0) * 1000; // Convert seconds to ms
    if (delay > 0) {
      delayedActions.push({ ...action, delayMs: delay });
    } else {
      immediateActions.push(action);
    }
  }
  
  // Execute immediate actions
  for (const action of immediateActions) {
    await executeAction(action, visible);
    await sleep(30);
  }
  
  // Schedule delayed actions
  for (const action of delayedActions) {
    setTimeout(() => {
      executeAction(action, visible);
    }, action.delayMs);
  }
}

// Execute a single action
async function executeAction(action, visible) {
  switch (action.type) {
    case 'source':
      if (action.name && action.name.trim()) {
        await setSourceVisibility(action.name.trim(), visible);
      }
      break;
      
    case 'scene':
      // Scene: only "show" makes sense (switch to scene)
      if (visible && action.name && action.name.trim()) {
        await switchToScene(action.name.trim());
      }
      break;
      
    case 'filter':
      if (action.scene && action.source && action.filter) {
        await setAnyFilterEnabled(
          action.scene.trim(),
          action.source.trim(),
          action.filter.trim(),
          visible
        );
      }
      break;
  }
}

// ============== THROW HANDLING ==============

async function handleThrow(segment) {
  if (!isMyTurn) {
    log(`[Throw] Ignored - not my turn`);
    return;
  }
  
  const segmentName = segment?.name;
  if (!segmentName) return;
  
  log(`[Throw] ${segmentName} | Score: ${myCurrentScore}, T20 streak: ${t20Streak}`);
  
  chrome.storage.local.set({ lastThrow: segment });
  dartsThrown++;
  
  const isT20 = segmentName === 'T20';
  
  // Score > checkoutScore OR Score not yet loaded (0) = we're in "T20 zone" (not checkout)
  // Bei Match-Start ist Score oft noch 0, also T20 Streak trotzdem zählen
  const checkoutThreshold = settings.checkoutScore || 170;
  const inT20Zone = myCurrentScore > checkoutThreshold || myCurrentScore === 0;
  
  if (inT20Zone) {
    if (isT20) {
      t20Streak++;
      log(`[T20] Streak: ${t20Streak} (Score: ${myCurrentScore})`);
      if (t20Streak >= 2) {
        log(`[T20] Streak >= 2, zooming to T20`);
        await showPredictionCamera('T20');
      }
      return;
    } else {
      if (t20Streak > 0) {
        log(`[T20] Streak broken by ${segmentName}`);
        t20Streak = 0;
        await returnToDefault();
      }
      return;
    }
  }
  
  t20Streak = 0;
  
  if (predictedSegment && myCurrentScore <= checkoutThreshold) {
    if (segmentName === predictedSegment) {
      log(`[Predict] ✓ HIT ${predictedSegment}!`);
    }
  }
}

async function showPredictionCamera(segmentName) {
  log(`[Predict] Looking up: "${segmentName}"`);
  
  const filter = getFilterForSegment(segmentName);
  if (!filter) {
    log(`[Predict] No filter for: "${segmentName}"`);
    return;
  }
  
  log(`[Predict] Found filter: "${filter}" for "${segmentName}"`);
  
  if (throwDisplayTimeout) {
    clearTimeout(throwDisplayTimeout);
    throwDisplayTimeout = null;
  }
  
  await activateMoveFilter(filter);
  predictedSegment = segmentName;
  showingPrediction = true;
}

async function updatePredictionCamera() {
  const prediction = getPredictedSegment();
  
  if (prediction) {
    log(`[Predict] Next: ${prediction}`);
    await showPredictionCamera(prediction);
  } else {
    await returnToDefault();
  }
}

async function returnToDefault() {
  if (throwDisplayTimeout) {
    clearTimeout(throwDisplayTimeout);
    throwDisplayTimeout = null;
  }
  
  if (settings.defaultFilter) {
    log(`[Camera] Default: ${settings.defaultFilter}`);
    await activateMoveFilter(settings.defaultFilter);
    
    // Play default sound
    if (settings.defaultSound) {
      playSound(settings.defaultSound);
    }
  }
  
  showingPrediction = false;
  predictedSegment = null;
}

async function resetToDefault() {
  if (throwDisplayTimeout) {
    clearTimeout(throwDisplayTimeout);
    throwDisplayTimeout = null;
  }
  
  t20Streak = 0;
  dartsThrown = 0;
  showingPrediction = false;
  predictedSegment = null;
  checkoutGuide = null;
  isBusted = false;
  
  if (settings.useEnemySource) {
    if (settings.enemySource) await setSourceVisibility(settings.enemySource, false);
    await sleep(50);
    if (settings.mySource) await setSourceVisibility(settings.mySource, true);
    if (settings.hideSourceOnEnemy) await setSourceVisibility(settings.hideSourceOnEnemy, true);
  }
  
  if (settings.defaultFilter) {
    await activateMoveFilter(settings.defaultFilter);
  }
}

// ============== FILTER UPDATE FUNCTIONS ==============

// Update a single filter's settings (duration, easing function and type)
function updateFilterSettings(sourceName, filterName, duration, easingFunction, easingType) {
  return new Promise((resolve) => {
    // First get current settings, then update only the ones we want
    sendRequest('GetSourceFilter', {
      sourceName: sourceName,
      filterName: filterName
    }, (currentData, getErr) => {
      if (getErr) {
        resolve(false);
        return;
      }
      
      // Merge current settings with new values
      const currentSettings = currentData?.filterSettings || {};
      const newSettings = {
        ...currentSettings,
        duration: duration,
        easing_match: easingType,               // Easing Type: 0=None, 1=In, 2=Out, 3=InOut
        easing_function_match: easingFunction   // Easing Function: 1=Quadratic, 2=Cubic, etc.
      };
      
      
      sendRequest('SetSourceFilterSettings', {
        sourceName: sourceName,
        filterName: filterName,
        filterSettings: newSettings
      }, (data, err) => {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  });
}

// Update all filters with new duration, easing function and type
async function updateAllFilters(sourceName, duration, easingFunction, easingType) {
  if (!sourceName || !obsIdentified) {
    chrome.runtime.sendMessage({ type: 'filterUpdateDone', success: false }).catch(() => {});
    return;
  }
  
  
  const total = ALL_FILTER_NAMES.length;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < ALL_FILTER_NAMES.length; i++) {
    const filterName = ALL_FILTER_NAMES[i];
    
    // Send progress update
    chrome.runtime.sendMessage({
      type: 'filterUpdateProgress',
      current: i + 1,
      total: total,
      filterName: filterName
    }).catch(() => {});
    
    const success = await updateFilterSettings(sourceName, filterName, duration, easingFunction, easingType);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Small delay between updates (longer because we do get+set per filter)
    await sleep(100);
  }
  
  chrome.runtime.sendMessage({ 
    type: 'filterUpdateDone', 
    success: errorCount === 0,
    successCount,
    errorCount
  }).catch(() => {});
}

// ============== MESSAGE HANDLING ==============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log(`[Message] Received: ${message.type}`);
  
  if (message.type === 'throw') {
    log(`[Message] Throw received:`, message.segment?.name);
    handleThrow(message.segment);
    sendResponse({ success: true });
  }
  
  if (message.type === 'state') {
    log(`[Message] State received: player=${message.player}, players=${message.players?.length}`);
    handleStateUpdate(message);
    sendResponse({ success: true });
  }
  
  if (message.type === 'matchStart') {
    
    // If a game was still active, end it first
    if (gameActive) {
      (async () => {
        await applySources(settings.gameEndHide, false);
        await sleep(50);
        await applySources(settings.gameEndShow, true);
      })();
    }
    
    gameActive = false;
    isFirstStateUpdate = true;
    myCurrentScore = 501;
    t20Streak = 0;
    dartsThrown = 0;
    sendResponse({ success: true });
  }
  
  if (message.type === 'matchEnd') {
    // Stop any pending timers
    if (throwDisplayTimeout) {
      clearTimeout(throwDisplayTimeout);
      throwDisplayTimeout = null;
    }
    
    // Always return to default on match end
    (async () => {
      await returnToDefault();
      
      // Only apply Game End actions if game was active
      if (gameActive) {
        gameActive = false;
        isFirstStateUpdate = true;
        await sleep(100);
        await applySources(settings.gameEndHide, false);
        await sleep(50);
        await applySources(settings.gameEndShow, true);
      }
    })();
    
    gameActive = false;
    isFirstStateUpdate = true;
    sendResponse({ success: true });
  }
  
  if (message.type === 'getStatus') {
    sendResponse({
      connected: obsIdentified,
      enabled: settings.enabled,
      obsUrl: settings.obsUrl,
      currentScene: currentScene,
      isMyTurn: isMyTurn,
      usernames: settings.usernames,
      score: myCurrentScore
    });
  }
  
  if (message.type === 'updateSettings') {
    settings = { ...settings, ...message.settings };
    chrome.storage.local.set(message.settings);
    if (ws) ws.close();
    obsIdentified = false;
    isFirstStateUpdate = true;
    if (settings.enabled) setTimeout(connectOBS, 500);
    sendResponse({ success: true });
  }
  
  if (message.type === 'reconnect') {
    if (ws) ws.close();
    obsIdentified = false;
    isFirstStateUpdate = true;
    setTimeout(connectOBS, 100);
    sendResponse({ success: true });
  }
  
  if (message.type === 'testCamera') {
    showSegmentCamera(message.segment, false);
    sendResponse({ success: true });
  }
  
  if (message.type === 'testTurn') {
    handleTurnChange(message.isMyTurn);
    sendResponse({ success: true });
  }
  
  if (message.type === 'testGameOn') {
    (async () => {
      await applySources(settings.gameOnHide, false);
      await sleep(50);
      await applySources(settings.gameOnShow, true);
    })();
    sendResponse({ success: true });
  }
  
  if (message.type === 'testGameEnd') {
    // Stop any pending timers
    if (throwDisplayTimeout) {
      clearTimeout(throwDisplayTimeout);
      throwDisplayTimeout = null;
    }
    (async () => {
      await returnToDefault();
      await sleep(100);
      await applySources(settings.gameEndHide, false);
      await sleep(50);
      await applySources(settings.gameEndShow, true);
    })();
    sendResponse({ success: true });
  }
  
  if (message.type === 'createAllFilters') {
    (async () => {
      // First get available filter kinds to find correct one
      const kinds = await getAvailableFilterKinds();
      
      // Look for the correct Move Source filter (not Move Transition Override)
      // The plugin ID is "move_source_filter" for Move Source
      // "move_transition_override_filter" is Move Transition Override (wrong one)
      let moveFilterKind = kinds.find(k => k === 'move_source_filter');
      
      if (!moveFilterKind) {
        // Fallback: look for any filter with 'move' and 'source' in the name
        moveFilterKind = kinds.find(k => 
          k.toLowerCase().includes('move') && 
          k.toLowerCase().includes('source') &&
          !k.toLowerCase().includes('transition')
        );
      }
      
      if (moveFilterKind) {
      } else {
      }
      
      await createAllFilters(message.sourceName, moveFilterKind || 'move_source_filter');
    })();
    sendResponse({ success: true });
  }
  
  if (message.type === 'updateAllFilters') {
    updateAllFilters(message.sourceName, message.duration, message.easing, message.easingType);
    sendResponse({ success: true });
  }
  
  return true;
});

// ============== FILTER CREATION ==============

// Get all existing filters for a source
function getSourceFilters(sourceName) {
  return new Promise((resolve) => {
    sendRequest('GetSourceFilterList', {
      sourceName: sourceName
    }, (data, err) => {
      if (err) {
        resolve([]);
      } else {
        resolve(data?.filters || []);
      }
    });
  });
}

// Delete a single filter
function deleteSourceFilter(sourceName, filterName) {
  return new Promise((resolve) => {
    sendRequest('RemoveSourceFilter', {
      sourceName: sourceName,
      filterName: filterName
    }, (data, err) => {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// Delete all filters from a source
async function deleteAllFilters(sourceName) {
  const filters = await getSourceFilters(sourceName);
  
  for (const filter of filters) {
    await deleteSourceFilter(sourceName, filter.filterName);
    await sleep(50);
  }
  
  return filters.length;
}

async function createAllFilters(sourceName, filterKind = 'move_source_filter') {
  if (!sourceName || !obsIdentified) {
    chrome.runtime.sendMessage({ type: 'filtersDone', success: false }).catch(() => {});
    return;
  }
  
  // First, delete all existing filters
  chrome.runtime.sendMessage({
    type: 'filterProgress',
    current: 0,
    total: 64,
    filterName: 'Deleting old filters...'
  }).catch(() => {});
  
  const deletedCount = await deleteAllFilters(sourceName);
  
  await sleep(200);
  
  
  const total = ALL_FILTER_NAMES.length;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < ALL_FILTER_NAMES.length; i++) {
    const filterName = ALL_FILTER_NAMES[i];
    
    // Send progress update
    chrome.runtime.sendMessage({
      type: 'filterProgress',
      current: i + 1,
      total: total,
      filterName: filterName
    }).catch(() => {});
    
    const success = await createMoveSourceFilter(sourceName, filterName, filterKind);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Small delay between filter creations
    await sleep(100);
  }
  
  chrome.runtime.sendMessage({ 
    type: 'filtersDone', 
    success: errorCount === 0,
    successCount,
    errorCount
  }).catch(() => {});
}

function createMoveSourceFilter(sourceName, filterName, filterKind) {
  return new Promise((resolve) => {
    sendRequest('CreateSourceFilter', {
      sourceName: sourceName,
      filterName: filterName,
      filterKind: filterKind,
      filterSettings: {
        duration: settings.filterDuration,
        easing_match: settings.filterEasingType,        // Easing Type: 0=None, 1=In, 2=Out, 3=InOut
        easing_function_match: settings.filterEasing    // Easing Function: 1=Quadratic, 2=Cubic, etc.
      }
    }, (data, err) => {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// Helper to get available filter kinds
function getAvailableFilterKinds() {
  return new Promise((resolve) => {
    sendRequest('GetSourceFilterKindList', {}, (data, err) => {
      if (err) {
        resolve([]);
      } else {
        resolve(data?.sourceFilterKinds || []);
      }
    });
  });
}

// ============== STARTUP ==============

const VERSION = '1.8.0';

chrome.storage.local.get([
  'obsUrl', 'obsPassword', 'enabled', 'usernames', 'username',  // Support both old and new
  'filterScene', 'filterSource', 'defaultFilter', 'throwDuration', 'checkoutScore',
  'filterDuration', 'filterEasing', 'filterEasingType',
  'zoomSound', 'defaultSound',
  'gameOnShow', 'gameOnHide', 'gameEndShow', 'gameEndHide',
  'myTurnShow', 'myTurnHide', 'opponentTurnShow', 'opponentTurnHide'
], (result) => {
  log(`[DartZoom] ========== VERSION ${VERSION} ==========`);
  log('[DartZoom] Loading settings...');
  
  if (result.obsUrl) settings.obsUrl = result.obsUrl;
  if (result.obsPassword) settings.obsPassword = result.obsPassword;
  if (result.enabled !== undefined) settings.enabled = result.enabled;
  
  // Handle migration from old single username to usernames array
  if (result.usernames && Array.isArray(result.usernames)) {
    settings.usernames = result.usernames;
  } else if (result.username) {
    // Migrate old single username
    settings.usernames = [result.username];
    // Save migrated data
    chrome.storage.local.set({ usernames: settings.usernames });
  }
  
  if (result.filterScene) settings.filterScene = result.filterScene;
  if (result.filterSource) settings.filterSource = result.filterSource;
  if (result.defaultFilter) settings.defaultFilter = result.defaultFilter;
  if (result.throwDuration) settings.throwDuration = result.throwDuration;
  if (result.checkoutScore) settings.checkoutScore = result.checkoutScore;
  if (result.filterDuration) settings.filterDuration = result.filterDuration;
  if (result.filterEasing !== undefined) settings.filterEasing = result.filterEasing;
  if (result.filterEasingType !== undefined) settings.filterEasingType = result.filterEasingType;
  
  // Sound settings
  if (result.zoomSound) settings.zoomSound = result.zoomSound;
  if (result.defaultSound) settings.defaultSound = result.defaultSound;
  
  // Source lists
  if (result.gameOnShow) settings.gameOnShow = result.gameOnShow;
  if (result.gameOnHide) settings.gameOnHide = result.gameOnHide;
  if (result.gameEndShow) settings.gameEndShow = result.gameEndShow;
  if (result.gameEndHide) settings.gameEndHide = result.gameEndHide;
  if (result.myTurnShow) settings.myTurnShow = result.myTurnShow;
  if (result.myTurnHide) settings.myTurnHide = result.myTurnHide;
  if (result.opponentTurnShow) settings.opponentTurnShow = result.opponentTurnShow;
  if (result.opponentTurnHide) settings.opponentTurnHide = result.opponentTurnHide;
  
  log('[DartZoom] Usernames:', settings.usernames.join(', ') || '(not set)');
  log('[DartZoom] Scene:', settings.filterScene);
  log('[DartZoom] Source:', settings.filterSource);
  log('[DartZoom] Default Filter:', settings.defaultFilter);
  log('[DartZoom] Checkout Score:', settings.checkoutScore);
  log('[DartZoom] Filter Duration:', settings.filterDuration);
  log('[DartZoom] Filter Easing:', settings.filterEasing);
  log('[DartZoom] Filter Easing Type:', settings.filterEasingType);
  log('[DartZoom] Zoom Sound:', settings.zoomSound || '(not set)');
  log('[DartZoom] Default Sound:', settings.defaultSound || '(not set)');
  
  if (settings.enabled) connectOBS();
});
