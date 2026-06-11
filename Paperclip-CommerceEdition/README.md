# Paperclip Commerce Edition - Technical Documentation

## 1. Architecture Overview
This project is a specialized version of Paperclip AI, tailored for E-commerce operations. It uses a monorepo structure to separate concerns between the frontend, backend, and shared business logic.

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS, shadcn/ui.
- **Backend**: NestJS (Node.js), TypeScript.
- **Database**: PostgreSQL (Default), compatible with MySQL/MariaDB/SQLite/Supabase/Neon.
- **Task Queue**: Redis + BullMQ.
- **Auth**: NextAuth.js.
- **AI Orchestration**: Custom Agent Framework supporting multiple providers (Gemini, OpenAI, Claude, etc.).

## 2. Workflow Logic
The system follows a strict hierarchical execution flow:
`Company` $\rightarrow$ `Goal` $\rightarrow$ `Project` $\rightarrow$ `Issue` $\rightarrow$ `Agent Assignment` $\rightarrow$ `Approval` $\rightarrow$ `Execution` $\rightarrow$ `Work Product` $\rightarrow$ `Review` $\rightarrow$ `Close`.

## 3. Organization Hierarchy
- **Core Roles**: CEO, COO, CTO, CMO.
- **Commerce Sub-Roles**:
    - Marketplace Manager
    - Product Research Manager
    - Content Manager
    - SEO Manager
    - Ads Manager
    - Reporting Manager

## 4. AI Provider Integration
Providers are managed via the `AIProvider` interface.
- **Supported**: Gemini, OpenAI, Claude, DeepSeek, Grok, OpenRouter, Ollama, LM Studio, OpenClaw, Custom API.
- **Configuration**: API Keys and endpoints are stored encrypted in the database and can be assigned per-agent.

## 5. Dynamic Selectors (Settings)
The following are configurable via the Settings UI:
- **Database**: PostgreSQL, MySQL, MariaDB, SQLite, Supabase, Neon.
- **Storage**: Local, S3, Cloudflare R2, MinIO, Supabase Storage.
- **Runtime**: Docker, Kubernetes, Railway, Coolify, VPS, Render, Fly.io, Localhost.

## 6. Development Guide
- **Running Web**: `cd apps/web && npm run dev`
- **Running API**: `cd apps/api && npm run start:dev`
- **Database Migration**: `cd packages/database && npx prisma migrate dev`
