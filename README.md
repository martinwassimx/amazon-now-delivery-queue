# ⚡ Amazon Now — QR-Based Delivery Queue Management System
### محطة توزيع أمازون ناو — الهرم (Al-Haram Hub, Giza, Egypt)

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Realtime-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-14%2F14_Passed-success?style=for-the-badge&logo=jest)](tests/queue-workflow.test.ts)

A production-ready, mobile-first QR delivery queue management system built for **Amazon Now Distribution Hub — Al-Haram, Giza, Egypt** (**محطة توزيع أمازون ناو — الهرم**). Designed specifically for rapid fulfillment couriers and warehouse dispatchers, featuring **100% natural Egyptian Arabic (العامية المصرية)**, strict right-to-left (RTL) typography, atomic concurrency locking, a mandatory 5-minute driver rest cooldown, and authentic Amazon Now aesthetics.

---

## 📸 System Overview & Live Interfaces

| Interface | Route | Primary Audience | Description |
| :--- | :--- | :--- | :--- |
| **Driver Scan & Join** | `/` | Couriers / Drivers | Mobile-optimized one-tap queue entrance. Zero sign-up, mandatory courier name, no tracking number required. |
| **Private Live Ticket** | `/ticket/[token]` | Couriers / Drivers | Large dynamic queue number, people ahead, real-time status updates, audio chime & vibration alert. |
| **Staff Operations Dashboard** | `/staff` | Warehouse Dispatchers | FIFO driver calling (`نده على اللي بعده`), preparation tracking, completion, and queue management. |
| **Public TV Monitor Display** | `/display` | Waiting Bay Screen | Digital signage for warehouse waiting area with huge current-turn numbers and automated sound alert. |
| **Printable QR Poster** | `/staff/qr` | Station Admins | Permanent location QR code manager with high-res PNG download and A4 printable poster generator. |
| **Order History** | `/staff/history` | Dispatch Supervisors | Completed order records with local Cairo timestamps (`Africa/Cairo`) and instant search. |
| **Audit Logs** | `/staff/audit` | Station Compliance | Comprehensive audit trail of every staff action (call, prep, finish, skip, cancel). |
| **Staff Authentication** | `/staff/login` | Station Staff | Supabase Auth login with 1-click demo access for local staging. |

---

## 🌟 Key Features & Business Rules

### 1. 📱 Frictionless Driver Journey (Mobile-First)
- **One Permanent QR Code:** Attached at the warehouse entry bay.
- **Zero App Installation & No Sign-Up:** Couriers scan using their standard smartphone camera.
- **Mandatory Driver Name:** Couriers enter their name or badge code so dispatchers can call them at the counter. (Shipment / tracking number field removed per operational flow).
- **One Giant High-Contrast Button:** Prominent **"ادخل الطابور"** button designed for one-handed thumb tapping on motorbike or van arrival.

### 2. ⏱️ 5-Minute Mandatory Cooldown (Rest & Fairness Enforced)
- Once a courier completes their order pickup, a **5-minute (300 seconds) mandatory cooldown** is enforced.
- Prevents queue hoarding and promotes fair rotation among all drivers.
- **Dual Enforcement:**
  - **Client-Side:** The join button is locked into a countdown timer displaying `برجاء الانتظار (MM:SS)` with clear Egyptian instructions.
  - **Server-Side:** `/api/queue/join` checks the driver's previous ticket and rejects requests before the 300-second mark with HTTP `429 Too Many Requests`.

### 3. 🔒 Atomic Concurrency & Idempotency
- **No Duplicate Numbers:** Queue number allocation uses PostgreSQL row-level locks (`FOR UPDATE`) inside a database function (`join_queue_atomic`).
- **Network Retry & Double-Tap Protection:** Every join request carries an `idempotency_key` generated on the client. Rapid double-taps return the existing ticket safely without incrementing the queue.
- **FIFO Staff Calling:** Dispatchers call drivers using `FOR UPDATE SKIP LOCKED` to prevent race conditions when multiple staff members call drivers simultaneously.

### 4. 🔔 Dynamic Audio Chime, Vibration & Realtime Alerts
- **Zero External Audio Assets:** Synthesizes a pleasant two-tone warehouse chime (880Hz -> 1320Hz) directly in the browser via the **Web Audio API**.
- **Haptic Feedback:** Vibrates mobile devices via the **HTML5 Vibration API** when the driver's number is called.
- **Celebratory Confetti:** Triggers celebration confetti on the driver's screen upon being summoned to the pickup window.

### 5. 🎨 Authentic Amazon Now Branding
- **Official Brand Mark:** High-resolution electric blue icon (`#0071dc`) with white lowercase "amazon", "now" with electric lightning bolt in the "o", and the iconic Amazon smile curve.
- **Al-Haram Hub Badge:** Distinctive **محطة توزيع أمازون ناو — الهرم** identifier with a pulsing amber status indicator.
- **Color Palette:**
  - `Electric Blue`: `#0071dc`
  - `Midnight Navy`: `#090d16` & `#0f172a`
  - `Amazon Gold/Amber`: `#f59e0b` & `#ff9900`
  - `Emerald Success`: `#10b981`
  - `Rose Alert`: `#f43f5e`
- **Typography:** Google `Cairo` font with full bidirectional RTL (`dir="rtl"`) layout and LTR-protected digital counters.

---

## 🏗️ Architecture & Technology Stack

```
amazon-now-delivery-queue/
├── src/
│   ├── app/                          # Next.js 16 App Router
│   │   ├── page.tsx                  # Driver QR entry page (Name + Join + Cooldown)
│   │   ├── layout.tsx                # RTL root layout with Cairo font
│   │   ├── globals.css               # Tailwind CSS v4 styling & animations
│   │   ├── ticket/[token]/page.tsx   # Courier's private live ticket
│   │   ├── staff/                    # Warehouse staff interfaces
│   │   │   ├── page.tsx              # Live operations dashboard
│   │   │   ├── history/page.tsx      # Daily order history & search
│   │   │   ├── audit/page.tsx        # System audit logs
│   │   │   ├── qr/page.tsx           # Permanent QR manager & A4 printable poster
│   │   │   └── login/page.tsx        # Staff authentication
│   │   ├── display/page.tsx          # Public TV monitor waiting bay screen
│   │   └── api/queue/                # Resilient REST API endpoints
│   │       ├── join/route.ts         # Join queue (with 5-min cooldown & idempotency)
│   │       ├── ticket/[token]/route.ts # Fetch live ticket details
│   │       ├── active/route.ts       # Active waiting/called/processing queue
│   │       ├── action/route.ts       # Staff state transitions (call, prep, complete, skip, cancel)
│   │       ├── stats/route.ts        # Real-time counter metrics
│   │       ├── history/route.ts      # Daily completed logs
│   │       └── audit/route.ts        # System audit records
│   ├── components/                   # Modular UI components
│   │   ├── AmazonNowLogo.tsx         # Official Amazon Now logo & Al-Haram hub badge
│   │   ├── LiveClock.tsx             # Real-time Cairo digital clock
│   │   ├── StaffNav.tsx              # Staff navigation header
│   │   └── StatusBadge.tsx           # Egyptian Arabic status badges
│   ├── lib/
│   │   ├── audio.ts                  # Web Audio API chime & haptics
│   │   ├── date-format.ts            # Cairo timezone formatting & numeral padding
│   │   ├── queue-service.ts          # Queue engine with Supabase & resilient fallback
│   │   └── supabase/                 # Client & Admin Supabase SDK instances
│   └── types/
│       └── queue.ts                  # TypeScript data contracts & statuses
├── supabase/
│   ├── schema.sql                    # One-click Supabase SQL Editor schema
│   └── migrations/
│       └── 20261011_initial_schema.sql # Complete DDL, RLS policies & stored procedures
├── tests/
│   └── queue-workflow.test.ts        # Automated concurrency & workflow test suite
└── public/
    └── images/
        └── amazon-now-logo.png       # Official Amazon Now brand asset
```

---

## 🗄️ Database Design & Supabase Schema

The schema handles high-concurrency ordering, session resets, and real-time pub/sub:

```mermaid
erDiagram
    SITES ||--o{ QUEUE_SESSIONS : hosts
    QUEUE_SESSIONS ||--o{ QUEUE_ENTRIES : contains
    STAFF_PROFILES ||--o{ AUDIT_LOGS : performs
    QUEUE_ENTRIES ||--o{ AUDIT_LOGS : records

    SITES {
        uuid id PK
        text name "محطة توزيع أمازون ناو — الهرم"
        text code "EGY-CAI-HRM"
        boolean is_active
    }

    QUEUE_SESSIONS {
        uuid id PK
        uuid site_id FK
        date session_date
        integer current_number
        integer daily_counter
        boolean is_active
    }

    QUEUE_ENTRIES {
        uuid id PK
        uuid session_id FK
        text ticket_token UK
        integer queue_number
        text driver_name
        text status "waiting | called | processing | completed | skipped | cancelled"
        timestamp joined_at
        timestamp called_at
        timestamp completed_at
        text idempotency_key UK
    }

    AUDIT_LOGS {
        uuid id PK
        uuid entry_id FK
        text action
        text performed_by
        timestamp created_at
    }
```

### Stored Procedures
- `join_queue_atomic`: Obtains a `FOR UPDATE` lock on the active `queue_sessions` record, verifies the `idempotency_key`, increments the `daily_counter`, and generates a secure 48-character `ticket_token`.
- `call_next_driver`: Locates the oldest `waiting` driver using `FOR UPDATE SKIP LOCKED`, updates status to `called`, and appends an entry to `audit_logs`.
- `update_queue_entry_status`: Transitions ticket state between `called`, `processing`, `completed`, `skipped`, and `cancelled` with full timestamp tracking.

---

## 🗣️ Egyptian Arabic (العامية المصرية) UI Glossary

The entire interface is written in natural, welcoming Egyptian Arabic:

| English Term | UI Term (العامية المصرية) | Context / Meaning |
| :--- | :--- | :--- |
| **Join Queue** | **ادخل الطابور** | The primary CTA button for couriers |
| **Queue Number** | **رقمك في الطابور** | Large ticket number (e.g. `001`) |
| **Queue Position** | **ترتيبك في الطابور** | Current rank in line |
| **Couriers Ahead** | **قبلك كام واحد** | Number of drivers before your turn |
| **Waiting** | **مستني دورك** | Status badge for drivers awaiting call |
| **Called / Ready** | **دورك جه! اتفضل استلم طلبك** | Urgent summons banner & notification |
| **Processing** | **جاري تجهيز طلبك دلوقتي** | Warehouse staff assembling the order |
| **Completed** | **تم استلام الطلب بنجاح!** | Order completed, triggers 5-min cooldown |
| **Call Next** | **نده على اللي بعده** | Dispatcher FIFO summons button |
| **Re-call** | **نده عليه تاني** | Re-alert driver if they didn't arrive |
| **Skip** | **تخطي الدور** | Move unresponsive driver aside |
| **Cancel** | **إلغاء الدور** | Remove erroneous entry |
| **Rest Cooldown** | **فترة راحة إلزامية: ٥ دقائق** | 5-minute cooldown notice |
| **Wait (MM:SS)** | **برجاء الانتظار (MM:SS)** | Countdown timer displayed on disabled button |
| **Al-Haram Hub** | **محطة توزيع أمازون ناو — الهرم** | Hub branding across all views |

---

## 🧪 Testing & Validation

A comprehensive test suite in [`tests/queue-workflow.test.ts`](file:///c:/Users/msfir/OneDrive/Desktop/Github%20Project/amazon-now-delivery-queue/tests/queue-workflow.test.ts) covers 14 mission-critical scenarios:

```bash
npm test
```

### Verified Test Cases:
1. `✓ Test 1`: Driver joins queue successfully.
2. `✓ Test 2`: Distinct sequential FIFO queue numbers allocated.
3. `✓ Test 3`: Concurrency stress test (simultaneous joins produce unique numbers).
4. `✓ Test 4 & 5`: Idempotency verification (double-click returns identical number).
5. `✓ Test 6`: Ticket lookup by unguessable token.
6. `✓ Test 7`: Staff calls oldest eligible driver in FIFO sequence.
7. `✓ Test 8`: Driver ticket state reflects called status.
8. `✓ Test 9`: Staff transitions ticket to processing and completed.
9. `✓ Test 10`: Position dynamically recalculates for drivers in line.
10. `✓ Test 11`: Repeat visit workflow after completing previous shipment.
11. `✓ Test 12`: Skipped and cancelled tickets handled cleanly.
12. `✓ Test 13`: System audit trail logging verified.
13. `✓ Test 14`: Real-time queue metrics and stats calculation.

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Node.js** `>= 18.18.0`
- **npm** `>= 9.0.0`
- A free [Supabase](https://supabase.com) account (optional for local testing, fallback engine included).

### 2. Clone & Install
```bash
git clone https://github.com/martinwassimx/amazon-now-delivery-queue.git
cd amazon-now-delivery-queue
npm install
```

### 3. Environment Configuration
Create a `.env.local` file based on `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
> **Note:** The application features an intelligent in-memory fallback queue service. If Supabase keys are omitted, the application runs fully locally with full state persistence during testing.

### 4. Database Setup (Supabase)
Copy the contents of [`supabase/schema.sql`](file:///c:/Users/msfir/OneDrive/Desktop/Github%20Project/amazon-now-delivery-queue/supabase/schema.sql) and paste them into the **SQL Editor** of your Supabase project, then click **Run**.

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Production Build
```bash
npm run build
```

---

## ☁️ Deployment (Vercel)

1. Push your repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add the following **Environment Variables** in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your production Vercel domain, e.g. `https://amazon-now-queue.vercel.app`)
4. Click **Deploy**. The application will be deployed instantly on Vercel's global edge network.

---

## 📄 License & Credits

Developed and Maintained by **Martin** ([@martinwassimx](https://github.com/martinwassimx)).  
All Rights Reserved © 2026.
