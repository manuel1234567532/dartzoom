// pageScript.js - Intercepts WebSocket messages from Autodarts

(function() {
  const DEBUG = false;
  function log(...args) { if (DEBUG) console.log(...args); }
  
  log('[DartZoom] pageScript.js loaded');
  
  function checkMessage(data) {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Log all events with 'event' field to debug
      if (msg.data && msg.data.event) {
        console.log('[DartZoom PageScript] Event received:', msg.data.event);
      }
      
      // Throw event
      if (msg.data && msg.data.event === 'throw' && msg.data.body) {
        const throwData = msg.data.body;
        log('[DartZoom] Throw:', throwData.segment?.name);
        window.dispatchEvent(new CustomEvent('autodarts-throw', { 
          detail: {
            coords: throwData.coords,
            segment: throwData.segment,
            matchId: msg.data.matchId
          }
        }));
        return true;
      }
      
      // Match start event
      if (msg.data && (msg.data.event === 'match-started' || msg.data.event === 'leg-started')) {
        console.log('[DartZoom PageScript] ===== MATCH START EVENT =====', msg.data.event);
        window.dispatchEvent(new CustomEvent('autodarts-match-start', { 
          detail: { matchId: msg.data.matchId }
        }));
        return true;
      }
      
      // Match end/cancel event - catch all possible end scenarios
      const endEvents = ['match-finished', 'match-cancelled', 'match-deleted', 'delete', 'match-aborted', 'aborted', 'cancelled', 'finished'];
      if (msg.data && msg.data.event && endEvents.includes(msg.data.event)) {
        console.log('[DartZoom PageScript] ===== MATCH END EVENT =====', msg.data.event);
        window.dispatchEvent(new CustomEvent('autodarts-match-end', { 
          detail: { matchId: msg.data.matchId, reason: msg.data.event }
        }));
        return true;
      }
      
      // State event
      if (msg.channel === 'autodarts.matches' && msg.topic?.endsWith('.state') && msg.data) {
        const state = msg.data;
        log('[DartZoom] State:', state.player);
        window.dispatchEvent(new CustomEvent('autodarts-state', { 
          detail: {
            player: state.player,
            players: state.players,
            matchId: state.id,
            round: state.round,
            finished: state.finished,
            gameFinished: state.gameFinished,
            gameScores: state.gameScores,
            turnScore: state.turnScore,
            turnBusted: state.turnBusted,
            turns: state.turns,
            checkoutGuide: state.state?.checkoutGuide || null
          }
        }));
        return true;
      }
      
    } catch (e) {}
    return false;
  }
  
  const origAddEventListener = WebSocket.prototype.addEventListener;
  WebSocket.prototype.addEventListener = function(type, listener, options) {
    if (type === 'message') {
      const wrappedListener = function(event) {
        checkMessage(event.data);
        return listener.call(this, event);
      };
      return origAddEventListener.call(this, type, wrappedListener, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };
  
  const origOnMessageDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
  Object.defineProperty(WebSocket.prototype, 'onmessage', {
    get: function() { return this._onmessageOriginal; },
    set: function(fn) {
      this._onmessageOriginal = fn;
      const wrapped = function(event) {
        checkMessage(event.data);
        if (fn) fn.call(this, event);
      };
      if (origOnMessageDescriptor && origOnMessageDescriptor.set) {
        origOnMessageDescriptor.set.call(this, wrapped);
      }
    }
  });
  
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    log('[DartZoom] WebSocket:', url);
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    return ws;
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
})();
