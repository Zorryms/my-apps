'use strict';
const $ = id => document.getElementById(id);
const labels = {want:'Хочу прочитати', reading:'Читаю', read:'Прочитано'};
let client, user, books = [], shelf = 'all', editing = null, cover = '', imageBusy = false, busy = false, loadSequence = 0;
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5500); }
function el(tag, text, className) { const e = document.createElement(tag); if(text !== undefined) e.textContent = text; if(className) e.className = className; return e; }
function safeUrl(value) { if(!value) return ''; try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
function errorText(error) { if(!navigator.onLine) return 'Немає інтернету. Зміни ще не збережено — підключись і спробуй знову.'; if(error?.code === '42501') return 'Недостатньо прав доступу. Увійди у свій акаунт.'; if(error?.code === '23505') return 'Така книга вже існує. Онови бібліотеку.'; return 'Не вдалося виконати дію. Перевір з’єднання та спробуй ще раз.'; }
async function loadBooks() {
 if(!client || !user) return;
 const sequence = ++loadSequence, uid = user.id; $('syncState').textContent = 'Синхронізація…';
 let all = [], start = 0;
 try {
  while(true) { const {data,error} = await client.from('books').select('*').eq('user_id',uid).order('id').range(start,start+199); if(error) throw error; all.push(...data); if(data.length<200) break; start += 200; }
  if(sequence !== loadSequence || user?.id !== uid) return;
  books = all; render(); $('syncState').textContent = '✓ Синхронізовано';
 } catch(error) { if(sequence !== loadSequence) return; $('syncState').textContent = 'Не синхронізовано'; toast(errorText(error)); }
}
function render() {
 const active = books.filter(b=>!b.deleted_at); $('total').textContent = active.length;
 for(const button of $('shelves').children) { const key=button.dataset.shelf; button.setAttribute('aria-pressed',String(key===shelf)); button.querySelector('span').textContent = key==='trash' ? books.filter(b=>b.deleted_at).length : key==='all' ? active.length : active.filter(b=>b.shelf===key).length; }
 const q=$('search').value.trim().toLocaleLowerCase('uk');
 const filtered=books.filter(b => (shelf==='trash' ? !!b.deleted_at : !b.deleted_at && (shelf==='all'||b.shelf===shelf)) && `${b.title} ${b.author} ${b.notes}`.toLocaleLowerCase('uk').includes(q));
 const sort=$('sort').value; filtered.sort((a,b)=>sort==='new' ? b.created_at.localeCompare(a.created_at) : a[sort].localeCompare(b[sort],'uk'));
 $('books').replaceChildren();
 for(const b of filtered) {
  const card=el('article',undefined,'book-card'); const open=el('button',undefined,'cover-button'); open.setAttribute('aria-label','Відкрити книгу '+b.title); open.onclick=()=>openEditor(b);
  const stage=el('div',undefined,'cover-stage');
  if(b.cover) { const img=el('img'); img.src=b.cover; img.alt='Обкладинка: '+b.title; img.loading='lazy'; stage.append(img); }
  else { const p=el('div',undefined,'book-placeholder'); const colors=['#82616e','#657c90','#bd8960','#827d5b','#a06353']; let hash=0; for(const c of b.id) hash+=c.charCodeAt(0); p.style.setProperty('--book-color',colors[hash%colors.length]); p.append(el('small',b.author||'МОЯ БІБЛІОТЕКА'),el('strong',b.title),el('span','✳','cover-symbol')); stage.append(p); }
  open.append(stage); card.append(open,el('h3',b.title),el('p',b.author||'Автор не вказаний'));
  const bottom=el('div',undefined,'card-bottom');
  if(b.deleted_at) { const restore=el('button','↶ Відновити','quiet'); restore.onclick=()=>updateBook(b,{deleted_at:null},'Книгу повернуто на полицю'); bottom.append(restore); }
  else { const select=el('select'); select.setAttribute('aria-label','Полиця: '+b.title); for(const [value,name] of Object.entries(labels)) { const option=el('option',name); option.value=value; select.append(option); } select.value=b.shelf; select.onchange=async()=>{select.disabled=true; const ok=await updateBook(b,{shelf:select.value},'Книгу переміщено'); if(!ok) select.value=b.shelf; select.disabled=false;}; bottom.append(select); }
  if(b.rating) bottom.append(el('span','★'.repeat(b.rating),'stars')); card.append(bottom); $('books').append(card);
 }
 $('empty').hidden=filtered.length>0; $('emptyTitle').textContent=q?'Не знайшлося книги':shelf==='trash'?'Кошик порожній':'Твоя історія починається тут'; $('emptyText').textContent=q?'Спробуй іншу назву чи автора.':shelf==='trash'?'Видалені книги можна буде відновити звідси.':'Додай книгу або перемісти її на цю полицю.'; $('emptyAdd').hidden=!!q||shelf==='trash';
}
function previewCover() { $('coverPreview').replaceChildren(); if(cover) { const img=el('img'); img.src=cover; img.alt='Обрана обкладинка'; $('coverPreview').append(img); } else $('coverPreview').textContent='▤'; }
function openEditor(book=null) {
 editing=book; cover=book?.cover||''; $('bookForm').reset(); $('editorTitle').textContent=book?'Твоя книга':'Нова книга'; $('bookTitle').value=book?.title||''; $('bookAuthor').value=book?.author||''; $('bookShelf').value=book?.shelf||(labels[shelf]?shelf:'want'); $('bookRating').value=book?.rating||0; $('bookUrl').value=book?.url||''; $('bookNotes').value=book?.notes||''; $('formError').textContent=''; $('trashBook').hidden=!book||!!book.deleted_at; $('saveBook').textContent=book?.deleted_at?'Відновити та зберегти':'Зберегти книгу'; $('visitBook').hidden=!safeUrl(book?.url); if(safeUrl(book?.url)) $('visitBook').href=safeUrl(book.url); previewCover(); $('editor').showModal();
}
async function updateBook(book, changes, message) {
 try { const {data,error}=await client.from('books').update(changes).eq('id',book.id).eq('user_id',user.id).select().single(); if(error) throw error; books=books.map(b=>b.id===data.id?data:b); render(); toast(message); return true; } catch(error) {toast(errorText(error)); return false;}
}
$('addBook').onclick=()=>openEditor(); $('emptyAdd').onclick=()=>openEditor(); $('closeEditor').onclick=()=>{if(!busy&&!imageBusy) $('editor').close();}; $('editor').addEventListener('cancel',event=>{if(busy||imageBusy)event.preventDefault();});
$('bookForm').onsubmit=async event=>{
 event.preventDefault(); if(busy||imageBusy||!user) return; const title=$('bookTitle').value.trim(); if(!title){$('formError').textContent='Вкажи назву книги.';return;}
 const url=$('bookUrl').value.trim(); if(url&&!safeUrl(url)){$('formError').textContent='Посилання має починатися з https:// або http://.';return;}
 busy=true; $('saveBook').disabled=true; $('formError').textContent='';
 const record={title,author:$('bookAuthor').value.trim(),shelf:$('bookShelf').value,rating:Number($('bookRating').value),notes:$('bookNotes').value,url:safeUrl(url),cover,deleted_at:null};
 try { let result; if(editing) result=await client.from('books').update(record).eq('id',editing.id).eq('user_id',user.id).select().single(); else result=await client.from('books').insert({...record,user_id:user.id}).select().single(); if(result.error) throw result.error; books=books.filter(b=>b.id!==result.data.id).concat(result.data); render(); $('editor').close(); toast('Книгу збережено й синхронізовано'); } catch(error) {$('formError').textContent=errorText(error);} finally {busy=false;$('saveBook').disabled=false;}
};
$('trashBook').onclick=async()=>{if(!editing||busy)return;busy=true; $('trashBook').disabled=true; try {if(await updateBook(editing,{deleted_at:new Date().toISOString()},'Книгу перенесено до кошика. Її можна відновити.'))$('editor').close();}finally{busy=false;$('trashBook').disabled=false;}};
$('coverFile').onchange=async()=>{
 const file=$('coverFile').files[0]; if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){$('formError').textContent='Вибери JPG, PNG або WebP до 10 МБ.';return;}
 imageBusy=true;$('saveBook').disabled=true; const objectUrl=URL.createObjectURL(file);
 try {const img=new Image();img.src=objectUrl;await img.decode(); if(img.width*img.height>50000000)throw new Error('size');const scale=Math.min(1,600/img.width,900/img.height);const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);const next=canvas.toDataURL('image/jpeg',.82);if(next.length>1000000)throw new Error('size');cover=next;previewCover();$('formError').textContent='';}catch{$('formError').textContent='Не вдалося прочитати зображення. Спробуй інший файл.';}finally{URL.revokeObjectURL(objectUrl);imageBusy=false;$('saveBook').disabled=false;}
};
$('removeCover').onclick=()=>{if(imageBusy)return;cover='';$('coverFile').value='';previewCover();};
$('search').oninput=render; $('sort').onchange=render; $('shelves').onclick=e=>{const b=e.target.closest('button[data-shelf]');if(b){shelf=b.dataset.shelf;render();}}; $('refresh').onclick=loadBooks;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({format:'my-library',version:1,exported_at:new Date().toISOString(),books},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='my-library-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Резервну копію підготовлено для завантаження');};
$('import').onclick=()=>$('backupFile').click();
$('backupFile').onchange=async()=>{
 const file=$('backupFile').files[0];if(!file||!user)return; $('import').disabled=true;
 try {if(file.size>50*1024*1024)throw new Error('format');const backup=JSON.parse(await file.text());if(backup.format!=='my-library'||backup.version!==1||!Array.isArray(backup.books)||backup.books.length>2000)throw new Error('format');
 const existing=new Set(books.map(b=>b.id)); const records=[];
 for(const b of backup.books){if(!b||typeof b.title!=='string'||!b.title.trim()||b.title.length>200||typeof b.author!=='string'||b.author.length>200||!Object.hasOwn(labels,b.shelf)||!Number.isInteger(b.rating)||b.rating<0||b.rating>5||typeof b.notes!=='string'||b.notes.length>20000||typeof b.cover!=='string'||b.cover.length>1000000||(b.cover&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.cover))||typeof b.url!=='string'||b.url.length>2000||(b.url&&!safeUrl(b.url)))throw new Error('format');if(existing.has(b.id))continue;const id=typeof b.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.id)?b.id:crypto.randomUUID();existing.add(id);records.push({id,user_id:user.id,title:b.title.trim(),author:b.author,shelf:b.shelf,rating:b.rating,notes:b.notes,cover:b.cover,url:safeUrl(b.url),deleted_at:null});}
 if(!records.length){toast('Усі ці книги вже є в бібліотеці. Нічого не змінено.');return;}
 const {error}=await client.from('books').insert(records);if(error)throw error;await loadBooks();toast('Додано книг: '+records.length+'. Наявні книги не змінено.');
 }catch(error){toast(error.message==='format'?'Це не коректна резервна копія бібліотеки (до 50 МБ).':errorText(error));}finally{$('import').disabled=false;$('backupFile').value='';}
};
function showSession(session) { const previous=user?.id;user=session?.user||null;const logged=!!user;$('library').hidden=!logged;$('loginPanel').hidden=logged;$('signout').hidden=!logged;if(previous!==user?.id){++loadSequence;books=[];render();if($('editor').open)$('editor').close();editing=null;cover='';$('bookForm').reset();previewCover();if(logged)void loadBooks();}if(!logged)$('syncState').textContent='Твій читацький простір';}
$('loginForm').onsubmit=async event=>{event.preventDefault();if(!client){$('loginError').textContent='Підключення ще налаштовується.';return;}$('loginSubmit').disabled=true;$('loginError').textContent='';try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error){$('loginError').textContent='Не вдалося увійти. Перевір email, пароль і з’єднання.';return;}$('password').value='';showSession(data.session);}catch{$('loginError').textContent='Немає зв’язку із сервером. Спробуй ще раз.';}finally{$('loginSubmit').disabled=false;}};
$('signout').onclick=async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error){toast('Не вдалося вийти. Перевір інтернет і спробуй ще раз.');return;}showSession(null);toast('Ти вийшов із бібліотеки на цьому пристрої');};
function start(){const cfg=window.LIBRARY_CONFIG;if(!window.supabase||!cfg?.url||!cfg?.key){$('loginError').textContent='Підключення бібліотеки ще налаштовується. Якщо налаштування вже завершено, перевір інтернет і онови сторінку.';return;}client=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'my-library-auth'}});client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>showSession(session),0);});client.auth.getSession().then(({data,error})=>{if(error)toast('Увійди повторно.');showSession(data.session);});}
window.addEventListener('focus',()=>{if(user&&!$('editor').open)void loadBooks();}); window.addEventListener('online',()=>{if(user)void loadBooks();});window.addEventListener('offline',()=>{$('syncState').textContent='Немає інтернету';});setInterval(()=>{if(user&&!document.hidden&&!$('editor').open)void loadBooks();},45000);
let installPrompt;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else $('installHelp').hidden=!$('installHelp').hidden;};window.addEventListener('appinstalled',()=>{$('install').hidden=true;});if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)$('install').hidden=true;
const noteKey='my-apps-note:'+new URL('.',location.href).pathname;$('oldNote').onclick=()=>{try{$('note').value=localStorage.getItem(noteKey)||'';}catch{toast('Нотатка недоступна');}$('noteDialog').showModal();};$('closeNote').onclick=()=>$('noteDialog').close();$('note').oninput=()=>{try{localStorage.setItem(noteKey,$('note').value);}catch{toast('Не вдалося зберегти нотатку.');}};
if('serviceWorker' in navigator&&location.protocol!=='file:'){let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading&&!$('editor').open){reloading=true;location.reload();}});navigator.serviceWorker.register('./sw.js').catch(()=>{});}
start();
