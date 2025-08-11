const N8N_BASE = 'https://n8n.ubiflow.net/webhook'; // ← à adapter
const ASK_ENTER_URL = `${N8N_BASE}/ask-enter`;
const ASK_STATUS_URL = `${N8N_BASE}/ask-status`;

const form = document.getElementById('ask-form');
const questionEl = document.getElementById('question');
const askBtn = document.getElementById('ask-btn');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const answerEl = document.getElementById('answer');
const stateIndicator = document.getElementById('state-indicator');

function setBusy(busy) {
  askBtn.disabled = busy;
  statusEl.textContent = busy ? 'Traitement en cours…' : '';
  stateIndicator.textContent = busy ? 'processing' : '';
}

function renderAnswer(text) {
  // rendu très simple (préserve sauts de ligne)
  answerEl.textContent = text || '(réponse vide)';
  resultEl.classList.remove('hidden');
  stateIndicator.textContent = 'completed';
}

async function askEnter(question) {
  const r = await fetch(ASK_ENTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`ask-enter: ${r.status} ${t}`);
  }
  return r.json(); // {status:"processing", thread_id, run_id}
}

async function askStatus(thread_id, run_id) {
  const url = new URL(ASK_STATUS_URL);
  url.searchParams.set('thread_id', thread_id);
  url.searchParams.set('run_id', run_id);

  const r = await fetch(url.toString(), { method: 'GET' });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`ask-status: ${r.status} ${t}`);
  }
  return r.json();
}

async function pollUntilComplete(thread_id, run_id, { intervalMs = 2000, maxTries = 60 } = {}) {
  for (let i = 0; i < maxTries; i++) {
    const data = await askStatus(thread_id, run_id);
    if (data.status === 'completed') return data;
    // Optionnel : afficher l’état fin (queued / in_progress)
    if (data.state) stateIndicator.textContent = data.state;
    await new Promise(res => setTimeout(res, intervalMs));
  }
  throw new Error('Timeout: pas de réponse complétée dans le délai imparti');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = (questionEl.value || '').trim();
  if (!question) {
    statusEl.textContent = 'Merci de saisir une question.';
    return;
  }

  setBusy(true);
  resultEl.classList.add('hidden');
  answerEl.textContent = '';

  try {
    // 1) crée le run
    const init = await askEnter(question);
    if (!init?.thread_id || !init?.run_id) {
      throw new Error('IDs manquants dans la réponse /ask-enter');
    }

    // 2) poll
    const fin = await pollUntilComplete(init.thread_id, init.run_id);

    // 3) rendu
    renderAnswer(fin.answer);

  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Erreur lors de l’appel. Réessaie.';
  } finally {
    setBusy(false);
  }
});
