const fieldsHost = document.getElementById('fields');
const profile = document.getElementById('profile');
const city = document.getElementById('city');
const weatherBtn = document.getElementById('weatherBtn');
const themeToggle = document.getElementById('themeToggle');
const stateTariff = document.getElementById('stateTariff');
const tariff = document.getElementById('tariff');
const simulate = document.getElementById('simulate');
const optimize = document.getElementById('optimize');
const compare = document.getElementById('compare');
const saveScenario = document.getElementById('saveScenario');
const metrics = document.getElementById('metrics');
const suggestion = document.getElementById('suggestion');
const chips = document.getElementById('chips');
const comparison = document.getElementById('comparison');
const sustainability = document.getElementById('sustainability');
const historyList = document.getElementById('historyList');
const chat = document.getElementById('chat');
const chatInput = document.getElementById('chatInput');
const askBtn = document.getElementById('askBtn');
const demoRun = document.getElementById('demoRun');

const chart = new Chart(document.getElementById('trendChart'), {
  type: 'line',
  data: { labels: [], datasets: [
    { label: 'Comfort', data: [], borderColor: '#6af6ce', tension: .35 },
    { label: 'Cost', data: [], borderColor: '#ff9966', tension: .35 },
    { label: 'Units', data: [], borderColor: '#75a1ff', tension: .35 },
  ]},
  options: { plugins: { legend: { labels: { color: '#d8e8f8' } } }, scales: { x: { ticks: { color: '#9ab1c7' } }, y: { ticks: { color: '#9ab1c7' } } } }
});

const FIELD_DEF = [
  ['room_temp', 'Room Temp (C)', 31],
  ['humidity', 'Humidity (%)', 60],
  ['occupancy', 'Occupancy', 2],
  ['fan_speed', 'Fan Speed (0-5)', 3],
  ['ac_setpoint', 'AC Setpoint (C)', 24],
  ['lights', 'Lights On', 2],
];
const PROFILES = {
  'Hostel Room': { room_temp: 31, humidity: 60, occupancy: 2, fan_speed: 3, ac_setpoint: 24, lights: 2 },
  'Bedroom': { room_temp: 29, humidity: 55, occupancy: 1, fan_speed: 2, ac_setpoint: 25, lights: 1 },
  'Living Room': { room_temp: 32, humidity: 58, occupancy: 3, fan_speed: 4, ac_setpoint: 23, lights: 3 },
  'Office': { room_temp: 30, humidity: 50, occupancy: 2, fan_speed: 2, ac_setpoint: 24, lights: 4 },
};
const CITIES = {
  Gurugram: { lat: 28.4595, lon: 77.0266 },
  Delhi: { lat: 28.6139, lon: 77.2090 },
  Mumbai: { lat: 19.0760, lon: 72.8777 },
  Bengaluru: { lat: 12.9716, lon: 77.5946 },
};
const STATE_TARIFF = { Haryana: 8.4, Delhi: 8.0, Maharashtra: 10.2, Karnataka: 8.8 };

let history = JSON.parse(localStorage.getItem('ghostlab_v2_history') || '[]');
let previous = null;

function initFields() {
  FIELD_DEF.forEach(([k, l, v]) => {
    const wrap = document.createElement('label');
    wrap.innerHTML = `${l}<input id="${k}" type="number" value="${v}" />`;
    fieldsHost.appendChild(wrap);
  });
}
function pulseButton(btn, e) {
  btn.classList.remove('ripple');
  btn.style.setProperty('--x', `${e.offsetX}px`);
  btn.style.setProperty('--y', `${e.offsetY}px`);
  void btn.offsetWidth;
  btn.classList.add('ripple');
}
function val(id) { return Number(document.getElementById(id).value); }
function getScenario() {
  return {
    room_temp: val('room_temp'), humidity: val('humidity'), occupancy: val('occupancy'), fan_speed: val('fan_speed'),
    ac_setpoint: val('ac_setpoint'), lights: val('lights'),
    tariff: Number(tariff.value),
    devices: {
      ac: document.getElementById('acOn').checked,
      fan: document.getElementById('fanOn').checked,
      lights: document.getElementById('lightsOn').checked,
      plug: document.getElementById('plugOn').checked,
      purifier: document.getElementById('purifierOn').checked,
    }
  };
}
function predict(s) {
  const deviceFactor = (s.devices.ac ? 1 : .2) + (s.devices.fan ? .4 : .1) + (s.devices.lights ? .3 : .05) + (s.devices.plug ? .18 : 0) + (s.devices.purifier ? .22 : 0);
  const thermalPenalty = Math.abs(s.room_temp - 24) * 2.5 + Math.abs(s.humidity - 50) * .28;
  const airflowBonus = s.fan_speed * 1.4;
  const comfort = Math.max(0, Math.min(100, 92 - thermalPenalty + airflowBonus - s.occupancy * 1.2));
  const units = Math.max(0.3, ((Math.max(0, s.room_temp - s.ac_setpoint) * .18) + s.fan_speed * .05 + s.lights * .04 + s.occupancy * .03) * deviceFactor);
  const cost = units * s.tariff;
  const modelConfidence = Math.max(78, Math.min(96, 91 - Math.abs(24 - s.ac_setpoint) * 1.4));
  return {
    comfort: Number(comfort.toFixed(1)),
    units: Number(units.toFixed(2)),
    cost: Number(cost.toFixed(2)),
    confidence: Number(modelConfidence.toFixed(1)),
    carbon: Number((units * .82).toFixed(2)),
  };
}

function smartSuggestion(s, o) {
  const newSet = Math.min(26, s.ac_setpoint + 1);
  const adjusted = predict({ ...s, ac_setpoint: newSet });
  const save = Math.max(0, o.cost - adjusted.cost);
  return `Lower intensity tip: set AC to ${newSet}°C to save Rs ${save.toFixed(1)} daily while keeping comfort around ${adjusted.comfort}.`;
}

function countUp(el, to, suffix = '') {
  const start = Number(el.dataset.value || 0);
  const t0 = performance.now();
  function frame(t) {
    const p = Math.min(1, (t - t0) / 450);
    const v = start + (to - start) * p;
    el.textContent = `${v.toFixed(1)}${suffix}`;
    if (p < 1) requestAnimationFrame(frame);
  }
  el.dataset.value = String(to);
  requestAnimationFrame(frame);
}

function render(out) {
  metrics.innerHTML = `
    <article class="metric"><small>Comfort</small><strong id="mComfort">0</strong></article>
    <article class="metric"><small>Cost</small><strong id="mCost">0</strong></article>
    <article class="metric"><small>Units</small><strong id="mUnits">0</strong></article>
    <article class="metric"><small>Model Confidence</small><strong id="mConf">0</strong></article>
  `;
  countUp(document.getElementById('mComfort'), out.comfort);
  countUp(document.getElementById('mCost'), out.cost, ' Rs');
  countUp(document.getElementById('mUnits'), out.units);
  countUp(document.getElementById('mConf'), out.confidence, '%');

  document.body.classList.remove('comfort-high', 'comfort-low', 'cost-high');
  if (out.comfort > 80) document.body.classList.add('comfort-high');
  if (out.comfort < 50) document.body.classList.add('comfort-low');
  if (out.cost > 12) document.body.classList.add('cost-high');
}

function renderHistory() {
  historyList.innerHTML = history.slice(-10).reverse().map((h) =>
    `<article class="history-item"><strong>${new Date(h.time).toLocaleString()}</strong><br/>Comfort ${h.out.comfort} | Cost Rs ${h.out.cost} | Units ${h.out.units}</article>`
  ).join('') || '<small>No history yet.</small>';

  chart.data.labels = history.map((h, i) => `S${i + 1}`);
  chart.data.datasets[0].data = history.map((h) => h.out.comfort);
  chart.data.datasets[1].data = history.map((h) => h.out.cost);
  chart.data.datasets[2].data = history.map((h) => h.out.units);
  chart.update();
}

function run() {
  const s = getScenario();
  const out = predict(s);
  render(out);
  suggestion.textContent = smartSuggestion(s, out);
  chips.innerHTML = [
    out.comfort > 80 ? 'Comfort Optimized' : 'Needs Tuning',
    out.cost < 10 ? 'Budget Friendly' : 'Cost Heavy',
    out.confidence > 90 ? 'High Model Confidence' : 'Moderate Confidence',
  ].map((x) => `<span>${x}</span>`).join('');

  const trees = Number((out.carbon / 21).toFixed(3));
  sustainability.textContent = `Sustainability: ${out.carbon} kg CO2e estimated. Equivalent offset need ~${trees} trees/day basis.`;

  previous = history.at(-1) || null;
  history.push({ time: Date.now(), scenario: s, out });
  localStorage.setItem('ghostlab_v2_history', JSON.stringify(history));
  renderHistory();
}

function comparePrev() {
  if (!previous) {
    comparison.textContent = 'No previous scenario available yet.';
    return;
  }
  const curr = history.at(-1).out;
  const dc = (curr.cost - previous.out.cost).toFixed(2);
  const df = (curr.comfort - previous.out.comfort).toFixed(1);
  comparison.textContent = `Delta vs previous -> Cost: ${dc} Rs, Comfort: ${df}.`;
}

function optimizeScenario() {
  let best = null;
  const base = getScenario();
  for (let ac = 22; ac <= 27; ac++) {
    for (let fan = 1; fan <= 5; fan++) {
      const out = predict({ ...base, ac_setpoint: ac, fan_speed: fan });
      if (!best || (out.cost < best.out.cost && out.comfort >= 75)) best = { ac, fan, out };
    }
  }
  if (best) {
    document.getElementById('ac_setpoint').value = best.ac;
    document.getElementById('fan_speed').value = best.fan;
    suggestion.textContent = `Optimization found: AC ${best.ac}°C + Fan ${best.fan} minimizes cost at Rs ${best.out.cost} with comfort ${best.out.comfort}.`;
    run();
  }
}

async function fetchWeather() {
  const c = CITIES[city.value];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,relative_humidity_2m`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    document.getElementById('room_temp').value = d.current.temperature_2m;
    document.getElementById('humidity').value = d.current.relative_humidity_2m;
    suggestion.textContent = `Weather synced for ${city.value}.`;
  } catch {
    suggestion.textContent = 'Weather fetch failed. Using manual values.';
  }
}

function askGhostLab(q) {
  const t = q.toLowerCase();
  const s = getScenario();
  const o = predict(s);
  if (t.includes('cheaper')) return `Set AC to ${Math.min(26, s.ac_setpoint + 1)} and reduce lights by 1. Estimated saving ~Rs ${(o.cost * .14).toFixed(1)}.`;
  if (t.includes('hot')) return `Increase fan speed to ${Math.min(5, s.fan_speed + 1)} and keep AC at ${s.ac_setpoint} for better comfort.`;
  if (t.includes('optimize')) return 'Click Optimize for Minimum Cost to auto-search best AC and fan combination.';
  return 'Try balancing AC setpoint, fan speed, and occupancy for best comfort-cost ratio.';
}

function initSelectors() {
  Object.keys(PROFILES).forEach((p) => profile.insertAdjacentHTML('beforeend', `<option>${p}</option>`));
  Object.keys(CITIES).forEach((c) => city.insertAdjacentHTML('beforeend', `<option>${c}</option>`));
  Object.entries(STATE_TARIFF).forEach(([s, v]) => stateTariff.insertAdjacentHTML('beforeend', `<option value="${v}">${s}</option>`));

  profile.addEventListener('change', () => {
    const p = PROFILES[profile.value];
    Object.entries(p).forEach(([k, v]) => { const n = document.getElementById(k); if (n) n.value = v; });
  });
  stateTariff.addEventListener('change', () => { tariff.value = stateTariff.value; });
}

function setupFx() {
  document.querySelectorAll('.btn').forEach((b) => b.addEventListener('click', (e) => pulseButton(b, e)));
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `rotateY(${x * 6}deg) rotateX(${y * -6}deg)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = 'rotateY(0) rotateX(0)'; });
  });

  const c = document.getElementById('bg-canvas');
  const g = c.getContext('2d');
  function resize() { c.width = innerWidth; c.height = innerHeight; }
  resize();
  addEventListener('resize', resize);
  const pts = Array.from({ length: 80 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 2, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 }));
  let mx = innerWidth / 2, my = innerHeight / 2;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; });
  (function draw() {
    g.clearRect(0, 0, c.width, c.height);
    pts.forEach((p) => {
      p.x += p.vx + (mx - p.x) * 0.00008;
      p.y += p.vy + (my - p.y) * 0.00008;
      if (p.x < 0 || p.x > c.width) p.vx *= -1;
      if (p.y < 0 || p.y > c.height) p.vy *= -1;
      g.fillStyle = 'rgba(220,240,255,.55)';
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    });
    requestAnimationFrame(draw);
  })();
}

simulate.addEventListener('click', run);
optimize.addEventListener('click', optimizeScenario);
compare.addEventListener('click', comparePrev);
saveScenario.addEventListener('click', () => { run(); suggestion.textContent = 'Scenario saved to timeline.'; });
weatherBtn.addEventListener('click', fetchWeather);
demoRun.addEventListener('click', () => {
  const seq = [
    { room_temp: 32, humidity: 65, fan_speed: 4, ac_setpoint: 23 },
    { room_temp: 29, humidity: 54, fan_speed: 2, ac_setpoint: 25 },
    { room_temp: 34, humidity: 68, fan_speed: 5, ac_setpoint: 22 },
  ];
  seq.forEach((s, i) => setTimeout(() => { Object.entries(s).forEach(([k, v]) => document.getElementById(k).value = v); run(); }, i * 700));
});
askBtn.addEventListener('click', () => {
  const q = chatInput.value.trim();
  if (!q) return;
  chat.insertAdjacentHTML('beforeend', `<p class="you">You: ${q}</p>`);
  chat.insertAdjacentHTML('beforeend', `<p class="bot">GhostLab: ${askGhostLab(q)}</p>`);
  chatInput.value = '';
  chat.scrollTop = chat.scrollHeight;
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  themeToggle.textContent = document.body.classList.contains('light') ? 'Dark Mode' : 'Light Mode';
});

initFields();
initSelectors();
setupFx();
if (history.length) renderHistory();
run();
