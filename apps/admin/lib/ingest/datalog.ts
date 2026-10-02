// The sensor's memory, as it arrives.
//
// An LHT65N keeps every reading it takes. Asked for a time range (the poll
// command in lib/chirpstack.ts), it answers on the same port as a live
// reading, fPort 2, with a frame of 11-byte records; a long range comes as
// several frames seconds apart. The frame is told apart from a live reading
// by the status byte of its first record: bit 6 says "answer to a poll",
// bit 7 "retransmission". A live reading has neither set.
//
// Each record, read from the raw bytes rather than ChirpStack's decoded
// string, which formats the time in the server's zone and names nothing:
//
//   0-1  external probe temperature, int16, 1/100 °C   (the compliance value)
//   2-3  internal temperature, int16, 1/100 °C
//   4-5  humidity, low 12 bits, 1/10 %
//   6    status: low nibble = external sensor kind, bit 6 poll, bit 7 retransmit
//   7-10 unix time the reading was taken, uint32, big-endian
//
// Captured and checked against sensor 2 on 2026-10-02: datalog.check.ts.

export const DATALOG_RECORD_BYTES = 11;

const STATUS_OFFSET = 6;
const POLL_BIT = 0x40;
const RETRANSMIT_BIT = 0x80;
/** Low nibble of the status byte when the external probe is a temperature sensor. */
const EXT_TEMPERATURE_PROBE = 1;

export type DatalogRecord = {
  /** External probe, °C. */
  temperature: number;
  humidity: number;
  /** When the sensor took the reading, by its own clock. */
  recordedAt: Date;
};

/** True for a frame the sensor sent in answer to a poll (or a retransmission),
 *  as opposed to a live reading. Both are fPort 2. */
export function isDatalogFrame(bytes: Uint8Array): boolean {
  if (bytes.length < DATALOG_RECORD_BYTES || bytes.length % DATALOG_RECORD_BYTES !== 0) return false;
  return (bytes[STATUS_OFFSET] & (POLL_BIT | RETRANSMIT_BIT)) !== 0;
}

function int16(hi: number, lo: number): number {
  const n = (hi << 8) | lo;
  return n >= 0x8000 ? n - 0x10000 : n;
}

/** The records in a datalog frame, in frame order. A record whose external
 *  sensor is not a temperature probe is left out: its first field would be
 *  something else (a counter, a voltage) wearing a temperature's clothes. */
export function parseDatalogFrame(bytes: Uint8Array): DatalogRecord[] {
  const records: DatalogRecord[] = [];
  for (let i = 0; i + DATALOG_RECORD_BYTES <= bytes.length; i += DATALOG_RECORD_BYTES) {
    const ext = bytes[i + STATUS_OFFSET] & 0x0f;
    if (ext !== EXT_TEMPERATURE_PROBE) continue;
    const unix = ((bytes[i + 7] << 24) >>> 0) + (bytes[i + 8] << 16) + (bytes[i + 9] << 8) + bytes[i + 10];
    records.push({
      temperature: int16(bytes[i], bytes[i + 1]) / 100,
      humidity: (((bytes[i + 4] << 8) | bytes[i + 5]) & 0x0fff) / 10,
      recordedAt: new Date(unix * 1000),
    });
  }
  return records;
}

/** The raw frame from ChirpStack's `data` field. */
export function frameBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}
