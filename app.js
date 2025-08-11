// ======= config =======
const N8N_WEBHOOK_URL = "<<<URL_WEBHOOK_N8N>>>"; // ex: https://n8n.example.com/webhook/ask-assistant
const OPTIONAL_API_KEY = ""; // si tu protèges le webhook, sinon laisse vide

// ======= dom =======
const form = document.getElementById("qa-form");
const questionEl = document.getElementById("question");
const threadEl = document.getElementById("thread");
const assistantEl = document.getElementById("assistant");
const statusEl = document.getElementById("status");
const answerBox = document.getElementById("answer-box");
const answerPre = document.getElementById("answer");
const submitBtn = form.querySelector("button[type='submit']");

// ======= helpers =======
function setStatus(msg, type = "info") {
  statusEl.textContent = msg;
  statusEl.style.color = type === "error" ? "#ef4444" : "#94a3b8";
}

function savePrefs() {
  localStorage.setItem("assistant.thread_id", threadEl.value.trim());
  localStorage.setItem("assistant.assistant_id", assistantEl.value.trim());
}

function loadPrefs() {
  const t = localStorage.getItem("assistant.thread_id");
  const a = localStorage.getItem("assistant.assistant_id");
  if (t) threadEl.value = t;
  if (a) assistantEl.value = a;
}

function validateInputs({ question, thread_id, assistant_id }) {
  if (!question) throw new Error("La question est vide.");
  if (!thread_id || !thread_id.startsWith("thread_")) {
    throw new Error("Thread ID invalide (doit commencer par 'thread_').");
  }
  if (!assistant_id || !assistant_id.startsWith("asst_")) {
    throw new Error("Assistant ID invalide (doit commencer par 'asst_').");
  }
}

async function askAssistant(payload) {
  const headers = { "Content-Type": "application/json" };
  if (OPTIONAL_API_KEY) headers["X-API-Key"] = OPTIONAL_API_KEY;

  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// ======= init =======
loadPrefs();

// ======= events =======
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    question: questionEl.value.trim(),
    thread_id: threadEl.value.trim(),
    assistant_id: assistantEl.value.trim(),
  };

  try {
    validateInputs(payload);
  } catch (err) {
    setStatus(err.message, "error");
    return;
  }

  // UI
  setStatus("En cours...");
  submitBtn.disabled = true;
  answerBox.classList.add("hidden");
  answerPre.textContent = "";

  try {
    const data = await askAssistant(payload);
    // data attendu: { answer, thread_id, run_id }
    answerPre.textContent = data.answer || "(Aucune réponse)";
    answerBox.classList.remove("hidden");
    setStatus("OK");
    savePrefs();
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Erreur inconnue", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

// bonus: Ctrl/Cmd+Enter pour envoyer
questionEl.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    form.requestSubmit();
  }
});
