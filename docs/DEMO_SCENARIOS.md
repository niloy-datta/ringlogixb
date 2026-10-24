# DockFlow AI — Hackathon Judging Scenarios & Demo Studio Reference

This guide provides Amazon Ring developer hackathon judges with complete instructions to evaluate the **Warehouse Digital Twin**, **Amazon Ring JSON:API Event Ingestion**, and **Autonomous Arrival-to-Receipt Automation**.

---

## 90-Second Quick Start for Judges

1. Open the application at `http://localhost:3000`.
2. Notice the top banner: **"Amazon Ring Developer Judging Mode"**.
3. Click the gold button: **"Launch 90s Judge Tour"**.
   - The guided tour walks through vehicle motion detection, multi-factor correlation, operator confirmation, receiving inspection, Bedrock discrepancy scoring, and cryptographic receipt sealing.
4. Alternatively, click **"Demo Studio (A-F)"** to run any of the six deterministic scenarios below with real database state changes.

---

## Scenario Catalog (Demo Studio A–F)

### Scenario A: Normal Truck Arrival & Cryptographic Receipt
- **Objective**: Demonstrate frictionless end-to-end Arrival-to-Receipt automation.
- **Workflow**:
  1. Ring Spotlight Cam (`ava1.ring.device.dock1`) issues an official JSON:API `motion_detected` payload with `sub_type: "vehicle"`.
  2. Webhook handler verifies HMAC-SHA256 signature in constant-time and validates replay window (<300s).
  3. Multi-factor matching engine computes 100% confidence score:
     - Dock mapping: +0.40
     - Time-window: +0.35
     - Vehicle classification: +0.25
  4. Digital Twin animates truck docking at **BAY-01**.
  5. Operator Dave Jenkins confirms trailer arrival and begins unloading.
  6. Receiving inspection confirms 14 pallets intact, security seal valid.
  7. System computes canonical SHA-256 hash and generates tamper-proof proof of receipt `REC-...`.
- **Key Evidence**: Click **"Proof of Receipt"** and click **"Verify Cryptographic Seal"** to recompute and verify canonical hash.

---

### Scenario B: Unscheduled Vehicle Creates Operational Exception
- **Objective**: Autonomous anomaly detection for unregistered or unmanifested vehicles.
- **Workflow**:
  1. Ring camera on **BAY-03** detects a vehicle arrival, but no scheduled purchase order exists in that dock's window.
  2. Correlation engine flags confidence below threshold.
  3. Operational exception `UNSCHEDULED_VEHICLE` is automatically raised with `SEVERITY: HIGH`.
  4. Real-time alert renders in Digital Twin and "Exceptions" tab.
- **Key Evidence**: Inspect the Exceptions tab; supervisor resolves exception with inspection notes.

---

### Scenario C: Ambiguous Overlapping Deliveries (Human-in-the-Loop)
- **Objective**: Explainable shipment intelligence and confidence breakdown for conflicting schedules.
- **Workflow**:
  1. Two carriers arrive with overlapping delivery windows at the same bay cluster.
  2. Matching engine evaluates competing candidates and calculates match contributions.
  3. System prompts operator with `ShipmentIntelligencePanel` detailing:
     - Dock match score (40%)
     - Time window score (35%)
     - Vehicle classification score (25%)
     - Alternative candidates and uncertainty reasons
  4. Operator safely selects the correct PO.

---

### Scenario D: Cargo Discrepancy & Compromised Seal
- **Objective**: AI risk scoring and quarantine workflow for physical freight defects.
- **Workflow**:
  1. Truck completes docking at **BAY-02**.
  2. Receiving operator reports 2 missing pallets (10 expected vs 8 received) and broken security seal.
  3. Risk engine evaluates freight risk score (75/100) and automatically flags `DISCREPANCY_FOUND`.
  4. Recommended actions prescribe immediate freight quarantine and carrier OSD report.

---

### Scenario E: Camera Offline Detection & Degraded Fail-Safe
- **Objective**: Resilient infrastructure monitoring and camera telemetry.
- **Workflow**:
  1. Ring webhook receives official `device_offline` status payload for camera `ava1.ring.device.dock4`.
  2. Camera status switches to `OFFLINE` in real-time.
  3. Operational exception `CAMERA_OFFLINE` triggers.
  4. Digital Twin turns radar cone to degraded red state, notifying floor supervisors to enable manual manifest logging.

---

### Scenario F: Replayed / Out-of-Order Ring Event Deduplication
- **Objective**: Robust distributed event handling and idempotency.
- **Workflow**:
  1. An attacker or network duplicate re-sends a previously processed webhook `request_id`.
  2. Webhook handler detects existing record in `< 5ms` and returns `200 OK` with `status: "duplicate_ignored"`.
  3. If timestamp is older than 300 seconds, returns `400 Bad Request` with replay attack prevention notice.
  4. Zero state corruption occurs in the database.

---

## Resetting to Deterministic Baseline

To reset the entire facility to the pre-demo pristine state:
1. Open **"Demo Studio (A-F)"**.
2. Click **"Reset Facility to Baseline"** (calls `/api/demo/reset`).
3. Docks reset to IDLE, deliveries reset to SCHEDULED, exceptions clear, and active receipts reset.
