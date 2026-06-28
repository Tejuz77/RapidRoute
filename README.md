# 🚌 RapidRoute — Intercity Bus Ticket Booking Platform

**A full-stack bus ticket booking platform with advanced concurrency controls, operator management, subscription billing, real-time metrics, AI assistant, and a complete admin dashboard.**

Built as a production-feature demo showcasing 7+ concurrency and synchronization patterns, distributed systems architecture (worker threads, message queue, metrics collector), and a complete multi-role platform experience.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Demo Credentials](#demo-credentials)
- [Features by Role](#features-by-role)
  - [👤 Customer Features](#-customer-features)
  - [🧑‍💼 Operator Features](#-operator-features)
  - [🛡️ Admin Features](#️-admin-features)
- [Pages Overview](#pages-overview)
- [API Endpoints](#api-endpoints)
- [Concurrency & Synchronization Patterns](#concurrency--synchronization-patterns)
- [Distributed Systems Patterns](#distributed-systems-patterns)
- [Subscription & Billing System](#subscription--billing-system)
- [Refund Policy](#refund-policy)
- [AI Assistant](#ai-assistant)
- [Design System](#design-system)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Tailwind CSS + Zustand + Lucide React + Recharts |
| **Backend** | Node.js + Express |
| **Database** | PostgreSQL |
| **Auth** | JWT (jsonwebtoken + bcryptjs) |
| **Key Packages** | async-mutex, uuid, pg (node-postgres), react-hot-toast, axios, recharts |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Home     │ │ Search   │ │ Seat     │ │ Checkout           │  │
│  │ Page     │ │ Results  │ │ Selection│ │ + Payment          │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ My       │ │ Admin    │ │ Operator │ │ Performance        │  │
│  │ Bookings │ │ Dashboard│ │ Dashboard│ │ Dashboard          │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│  ┌──────────┐ ┌───────────────────────┐ ┌────────────────────┐  │
│  │ Auth     │ │ AI Assistant (Chat)   │ │ Concurrency Demo  │  │
│  │ (Login/  │ │ Powered by OpenRouter │ │ Modal (Floating)  │  │
│  │ Register)│ │ Free models           │ │                    │  │
│  └──────────┘ └───────────────────────┘ └────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │ HTTP API
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Backend (Express Server)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Auth     │ │ Search   │ │ Seats    │ │ Bookings           │  │
│  │ Routes   │ │ Routes   │ │ Routes   │ │ Routes             │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Payments │ │ Admin    │ │ Admin    │ │ Operator           │  │
│  │ Routes   │ │ Routes   │ │ Metrics  │ │ Routes             │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ AI Chat  │ │          │ │          │ │                    │  │
│  │ Routes   │ │ Middleware│ │ Services │ │ Jobs + Queue       │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                            │
│  users │ buses │ routes │ seats │ bookings │ payments           │
│  refunds │ bus_subscriptions │ admin_settings │ cities          │
│  idempotency_keys │ refund_policy                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create PostgreSQL database
createdb rapidroute

# 3. Run database schema
psql -d rapidroute -f server/db/schema.sql

# 4. Seed sample data
psql -d rapidroute -f server/db/seed.sql

# 5. Configure environment
# Create .env file:
# DATABASE_URL=postgresql://localhost:5432/rapidroute
# JWT_SECRET=your_jwt_secret
# OPENROUTER_API_KEY=sk-or-v1-... (optional, for AI assistant)
# PORT=5000

# 6. Start development servers (frontend + backend concurrently)
npm run dev:all

# Or start separately:
npm run dev:server   # Backend on port 5000
npm run dev:client   # Frontend on port 3000
```

The frontend runs on **http://localhost:3000** and proxies API requests to the backend on **port 5000**.

---

## Demo Credentials

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| **Admin** | `admin@rapidroute.com` | `admin123` | Full platform control |
| **Operator** | `operator@rapidroute.com` | `operator123` | Bus operator with pre-seeded buses |
| **Customer** | *(register via signup page)* | user-set | Regular passenger |

> **Note:** You can also register new customer and operator accounts from the Register page.

---

## Features by Role

### 👤 Customer Features

#### 🔍 Bus Search
- Search intercity routes by origin city, destination city, and travel date
- Real-time seat availability display
- Filter by **bus type** (Sleeper, Semi-Sleeper, Seater)
- Filter by **departure time slot** (Morning, Afternoon, Evening, Night)
- Filter by **price range** (slider up to ₹5,000)
- Sort by **price**, **duration**, or **departure time**
- View bus amenities (AC, WiFi, USB Charging, etc.)

#### 🪑 Interactive Seat Selection
- **Realistic seat map** with custom SVG rendering
- **Dual deck support** for Sleeper buses (Lower Deck / Upper Deck)
- **Custom SVG seat graphics** — seats for Seater/Semi-Sleeper buses, beds for Sleeper buses
- **Color-coded seat status**: Green (available), Teal (selected), Yellow (held by you), Blue/Red (booked by male/female)
- **Gender badge indicators** — ♂/♀ icons on gender-restricted seats
- **Window/aisle indicators** on seat map
- **10-minute seat hold timer** with animated countdown progress bar
- Auto-warning at 2 minutes remaining
- **Booking window countdown** — shows time remaining before booking closes for departure
- Click to select, click again to deselect
- Login prompt overlay for unauthenticated users
- **Sold out** and **Booking closed** states with modals
- Seat map auto-refreshes via polling for real-time updates

#### 💳 Booking & Payment
- Multi-passenger booking (add names, ages, genders for each seat)
- **Contact details** collection (phone, email)
- **Demo payment simulation** with credit card form
- **Idempotency-protected** — same idempotency key = no duplicate charges
- **95% simulated payment success rate** (with retry on failure)
- **Auto-retry on conflict** — if another booking conflicts, auto-retries after 2 seconds
- **Gender validation** — ensures passenger gender matches seat restriction
- **Booking confirmation page** with animated checkmark
- **QR code placeholder** on ticket
- Download ticket button

#### 🎟️ My Bookings & Cancellations
- View all past and upcoming bookings
- Booking details: bus name, route, date, time, seats, passengers, fare
- **Cancel bookings** with **tiered refund** calculation displayed upfront
- **Refund history** table showing all past refunds
- Refund status tracking (pending / processed / failed)

#### 🤖 AI Assistant
- Floating chat widget (bottom-right corner, above concurrency demo button)
- **Natural language search**: "Show me buses from Mumbai to Pune tomorrow"
- **Route suggestions** with real-time database context injection
- **Seat recommendations**: "I want a window seat in the lower deck"
- **Feature explanations**: "How do seat holds work?"
- **Multi-turn conversation** with history
- **Markdown rendering** in responses
- Typing indicator animation
- Clear chat button
- Powered by **OpenRouter's free model tier** (auto-selects best free model)

---

### 🧑‍💼 Operator Features

#### 📊 Operator Dashboard
- **Stats overview**: Total buses, active routes, total bookings, revenue
- Dashboard with actionable cards

#### 🚍 Bus Management
- **Register new buses** with name, number, type, total seats, and amenities
- **Simulated payment flow** when adding a bus — operators "pay" a subscription fee (₹4,000 default, configurable by admin)
- View all buses with: occupancy percentage bar, upcoming routes count, booked/held seat counts
- **Expandable bus cards** — click to see all routes for that bus inline
- **Delete buses** (with safety — cancels all bookings on routes first)
- **Temporarily cancel a bus** with two modes:
  - **Cancel all upcoming** — bus hidden from search until reactivated
  - **Cancel by date range** — specify from/to dates
- **Reactivate** a temporarily cancelled bus with one click
- **Subscription status** badge on each bus:
  - Active subscription — shows days remaining (green)
  - Expiring soon — warns in yellow (< 30 days)
  - Expired — shows **Resubscribe (₹4,000)** and **Cancel Subscription** buttons
  - Cancelled — shows "Subscription Cancelled" badge

#### 🗺️ Route Management
- **Create routes** for registered buses: select bus, origin/destination cities, times, fare, travel date
- Auto-generates all **seats** for the route (based on bus type and seat count)
- **Sleeper bus routing** — seats split into lower and upper decks
- View all routes with: bus info, origin→destination, times, duration, fare, available seats
- Filter routes by bus, date, or status
- Delete routes (with safety — cancels bookings first)

#### 👥 Booking Visibility
- View all bookings on operator's routes
- Table with: user info, bus, route, date, seats count, fare, booking status

---

### 🛡️ Admin Features

#### 📈 Admin Dashboard
- **Today's stats**: Bookings today, revenue today, subscription revenue, total operators
- **Quick links** to Performance Dashboard

#### 📋 All Bookings (Admin View)
- Complete table of all platform bookings
- Booking ID, user, route, seats, fare, status, timestamp

#### ⏳ Active Seat Holds
- View all currently held seats across the platform
- Seat info, who holds it, route, time remaining countdown
- Color-coded urgency (green/ yellow < 5 min / red < 3 min)

#### 🚌 Bus Utilization
- All buses across all operators
- Occupancy percentage bars with booked (red) / held (yellow) breakdown
- Temporarily cancelled indicators
- Operator name shown per bus
- Admins can delete any bus (with booking safety)

#### 👥 Operator Management
- List all operators with: total buses, active buses, total subscription revenue
- **Expandable operator cards** — click to see all their buses inline
- Each operator bus shows: name, number, seats, cancellation status, subscription status

#### 💰 Revenue Dashboard
- **Total subscription revenue** across all operators
- **Active subscriptions** count
- **Monthly revenue chart** with bar visualization
- **Recent subscription payments** table with operator, bus, amount, date, status

#### 🔁 Refund Management
- Refunds today count + total amount
- **Refunds by tier** visualization (bars showing Full Refund, Partial 75%/50%/25%/No Refund)
- **Failed refunds** table with reprocess button — admins can retry failed payments

#### ⚙️ Platform Settings
- **Subscription price** — change the amount operators pay to list a bus (default: ₹4,000)
- **Subscription duration** — change the listing period in days (default: 180 days)
- Admin credentials display

#### 📊 Performance Dashboard
This is a separate page at `/performance` with **real-time system metrics**:

- **DB Pool Health**: Active/max connections, queue depth, average query time
- **Worker Pool Status**: Active workers visualization (1-4), queue depth, completed/failed tasks
- **Active Seat Holds**: Current held count with trend indicator (up/down)
- **Rate Limit Blocks**: Total blocked requests in the last 60 seconds
- **Idempotency Cache Hit Rate**: Percentage with history visualization
- **AI Assistant**: Average response time, total queries, errors
- **Message Queue**: Published / consumed / dead-lettered counts with bar chart
- **Request Throughput Chart** (Recharts): Requests per second over last 60s for search, hold, confirm, payment endpoints
- **Rate Limit Blocks Table**: Recent blocks with user, endpoint, retry-after
- **Concurrency Events Timeline**: Real-time log of lock conflicts, cache hits, expired holds

Auto-refreshes every **3 seconds**.

---

## Pages Overview

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Home** | Hero section, search form, features, popular routes |
| `/search?from=&to=&date=` | **Search Results** | Bus listing with filters (price, type, time) + sorting |
| `/seats/:routeId` | **Seat Selection** | Interactive luxury bus seat map with real-time polling + hold countdown |
| `/checkout` | **Checkout** | Passenger details for each seat + demo payment form with idempotency |
| `/confirmation/:bookingId` | **Confirmation** | Success animation with animated checkmark, QR code, and ticket details |
| `/my-bookings` | **My Bookings** | Past/upcoming bookings + cancel with refund info + refund history |
| `/admin` | **Admin Dashboard** | 7-tab admin panel: bookings, holds, buses, operators, revenue, refunds, settings |
| `/performance` | **Performance Dashboard** | Real-time system metrics auto-refreshing every 3 seconds |
| `/operator` | **Operator Dashboard** | 5-tab operator panel: my buses, routes, bookings, add bus, add route |
| `/login` | **Login** | JWT authentication with show/hide password |
| `/register` | **Register** | Customer/Operator role selection toggle |

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user (customer or operator) |
| POST | `/api/auth/login` | No | Login with email + password |

### Search (Public)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/search?from=&to=&date=` | No | Search available bus routes |
| GET | `/api/search/cities` | No | List all cities for dropdowns |

### Seats (Public view, Auth for actions)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/seats/:routeId` | No | Get seat layout with status, passenger info, and route details |
| POST | `/api/seats/hold` | Yes | Hold selected seats (rate limited, booking window checked) |
| POST | `/api/seats/release` | Yes | Release held seats |

### Bookings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bookings/confirm` | Yes | Confirm booking (idempotent, pessimistic locking) |
| GET | `/api/bookings/my` | Yes | Get current user's bookings |
| PATCH | `/api/bookings/:id/cancel` | Yes | Cancel booking with tiered refund |
| GET | `/api/bookings/refunds` | Yes | Get user's refund history |

### Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/process` | Yes | Process payment (idempotent, 95% simulated success) |

### Operator
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/operator/buses` | Operator | Register new bus (creates subscription) |
| GET | `/api/operator/buses` | Operator | List operator's buses with occupancy stats |
| GET | `/api/operator/buses/:id` | Operator | Get bus details with routes |
| DELETE | `/api/operator/buses/:id` | Operator | Delete bus (cancels bookings first) |
| PATCH | `/api/operator/buses/:id/cancel-temp` | Operator | Temporarily cancel bus (date range or all upcoming) |
| PATCH | `/api/operator/buses/:id/reactivate` | Operator | Reactivate cancelled bus |
| GET | `/api/operator/buses/:id/subscription` | Operator | Check bus subscription status |
| POST | `/api/operator/buses/:id/cancel-subscription` | Operator | Cancel bus subscription |
| POST | `/api/operator/buses/:id/renew-subscription` | Operator | Renew/resubscribe bus |
| GET | `/api/operator/routes` | Operator | List routes (optional filters: bus_id, date) |
| POST | `/api/operator/routes` | Operator | Create route with auto-generated seats |
| DELETE | `/api/operator/routes/:id` | Operator | Delete route (cancels bookings first) |
| GET | `/api/operator/bookings` | Operator | View bookings on operator's routes |
| GET | `/api/operator/cities` | Operator | List all cities for route creation |
| GET | `/api/operator/stats` | Operator | Dashboard stats (revenue, counts) |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/bookings` | Admin | All bookings |
| GET | `/api/admin/buses` | Admin | All buses with utilization stats |
| DELETE | `/api/admin/buses/:id` | Admin | Delete any bus |
| GET | `/api/admin/holds` | Admin | Active seat holds with countdown |
| GET | `/api/admin/operators` | Admin | List all operators |
| GET | `/api/admin/operators/:id/buses` | Admin | List operator's buses |
| GET | `/api/admin/subscribers` | Admin | All bus subscriptions |
| GET | `/api/admin/revenue` | Admin | Subscription revenue stats + history |
| GET | `/api/admin/refunds` | Admin | Refund statistics by tier |
| POST | `/api/admin/refunds/:id/reprocess` | Admin | Reprocess failed refund |
| GET | `/api/admin/settings` | Admin | Get platform settings |
| PUT | `/api/admin/settings/:key` | Admin | Update platform setting |
| GET | `/api/admin/metrics` | Any Auth | Real-time system metrics |

### AI Assistant
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/ai/chat` | No | Chat with AI assistant (injects route context) |

---

## Concurrency & Synchronization Patterns

The application implements **7 distinct concurrency and synchronization patterns** demonstrated via a floating **⚡ Concurrency Demo** button (visible in dev mode).

### 1. Optimistic Locking — `server/services/SeatService.js`

**Problem:** Two users simultaneously try to book the same seat. Without locking, both requests could succeed, resulting in a double-booking.

**Solution:** Each seat row has a `version` column. When updating a seat, the query checks that the version hasn't changed since it was read. If it has, the update affects zero rows and the transaction rolls back.

```sql
UPDATE seats
SET status = 'held', version = version + 1
WHERE id = $1 AND status = 'available' AND version = $2;
```

### 2. Pessimistic Locking — `server/services/SeatService.js`

**Problem:** Even with optimistic locking, a concurrent transaction could read stale data between the SELECT and UPDATE.

**Solution:** `SELECT ... FOR UPDATE` acquires a row-level lock, preventing any other transaction from modifying those rows until the current transaction commits or rolls back.

```sql
SELECT * FROM seats WHERE id = ANY($1) FOR UPDATE;
```

### 3. Seat Hold TTL — `server/jobs/holdExpiryJob.js`

**Problem:** Users who select seats but never complete booking would leave seats indefinitely unavailable.

**Solution:** A background job runs every 60 seconds and atomically releases seats where the hold has expired.

### 4. Sliding Window Rate Limiter — `server/middleware/rateLimiter.js`

**Problem:** A malicious or buggy client could flood the booking endpoint with requests.

**Solution:** In-memory sliding window tracks request timestamps per user. If a user exceeds the limit (default: 5 requests/minute), the server returns HTTP 429 with a `Retry-After` header.

### 5. Idempotency Keys — `server/middleware/idempotency.js`

**Problem:** Network failures can cause clients to retry requests. Without idempotency, retries could create duplicate bookings or double charges.

**Solution:** Clients generate a UUID v4 idempotency key for each non-idempotent operation. The server stores the response keyed by this ID. If a duplicate request arrives within 24 hours, the cached response is returned without processing.

### 6. Connection Pool Backpressure — `server/db/pool.js`

**Problem:** Under high load, all database connections become saturated. New requests either fail immediately or add to the chaos.

**Solution:** The custom `BackpressurePool` wraps the standard PostgreSQL pool. When all connections are active, incoming requests are queued instead of dropped. The queue is drained as connections become available.

### 7. Mutex Cache Guard — `server/jobs/holdExpiryJob.js`

**Problem:** The hold expiry job runs every 60 seconds. If a job iteration takes longer than the interval, multiple iterations could concurrently update the in-memory seat cache, causing race conditions.

**Solution:** `async-mutex` ensures only one asynchronous fiber updates the seat cache at any time.

---

## Distributed Systems Patterns

### Worker Thread Pool — `server/services/WorkerPool.js`

**Problem:** CPU-bound tasks (email rendering, PDF generation, analytics) block the Node.js event loop, degrading response times for all users.

**Solution:** A pool of **4 worker threads** runs on separate CPU cores using the `worker_threads` module.

- **Round-robin distribution** — each new task goes to the next available worker
- **Auto-restart** — crashed workers are automatically detected and restarted after 1 second
- **Queue depth tracking** — when all workers are busy, tasks are queued

**Tasks handled:**
| Task | Duration |
|------|----------|
| `SEND_CONFIRMATION_EMAIL` | 100-300ms |
| `GENERATE_TICKET_PDF` | 200-500ms |
| `UPDATE_ANALYTICS` | 50-150ms |

### Message Queue — `server/queue/MessageQueue.js`

**Problem:** Tightly coupling booking confirmation to downstream tasks (email, PDF, analytics) means a failure in any one task blocks the entire booking flow.

**Solution:** An in-memory **EventEmitter-based pub/sub queue** decouples the booking service from async processing.

- **Topics:** `booking.confirmed`, `seat.hold.expired`, `payment.processed`, `search.performed`
- **Dead Letter Queue:** Messages that fail processing are retried **up to 3 times** with exponential backoff (1s, 2s, 4s)
- After 3 failed attempts, the message is **dead-lettered**

### Real-Time Metrics — `server/services/MetricsCollector.js`

**Problem:** Without real-time visibility into system health, performance regressions go undetected.

**Solution:** A singleton `MetricsCollector` tracks **12+ metric categories** in real-time, exposed via `GET /api/admin/metrics` and visualized on the Performance dashboard at `/performance`.

---

## Subscription & Billing System

Operators pay a **subscription fee** to list each bus on the platform. This is a demo simulation.

### How It Works

1. **Admin sets the price** and duration in Settings (default: ₹4,000 for 180 days)
2. **Operator registers a bus** → payment dialog appears with subscription details
3. **Simulated payment** processes with 95% success rate, 2-second delay
4. **Bus subscription created** with start/end dates and payment record
5. **Admin revenue tab** shows all subscription income, monthly breakdown, recent payments

### Subscription States

- **Active** → Bus is listed, normal operations
- **Expiring soon** → Warning shown in operator dashboard (< 30 days)
- **Expired** → Bus still exists, but operator sees Resubscribe button
- **Cancelled** → Operator chose to cancel subscription, bus continues without subscription benefits

Operators can:
- **Resubscribe** an expired bus — creates new subscription period
- **Cancel subscription** — stops future renewal, bus remains but without subscription

---

## Refund Policy

When customers cancel bookings, refunds are calculated based on time remaining before departure.

### Refund Tiers

| Tier | Time Before Departure | Refund % |
|------|----------------------|----------|
| Full Refund | More than 48 hours | 100% |
| Partial 75% | 24–48 hours | 75% |
| Partial 50% | 12–24 hours | 50% |
| Partial 25% | 4–12 hours | 25% |
| No Refund | Less than 4 hours | 0% |

### How It Works

1. **Calculation** — when user initiates cancellation, `calculateRefund()` fetches departure time and computes hours remaining
2. **Processing** — `processRefund()` inserts a pending refund record, releases seats, clears gender restrictions, simulates payment gateway (90% success rate, 1-3s delay)
3. **Audit Trail** — all refunds stored in `refunds` table with: original fare, refund %, amount, tier name, status
4. **Failed Refunds** — admins can reprocess from Admin → Refunds tab

---

## AI Assistant

### How It Works

The AI assistant uses **OpenRouter's free model tier** (`openrouter/free` meta-model) that auto-selects the best available free model (Gemini Flash, Llama, Qwen, etc.).

**Setup:**
1. Sign up at [OpenRouter](https://openrouter.ai) (free, no credit card)
2. Generate API key from [Keys page](https://openrouter.ai/keys)
3. Add to `.env`: `OPENROUTER_API_KEY=sk-or-v1-...`
4. Restart server

**Context Injection:** When a user asks a question, the server:
1. Queries the database for **current available routes** (next 7 days)
2. Captures **current page context** (pathname, page title)
3. Injects both as JSON into the AI system prompt

---

## Design System

- **Primary Background:** `#0F1B2D` (deep navy)
- **Card Background:** `#162236`
- **Accent:** `#00C2A8` (electric teal)
- **Text:** `#FFFFFF` primary / `#8FA3B1` secondary
- **Success:** `#22C55E` / **Warning:** `#F59E0B` / **Error:** `#EF4444`
- **Male gender color:** `#3B82F6` (blue)
- **Female gender color:** `#EC4899` (pink)
- **Typography:** Inter (Google Fonts)
- **Cards:** `rounded-xl` with `border border-white/10` and hover state `border-teal-400/30`
- **Responsive:** 375px mobile → 1440px desktop

---

## Project Structure

```
rapidroute/
├── server/
│   ├── index.js                    # Express entry point
│   ├── db/
│   │   ├── pool.js                 # Connection pool with backpressure
│   │   ├── schema.sql              # PostgreSQL schema (tables, indexes, FK constraints)
│   │   ├── seed.sql                # Sample data (cities, operators, buses, routes)
│   │   └── migration.sql           # Schema migration for existing databases
│   ├── middleware/
│   │   ├── auth.js                 # JWT verification middleware
│   │   ├── rateLimiter.js          # Sliding window rate limiter (5 req/min)
│   │   └── idempotency.js          # Idempotency key middleware (24h cache)
│   ├── services/
│   │   ├── SeatService.js          # Optimistic + pessimistic locking for seats
│   │   ├── BookingService.js       # Pessimistic locking + gender adjacency
│   │   ├── PaymentService.js       # Idempotent payment processing (95% success)
│   │   ├── RefundService.js        # Tiered refund policy + reprocessing
│   │   ├── WorkerPool.js           # 4 worker threads with auto-restart
│   │   └── MetricsCollector.js     # 12+ metric categories collector
│   ├── jobs/
│   │   └── holdExpiryJob.js        # Periodic hold expiry (60s) + mutex cache guard
│   ├── queue/
│   │   └── MessageQueue.js         # In-memory pub/sub with dead letter + exponential backoff
│   ├── workers/
│   │   └── bookingWorker.js        # Worker thread (email, PDF, analytics)
│   ├── utils/
│   │   ├── bookingWindow.js        # Booking window open/close logic
│   │   └── cache.js                # In-memory seat cache
│   └── routes/
│       ├── auth.js                 # POST /api/auth/register, /login
│       ├── search.js               # GET /api/search, /api/search/cities
│       ├── seats.js                # GET/POST /api/seats/:routeId, /hold, /release
│       ├── bookings.js             # POST/GET/PATCH /api/bookings/*
│       ├── payments.js             # POST /api/payments/process
│       ├── operator.js             # Full operator CRUD (buses, routes, subscriptions)
│       ├── admin.js                # Admin management (7 sections)
│       ├── adminMetrics.js         # GET /api/admin/metrics
│       └── ai.js                   # POST /api/ai/chat (OpenRouter proxy)
└── src/
    ├── App.tsx                     # Router setup + Concurrency Demo modal
    ├── main.tsx                    # React entry point
    ├── index.css                   # Tailwind base + custom styles
    ├── pages/                      # 11 React pages
    │   ├── Home.tsx                # Landing page with search
    │   ├── SearchResults.tsx       # Bus listing with filters
    │   ├── SeatSelection.tsx       # Interactive seat map
    │   ├── Checkout.tsx            # Passenger details + payment
    │   ├── Confirmation.tsx        # Booking success ticket
    │   ├── MyBookings.tsx          # User's bookings + refund history
    │   ├── OperatorDashboard.tsx   # Operator panel (buses/routes/bookings)
    │   ├── Admin.tsx               # Admin panel (7 tabs)
    │   ├── Performance.tsx         # Real-time metrics dashboard
    │   ├── Login.tsx               # Login form
    │   └── Register.tsx            # Registration with role toggle
    ├── components/
    │   ├── Navbar.tsx              # Navigation with role-based links
    │   └── AIAssistant.tsx         # Floating AI chat widget
    ├── hooks/
    │   ├── useSeats.ts             # Seat data with real-time polling
    │   ├── useCountdown.ts         # Countdown timer for seat holds
    │   └── useBooking.ts           # Booking state management
    ├── store/
    │   ├── authStore.ts            # Zustand auth store
    │   └── bookingStore.ts         # Zustand booking store
    └── utils/
        ├── api.ts                  # Axios instance with auth interceptor
        └── idempotency.ts          # UUID v4 idempotency key generator
```

---

## License

MIT
