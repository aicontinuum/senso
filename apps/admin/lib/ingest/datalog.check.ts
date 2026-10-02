// Checks the datalog parser against a frame captured from sensor 2 on
// 2026-10-02, answering a poll for 1 Oct 08:50–10:30 UTC. ChirpStack's own
// decoder read the same frame as the DATALOG string below.
//
//   node --experimental-strip-types apps/admin/lib/ingest/datalog.check.ts

import { frameBytes, isDatalogFrame, parseDatalogFrame } from './datalog.ts';

const CAPTURED = 'CCcIIwJAQWq+IL4ILQgnAhhBar4kQggtCCoCD0FqvifGCC0ILQICQWq+K0oILQgsAfxBar4uzgg0CC4B6kFqvjJSCC0IKgIHQWq+NdY=';
const DECODER_SAID = '[20.87,20.83,57.6,2026-10-01 08:58:38],[20.93,20.87,53.6,2026-10-01 09:13:38],[20.93,20.9,52.7,2026-10-01 09:28:38],[20.93,20.93,51.4,2026-10-01 09:43:38],[20.93,20.92,50.8,2026-10-01 09:58:38],[21,20.94,49,2026-10-01 10:13:38],[20.93,20.9,51.9,2026-10-01 10:28:38],';
/** A live reading from the same sensor model: 11 bytes, no poll bit. */
const LIVE = 'zOEJqQHEAQj1f/8=';

function assert(cond: boolean, name: string): void {
  if (!cond) { console.error(`FAIL: ${name}`); process.exit(1); }
  console.log(`PASS: ${name}`);
}

const bytes = frameBytes(CAPTURED);
assert(isDatalogFrame(bytes), 'the captured frame is recognised as a datalog answer');
assert(!isDatalogFrame(frameBytes(LIVE)), 'a live reading is not');

const records = parseDatalogFrame(bytes);
const expected = DECODER_SAID.split('],').filter(Boolean).map(s => s.replace('[', '').split(','));
assert(records.length === expected.length, `seven records (${records.length})`);
records.forEach((r, i) => {
  const [temp, , hum, when] = expected[i];
  assert(r.temperature === Number(temp), `record ${i + 1} probe temperature ${temp}`);
  assert(r.humidity === Number(hum), `record ${i + 1} humidity ${hum}`);
  assert(r.recordedAt.toISOString() === `${when.replace(' ', 'T')}.000Z`, `record ${i + 1} taken at ${when} UTC`);
});
assert(records[1].recordedAt.getTime() - records[0].recordedAt.getTime() === 15 * 60 * 1000, 'records are 15 minutes apart');
console.log('DATALOG_OK');
