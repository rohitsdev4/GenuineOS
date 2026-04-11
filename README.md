# GenuineOS - AI-First Business Operating System

A comprehensive, offline-first business management suite built for construction and contracting businesses. GenuineOS combines financial tracking, project management, workforce coordination, and AI-powered intelligence into a single, beautiful application.

## Overview

GenuineOS is designed for **Genuine Hospi Enterprises** and similar construction/contracting businesses that need to manage multiple facets of their operations from one place. It works entirely offline using IndexedDB for local data storage, with optional Google Sheets sync for backup and collaboration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui (Radix UI primitives) |
| State Management | Zustand + React Query (TanStack) |
| Local Database | Dexie (IndexedDB wrapper) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Animations | Framer Motion |
| AI Integration | z-ai-web-dev-sdk (Gemini, Groq, OpenRouter) |
| PWA | next-pwa with install banner |
| Database ORM | Prisma (schema reference) |
| Font | Geist Sans / Geist Mono |

## Features

### 1. Dashboard
- **Partner Balance Cards** - Side-by-side financial overview for each business partner (Gulshan, Rohit) showing total received, expenses, and balance
- **Financial Overview** - Summary cards for total received, total expenses, net balance, and active sites
- **Quick Actions** - One-click dialogs to add payments, expenses, receivables, and tasks directly from the dashboard
- **Recent Activity** - Live feeds of recent payments and expenses with mode badges and manager attribution
- **Connection Status** - Real-time Google Sheets connection indicator
- **Data Import** - Bulk import from Google Sheets with one click

### 2. Clients
- Full client management with contact details (name, phone, email, address, GST number)
- Client type classification (customer, vendor, contractor)
- Status tracking and credit limit support
- Search and filter capabilities

### 3. Sites & Projects
- Project cards with contract value, received amount, expenses, and net balance
- Progress bar with color coding (blue < 40%, amber 40-75%, green > 75%)
- Status filtering (all, active, on-hold, completed)
- Expandable transaction history per site showing all linked payments and expenses
- Contractor and location tracking
- Estimated days and start date management

### 4. Payments
- Track all incoming payments with party name, amount, date, mode, and category
- Payment mode badges (cash, UPI, bank, cheque, card, online) with color coding
- Partner and site filtering
- Party autocomplete from client database and past payments
- Debounced search for performance
- Responsive table view (desktop) / card view (mobile)

### 5. Expenses
- Track all outgoing expenses with title, amount, category, payee, and payment mode
- Predefined categories: general, travel, food, materials, rent, salary, fuel, maintenance, tools, equipment, electricity, tax, other
- Per-expense category and site filtering
- Bill number and bill image support
- Recurring expense flag

### 6. Receivables
- Track pending payments with party, amount, due date, priority, and status
- Priority levels: low, medium, high, urgent
- Follow-up date and notes tracking
- Invoice number and invoice image support
- Overdue receivable detection

### 7. Tasks
- Task management with title, description, status, priority, and due date/time
- Priority levels: low, medium, high, urgent
- Status tracking: pending, in-progress, completed, cancelled
- Tags and site assignment
- Reminder support with configurable reminders

### 8. Labour Management
- **Workers Tab**: Full worker profiles with name, phone, role, skill level, Aadhaar, address
- Worker roles: worker, mason, plumber, electrician, carpenter, painter, supervisor
- Skill levels: unskilled, semi-skilled, skilled, foreman
- Daily wage and monthly salary tracking
- Bank details (bank name, account number, IFSC code)
- Site assignment and join date tracking
- Expandable payment history per worker (combines labour payments and expenses)
- **Payments Tab**: Dedicated labour payment records with days worked, month, and mode

### 9. Materials
- Materials inventory management stored as categorized notes
- CRUD operations with table view
- Integration with AI Chat for voice/text-based quick additions

### 10. Vehicles
- Vehicle fleet management stored as categorized notes
- Vehicle name and details tracking (registration, driver info, etc.)
- CRUD operations with table view
- Integration with AI Chat for quick additions

### 11. Diary & Journal
- Personal journal with rich text entries
- Mood tracking (8 moods: great, good, okay, low, bad, reflective, inspired, motivated)
- Category classification: general, personal, work, idea, important, journal, gratitude, goal, reflection
- Color-coded notes (default, red, blue, green, yellow, purple)
- Pin/unpin important entries
- Quick actions: Quick Journal, Quick Idea, Quick Gratitude
- Full-screen reading overlay with word/character count
- Search, mood filter, category filter pills
- Grid and list view modes

### 12. Habits
- Habit creation with name, description, category, frequency, color, and emoji icon
- Categories: health, fitness, productivity, learning, mindfulness, finance, social, other
- Frequency: daily, weekly
- Target count with custom units (e.g., 8 glasses, 30 minutes)
- One-click daily completion toggle
- Increment/decrement counter for multi-target habits
- **Streak Tracking**: Current streak and best streak calculation with 1-day gap allowance
- **30-Day Heatmap**: GitHub-style activity grid showing completion history
- Backdating: Click past dates on the heatmap to retroactively log completions
- 30-day completion rate percentage
- Habit detail view with stats, heatmap, and recent logs
- Category filtering

### 13. Calendar
- Interactive calendar with task date indicators (green dots)
- Click any date to see all tasks scheduled for that day
- Task display with status icons, priority badges, and due time
- Completed tasks shown with strikethrough

### 14. Reports & Analytics
- **Financial Overview**: Total income, total expenses, net profit, active sites stat cards
- **30-Day Income vs Expenses**: Bar chart showing daily financial flow
- **Expense Category Breakdown**: Horizontal progress bars with percentages
- **Recent Activity Feed**: Combined timeline of payments, expenses, and tasks

### 15. AI Chat
- AI-powered assistant for business queries
- **Natural Language Commands**: "Show me a financial summary", "Add payment 5000 from Ramesh", "What tasks are pending?"
- **Tool Execution**: AI can add payments, expenses, receivables, tasks, sites, labour, clients, notes, and delete records
- **Thinking Mode**: Toggle extended reasoning for complex queries with collapsible thinking process display
- **Memory Context**: User-configurable business context for personalized AI responses
- **Markdown Rendering**: Rich formatted responses with syntax highlighting
- **Suggestion Chips**: Quick-start prompts on empty chat

### 16. Settings
- **Profile**: Business name, phone, address, email, GST number
- **Managers**: Team manager CRUD with roles (manager, accountant, admin) and status tracking
- **LLM & AI**: Provider selection (Gemini, Groq, OpenRouter), model name, API key, temperature slider, max tokens, thinking mode toggle
- **Google Sheets**: Sheet ID, API key, connection test, sync data, auto-sync with configurable intervals (15/30/60/120 min), duplicate removal
- **Appearance**: Theme toggle (dark/light), accent color picker (8 colors), currency selection (INR, USD, EUR, GBP), date format
- **Notifications**: Task reminders, payment alerts toggle

## Architecture

### Data Flow
```
UI Components (React)
        ↓
React Query (TanStack) - Cache & State
        ↓
Data Service Layer (data-service.ts)
        ↓
Dexie IndexedDB (GenuineOS database)
```

### Database Schema
The app uses 15 IndexedDB tables via Dexie:

| Table | Description |
|-------|------------|
| `appSettings` | Application configuration (singleton, id: "main") |
| `manager` | Team managers with roles and status |
| `client` | Client/customer contacts |
| `site` | Construction sites/projects |
| `payment` | Incoming payments |
| `sitePayment` | Site-specific payments |
| `expense` | Outgoing expenses |
| `receivable` | Pending receivables |
| `task` | Task management |
| `labour` | Workers with skills and bank details |
| `labourPayment` | Labour wage payments |
| `attendance` | Worker attendance records |
| `extraWork` | Extra work tracking per site |
| `note` | Multi-purpose notes (diary, materials, vehicles) |
| `habit` | Habit definitions |
| `habitLog` | Daily habit completion logs |

### API Routes
| Route | Purpose |
|-------|---------|
| `/api/sheets` | Google Sheets API proxy (connect, test, fetch, sync) |
| `/api/data` | Generic data CRUD operations |
| `/api/settings` | Application settings CRUD |
| `/api/chat` | AI chat with tool calling |
| `/api/import-sheet` | Bulk import from Google Sheets |

### Key Design Patterns
- **Offline-First**: All data stored in IndexedDB, no server-side database required for core functionality
- **Lazy Loading**: All tab components loaded via `React.lazy()` + `Suspense` for fast initial page load
- **Optimistic Updates**: React Query mutations with automatic cache invalidation
- **Responsive Design**: Mobile-first with bottom navigation (5 tabs) and desktop sidebar (16 navigation items)
- **Error Boundaries**: Comprehensive error logging throughout the save pipeline with toast notifications
- **Partner Multi-Tenancy**: Payments, expenses, and sites can be attributed to business partners

## Project Structure
```
src/
├── app/
│   ├── api/              # Backend API routes
│   │   ├── sheets/       # Google Sheets integration
│   │   ├── data/         # Generic CRUD endpoint
│   │   ├── settings/     # Settings management
│   │   ├── chat/         # AI chat with tool calling
│   │   └── import-sheet/ # Bulk data import
│   ├── offline/          # Offline fallback page
│   ├── layout.tsx        # Root layout (dark theme, PWA)
│   ├── page.tsx          # Main SPA shell
│   └── globals.css       # Global styles + Tailwind
├── components/
│   ├── tabs/             # Feature tab components (16 tabs)
│   │   ├── dashboard.tsx
│   │   ├── clients.tsx
│   │   ├── sites.tsx
│   │   ├── payments.tsx
│   │   ├── expenses.tsx
│   │   ├── receivables.tsx
│   │   ├── tasks.tsx
│   │   ├── labour.tsx
│   │   ├── materials.tsx
│   │   ├── vehicles.tsx
│   │   ├── diary.tsx
│   │   ├── habits.tsx
│   │   ├── calendar.tsx
│   │   ├── reports.tsx
│   │   ├── chat.tsx
│   │   └── settings.tsx
│   ├── ui/               # shadcn/ui components (50+)
│   ├── shared/           # Reusable components
│   │   ├── empty-state.tsx
│   │   ├── confirm-dialog.tsx
│   │   └── data-table.tsx
│   ├── bottom-nav.tsx    # Mobile bottom navigation
│   ├── pwa-install-banner.tsx
│   └── providers.tsx      # React Query + Theme providers
├── hooks/
│   ├── use-data.ts       # Data hooks (CRUD, summary, settings, sync, chat)
│   ├── use-toast.ts      # Toast notifications
│   └── use-mobile.ts     # Mobile detection
├── lib/
│   ├── indexeddb.ts      # Dexie database schema & helpers
│   ├── data-service.ts   # Data access layer (CRUD operations)
│   ├── helpers.ts        # Formatting utilities (currency, date, colors)
│   ├── utils.ts          # Tailwind merge utility
│   └── db.ts             # Database utilities
└── stores/
    └── app-store.ts      # Zustand global state (UI, chat, sync)
```

## Getting Started

### Prerequisites
- Node.js 18+
- Bun (recommended) or npm

### Installation
```bash
bun install
```

### Development
```bash
bun run dev
```
The app runs on `http://localhost:3000`.

### Database (Optional)
```bash
bun run db:push      # Push Prisma schema to database
bun run db:generate  # Generate Prisma client
```

### Linting
```bash
bun run lint
```

## PWA Support
GenuineOS is a Progressive Web App with:
- Web App Manifest (`/public/manifest.json`)
- Apple Web App capability
- Service worker via next-pwa
- Install banner component
- Offline fallback page
- Safe area inset handling for mobile devices

## Google Sheets Integration
1. Go to **Settings > Sheets**
2. Enter your Google Sheet ID (from the URL: `docs.google.com/spreadsheets/d/[SHEET_ID]/edit`)
3. Enter your Google API key
4. Click **Save & Connect**
5. Use **Test Connection** to verify
6. Click **Sync Data** to import
7. Optionally enable **Auto Sync** with configurable intervals

## AI Configuration
1. Go to **Settings > LLM & AI**
2. Select your provider (Gemini, Groq, or OpenRouter)
3. Enter your API key
4. Configure model name, temperature, and max tokens
5. Enable **Thinking Mode** for complex reasoning tasks
6. Go to **AI Chat** tab and start interacting with your business data

## Recent Bug Fixes
- Fixed Google Sheets sync credentials not being passed to API route
- Fixed all save buttons not persisting data due to silently swallowed errors
- Added comprehensive error logging throughout the save pipeline
- Fixed Quick Action dialogs closing prematurely before mutation completion
- Added crypto.randomUUID() fallback for non-secure contexts (HTTP, some PWA environments)
- Fixed Dexie table.put() and table.update() errors with try/catch and logging

## License
Private - Genuine Hospi Enterprises
