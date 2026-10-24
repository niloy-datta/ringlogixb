# DockFlow AI — API Reference

Base URL: `http://localhost:3000`

---

## 1. Webhook Ingestion

### `POST /api/webhooks/ring`
Fast Ring Partner API webhook ingestion. Responds in $< 50$ms.

- **Headers**:
  - `X-Signature`: HMAC-SHA256 signature calculated over raw request body.
  - `X-Org-Id`: Organization identifier (default: `org_main_warehouse_01`).
- **Body**:
  ```json
  {
    "meta": {
      "request_id": "wh_req_998877",
      "timestamp": "2026-10-24T14:30:00.000Z"
    },
    "event_type": "motion",
    "device_id": "ava1.ring.device.dock1",
    "data": {
      "event_id": "evt_001",
      "sub_type": "vehicle",
      "started_at": "2026-10-24T14:30:00.000Z"
    }
  }
  ```
- **Responses**:
  - `200 OK`: `{"status": "acknowledged", "requestId": "wh_req_998877"}`
  - `200 OK`: `{"status": "duplicate_ignored"}` (idempotent duplicate rejection)
  - `401 Unauthorized`: `{"status": "invalid_signature"}`

---

## 2. Real-Time Telemetry

### `GET /api/realtime/events`
Server-Sent Events (SSE) live operational stream.

- **Headers**:
  - `Last-Event-ID`: Optional ID of last received event for replay buffer.
- **Event Types Emitted**:
  - `RING_EVENT_RECEIVED`: Raw motion or device status update.
  - `CORRELATION_COMPLETED`: AI matching engine candidate scores.
  - `DELIVERY_STATUS_CHANGED`: Workflow state machine transition.
  - `EXCEPTION_DETECTED`: New operational anomaly.
  - `RECEIVING_COMPLETED`: Receipt sealed with SHA-256 hash.

---

## 3. Inbound Deliveries

### `GET /api/deliveries`
List scheduled and active deliveries.
- **Query Parameters**:
  - `q`: Search string (PO, BOL, or Carrier).
  - `status`: Filter by `ReceivingStatus`.
  - `facilityId`: Filter by facility.

### `POST /api/deliveries`
Schedule an expected inbound delivery.
- **Body**:
  ```json
  {
    "facilityId": "fac_chicago_01",
    "dockId": "dock_bay_01",
    "carrierName": "FedEx Freight",
    "purchaseOrderNumber": "PO-2026-9901",
    "bolNumber": "BOL-FX-12345",
    "expectedArrivalWindowStart": "2026-10-24T08:00:00Z",
    "expectedArrivalWindowEnd": "2026-10-24T12:00:00Z",
    "palletCount": 12
  }
  ```

---

## 4. Correlation & Human Verification

### `POST /api/correlations/decision`
Human-in-the-loop verification of AI/camera correlation matches.
- **Body**:
  ```json
  {
    "correlationId": "corr_uuid",
    "action": "CONFIRM", // "CONFIRM" | "REJECT" | "OVERRIDE"
    "notes": "Driver presented verified PO packing slip."
  }
  ```

---

## 5. Receiving Execution & Cryptographic Receipt

### `POST /api/receiving/start`
Starts a physical unloading and inspection session at a dock bay.

### `POST /api/receiving/{sessionId}/complete`
Completes receiving, runs Amazon Bedrock discrepancy analysis, and seals the receipt.
- **Body**:
  ```json
  {
    "palletCountReceived": 12,
    "sealIntact": true,
    "damagesReported": false,
    "damageNotes": null,
    "signatureData": "DIGITAL_SIG_OPERATOR_DAVE"
  }
  ```

### `GET /api/receipts/{deliveryId}`
Retrieves the tamper-evident proof-of-receipt certificate with the 256-bit SHA-256 cryptographic hash.

---

## 6. Simulation & Dev Testing

### `POST /api/simulator/trigger`
Triggers simulated Ring Partner events for interactive testing.
- **Body**:
  ```json
  {
    "scenario": "SCHEDULED_TRUCK", // "SCHEDULED_TRUCK" | "UNSCHEDULED_VEHICLE" | "GENERIC_MOTION" | "CAMERA_OFFLINE" | "TAMPERED_SIGNATURE"
    "executeJobsImmediately": true
  }
  ```
