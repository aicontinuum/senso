#!/usr/bin/env node
// Gateway simulator — mimics a Raspberry Pi sending temperature readings to the ingest API.
// Edit the CONFIG section below, then: node scripts/simulate.mjs

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const INGEST_URL = process.env.INGEST_URL ?? 'http://localhost:3001/api/ingest';
const GATEWAY_MAC = process.env.GATEWAY_MAC ?? 'b8:27:eb:4f:a2:11';
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? '10000');

// hardware_id values must match sensors registered in the admin UI
const SENSORS = [
  { hardwareId: '28-3c01d6075aff', name: 'Cold Storage B', baseTemp: 4.0, variance: 0.8 },
];
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
};

// Box-Muller Gaussian random temperature
function randTemp(base, variance) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.round((base + z * variance) * 10) / 10;
}

const args = process.argv.slice(2);
const spikeIdx  = args.includes('--spike')   ? Number(args[args.indexOf('--spike')  + 1]) : null;
const dropIdx   = args.includes('--drop')    ? Number(args[args.indexOf('--drop')   + 1]) : null;
const offlineMode = args.includes('--offline');
const onceMode    = args.includes('--once');

async function post(body) {
  const res = await fetch(INGEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

async function sendOffline() {
  const { ok, data } = await post({ mac_address: GATEWAY_MAC, offline: true });
  if (ok) console.log(`${C.yellow}→ Offline signal sent${C.reset}`);
  else    console.log(`${C.red}✗ Offline signal failed: ${data.error ?? JSON.stringify(data)}${C.reset}`);
}

async function sendReadings() {
  const now = new Date().toISOString();

  const readings = SENSORS.map((s, i) => {
    let temperature;
    if (i === spikeIdx)     temperature = Math.round((s.baseTemp + 10) * 10) / 10;
    else if (i === dropIdx) temperature = Math.round((s.baseTemp - 10) * 10) / 10;
    else                    temperature = randTemp(s.baseTemp, s.variance);
    return { hardware_id: s.hardwareId, temperature, recorded_at: now };
  });

  const { ok, data } = await post({ mac_address: GATEWAY_MAC, readings });

  const ts = new Date().toLocaleTimeString();
  if (ok) {
    const skippedNote = data.skipped > 0 ? ` ${C.yellow}(${data.skipped} skipped — hardware_id not registered)${C.reset}` : '';
    console.log(`${C.dim}[${ts}]${C.reset} ${C.green}✓${C.reset} ${data.accepted} reading(s) sent${skippedNote}`);
    readings.forEach((r, i) => {
      const s = SENSORS[i];
      const anomaly = i === spikeIdx ? ` ${C.red}↑ SPIKE${C.reset}` : i === dropIdx ? ` ${C.red}↓ DROP${C.reset}` : '';
      console.log(`  ${C.cyan}${s.name}${C.reset}: ${r.temperature}°C${anomaly}`);
    });
  } else {
    console.log(`${C.dim}[${ts}]${C.reset} ${C.red}✗ ${data.error ?? JSON.stringify(data)}${C.reset}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (offlineMode) {
  await sendOffline();
  process.exit(0);
}

console.log(`\n${C.bold}${C.cyan}Senso Gateway Simulator${C.reset}`);
console.log(`  Ingest URL : ${INGEST_URL}`);
console.log(`  Gateway MAC: ${GATEWAY_MAC}`);
console.log(`  Sensors    : ${SENSORS.map(s => `${s.name} (${s.hardwareId})`).join(', ')}`);
console.log(`  Interval   : ${INTERVAL_MS / 1000}s`);
if (spikeIdx !== null) console.log(`  ${C.red}SPIKE MODE : sensor ${spikeIdx} — ${SENSORS[spikeIdx]?.name ?? 'unknown'}${C.reset}`);
if (dropIdx  !== null) console.log(`  ${C.red}DROP  MODE : sensor ${dropIdx}  — ${SENSORS[dropIdx]?.name  ?? 'unknown'}${C.reset}`);
if (onceMode)          console.log(`  ${C.yellow}ONE-SHOT MODE${C.reset}`);
console.log(`\nPress Ctrl+C to stop (sends offline signal)\n`);

process.on('SIGINT', async () => {
  console.log(`\n${C.yellow}Stopping…${C.reset}`);
  await sendOffline();
  process.exit(0);
});

await sendReadings();
if (onceMode) process.exit(0);

setInterval(sendReadings, INTERVAL_MS);
