'use strict';
const byId = id => document.getElementById(id);
const installButton = byId('install');
let installPrompt;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function updateInstalled() { if (standalone()) { installButton.hidden = true; byId('installHelp').hidden = true; } }
updateInstalled();
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; installButton.textContent = '＋ Встановити My Apps'; });
installButton.addEventListener('click', async () => {
  if (!installPrompt) { byId('installHelp').hidden = !byId('installHelp').hidden; return; }
  try { await installPrompt.prompt(); const choice = await installPrompt.userChoice; if (choice.outcome === 'accepted') installButton.hidden = true; }
  catch { byId('installHelp').hidden = false; }
  finally { installPrompt = null; }
});
window.addEventListener('appinstalled', () => { installButton.hidden = true; byId('installHelp').hidden = true; });
byId('openNote').addEventListener('click', () => { byId('noteDialog').showModal(); byId('note').focus(); });
byId('closeNote').addEventListener('click', () => byId('noteDialog').close());
const noteKey = 'my-apps-note:' + new URL('.', location.href).pathname;
try { byId('note').value = localStorage.getItem(noteKey) || ''; } catch { byId('saveState').textContent = 'Збереження недоступне в цьому браузері.'; }
byId('note').addEventListener('input', () => {
  try { localStorage.setItem(noteKey, byId('note').value); byId('saveState').textContent = 'Збережено на цьому пристрої. Між пристроями не синхронізується.'; }
  catch { byId('saveState').textContent = 'Не вдалося зберегти. Скопіюй текст, перш ніж закривати.'; }
});
function connection() { byId('connection').textContent = navigator.onLine ? 'Мій простір' : 'Офлайн'; }
connection(); window.addEventListener('online', connection); window.addEventListener('offline', connection);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => { byId('offlineState').textContent = 'Готово до роботи офлайн.'; }).catch(() => { byId('offlineState').textContent = 'Офлайн наразі недоступний. Спробуй перезавантажити сторінку.'; });
}
