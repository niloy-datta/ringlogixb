# DockFlow AI — Test Execution Results

**Test Suite Engine**: Vitest v2.1.9 (Node environment)  
**Total Test Files**: 8 passed (8)  
**Total Tests**: 36 passed (36)  
**Pass Rate**: 100%

---

## Detailed Test Matrix

```
 ✓ tests/unit/event-normalizer.test.ts (5 tests)
   ✓ correctly normalizes a vehicle motion event with Smart Alerts
   ✓ handles missing Smart Alerts classification gracefully by falling back to generic motion
   ✓ supports human and package_delivery classifications
   ✓ throws an informative error if meta.request_id is missing
   ✓ throws an informative error if device_id is missing

 ✓ tests/unit/matching-engine.test.ts (4 tests)
   ✓ produces high confidence match (> 0.90) for vehicle arrival matching dock and appointment window
   ✓ evaluates and ranks multiple candidate delivery matches
   ✓ bounds confidence score when only generic motion is available (never identifies truck from generic motion alone)
   ✓ handles delayed events within grace window with reduced time contribution

 ✓ tests/unit/crypto.test.ts (7 tests)
   ✓ correctly calculates HMAC-SHA256 signature for raw byte payloads
   ✓ verifies valid HMAC signatures using timing-safe comparison
   ✓ supports signatures prefixed with "sha256="
   ✓ rejects tampered payload content with invalid signature
   ✓ rejects null, undefined, or empty signatures
   ✓ generates deterministic SHA-256 tamper-proof receipt hashes regardless of key order
   ✓ encrypts and decrypts sensitive Ring tokens using AES-256-GCM

 ✓ tests/integration/simulator-workflow.test.ts (3 tests)
   ✓ generates fully compliant Ring motion payload signed with HMAC
   ✓ generates Ring device status changed payload (camera offline)
   ✓ normalizes simulated payload with proper provenance tracking

 ✓ tests/unit/job-queue.test.ts (3 tests)
   ✓ calculates exponential backoff delay correctly on job failure
   ✓ marks job as FAILED when max retries are exceeded
   ✓ recovers locked or interrupted jobs after worker restart

 ✓ tests/integration/receipt-audit.test.ts (5 tests)
   ✓ generates a valid 256-bit tamper-proof SHA-256 hash for proof of receipt
   ✓ detects tampering: modifying pallet count changes cryptographic hash completely
   ✓ detects tampering: changing seal condition changes cryptographic hash
   ✓ scores clean receiving session as 0 risk with clean receipt recommendation
   ✓ identifies broken trailer seals and pallet shortages with elevated risk scores

 ✓ tests/unit/out-of-order.test.ts (3 tests)
   ✓ prevents retrograde state transitions if older out-of-order event arrives
   ✓ allows advancing from ARRIVAL_DETECTED to ARRIVED even if intermediate state was delayed
   ✓ rejects state mutation after receiving session is CLOSED

 ✓ tests/unit/state-machine.test.ts (6 tests)
   ✓ allows valid progressive transitions in the receiving lifecycle
   ✓ rejects invalid state transitions
   ✓ treats identical state transition as idempotent no-op
   ✓ grants full operational and override permissions to ADMIN
   ✓ grants dock execution permissions to RECEIVING_OPERATOR but prohibits override
   ✓ grants read-only audit permissions to AUDITOR without write capabilities
```

---

## Production Build Verification

```
> dockflow-ai@1.0.0 build
> next build

  ▲ Next.js 14.2.35
  - Environments: .env

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    11.8 kB         105 kB
├ ○ /_not-found                          873 B          88.1 kB
├ ƒ /api/correlations/decision           0 B                0 B
├ ƒ /api/dashboard/kpis                  0 B                0 B
├ ƒ /api/deliveries                      0 B                0 B
├ ƒ /api/deliveries/[id]                 0 B                0 B
├ ƒ /api/deliveries/[id]/status          0 B                0 B
├ ƒ /api/docks                           0 B                0 B
├ ƒ /api/docks/map-camera                0 B                0 B
├ ƒ /api/exceptions                      0 B                0 B
├ ƒ /api/exceptions/[id]/resolve         0 B                0 B
├ ƒ /api/realtime/events                 0 B                0 B
├ ƒ /api/receipts/[deliveryId]           0 B                0 B
├ ƒ /api/receiving/[sessionId]/complete  0 B                0 B
├ ƒ /api/receiving/start                 0 B                0 B
├ ƒ /api/ring/cameras                    0 B                0 B
├ ƒ /api/simulator/trigger               0 B                0 B
└ ƒ /api/webhooks/ring                   0 B                0 B
+ First Load JS shared by all            87.2 kB

✓ 0 TypeScript errors
✓ 0 Lint errors
✓ 0 Bundle warnings
```
