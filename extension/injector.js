// injector.js - Injects script into page context

const script = document.createElement('script');
script.src = chrome.runtime.getURL('pageScript.js');
(document.documentElement || document.head).appendChild(script);

function safeSendMessage(message) {
  try {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage(message).catch(() => {});
    }
  } catch (e) {}
}

window.addEventListener('autodarts-throw', (event) => {
  safeSendMessage({
    type: 'throw',
    segment: event.detail.segment,
    coords: event.detail.coords,
    matchId: event.detail.matchId
  });
});

window.addEventListener('autodarts-match-start', (event) => {
  safeSendMessage({
    type: 'matchStart',
    matchId: event.detail.matchId
  });
});

window.addEventListener('autodarts-match-end', (event) => {
  safeSendMessage({
    type: 'matchEnd',
    matchId: event.detail.matchId,
    reason: event.detail.reason
  });
});

window.addEventListener('autodarts-state', (event) => {
  safeSendMessage({
    type: 'state',
    player: event.detail.player,
    players: event.detail.players,
    matchId: event.detail.matchId,
    finished: event.detail.finished,
    gameFinished: event.detail.gameFinished,
    gameScores: event.detail.gameScores,
    turnScore: event.detail.turnScore,
    turnBusted: event.detail.turnBusted,
    turns: event.detail.turns,
    checkoutGuide: event.detail.checkoutGuide
  });
});
