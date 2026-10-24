# DockFlow AI — Architecture & Technical Design

## 1. Executive Architecture Summary

DockFlow AI is designed as a high-reliability, event-driven warehouse receiving operating system. It bridges physical hardware sensors (Amazon Ring cameras) and enterprise logistics processes (WMS/receiving management).

### Architectural Invariants
1. **Separation of Ingestion and Processing**: Webhooks are acknowledged within 5 seconds; expensive correlation and AI scoring run asynchronously via a durable job queue.
2. **Cryptographic Provenance**: Every incoming Ring event is verified via HMAC-SHA256 against raw request bytes. Every finished receiving record is sealed with an immutable SHA-256 hash.
3. **Multi-Factor Correlation**: No shipment is identified solely from generic motion. Vehicle presence, dock geometry, and schedule appointment windows are deterministically scored.
4. **Finite State Transitions**: All receiving lifecycle changes pass through an atomic state machine with audit trails.

---

## 2. Ingestion Subsystem

```
Ring Webhook ---> HTTP POST /api/webhooks/ring
                      |
                      v
             Raw Request Buffer
                      |
                      +---> HMAC-SHA256 Verification (timingSafeEqual)
                      |
                      +---> Deduplication Check on meta.request_id
                      |
                      +---> Persistence into RingEvent Table
                      |
                      +---> Immediate 200 OK Response (SLA < 5s)
                      |
                      v
             Enqueue Background Job (CORRELATE_EVENT)
```

---

## 3. Deterministic Matching Engine

The matching engine scores candidate deliveries against the arriving vehicle event using weighted factors:

$$\text{Confidence Score} = W_{\text{dock}} \cdot S_{\text{dock}} + W_{\text{time}} \cdot S_{\text{time}} + W_{\text{class}} \cdot S_{\text{class}}$$

| Factor | Weight | Scoring Logic |
|---|---|---|
| **Dock Match** ($W_{\text{dock}}$) | 0.40 | 1.0 if camera is mapped to the delivery's reserved bay; 0.375 if floating |
| **Time Window** ($W_{\text{time}}$) | 0.35 | 1.0 if inside window; 0.70 if within 30 min grace period; 0.35 if within 60 mins |
| **Classification** ($W_{\text{class}}$) | 0.25 | 1.0 for Ring Smart Alerts `vehicle`; 0.32 for generic `motion`; 0.16 for `human` |

### Disambiguation & Thresholds
- **Confidence $\ge 0.70$ with single leader**: Advanced to `ARRIVAL_DETECTED`.
- **Multiple candidates within 0.15 score gap**: Placed into `MATCH_PENDING` requiring operator confirmation.
- **No scheduled shipment found for vehicle**: Triggers `UNSCHEDULED_VEHICLE` operational exception.

---

## 4. State Machine Transition Graph

```
[ SCHEDULED ] -----------------------------------------> [ CANCELLED ]
      |
      v
[ ARRIVAL_DETECTED ] -------> [ MATCH_PENDING ]
      |                             |
      v                             v
[ ARRIVED ] <-----------------------+
      |
      v
[ RECEIVING ]
      |
      v
[ RECEIVED ]  (Sealed with SHA-256 Proof of Receipt)
      |
      v
[ CLOSED ]
```

---

## 5. Security & Multi-Tenancy

- **Multi-Tenant Isolation**: All database queries are partitioned by `orgId`.
- **HMAC Verification**: Timing-attack safe comparisons prevent spoofed Ring event injection.
- **AES-256-GCM Token Encryption**: Ring Playground and OAuth refresh tokens are stored encrypted at rest.
- **Role-Based Access Control**:
  - `ADMIN`: Full system configuration, manual overrides, user provisioning.
  - `SHIFT_SUPERVISOR`: Dock bay assignments, exception resolution, correlation overrides.
  - `RECEIVING_OPERATOR`: Active session inspection, pallet verification, digital sign-off.
  - `AUDITOR`: Immutable read-only inspection of sealed receipts and audit logs.
