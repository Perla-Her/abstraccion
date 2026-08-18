/* CONSTANTES  */
const G = 6.674e-11, C = 3e8, HBAR = 1.055e-34, KB = 1.381e-23, MSUN = 1.989e30, SIGMA = 5.670e-8;


/* CLASE */
class AgujeroNegro {
  constructor(masaSolar, x, y, spin = 0, carga = 0) {
    this.masaSolar = masaSolar;        // masa en masas solares (fácil de leer)
    this.masa = masaSolar * MSUN;      // masa en kg (para las fórmulas reales)
    this.posicion = { x, y };          // en píxeles del canvas
    this.velocidad = { x: 0, y: 0 };
    this.spin = spin;                  // 0 a 0.99
    this.carga = carga;                // 0 a 1 (simplificado)
  }

  
  get tipo() {
    if (this.spin > 0.01 && this.carga > 0.01) return "Kerr-Newman";
    if (this.spin > 0.01) return "Kerr";
    if (this.carga > 0.01) return "Reissner-Nordström";
    return "Schwarzschild";
  }

  radioSchwarzschild() {
    return 2 * G * this.masa / (C * C); 
  }

  horizonteEventos() {
    const rs = this.radioSchwarzschild();
    return (rs / 2) * (1 + Math.sqrt(Math.max(0, 1 - this.spin * this.spin)));
  }

  temperaturaHawking() {
    return (HBAR * C ** 3) / (8 * Math.PI * G * this.masa * KB); 
  }

  luminosidad() {
    const r = this.radioSchwarzschild();
    const area = 4 * Math.PI * r * r;
    const T = this.temperaturaHawking();
    return SIGMA * area * T ** 4;
  } 

  moverse(dt, fuerza) {
    const ax = fuerza.x / this.masaSolar, ay = fuerza.y / this.masaSolar;
    this.velocidad.x += ax * dt;
    this.velocidad.y += ay * dt;
    this.posicion.x += this.velocidad.x * dt;
    this.posicion.y += this.velocidad.y * dt;
  }

  fusionar(otro) {
    this.masaSolar += otro.masaSolar;
    this.masa += otro.masa;
    this.spin = Math.min(0.99, this.spin + otro.spin * 0.3);
  }

  emitirRadiacionHawking(dt, tasa) {
    this.masaSolar = Math.max(0.5, this.masaSolar - tasa * dt);
    this.masa = this.masaSolar * MSUN;
  }
}


/* OBJETOS DEL CANVAS */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function resize() { canvas.width = canvas.clientWidth; canvas.height = 380; }
resize();
window.addEventListener('resize', resize);

const bh = new AgujeroNegro(10, canvas.width / 2, canvas.height / 2, 0, 0);

let waves = [];   // ondas gravitacionales al fusionar
let disk = [];     // partículas del disco de acreción
let freeParticles = []; // partículas cayendo hacia el horizonte

function seedDisk() {
  disk = [];
  for (let i = 0; i < 160; i++) {
    disk.push({
      a: Math.random() * Math.PI * 2, // ángulo inicial
      r: 1.4 + Math.random() * 2.4,   // lejania al centro
      speed: 0.4 + Math.random() * 1.6,
      hot: Math.random()
    });
  }
}
seedDisk();

function spawnFreeParticle() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) { x = Math.random() * canvas.width; y = -10; }
  else if (edge === 1) { x = canvas.width + 10; y = Math.random() * canvas.height; }
  else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 10; }
  else { x = -10; y = Math.random() * canvas.height; }
  freeParticles.push({ x, y, vx: 0, vy: 0 });
}
setInterval(spawnFreeParticle, 900);

function visualRadius() {
  return Math.min(140, 16 + bh.masaSolar * 1.9);
}


/* ANIMACION*/
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // FONDO ESTRELLADO
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 70; i++) {
    const sx = (i * 197) % canvas.width, sy = (i * 131) % canvas.height;
    ctx.globalAlpha = 0.15 + (i % 5) * 0.1;
    ctx.fillRect(sx, sy, 1.4, 1.4);
  }
  ctx.restore();

  const vr = visualRadius();
  const cx = bh.posicion.x, cy = bh.posicion.y;

  // ondas gravitacionales
  waves = waves.filter(w => w.r < 260);
  waves.forEach(w => {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,77,109,${Math.max(0, 1 - w.r / 260)})`;
    ctx.lineWidth = 2;
    ctx.ellipse(cx, cy, w.r, w.r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    w.r += 90 * dt;
  });

  // disco (mitad de atrás)
  disk.forEach(p => {
    p.a += p.speed * dt * (1 + bh.spin);
    const rad = vr * p.r;
    const x = cx + Math.cos(p.a) * rad;
    const y = cy + Math.sin(p.a) * rad * 0.35;
    if (Math.sin(p.a) < 0) drawDiskDot(x, y, p);
  });

  // partículas cayendo 
  freeParticles = freeParticles.filter(p => {
    const dx = cx - p.x, dy = cy - p.y;
    const dist = Math.max(8, Math.hypot(dx, dy));
    const force = (bh.masaSolar * 260) / (dist * dist);
    p.vx += (dx / dist) * force * dt;
    p.vy += (dy / dist) * force * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.fillStyle = 'rgba(168,230,255,0.8)';
    ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
    return dist > vr * 0.55;
  });

  // anillo de fotones
  const ringColor = bh.spin > 0.5 ? '#c9a8ff' : (bh.spin > 0.15 ? '#8fc7ff' : '#5ec8ff');
  ctx.beginPath();
  ctx.strokeStyle = ringColor;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.arc(cx, cy, vr * 1.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // horizonte de eventos 
  ctx.beginPath();
  ctx.fillStyle = '#000000';
  ctx.arc(cx, cy, vr, 0, Math.PI * 2);
  ctx.fill();

  // disco (mitad de adelante)
  disk.forEach(p => {
    const rad = vr * p.r;
    const x = cx + Math.cos(p.a) * rad;
    const y = cy + Math.sin(p.a) * rad * 0.35;
    if (Math.sin(p.a) >= 0) drawDiskDot(x, y, p);
  });

  // rebote en los bordes del canvas
  if (cx < vr || cx > canvas.width - vr) bh.velocidad.x *= -0.6;
  if (cy < vr || cy > canvas.height - vr) bh.velocidad.y *= -0.6;
  bh.posicion.x = Math.max(vr, Math.min(canvas.width - vr, bh.posicion.x));
  bh.posicion.y = Math.max(vr, Math.min(canvas.height - vr, bh.posicion.y));
  bh.velocidad.x *= 0.985; bh.velocidad.y *= 0.985;

  updateTelemetry();
  requestAnimationFrame(frame);
}

function drawDiskDot(x, y, p) {
  const hue = p.hot > 0.6 ? '#fff2d6' : (p.hot > 0.3 ? '#ffb066' : '#ff5d4d');
  ctx.fillStyle = hue;
  ctx.globalAlpha = 0.55 + p.hot * 0.4;
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

requestAnimationFrame(frame);


/* CONEXION DE ATRIBUTOS */
const elMasa = document.getElementById('masa');
const elSpin = document.getElementById('spin');
const elCarga = document.getElementById('carga');

function syncAttrs() {
  bh.masaSolar = parseFloat(elMasa.value);
  bh.masa = bh.masaSolar * MSUN;
  bh.spin = parseFloat(elSpin.value);
  bh.carga = parseFloat(elCarga.value);

  document.getElementById('v-masa').textContent = bh.masaSolar.toFixed(1) + ' M☉';
  document.getElementById('v-spin').textContent = bh.spin.toFixed(2);
  document.getElementById('v-carga').textContent = bh.carga.toFixed(2);
  document.getElementById('v-tipo').textContent = bh.tipo;
}
[elMasa, elSpin, elCarga].forEach(el => el.addEventListener('input', syncAttrs));
syncAttrs();

function updateTelemetry() {
  document.getElementById('t-rs').textContent = (bh.radioSchwarzschild() / 1000).toFixed(2) + ' km';
  document.getElementById('t-rh').textContent = (bh.horizonteEventos() / 1000).toFixed(2) + ' km';
  document.getElementById('t-temp').textContent = bh.temperaturaHawking().toExponential(2) + ' K';
  document.getElementById('t-lum').textContent = bh.luminosidad().toExponential(2) + ' W';
}


/* BOTONES DE METODOS */
const logEl = document.getElementById('log');
function logLine(cmd, out) {
  const l1 = document.createElement('div');
  l1.textContent = '>>> ' + cmd;
  logEl.appendChild(l1);
  if (out) {
    const l2 = document.createElement('div');
    l2.className = 'out';
    l2.textContent = out;
    logEl.appendChild(l2);
  }
  logEl.scrollTop = logEl.scrollHeight;
}
logLine('agujero = AgujeroNegro(masa=10, spin=0.0, carga=0.0)', 'objeto creado.');

document.getElementById('btn-mover').addEventListener('click', () => {
  const fx = (Math.random() - 0.5) * 4000, fy = (Math.random() - 0.5) * 4000;
  bh.moverse(0.35, { x: fx, y: fy });
  logLine(`agujero.moverse(dt=0.35, fuerza=(${fx.toFixed(0)}, ${fy.toFixed(0)}))`,
    `nueva velocidad: (${bh.velocidad.x.toFixed(1)}, ${bh.velocidad.y.toFixed(1)}) px/s`);
});

document.getElementById('btn-radio').addEventListener('click', () => {
  logLine('agujero.calcularRadioSchwarzschild()',
    `${bh.radioSchwarzschild().toExponential(3)} m  (${(bh.radioSchwarzschild() / 1000).toFixed(2)} km)`);
});

document.getElementById('btn-hawking').addEventListener('click', () => {
  const masaAntes = bh.masaSolar;
  let ticks = 0;
  const iv = setInterval(() => {
    bh.emitirRadiacionHawking(1, 0.4); // tasa acelerada, solo ilustrativa
    ticks++;
    if (ticks >= 6) {
      clearInterval(iv);
      logLine(`agujero.emitirRadiacionHawking(dt=6)  # tasa acelerada, ilustrativa`,
        `masa: ${masaAntes.toFixed(1)} M☉ → ${bh.masaSolar.toFixed(1)} M☉`);
      elMasa.value = bh.masaSolar;
      syncAttrs();
    }
  }, 180);
});

document.getElementById('btn-fusionar').addEventListener('click', () => {
  const otraMasa = 3 + Math.random() * 8;
  const otro = new AgujeroNegro(otraMasa, 0, 0, Math.random() * 0.5);
  const antes = bh.masaSolar;
  bh.fusionar(otro);
  elMasa.value = Math.min(50, bh.masaSolar);
  syncAttrs();
  waves.push({ r: visualRadius() });
  logLine(`agujero.fusionar(otro=AgujeroNegro(masa=${otraMasa.toFixed(1)}))`,
    `masa combinada: ${antes.toFixed(1)} + ${otraMasa.toFixed(1)} = ${bh.masaSolar.toFixed(1)} M☉ · se emite una onda gravitacional`);
});
