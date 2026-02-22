const API = "http://127.0.0.1:8004/api";
const inputsHost = document.getElementById("inputs");
const presetSelect = document.getElementById("preset");
const runBtn = document.getElementById("run");
const resultHost = document.getElementById("result");
const adviceHost = document.getElementById("advice");
const moodChips = document.getElementById("mood-chips");
const comfortDial = document.getElementById("comfortDial");
const comfortDialValue = document.getElementById("comfortDialValue");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

const FIELDS = [
  ["room_temp", "Room Temp (C)", 31],
  ["humidity", "Humidity (%)", 60],
  ["occupancy", "Occupancy", 2],
  ["fan_speed", "Fan Speed (0-5)", 3],
  ["ac_setpoint", "AC Setpoint (C)", 24],
  ["lights", "Lights On", 2],
];

FIELDS.forEach(([id, label, value]) => {
  const node = document.createElement("div");
  node.className = "field";
  node.innerHTML = `<label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" />`;
  inputsHost.appendChild(node);
});

function applyTilt() {
  document.querySelectorAll("[data-tilt]").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x * 10}deg) rotateX(${y * -10}deg)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "rotateY(0deg) rotateX(0deg)";
    });
  });
}

function setupStarfield() {
  const c = document.getElementById("starfield");
  const g = c.getContext("2d");
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  function resize() {
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const stars = Array.from({ length: 110 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: Math.random() * 1.7,
    s: Math.random() * 0.35 + 0.05,
  }));

  function draw() {
    g.clearRect(0, 0, innerWidth, innerHeight);
    stars.forEach((s) => {
      s.y += s.s;
      if (s.y > innerHeight) s.y = -2;
      g.fillStyle = "rgba(255,255,255,.7)";
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

async function jf(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function payload() {
  return Object.fromEntries(FIELDS.map(([id]) => [id, Number(document.getElementById(id).value)]));
}

function metric(title, val, suffix = "") {
  return `<article class="metric"><small>${title}</small><strong>${val}${suffix}</strong></article>`;
}

function paintChart(points) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const maxCost = Math.max(...points.map((p) => p.predicted_cost), 15);

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "#63f5c9");
  grad.addColorStop(1, "#5e89ff");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.3;

  points.forEach((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * (canvas.width - 40) + 20;
    const y = canvas.height - (p.predicted_cost / maxCost) * (canvas.height - 40) - 20;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#ff9d66";
  points.forEach((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * (canvas.width - 40) + 20;
    const y = canvas.height - (p.predicted_cost / maxCost) * (canvas.height - 40) - 20;
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderMoodChips(out) {
  const modes = [];
  if (out.comfort_score >= 80) modes.push("Comfort Optimized");
  if (out.predicted_cost <= 8) modes.push("Budget Friendly");
  if (out.predicted_cost > 12) modes.push("High Energy Draw");
  if (!modes.length) modes.push("Balanced Mode");
  moodChips.innerHTML = modes.map((m) => `<span>${m}</span>`).join("");
}

async function loadPresets() {
  const data = await jf(`${API}/presets`);
  presetSelect.innerHTML = `<option value="">Apply Preset</option>${data.presets
    .map((p) => `<option value='${JSON.stringify(p)}'>${p.name}</option>`)
    .join("")}`;
}

presetSelect.addEventListener("change", () => {
  if (!presetSelect.value) return;
  const p = JSON.parse(presetSelect.value);
  Object.keys(p).forEach((k) => {
    const node = document.getElementById(k);
    if (node) node.value = p[k];
  });
});

async function runSimulation() {
  const out = await jf(`${API}/predict`, { method: "POST", body: JSON.stringify(payload()) });
  resultHost.innerHTML = [
    metric("Comfort", out.comfort_score),
    metric("Units", out.predicted_units),
    metric("Cost", out.predicted_cost, " INR"),
  ].join("");

  adviceHost.textContent = out.advice;
  comfortDial.style.setProperty("--value", out.comfort_score);
  comfortDialValue.textContent = out.comfort_score;
  renderMoodChips(out);

  const h = await jf(`${API}/history`);
  paintChart(h.points);
}

runBtn.addEventListener("click", runSimulation);

(async function init() {
  applyTilt();
  setupStarfield();
  await loadPresets();
  await runSimulation();
})();
