// audit.test.mjs — the layout must reproduce what fallvet has ALREADY written.
import { payloadOf, makeAuditChain } from './audit.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const sha = async (s) => 'h' + [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16);

console.log('\n=== §1 · ⚑ THE HISTORICAL BYTES, UNCHANGED ===');
{
  // The original writer, copied from index.html before the graft:
  //   sha256(lastAuditHash + ts + action + adviserId + JSON.stringify(payload||{}))
  const legacy = (prev, ts, action, adviserId, payload) =>
    prev + ts + action + adviserId + JSON.stringify(payload || {});

  const cases = [
    ['abc123', 1723550000000, 'patient.updated', 'cl_7', { id: 'p1' }],
    ['', 1, 'firm.updated', '', {}],
    ['zz', 999, 'prescription.issued', 'cl_1', { drug: 'meloxicam', qty: 3 }],
  ];
  for (const [prev, ts, action, clinicianId, payload] of cases) {
    const mine = payloadOf(prev, { ts, action, clinicianId, payload });
    ok(mine === legacy(prev, ts, action, clinicianId, payload),
       `⚑ reproduces the old writer byte for byte — "${action}"`);
  }

  // The failure this pins: an entry written by the OLD code must still verify under the NEW checker,
  // or a practice's real audit history reads as forged the day this ships.
  const chain = makeAuditChain(sha);
  const ts = 1723550000000;
  const legacyEntry = { ts, action: 'patient.updated', clinicianId: 'cl_7', payload: { id: 'p1' }, prevHash: '' };
  legacyEntry.docHash = await sha(legacy('', ts, 'patient.updated', 'cl_7', { id: 'p1' }));
  const v = await chain.verify([legacyEntry]);
  ok(v.ok === true, '⚑ an entry written by the OLD inline writer verifies under the new chain');
}

console.log('\n=== §2 · missing fields hash as empty, not as "undefined" ===');
{
  ok(payloadOf('p', {}) === 'p{}', 'an entry with nothing set hashes prev plus an empty payload');
  ok(!/undefined|null/.test(payloadOf('p', { ts: null, action: undefined, clinicianId: null })),
     '⚑ absent fields never become the literal text "undefined" — that would sign a different record than the one stored');
  ok(payloadOf(null, { ts: 5 }) === '5{}', 'a null previous hash is the empty string, matching genesis');
}

console.log('\n=== §3 · it still catches tampering ===');
{
  const chain = makeAuditChain(sha);
  let log = [];
  for (let i = 0; i < 4; i++) log = [...log, await chain.append(log, { id: 'a' + i, ts: 100 + i, action: 'saved', clinicianId: 'c1', payload: { i } })];

  ok((await chain.verify(log)).ok === true, 'an untouched log verifies');

  const edited = [...log]; edited[2] = { ...edited[2], payload: { i: 'tampered' } };
  const e = await chain.verify(edited);
  ok(e.ok === false && e.brokeAt === 2, 'an edit is caught at the right entry');

  const removed = [...log]; removed.splice(1, 1);
  ok((await chain.verify(removed)).ok === false, 'a deletion from the middle is caught');

  // Changing WHO did it must break the chain — that is half the point of an audit log.
  const reassigned = [...log]; reassigned[1] = { ...reassigned[1], clinicianId: 'someone-else' };
  ok((await chain.verify(reassigned)).ok === false,
     '⚑ rewriting which clinician did something breaks the chain');

  const truncated = log.slice(0, 2);
  ok((await chain.verify(truncated)).tailProven === false, 'and truncation is reported as unproven rather than passed silently');
  ok((await chain.verify(truncated, { expectHead: log[3].docHash })).ok === false, 'given the real head, truncation is caught');
}

console.log('\n=== §4 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, 'x'];
  let threw = null;
  for (const j of junk) { try { payloadOf(j, j); } catch (er) { threw = `${JSON.stringify(j)} → ${er.message}`; } }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
