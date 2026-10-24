# DockFlow AI — Intelligent Event-Driven Warehouse Receiving OS

<p align="center">
  <img src="https://img.shields.io/badge/DockFlow_AI-Arrival--to--Receipt_Automation-0284c7?style=for-the-badge&logo=ring&logoColor=white" alt="DockFlow AI" />
</p>

<p align="center">
  <a href="#-architecture--workflow"><img src="https://img.shields.io/badge/Architecture-Event--Driven-blue?style=flat-square" alt="Event-Driven" /></a>
  <a href="#-automated-testing"><img src="https://img.shields.io/badge/Tests-36%20Passed%20(100%25)-brightgreen?style=flat-square&logo=vitest" alt="Vitest 36 Passed" /></a>
  <a href="#-production-build"><img src="https://img.shields.io/badge/Build-Passing-brightgreen?style=flat-square&logo=next.js" alt="Next.js Build Passing" /></a>
  <a href="https://developer.amazon.com/docs/ring/api-documentation.html"><img src="https://img.shields.io/badge/Ring_Partner_API-v1_Compliant-orange?style=flat-square" alt="Ring Partner API" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Strict_Mode-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=flat-square&logo=prisma" alt="Prisma" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" /></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
</p>

> **Arrival-to-Receipt Automation with Amazon Ring Cameras**  
> *Transforming physical security cameras into an automated logistics verification & tamper-evident proof-of-receipt operating system.*

---

## 📑 Table of Contents
- [🌟 Product Vision & Differentiator](#-product-vision--differentiator)
- [🏗️ System Architecture](#️-system-architecture)
- [🔄 Automated Arrival-to-Receipt Workflow](#-automated-arrival-to-receipt-workflow)
- [⚡ Ring Partner API Integration](#-ring-partner-api-integration)
- [🧪 Automated Testing Suite (36/36 Passed)](#-automated-testing-suite-3636-passed)
- [🚀 Quickstart & Local Setup](#-quickstart--local-setup)
- [📂 Repository Structure](#-repository-structure)
- [📚 Companion Specifications](#-companion-specifications)

---

## 🌟 Product Vision & Differentiator

Conventional camera applications only notify users of motion or stream passive video. **DockFlow AI** is an event-driven warehouse receiving operating system that converts Amazon Ring camera events into actionable logistics workflows — from trailer arrival detection through dock assignment, deterministic multi-factor correlation, human verification, and tamper-evident cryptographic proof-of-receipt.

### Core Capabilities
- **Official Ring Partner API Client**: Device discovery, status polling, and telemetry streaming via `https://api.amazonvision.com/v1/`.
- **Sub-5-Second Webhook Ingestion**: Fast HTTPS webhook ingestion with constant-time HMAC-SHA256 signature verification and deduplication on `meta.request_id`.
- **Deterministic Correlation Engine**: Multi-factor matching evaluating assigned dock bays, scheduled appointment windows, and Ring Smart Alerts vehicle classification. **Never identifies a truck or driver solely from generic motion.**
- **Workflow State Machine**: Strict atomic transitions (`SCHEDULED` ➔ `ARRIVAL_DETECTED` ➔ `MATCH_PENDING` ➔ `ARRIVED` ➔ `RECEIVING` ➔ `RECEIVED` ➔ `CLOSED`).
- **Cryptographic Proof of Receipt**: Generates canonical 256-bit SHA-256 tamper-evident receipts binding carrier identity, Ring camera event timestamps, physical pallet counts, and seal integrity.
- **Real-Time SSE Operational Stream**: Live telemetry streaming via Server-Sent Events with bounded replay and heartbeat pings.
- **Automated Exception Detection**: Proactive monitoring for unscheduled vehicles, overdue arrivals, delayed receiving, dock congestion, and offline cameras.
- **Amazon Bedrock & S3 Architecture**: Modular AI analysis interface for cargo discrepancy scoring and S3-compatible evidence storage.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph External["Amazon Ring Platform"]
        RC[Ring Spotlight / Floodlight Camera] -->|Motion Event| WH[Ring Webhook Dispatcher]
    end

    subgraph Ingestion["DockFlow Ingestion Subsystem (< 5s SLA)"]
        WH -->|HTTPS POST + X-Signature| API["POST /api/webhooks/ring"]
        API -->|Raw Buffer| HMAC["Timing-Safe HMAC-SHA256 Check"]
        HMAC -->|Verified| DEDUP["Deduplication on meta.request_id"]
        DEDUP -->|Unique| DB_EVENT[("Persist RingEvent")]
        API -.->|Immediate 200 OK| WH
    end

    subgraph AsyncWorker["Durable Async Processing"]
        DB_EVENT -->|Enqueue| Q[("PostgreSQL Durable Job Queue")]
        Q --> WORKER["Job Worker Engine"]
        WORKER --> MATCH["Deterministic Matching Engine"]
    end

    subgraph Correlation["Multi-Factor Scoring Engine"]
        MATCH --> DOCK_FAC["Dock Bay Factor (40%)"]
        MATCH --> TIME_FAC["Time Window Factor (35%)"]
        MATCH --> CLASS_FAC["Vehicle Classification (25%)"]
    end

    subgraph StateMachine["Receiving State Machine"]
        DOCK_FAC & TIME_FAC & CLASS_FAC --> FSM{"Confidence Score"}
        FSM -->|Score >= 0.70| ARRIVED["ARRIVAL_DETECTED ➔ ARRIVED"]
        FSM -->|Multiple Candidates| REVIEW["MATCH_PENDING (Operator Review)"]
        FSM -->|No Match + Vehicle| EXC["UNSCHEDULED_VEHICLE Exception"]
    end

    subgraph Receipt["Cryptographic Receipt Sealing"]
        ARRIVED --> RECV["Physical Receiving & Pallet Count"]
        RECV --> BEDROCK["Amazon Bedrock Discrepancy Scoring"]
        BEDROCK --> SEAL["Canonical SHA-256 Receipt Seal"]
        SEAL --> CERT[("Immutable Proof-of-Receipt")]
    end
```

---

## 🔄 Automated Arrival-to-Receipt Workflow

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED : Warehouse Staff Creates Delivery
    SCHEDULED --> ARRIVAL_DETECTED : Ring Vehicle Event Correlated (Score >= 0.70)
    SCHEDULED --> CANCELLED : Carrier Cancellation
    ARRIVAL_DETECTED --> MATCH_PENDING : Multiple Overlapping Appointments
    ARRIVAL_DETECTED --> ARRIVED : Operator Confirms Trailer Match
    MATCH_PENDING --> ARRIVED : Operator Verifies PO & License
    ARRIVED --> RECEIVING : Dock Session Started & Bay Locked
    RECEIVING --> RECEIVED : Pallets Counted + Seal Checked + SHA-256 Hash Generated
    RECEIVED --> CLOSED : Trailer Departed Bay
    CLOSED --> [*]
```

---

## ⚡ Ring Partner API Integration

DockFlow AI directly integrates with the official Amazon Ring Partner API specifications:

| Official Ring API Endpoint | Method | Purpose in DockFlow AI |
|---|---|---|
| `https://api.amazonvision.com/v1/devices` | `GET` | Automatic discovery of authorized Ring warehouse cameras |
| `https://api.amazonvision.com/v1/devices/{id}/status` | `GET` | Real-time device connectivity & battery telemetry |
| `https://api.amazonvision.com/v1/devices/{id}/capabilities` | `GET` | Validates Smart Alerts vehicle detection support |
| `https://api.amazonvision.com/v1/history/devices/{id}/events` | `GET` | Synchronizes historical camera events & video clips |
| `POST /api/webhooks/ring` | `POST` | Ingestion receiver verifying `X-Signature` HMAC-SHA256 |

---

## 🧪 Automated Testing Suite (36/36 Passed)

DockFlow AI features comprehensive automated unit and integration tests covering all 13 critical logistics, workflow, and security scenarios:

```bash
$ npm test

 RUN  v2.1.9 D:/ringlogixb

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

 Test Files  8 passed (8)
      Tests  36 passed (36)
   Duration  652ms
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v18.0.0+ (Tested on Node.js v24.19.0)
- **PostgreSQL**: v14+ (or Docker Compose)

### 2. Configure Environment
```bash
cp .env.example .env
```

Key environment variables in `.env`:
```env
DATABASE_URL="postgresql://dockflow_user:dockflow_pass@localhost:5432/dockflow_db?schema=public"
RING_API_BASE_URL="https://api.amazonvision.com"
RING_ACCESS_TOKEN="your_ring_playground_or_oauth_token"
RING_WEBHOOK_SECRET="whsec_dockflow_production_grade_hmac_secret_2026"
```

### 3. Initialize Database & Seed Dataset
```bash
# Start local PostgreSQL & MinIO container
docker compose up -d

# Generate Prisma Client & Push Schema
npm run db:generate
npm run db:push

# Seed Chicago Hub docks, Ring cameras, carriers & shipments
npm run db:seed
```

### 4. Start Application
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

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
│   │   ├── prisma.ts                 # Database client singleton
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

## 📚 Companion Specifications
- [**`ARCHITECTURE.md`**](file:///d:/ringlogixb/ARCHITECTURE.md): Mathematical scoring models, webhook sequence diagrams, state machines, and security invariants.
- [**`IMPLEMENTATION_STATUS.md`**](file:///d:/ringlogixb/IMPLEMENTATION_STATUS.md): Milestone checklist and Real API vs. Simulator matrix.
- [**`DATABASE_SCHEMA.md`**](file:///d:/ringlogixb/DATABASE_SCHEMA.md): Entity relationships, indexes, and constraints.
- [**`API_REFERENCE.md`**](file:///d:/ringlogixb/API_REFERENCE.md): Complete REST & SSE API contracts with Zod validation schemas.
- [**`TEST_RESULTS.md`**](file:///d:/ringlogixb/TEST_RESULTS.md): Detailed 36-test suite execution report.
- [**`docs/DEMO_SCENARIOS.md`**](file:///d:/ringlogixb/docs/DEMO_SCENARIOS.md): Step-by-step evaluator walkthrough scenarios.

---

## 📜 License
MIT License &copy; 2026 DockFlow AI Team.
