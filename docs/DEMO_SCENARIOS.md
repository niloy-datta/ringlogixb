# DockFlow AI — Walkthrough & Demo Scenarios

This document guides hackathon judges and evaluators through reproducing the end-to-end Arrival-to-Receipt automation flows in DockFlow AI.

---

## Scenario 1: Automated On-Time Truck Arrival & Multi-Factor Correlation

1. **Pre-condition**:
   - `PO-2026-8801` (FedEx Freight) is scheduled for **Bay 1** between 08:00 and 13:00.
   - Dock Bay 1 is mapped to Ring Spotlight Camera `ava1.ring.device.dock1`.
2. **Trigger Action**:
   - In the top action bar, click **"Simulate Truck Arrival (Bay 1)"**.
3. **Automated Event Execution**:
   - The simulator issues an HMAC-SHA256 signed Ring webhook to `/api/webhooks/ring`.
   - The webhook acknowledges in $< 20$ms and enqueues a `CORRELATE_EVENT` job.
   - The deterministic matching engine evaluates:
     - Dock mapping: Matched (+0.40)
     - Time window: Inside (+0.35)
     - Classification: Ring Smart Alerts `vehicle` (+0.25)
     - Confidence score: **1.00 (100%)**
   - The delivery automatically transitions from `SCHEDULED` to `ARRIVAL_DETECTED`.
   - Real-time SSE broadcasts `CORRELATION_COMPLETED` and `RING_EVENT_RECEIVED` to the UI.
4. **Verification**:
   - The PO badge pulses in the inbound deliveries table.
   - Click **"Review Match"** to inspect the deterministic evidence and click **"Confirm Trailer Arrival"**.
   - The delivery state transitions to `ARRIVED`, and Dock Bay 1 switches to `OCCUPIED`.

---

## Scenario 2: Unscheduled Vehicle Arrival & Automated Exception

1. **Trigger Action**:
   - Click **"Unscheduled Vehicle"** in the top action bar.
2. **Automated Event Execution**:
   - A vehicle motion event is received from camera `ava1.ring.device.dock3` (Bay 3).
   - No scheduled delivery is found within the appointment window for Bay 3.
   - The correlation engine flags an anomaly and creates an `UNSCHEDULED_VEHICLE` operational exception.
3. **Verification**:
   - Switch to the **"Exceptions"** tab.
   - An alert appears: `"Unscheduled Vehicle at Dock BAY-03 - Detected at [Time]"`.
   - Click **"Resolve Exception"** to log supervisor notes and clear the alert.

---

## Scenario 3: Physical Verification, Bedrock Discrepancy Scoring & Cryptographic Receipt Sealing

1. **Trigger Action**:
   - Find an `ARRIVED` shipment (or click **"Start Unloading"**).
   - Once in `RECEIVING` status, click **"Complete Receipt"**.
2. **Inspection Modal**:
   - Inspect the pallet counts (e.g. 14 expected vs 14 received).
   - Ensure "Trailer Security Seal Verified Intact" is checked.
   - Click **"Sign & Seal Proof of Receipt"**.
3. **Cryptographic Sealing**:
   - Amazon Bedrock analyzer reviews the cargo condition and outputs a clean receipt assessment.
   - The canonical JSON representation is cryptographically hashed with SHA-256:
     ```
     proofOfReceiptHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855..."
     ```
   - The delivery advances to `RECEIVED`.
4. **Verification**:
   - Click **"Proof of Receipt"** on the received delivery.
   - A cryptographic certificate modal displays the verified timestamps, operator identity, intact seal confirmation, and 256-bit SHA-256 seal.
