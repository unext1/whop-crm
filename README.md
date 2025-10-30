# Spark

A modern social platform built with React Router v7, featuring experiences, posts, leaderboards, and user profiles.

## Tech Stack

- **Framework**: React Router v7 (Framework Mode)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, Shadcn UI, Framer Motion
- **Database**: DrizzleORM with SQLite/PostgreSQL
- **Auth**: Whop SDK integration
- **Deployment**: Ready for production with SSR

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp env.example .env

# Run database migrations
pnpm migrate:apply

# Start development server
pnpm dev

# Run Whop proxy
pnpm whop-proxy --upstreamPort 5173
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm migrate:gen` - Generate database migrations
- `pnpm migrate:apply` - Apply database migrations
- `pnpm studio` - Open Drizzle Studio

## Features

- 📝 Real-time feed with post creation and voting system
- 🏆 Leaderboards and featured content
- 👤 User profiles and experiences
- 🎨 Modern UI with smooth animations
- ⚡ Server-side rendering and optimistic updates

Built for performance and delightful user experiences.
