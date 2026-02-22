const API = "http://127.0.0.1:8004/api";
const inputsHost = document.getElementById("inputs");
const presetSelect = document.getElementById("preset");
const runBtn = document.getElementById("run");
const resultHost = document.getElementById("result");
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
  ctx.strokeStyle = "#5e89ff";
  ctx.lineWidth = 2;
  const maxCost = Math.max(...points.map((p) => p.predicted_cost), 15);
  points.forEach((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * (canvas.width - 40) + 20;
    const y = canvas.height - (p.predicted_cost / maxCost) * (canvas.height - 40) - 20;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#63f5c9";
  points.forEach((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * (canvas.width - 40) + 20;
    const y = canvas.height - (p.predicted_cost / maxCost) * (canvas.height - 40) - 20;
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  });
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

  const h = await jf(`${API}/history`);
  paintChart(h.points);
}

runBtn.addEventListener("click", runSimulation);

(async function init() {
  await loadPresets();
  await runSimulation();
})();
