# Quick Capture

A lightweight task and event capture application with persistent cloud storage. Built with React, Express, and Supabase PostgreSQL.

## Features

- **Task Management**: Capture tasks with due dates, effort estimates, priorities, and deadlines
- **Event Tracking**: Schedule events with start times, durations, locations, and attendees
- **Natural Language Parsing**: Quick entry with phrases like "Draft proposal by Friday 2h hard #work"
- **Tags & Organization**: Tag items and filter by categories
- **Rich Metadata**: Add notes, URLs, subtasks, dependencies, and recurrence patterns
- **Cross-Device Sync**: Access your data from anywhere with cloud storage
- **Real-time Updates**: Changes sync immediately with the backend

## Architecture

```
quick-capture/
├── frontend/          # React + Vite + TypeScript
├── backend/           # Express + TypeScript API
├── database/          # Supabase PostgreSQL schema
└── render.yaml        # Deployment configuration
```

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for fast development and optimized builds
- **TailwindCSS** for styling
- **Framer Motion** for animations
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Supabase** PostgreSQL database with REST API
- **Simple API key authentication**

### Deployment
- **Render** for both frontend (static site) and backend (web service)
- **Free tier** compatible

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier)
- A Render account (free tier)
- Git installed

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd quick-capture
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for both frontend and backend workspaces.

### 3. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Once your project is ready, go to **Project Settings** → **API**
4. Copy your project URL and service role key (keep these secret!)
5. Go to the **SQL Editor** in your Supabase dashboard
6. Copy and paste the contents of `database/schema.sql`
7. Click **Run** to create the database schema

### 4. Configure Environment Variables

#### Backend Configuration

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add your Supabase credentials:

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
API_KEY=choose-a-secure-random-string
```

#### Frontend Configuration (Optional)

```bash
cd ../frontend
cp .env.example .env
```

For local development, you can leave `VITE_API_URL` empty (it will proxy to localhost:3000).

### 5. Run Locally

From the root directory:

```bash
# Run both frontend and backend concurrently
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Frontend (http://localhost:5173)
npm run dev:frontend

# Terminal 2 - Backend (http://localhost:3000)
npm run dev:backend
```

The frontend will be available at `http://localhost:5173` and the backend at `http://localhost:3000`.

## Deployment to Render

### Option 1: Using render.yaml (Infrastructure as Code)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) and sign up
3. Click **New** → **Blueprint**
4. Connect your GitHub repository
5. Render will automatically detect `render.yaml` and create both services
6. Add your environment variables in the Render dashboard:
   - For the backend service, add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
7. Deploy!

### Option 2: Manual Setup

#### Deploy Backend

1. Go to Render dashboard → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: quick-capture-api
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build --workspace=backend`
   - **Start Command**: `npm run start:backend`
   - **Health Check Path**: `/health`
4. Add environment variables:
   - `PORT=3000`
   - `SUPABASE_URL=<your-url>`
   - `SUPABASE_SERVICE_KEY=<your-key>`
   - `API_KEY=<generate-secure-key>`
5. Deploy

#### Deploy Frontend

1. Go to Render dashboard → **New** → **Static Site**
2. Connect your GitHub repository
3. Configure:
   - **Name**: quick-capture-frontend
   - **Build Command**: `npm install && npm run build:frontend`
   - **Publish Directory**: `frontend/dist`
4. Add environment variable:
   - `VITE_API_URL=https://quick-capture-api.onrender.com`
5. Deploy

### Note on Free Tier Limitations

Render's free tier spins down services after 15 minutes of inactivity. The first request after spin-down may take 30-60 seconds. This is normal for free tier services.

## Project Structure

```
quick-capture/
├── frontend/
│   ├── src/
│   │   ├── QuickCaptureApp.tsx  # Main app component
│   │   ├── api.ts                # API client
│   │   ├── types.ts              # TypeScript types
│   │   ├── App.tsx               # App entry
│   │   └── main.tsx              # Vite entry
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server
│   │   ├── db.ts                 # Supabase client
│   │   └── types.ts              # TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── database/
│   └── schema.sql                # Database schema
├── package.json                  # Root package (workspaces)
├── render.yaml                   # Render deployment config
└── README.md
```

## API Endpoints

All endpoints require the `X-API-Key` header (except `/health`).

- `GET /health` - Health check
- `GET /api/items` - Get all items
- `POST /api/items` - Create a new item
- `PUT /api/items/:id` - Update an item
- `DELETE /api/items/:id` - Delete an item
- `GET /api/tags` - Get all unique tags

## Development

### Build Commands

```bash
# Build both frontend and backend
npm run build

# Build frontend only
npm run build:frontend

# Build backend only
npm run build:backend
```

### Type Checking

```bash
# Frontend
cd frontend && npm run type-check

# Backend
cd backend && npm run type-check
```

## Future Enhancements

- Multi-user support with authentication
- Calendar view for events
- Task completion tracking
- Smart scheduling and auto-prioritization
- Mobile app (React Native)
- Slack/email integrations
- Import/export to Google Calendar, Todoist, etc.

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
