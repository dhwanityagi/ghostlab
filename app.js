const API = "http://127.0.0.1:8004/api";
const IS_LIVE_DEMO = !["localhost", "127.0.0.1"].includes(location.hostname);
const MOCK_KEY = "ghostlab_history";
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

const FIELDS = [["room_temp","Room Temp (C)",31],["humidity","Humidity (%)",60],["occupancy","Occupancy",2],["fan_speed","Fan Speed (0-5)",3],["ac_setpoint","AC Setpoint (C)",24],["lights","Lights On",2]];
const PRESETS = [{name:"Exam Night",room_temp:31,humidity:62,occupancy:2,fan_speed:4,ac_setpoint:23,lights:3},{name:"Sleep Mode",room_temp:28,humidity:54,occupancy:1,fan_speed:2,ac_setpoint:25,lights:1},{name:"Group Study",room_temp:33,humidity:65,occupancy:4,fan_speed:5,ac_setpoint:22,lights:5}];

FIELDS.forEach(([id,label,value]) => { const node = document.createElement("div"); node.className = "field"; node.innerHTML = `<label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" />`; inputsHost.appendChild(node); });

function applyTilt(){document.querySelectorAll("[data-tilt]").forEach((card)=>{card.addEventListener("mousemove",(e)=>{const r=card.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;card.style.transform=`rotateY(${x*10}deg) rotateX(${y*-10}deg)`});card.addEventListener("mouseleave",()=>{card.style.transform="rotateY(0deg) rotateX(0deg)"})})}
function setupStarfield(){const c=document.getElementById("starfield"),g=c.getContext("2d"),dpr=Math.max(window.devicePixelRatio||1,1);function resize(){c.width=innerWidth*dpr;c.height=innerHeight*dpr;g.setTransform(dpr,0,0,dpr,0,0)}resize();window.addEventListener("resize",resize);const stars=Array.from({length:110},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.7,s:Math.random()*.35+.05}));(function draw(){g.clearRect(0,0,innerWidth,innerHeight);stars.forEach((s)=>{s.y+=s.s;if(s.y>innerHeight)s.y=-2;g.fillStyle="rgba(255,255,255,.7)";g.beginPath();g.arc(s.x,s.y,s.r,0,Math.PI*2);g.fill()});requestAnimationFrame(draw)})()}

function getHistory(){try{return JSON.parse(localStorage.getItem(MOCK_KEY)||"[]")}catch{return[]}}
function setHistory(v){localStorage.setItem(MOCK_KEY,JSON.stringify(v.slice(-12)))}
function predictLocal(s){const thermalPenalty=Math.abs(s.room_temp-24)*2.4+Math.abs(s.humidity-50)*0.35;const airflowBonus=s.fan_speed*1.5;const occupancyPenalty=s.occupancy*1.3;const comfort=Math.max(0,Math.min(100,92-thermalPenalty+airflowBonus-occupancyPenalty));const acLoad=Math.max(0,(s.room_temp-s.ac_setpoint)*0.16);const fanLoad=s.fan_speed*0.06;const lightLoad=s.lights*0.04;const occLoad=s.occupancy*0.03;const units=Number((acLoad+fanLoad+lightLoad+occLoad).toFixed(2));const cost=Number((units*8.4).toFixed(2));const out={comfort_score:Number(comfort.toFixed(1)),predicted_units:units,predicted_cost:cost,advice:cost>10?"Reduce AC delta and lights for lower cost.":"Comfort-cost balance is healthy."};const h=getHistory();h.push({comfort_score:out.comfort_score,predicted_cost:out.predicted_cost,created_at:new Date().toISOString()});setHistory(h);return out}

async function jf(url,options={}){if(!IS_LIVE_DEMO){const res=await fetch(url,{headers:{"Content-Type":"application/json"},...options});if(!res.ok)throw new Error(await res.text());return res.json()}if(url.endsWith("/presets"))return {presets:PRESETS};if(url.endsWith("/predict"))return predictLocal(JSON.parse(options.body||"{}"));if(url.endsWith("/history"))return {points:getHistory()};return {}}
function payload(){return Object.fromEntries(FIELDS.map(([id])=>[id,Number(document.getElementById(id).value)]))}
function metric(title,val,suffix=""){return `<article class="metric"><small>${title}</small><strong>${val}${suffix}</strong></article>`}

function paintChart(points){ctx.clearRect(0,0,canvas.width,canvas.height);const maxCost=Math.max(...points.map((p)=>p.predicted_cost),15);const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,"#63f5c9");grad.addColorStop(1,"#5e89ff");ctx.strokeStyle=grad;ctx.lineWidth=2.3;points.forEach((p,i)=>{const x=(i/Math.max(points.length-1,1))*(canvas.width-40)+20;const y=canvas.height-(p.predicted_cost/maxCost)*(canvas.height-40)-20;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();ctx.fillStyle="#ff9d66";points.forEach((p,i)=>{const x=(i/Math.max(points.length-1,1))*(canvas.width-40)+20;const y=canvas.height-(p.predicted_cost/maxCost)*(canvas.height-40)-20;ctx.beginPath();ctx.arc(x,y,3.4,0,Math.PI*2);ctx.fill()})}
function renderMoodChips(out){const modes=[];if(out.comfort_score>=80)modes.push("Comfort Optimized");if(out.predicted_cost<=8)modes.push("Budget Friendly");if(out.predicted_cost>12)modes.push("High Energy Draw");if(!modes.length)modes.push("Balanced Mode");moodChips.innerHTML=modes.map((m)=>`<span>${m}</span>`).join("")}

async function loadPresets(){const data=await jf(`${API}/presets`);presetSelect.innerHTML=`<option value="">Apply Preset</option>${data.presets.map((p)=>`<option value='${JSON.stringify(p)}'>${p.name}</option>`).join("")}`}
presetSelect.addEventListener("change",()=>{if(!presetSelect.value)return;const p=JSON.parse(presetSelect.value);Object.keys(p).forEach((k)=>{const node=document.getElementById(k);if(node)node.value=p[k]})})

async function runSimulation(){const out=await jf(`${API}/predict`,{method:"POST",body:JSON.stringify(payload())});resultHost.innerHTML=[metric("Comfort",out.comfort_score),metric("Units",out.predicted_units),metric("Cost",out.predicted_cost," INR")].join("");adviceHost.textContent=out.advice;comfortDial.style.setProperty("--value",out.comfort_score);comfortDialValue.textContent=out.comfort_score;renderMoodChips(out);const h=await jf(`${API}/history`);paintChart(h.points)}

runBtn.addEventListener("click",runSimulation);
(async function init(){applyTilt();setupStarfield();await loadPresets();await runSimulation()})();
