'use strict';
const $=id=>document.getElementById(id);
const key='my-apps-note:'+new URL('.',location.href).pathname;
$('openNote').onclick=()=>{try{$('note').value=localStorage.getItem(key)||'';}catch{$('noteState').textContent='Сховище браузера недоступне.';}$('noteDialog').showModal();};
$('closeNote').onclick=()=>$('noteDialog').close();
$('note').oninput=()=>{try{localStorage.setItem(key,$('note').value);$('noteState').textContent='Збережено на цьому пристрої. Нотатка не синхронізується.';}catch{$('noteState').textContent='Не вдалося зберегти. Скопіюй текст перед закриттям.';}};
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else $('installHelp').hidden=!$('installHelp').hidden;};window.addEventListener('appinstalled',()=>{$('install').hidden=true;});if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)$('install').hidden=true;
if('serviceWorker' in navigator&&location.protocol!=='file:'){let reload=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reload&&!$('noteDialog').open){reload=true;location.reload();}});navigator.serviceWorker.register('./sw.js').catch(()=>{});}
