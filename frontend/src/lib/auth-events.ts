const SESSION_EXPIRED_EVENT = 'delta-help-desk-session-expired';

export function notifySessionExpired() {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function onSessionExpired(callback: () => void) {
  window.addEventListener(SESSION_EXPIRED_EVENT, callback);

  return () => {
    window.removeEventListener(SESSION_EXPIRED_EVENT, callback);
  };
}
