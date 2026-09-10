const passwordInput = document.getElementById("password");
const toggleBtn = document.getElementById("toggleBtn");
const validateBtn = document.getElementById("validateBtn");
const result = document.getElementById("result");
const resultIcon = document.getElementById("resultIcon");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const statusBadge = document.getElementById("statusBadge");
const trace = document.getElementById("trace");
const statePill = document.getElementById("statePill");

function classify(ch) {
  if (/[A-Z]/.test(ch)) return "U";
  if (/[a-z]/.test(ch)) return "L";
  if (/[0-9]/.test(ch)) return "D";
  return "X";
}

function updateRequirements(password, showResults = false) {
  const rules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    charset: /^[A-Za-z0-9]*$/.test(password)
  };

  Object.entries(rules).forEach(([rule, valid]) => {
    const el = document.querySelector(`[data-rule="${rule}"]`);
    if (!el) return;
    el.classList.remove("valid", "invalid");
    if (rule === "upper" || rule === "lower" || rule === "digit") {
      el.querySelector(".check").textContent = "✓";
      return;
    }
    if (showResults || password.length > 0) {
      el.classList.add(valid ? "valid" : "invalid");
      el.querySelector(".check").textContent = valid ? "✓" : "×";
    } else {
      el.querySelector(".check").textContent = "×";
    }
  });
  return rules;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function renderTrace(data) {
  statePill.textContent = data.finalState;
  if (!data.trace || data.trace.length <= 1) {
    trace.textContent = "Enter a password and validate it to see the DFA state sequence.";
    return;
  }

  const rows = data.trace.slice(1).map(step =>
    `<div class="trace-step"><span>${escapeHtml(step.character)}</span> <b>(${step.symbol})</b> : ${escapeHtml(step.from)} → ${escapeHtml(step.to)}</div>`
  ).join("");

  trace.innerHTML =
    `<strong>Input:</strong> ${escapeHtml(passwordInput.value)}<br>` +
    `<strong>Transitions:</strong><div class="trace-list">${rows}</div>` +
    `<strong>Final:</strong> <span class="${data.accepted ? "accepted" : "rejected"}">${escapeHtml(data.finalState)} — ${data.accepted ? "ACCEPT" : "REJECT"}</span>`;
}

async function runValidation() {
  const password = passwordInput.value;
  updateRequirements(password, true);
  statusBadge.textContent = "Validating…";
  statusBadge.className = "badge neutral";

  try {
    const response = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Backend validation failed");

    result.classList.remove("hidden", "accept", "reject");
    result.classList.add(data.accepted ? "accept" : "reject");
    resultIcon.textContent = data.accepted ? "✓" : "×";
    resultTitle.textContent = data.accepted ? "Password Accepted" : "Password Rejected";
    resultText.textContent = data.accepted
      ? "The backend DFA reached the accepting state q8."
      : `The backend DFA stopped in ${data.finalState}.`;
    statusBadge.textContent = data.accepted ? "Accepted" : "Rejected";
    statusBadge.className = data.accepted ? "badge good" : "badge bad";
    renderTrace(data);
  } catch (error) {
    result.classList.remove("hidden", "accept");
    result.classList.add("reject");
    resultIcon.textContent = "!";
    resultTitle.textContent = "Backend Connection Error";
    resultText.textContent = error.message;
    statusBadge.textContent = "Offline";
    statusBadge.className = "badge bad";
  }
}

toggleBtn.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  toggleBtn.textContent = showing ? "Show" : "Hide";
  toggleBtn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

passwordInput.addEventListener("input", () => {
  updateRequirements(passwordInput.value, false);
  result.classList.add("hidden");
  statusBadge.textContent = passwordInput.value ? "Ready" : "Waiting";
  statusBadge.className = "badge neutral";
  statePill.textContent = "q0";
});

validateBtn.addEventListener("click", runValidation);
passwordInput.addEventListener("keydown", event => { if (event.key === "Enter") runValidation(); });
updateRequirements("");
