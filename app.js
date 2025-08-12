// =================== CONFIG ===================
const N8N_BASE = 'https://YOUR-N8N-DOMAIN/webhook'; // ← ADAPTE ICI
const ASK_ENTER_URL  = `${N8N_BASE}/ask-enter`;
const ASK_STATUS_URL = `${N8N_BASE}/ask-status`;

// =================== DOM ===================
const chatEl = document.getElementById('chat');
const form   = document.getElementById('composer');
const input  = document.getElementById('input');
const send   = document.getElementById('send');
const newBtn = document.getElementById('new-chat');

// =================== LocalStorage ===================
let threadId = loadThreadId();
let messages = loadMessages();
let busy = false;


function loadThreadId(){ return localStorage.getItem('thread_id') || null; }
function saveThreadId(id){ localStorage.setItem('thread_id', id); }
function clearThread(){ localStorage.removeItem('thread_id'); threadId = null; }

function loadMessages(){
  try { return JSON.parse(localStorage.getItem('messages') || '[]'); }
  catch { return []; }
}
function saveMessages(){ localStorage.setItem('messages', JSON.stringify(messages)); }

// =================== UI ===================
function renderChat(){
  chatEl.innerHTML = '';
  messages.forEach(m => appendBubble(m));
  chatEl.scrollTop = chatEl.scrollHeight;
}
function appendBubble({ role, text }){
  const wrap = document.createElement('div');
  wrap.className = `bubble ${role}`;
  wrap.innerText = text;
  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
}
function appendTyping(){
  const wrap = document.createElement('div');
  wrap.className = 'bubble assistant typing';
  wrap.innerHTML = '<span></span><span></span><span></span>';
  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
  return wrap;
}
function appendError(text){
  appendBubble({ role: 'assistant', text: `⚠️ ${text}` });
}

// =================== API ===================
async function askEnter(question){
  const payload = { question };
  if (threadId) payload.thread_id = threadId;

  const r = await fetch(ASK_ENTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const txt = await r.text();
  if (!r.ok) throw new Error(`ask-enter ${r.status}: ${txt || '(empty)'}`);

  let data;
  try { data = JSON.parse(txt); }
  catch (e) { throw new Error(`ask-enter JSON invalide: ${e.message}`); }

  if (!data.thread_id || !data.run_id) {
    throw new Error(`Réponse /ask-enter incomplète: ${txt}`);
  }
  return data; // { status:'processing', thread_id, run_id }
}

async function askStatus(thread_id, run_id){
  const url = new URL(ASK_STATUS_URL);
  url.searchParams.set('thread_id', thread_id);
  url.searchParams.set('run_id', run_id);

  const r = await fetch(url.toString());
  const txt = await r.text();
  if (!r.ok) throw new Error(`ask-status ${r.status}: ${txt || '(empty)'}`);

  let data;
  try { data = JSON.parse(txt); }
  catch (e) { throw new Error(`ask-status JSON invalide: ${e.message}`); }

  if (!data.status) throw new Error(`Réponse /ask-status incomplète: ${txt}`);
  return data; // {status:'processing'|'completed', ...}
}

async function pollUntilComplete(thread_id, run_id, { intervalMs = 1200, maxTries = 80 } = {}){
  for (let i = 0; i < maxTries; i++) {
    const data = await askStatus(thread_id, run_id);
    if (data.status === 'completed') return data;
    await new Promise(res => setTimeout(res, intervalMs));
  }
  throw new Error('Timeout: pas de complétion dans le délai imparti');
}

// =================== LOGIQUE CHAT ===================
async function sendMessage(text){
  if (busy) return;
  const msg = (text || '').trim();
  if (!msg) return;

  busy = true;
  send.disabled = true;
  input.disabled = true;

  // 1) ajouter le message user dans l'historique
  messages.push({ role: 'user', text: msg });
  saveMessages();
  renderChat();

  input.value = '';

  // 2) créer le run
  let init;
  try {
    init = await askEnter(msg); // {status, thread_id, run_id}
  } catch (e) {
    appendError(`Échec /ask-enter → ${e.message}`);
    busy = false; send.disabled = false; input.disabled = false; input.focus();
    return;
  }

  if (!threadId) { threadId = init.thread_id; saveThreadId(threadId); }

  // 3) typing indicator
  const typing = appendTyping();

  // 4) poll jusqu'à complétion
  try {
    const fin = await pollUntilComplete(init.thread_id, init.run_id);
    typing.remove();
    messages.push({ role: 'assistant', text: fin.answer || '(réponse vide)' });
    saveMessages();
    renderChat();
  } catch (e) {
    typing.remove();
    appendError(`Échec polling → ${e.message}`);
  } finally {
    busy = false;
    send.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// =================== EVENTS ===================
form.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(input.value);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
});
newBtn.addEventListener('click', () => {
  clearThread();
  messages = [];
  saveMessages();
  renderChat();
  appendBubble({ role: 'assistant', text: "Nouvelle discussion créée. Comment puis-je vous aider ?" });
  input.focus();
});

// =================== INIT ===================
if (!messages.length) {
  appendBubble({ role: 'assistant', text: "Bonjour ! Posez-moi une question pour démarrer la discussion." });
} else {
  renderChat();
}
