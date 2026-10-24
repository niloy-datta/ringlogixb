# DockFlow AI — Intelligent Event-Driven Warehouse Receiving OS

> **Arrival-to-Receipt Automation with Amazon Ring Cameras**  
> *Transforming security cameras into an automated logistics verification & proof-of-receipt operating system.*

---

## 🌟 Product Vision & Differentiator

Conventional camera applications only notify users of motion or stream passive video. **DockFlow AI** is an event-driven warehouse receiving operating system that converts Amazon Ring camera events into actionable logistics workflows — from trailer arrival detection through dock assignment, multi-factor correlation, human verification, and tamper-evident cryptographic proof-of-receipt.

### Core Capabilities
- **Official Ring Partner API Client**: Device discovery, status polling, and telemetry streaming via `https://api.amazonvision.com`.
- **Sub-5-Second Webhook Ingestion**: Fast HTTPS webhook ingestion with constant-time HMAC-SHA256 signature verification and deduplication on `meta.request_id`.
- **Deterministic Correlation Engine**: Multi-factor matching evaluating assigned dock bays, scheduled appointment windows, and Ring Smart Alerts vehicle classification. Never identifies a truck solely from generic motion.
- **State Machine Workflow**: Strict atomic transitions (`SCHEDULED` ➔ `ARRIVAL_DETECTED` ➔ `MATCH_PENDING` ➔ `ARRIVED` ➔ `RECEIVING` ➔ `RECEIVED` ➔ `CLOSED`).
- **Cryptographic Proof of Receipt**: Generates 256-bit SHA-256 tamper-evident receipts binding carrier identity, Ring camera event timestamps, physical pallet counts, and seal integrity.
- **Real-Time SSE Operational Stream**: Live telemetry streaming via Server-Sent Events with bounded replay and heartbeat pings.
- **Automated Exception Detection**: Proactive monitoring for unscheduled vehicles, overdue arrivals, delayed receiving, dock congestion, and offline cameras.
- **Amazon Bedrock & S3 Architecture**: Modular AI analysis interface for cargo discrepancy scoring and S3-compatible evidence storage.

---

## 🏗️ Architecture Overview

```
                      +-------------------------------------------+
                      |       Ring Partner API / Webhook          |
                      |       (https://api.amazonvision.com)      |
                      +---------------------+---------------------+
                                            |
                         HTTPS POST (HMAC-SHA256 Signed)
                                            v
                      +-------------------------------------------+
                      |         Fast Webhook Ingestion            |
                      |   - Verify X-Signature raw byte HMAC      |
                      |   - Deduplicate via meta.request_id       |
                      |   - Acknowledge 200 OK (< 5 seconds)      |
                      +---------------------+---------------------+
                                            |
                              Enqueues Job into Postgres
                                            v
                      +-------------------------------------------+
                      |            Durable Job Worker             |
                      |         (PostgreSQL Job Queue)            |
                      +---------------------+---------------------+
                                            |
                                            v
                      +-------------------------------------------+
                      |    Deterministic Correlation Engine       |
                      |   - Dock Bay Mapping (Weight: 40%)        |
                      |   - Time Window Fit  (Weight: 35%)        |
                      |   - Vehicle Classify (Weight: 25%)        |
                      +---------------------+---------------------+
                                            |
                         Advances Receiving State Machine
                                            v
                      +-------------------------------------------+
                      |         Human Verification UI             |
                      |   - Operator confirms / overrides match   |
                      |   - Inspects trailer seal & pallet counts |
                      +---------------------+---------------------+
                                            |
                               Creates Signed Receipt
                                            v
                      +-------------------------------------------+
                      |    Tamper-Evident Proof of Receipt        |
                      |   - Canonical SHA-256 Cryptographic Seal  |
                      |   - Evidence Snapshot References          |
                      +-------------------------------------------+
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v18.0.0+ (Tested on Node.js v24.19.0)
- **PostgreSQL**: v14+ (Local instance or Docker Compose)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your credentials:
```env
DATABASE_URL="postgresql://dockflow_user:dockflow_pass@localhost:5432/dockflow_db?schema=public"
RING_API_BASE_URL="https://api.amazonvision.com"
RING_ACCESS_TOKEN="your_ring_playground_or_oauth_token"
RING_WEBHOOK_SECRET="whsec_dockflow_production_grade_hmac_secret_2026"
```

### 3. Launch Local Database & Seed Data
Start PostgreSQL and MinIO (optional Docker Compose):
```bash
docker compose up -d
```

Generate Prisma Client and push migrations:
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing

DockFlow AI includes comprehensive unit and integration tests covering all 13 critical logistics and security scenarios:

```bash
# Run all Vitest suites
npm test

# Run tests with coverage report
npm run test:coverage
```

### Test Scenarios Covered
| # | Scenario | Test File | Status |
|---|---|---|---|
| 1 | Normal delivery processing | `tests/unit/matching-engine.test.ts` | ✅ Pass |
| 2 | Invalid webhook signatures (HMAC rejection) | `tests/unit/crypto.test.ts` | ✅ Pass |
| 3 | Duplicate webhook delivery (meta.request_id) | `tests/unit/crypto.test.ts` | ✅ Pass |
| 4 | Missing or malformed events | `tests/unit/event-normalizer.test.ts` | ✅ Pass |
| 5 | Missing Smart Alerts fallback (generic motion) | `tests/unit/event-normalizer.test.ts` | ✅ Pass |
| 6 | Unscheduled arrival handling | `tests/unit/matching-engine.test.ts` | ✅ Pass |
| 7 | Multiple candidate delivery matches | `tests/unit/matching-engine.test.ts` | ✅ Pass |
| 8 | Delayed events & grace windows | `tests/unit/matching-engine.test.ts` | ✅ Pass |
| 9 | Out-of-order events & monotonic transitions | `tests/unit/out-of-order.test.ts` | ✅ Pass |
| 10 | Offline Ring camera alerts | `tests/integration/simulator-workflow.test.ts` | ✅ Pass |
| 11 | Unauthorized operators (RBAC matrix) | `tests/unit/state-machine.test.ts` | ✅ Pass |
| 12 | Interrupted background jobs & worker recovery | `tests/unit/job-queue.test.ts` | ✅ Pass |
| 13 | Tamper-evident receipt audit correctness | `tests/integration/receipt-audit.test.ts` | ✅ Pass |

---

## 📂 Repository Structure

```
dockflow-ai/
├── src/
│   ├── app/                          # Next.js App Router (UI & API Routes)
│   │   ├── api/                      # Authenticated REST & Webhook Handlers
│   │   │   ├── webhooks/ring/        # Fast Ring webhook receiver (HMAC check)
│   │   │   ├── realtime/events/      # Server-Sent Events (SSE) live broker
│   │   │   ├── deliveries/           # Expected deliveries CRUD & status
│   │   │   ├── docks/                # Dock bays & camera mappings
│   │   │   ├── ring/cameras/         # Camera registration & discovery
│   │   │   ├── correlations/decision/# Human verification & override
│   │   │   ├── receiving/            # Session execution & completion
│   │   │   ├── receipts/             # Tamper-evident proof-of-receipt
│   │   │   ├── exceptions/           # Operational exceptions & scan
│   │   │   ├── dashboard/kpis/       # Warehouse executive metrics
│   │   │   └── simulator/trigger/    # Dev playground scenario triggers
│   │   ├── globals.css               # Dark theme design system & tokens
│   │   ├── layout.tsx                # App layout & navigation
│   │   └── page.tsx                  # Command Center UI & Live Stream
│   ├── components/                   # UI Primitives & Providers
│   ├── lib/                          # Core Singletons & Utilities
│   │   ├── prisma.ts                 # Database client
│   │   ├── crypto.ts                 # HMAC-SHA256, AES-256-GCM, Receipt Hashing
│   │   ├── auth.ts                   # RBAC matrix & session extraction
│   │   ├── sse.ts                    # Real-time event broker & replay
│   │   ├── logger.ts                 # Structured JSON logger
│   │   ├── s3.ts                     # S3 evidence store
│   │   └── bedrock.ts                # Amazon Bedrock AI discrepancy scoring
│   ├── services/                     # Business Logic & Integrations
│   │   ├── ring/                     # Official Ring Partner Client & Normalizer
│   │   ├── correlation/              # Deterministic Multi-Factor Matching
│   │   ├── workflow/                 # State Machine & Durable Job Queue
│   │   └── receiving/                # Deliveries, Docks, Exceptions & Receipts
│   └── types/                        # TypeScript & Zod Schema Contracts
├── prisma/
│   ├── schema.prisma                 # 19 Production Models & Indexes
│   └── seed.ts                       # Realistic warehouse seed data
├── tests/
│   ├── unit/                         # Unit test suites
│   └── integration/                  # End-to-end integration test suites
├── docker-compose.yml                # PostgreSQL & MinIO local infrastructure
└── package.json
```

---

## 📜 License
MIT License &copy; 2026 DockFlow AI Team.
