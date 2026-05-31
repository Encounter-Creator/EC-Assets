# Assets App v2

Expo-first rebuild of the Assets app using the locked baseline as the primary source of truth.

## Stack

- Expo + Expo Router
- React Native + Expo Web
- React Query
- Supabase
- Expo Notifications

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Install dependencies with `npm install`.
4. Start the app with `npm run start`.

## Current implementation

- Role-aware Expo Router shell
- Login, signup, approval-pending, and damage-lock flows
- Baseline-driven dashboard, inventory, requests, approvals, check-out/in, and settings scaffolds
- Push-notification registration
- Fresh Supabase migration starting the new baseline schema
- Provider-agnostic server-side notification fan-out stub for in-app, push, and email
- Supabase-backed access context lookup
- Supabase-backed request draft autosave and submit-from-draft flow
- Live notification inbox query and resolve action
- Live approvals queue with approve, decline, and request-changes actions
- Live damage-case queue with resolution actions

## Build status

Built now:

- Expo project linked to EAS project `9d29bb3a-56c2-440b-8165-354b270ca275`
- Expo slug set to `ec-asset`
- Supabase project linked to ref `kpcfvmteutmzcfoazszp` (`EC Asset`)
- Initial schema and RPC layer committed in `supabase/migrations`
- Live request draft and notification flows wired into the app when env vars are set
- Live approvals and damage queue flows wired into the app when env vars are set
- Remote Supabase project updated through migration `20260531204000_live_approvals_and_damage_queue.sql`

Still to build:

- Full approvals workflow actions
- Full check-out/in operational workflows
- Transfer, Sunday kits, duplicates, reports, and QR export workflows
- Final email delivery provider integration
- Remaining live queries and mutations across all screens

## Verification

- `npm run typecheck`
- `npx expo export --platform web`

## EAS

The Expo app is configured for EAS project ID `9d29bb3a-56c2-440b-8165-354b270ca275`.

## Supabase

The Supabase project ref for this rebuild is `kpcfvmteutmzcfoazszp`.
The repo-local Supabase link is saved in [supabase/config.toml](/C:/Users/baren/OneDrive/Documents/Barend/PROJECTS/Assets%20App/supabase/config.toml:1).
