// CONFIG: mets l’URL publique de ton webhook n8n /ask
const N8N_WEBHOOK_URL = "https://n8n.ubiflow.net/webhook-test/ask-enter";

const form = document.getElementById('ask-form');
const questionEl = document.getElementById('question');
const statusEl = document.getElementById('status');
const answerEl = document.getElementById('answer');

function setStatus(msg) {
  statusEl.textContent = msg || "";
}
function setAnswer(text) {
  // Affiche proprement, conserve les sauts de ligne
  answerEl.textContent = text || "";
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = questionEl.value.trim();
  if (!question) return;

  setAnswer("");
  setStatus("Envoi en cours…");

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status}: ${t}`);
    }
    const data = await res.json();
    setStatus("");
    setAnswer(data.answer || "(aucune réponse)");
  } catch (err) {
    console.error(err);
    setStatus("Erreur lors de l’appel. Réessaie.");
    setAnswer("");
  }
});
