# DockFlow AI — Database Schema Reference

PostgreSQL database managed via Prisma ORM (`prisma/schema.prisma`).

## Models & Entity Relationships

### 1. `organizations`
Multi-tenant isolation boundary for warehouse operators.
- `id`: UUID (Primary Key)
- `name`: String
- `code`: String (Unique)
- `retentionDays`: Integer (Default 365)

### 2. `users`
Warehouse personnel with role-based access control.
- `id`: UUID (Primary Key)
- `orgId`: UUID (FK ➔ `organizations.id`)
- `email`: String (Unique per org)
- `role`: Enum (`ADMIN`, `RECEIVING_OPERATOR`, `SHIFT_SUPERVISOR`, `AUDITOR`)

### 3. `facilities`
Physical logistics hub or fulfillment center.
- `id`: UUID (Primary Key)
- `code`: String (Unique per org, e.g. `ORD-HUB-01`)
- `timezone`: String

### 4. `docks`
Loading bays and receiving doors.
- `id`: UUID (Primary Key)
- `dockNumber`: String (Unique per facility, e.g. `BAY-01`)
- `status`: Enum (`IDLE`, `OCCUPIED`, `RESERVED`, `MAINTENANCE`)

### 5. `ring_camera_connections`
Authorized Ring camera devices.
- `id`: UUID (Primary Key)
- `deviceId`: String (Unique per org, e.g. `ava1.ring.device.dock1`)
- `isOnline`: Boolean
- `tokenEncrypted`: String (AES-256-GCM encrypted access token)

### 6. `camera_dock_mappings`
Spatial mapping between Ring cameras and warehouse bays.
- `cameraId`: UUID (FK ➔ `ring_camera_connections.id`)
- `dockId`: UUID (FK ➔ `docks.id`)
- `viewAngle`: String (`TRAILER_APPROACH`, `DOOR_SEAL_VIEW`)

### 7. `expected_deliveries`
Scheduled carrier appointments.
- `id`: UUID (Primary Key)
- `purchaseOrderNumber`: String (Indexed)
- `bolNumber`: String (Bill of Lading)
- `expectedArrivalWindowStart`: DateTime
- `expectedArrivalWindowEnd`: DateTime
- `status`: Enum (`SCHEDULED`, `ARRIVAL_DETECTED`, `MATCH_PENDING`, `ARRIVED`, `RECEIVING`, `REVIEW_REQUIRED`, `RECEIVED`, `CLOSED`, `CANCELLED`)
- `palletCount`: Integer

### 8. `ring_events`
Ingested and normalized Ring events.
- `requestId`: String (Unique constraint for deduplication)
- `eventType`: String (`motion`, `device_status_changed`)
- `subType`: Enum (`vehicle`, `human`, `package_delivery`, `other_motion`, `motion`)
- `startedAt`: DateTime
- `snapshotUrl`: String

### 9. `event_correlations`
Deterministic correlation scores between Ring events and deliveries.
- `confidenceScore`: Float (0.0 to 1.0)
- `matchReasoning`: JSON (Breakdown of dock, time, and vehicle scores)
- `status`: Enum (`PROPOSED`, `CONFIRMED`, `REJECTED`, `OVERRIDDEN`)

### 10. `receiving_sessions`
Active physical receiving sessions at a dock.
- `palletCountReceived`: Integer
- `startedAt`: DateTime
- `endedAt`: DateTime

### 11. `receiving_confirmations`
Finalized, signed receipt certificate.
- `receiptNumber`: String (Unique)
- `proofOfReceiptHash`: String (SHA-256 cryptographic hash)
- `sealIntact`: Boolean
- `damagesReported`: Boolean

### 12. `operational_exceptions`
Discrepancies, overdue alerts, and anomalies.
- `exceptionType`: Enum (`UNSCHEDULED_VEHICLE`, `ARRIVAL_OVERDUE`, `RECEIVING_OVERDUE`, `DOCK_CONGESTION`, `CAMERA_OFFLINE`, `DISCREPANCY_FOUND`)
- `severity`: Enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `status`: Enum (`OPEN`, `INVESTIGATING`, `RESOLVED`, `DISMISSED`)

### 13. `audit_logs`
Immutable audit log of all state machine transitions and manual overrides.
- `action`: String
- `previousState`: JSON
- `newState`: JSON
- `timestamp`: DateTime

### 14. `durable_jobs`
PostgreSQL-backed background job queue for async correlation & scanning.
- `jobType`: String
- `status`: Enum (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`)
- `retryCount`: Integer
- `scheduledFor`: DateTime
