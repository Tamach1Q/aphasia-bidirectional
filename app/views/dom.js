// Shared DOM helpers. Views own meaning; this module only owns shell mechanics.

export function byId(id) {
  return document.getElementById(id);
}

export function setStatus(text, active = false) {
  byId('statusText').textContent = text;
  byId('statusDot').classList.toggle('active', active);
}

export function setBottomBar(visible) {
  byId('bottomBar').hidden = !visible;
}

export function setMain(html) {
  byId('mainArea').innerHTML = html;
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

export function icon(name) {
  const paths = {
    mic: '<path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><path d="M12 18v3M8 21h8"></path>',
    keyboard: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 13h12M8 16h8"></path>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path>',
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || '') + '</svg>';
}
