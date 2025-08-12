const N8N_BASE = 'https://n8n.ubiflow.net/webhook';
const ASK_ENTER_URL  = `${N8N_BASE}/ask-enter`;
const ASK_STATUS_URL = `${N8N_BASE}/ask-status`;

const chatEl = document.getElementById('chat');
const form   = document.getElementById('composer');
const input  = document.getElementById('input');
const send   = document.getElementById('send');
const newBtn = document.getElementById('new-chat');

let threadId = loadThreadId();
let messages = loadMessages();
let busy = false;

// ---------- LocalStorage helpers ----------
function loadThreadId() {
  return localStorage.getItem('thread_id') || null;
}
function saveThreadId(id) {
  localStorage.setItem('thread_id', id);
}
function clearThread() {
  localStorage.removeItem('thread_id');
  threadId = null;
}
function loadMessages() {
  try {
    return JSON.parse(localStorage.getItem('messages') || '[]');
  } catch {
    return [];
  }
}
function saveMessages() {
  localStorage.setItem('messages', JSON.stringify(messages));
}

// ---------- UI ----------
function renderChat() {
  chatEl.innerHTML = '';
  messages.forEach(msg => appendBubble(msg));
  chatEl.scrollTop = chatEl.scrollHeight;
}
function appendBubble({ role, text }) {
  const wrap = document.createElement('div');
  wrap.className = `bubble ${role}`;
  wrap.innerText = text;
  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
}
function appendTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'bubble assistant typing';
  wrap.innerHTML = '<span></span><span></span><span></span>';
  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
  return wrap;
}

// ---------- API calls ----------
async function askEnter(question) {
  const payload = { question };
  if (threadId) payload.thread_id = threadId;

  const r = await fetch(ASK_ENTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`ask-enter: ${r.status}`);
  return r.json();
}
async function askStatus(thread_id, run_id) {
  const url = new URL(ASK_STATUS_URL);
  url.searchParams.set('thread_id', thread_id);
  url.searchParams.set('run_id', run_id);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`ask-status: ${r.status}`);
  return r.json();
}
async function pollUntilComplete(thread_id, run_id, { intervalMs = 1200, maxTries = 80 } = {}) {
  for (let i = 0; i < maxTries; i++) {
    const data = await askStatus(thread_id, run_id);
    if (data.status === 'completed') return data;
    await new Promise(res => setTimeout(res, intervalMs));
  }
  throw new Error('Timeout');
}

// ---------- Main logic ----------
async function sendMessage(text) {
  if (busy) return;
  const msg = text.trim();
  if (!msg) return;

  busy = true;
  send.disabled = true;
  input.disabled = true;

  // Ajoute le message user
  messages.push({ role: 'user', text: msg });
  saveMessages();
  renderChat();

  input.value = '';

  // 1) Lance le run
  const init = await askEnter(msg);
  if (!threadId) {
    threadId = init.thread_id;
    saveThreadId(threadId);
  }

  // 2) Typing indicator
  const typing = appendTyping();

  try {
    // 3) Poll jusqu’à complétion
    const fin = await pollUntilComplete(init.thread_id, init.run_id);
    typing.remove();

    // 4) Ajoute la réponse assistant
    messages.push({ role: 'assistant', text: fin.answer || '(réponse vide)' });
    saveMessages();
    renderChat();
  } catch (e) {
    console.error(e);
    typing.remove();
    messages.push({ role: 'assistant', text: "Oups, une erreur est survenue. Réessaie." });
    saveMessages();
    renderChat();
  } finally {
    busy = false;
    send.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// ---------- Event handlers ----------
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

// ---------- Init ----------
if (!messages.length) {
  appendBubble({ role: 'assistant', text: "Bonjour ! Posez-moi une question pour démarrer la discussion." });
} else {
  renderChat();
}
