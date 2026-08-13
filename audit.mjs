// audit.mjs — fallvet's audit layout, and the chain built from it.
//
// ⚑ THE BYTES MUST NOT CHANGE. There are logs in the wild signed by the old inline writer:
//     sha256(lastAuditHash + ts + action + adviserId + payloadStr)
// If this layout differs by one character, every entry a practice has already written stops
// reproducing and the verifier reports the whole history as tampered. Making a real audit trail
// look forged is a worse outcome than not checking it at all, so the layout below is a faithful
// copy of the original and a test pins it against a literal expected string.
//
// The chain semantics live in the shared, separately-gated audit-chain kernel. Only the byte layout
// is this repo's business.
import { auditChain } from './audit-chain.mjs';

/**
 * Exactly what the old writer hashed, in the same order. `clinicianId` is the field the entry
 * carries; the original read it from state as `adviserId` before storing it under that name.
 */
export function payloadOf(prevHash, entry) {
  const e = (entry && typeof entry === 'object') ? entry : {};
  return String(prevHash == null ? '' : prevHash)
    + String(e.ts ?? '')
    + String(e.action ?? '')
    + String(e.clinicianId ?? '')
    + JSON.stringify(e.payload ?? {});
}

/** The writer and the checker, from one call, over one layout. */
export function makeAuditChain(sha256) {
  return auditChain({ sha256, payloadOf });
}

export default { payloadOf, makeAuditChain };
