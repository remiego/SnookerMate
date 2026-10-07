# SnookerMate

SnookerMate is a React + TypeScript snooker scorekeeper. Play a frame without an account, or connect Supabase to register, save player profiles and keep match history. Supabase row-level security protects user-owned data and gives administrators access to all profiles and matches.

## Run locally

1. Install Node.js 20 or later.
2. Run `npm install`, then `npm run dev`.
3. To enable accounts and saved data, create a Supabase project, copy `.env.example` to `.env.local`, and set the project URL and anon key.
4. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
5. In Supabase Authentication, enable email/password sign-in and set the desired site URL/redirect URLs.
6. To grant an administrator role, update that account's `account_profiles.role` to `admin` using the Supabase SQL editor. Never expose the service-role key in the client.

Without Supabase credentials, the frame scorer works as an anonymous, in-memory game; accounts, profiles, and saved history require Supabase.

## Scoring

The scorer enforces the standard sequence: red, nominated colour, repeat while reds remain, then the colour clearance from yellow through black. The foul control awards the standard minimum of four points to the opponent and passes the turn. Use End frame to save the current score at any time. Anonymous frames are not saved.

## Database access

The migration creates `account_profiles`, `player_profiles`, and `matches`, plus row-level security policies. New accounts receive a regular profile through a database trigger. The role field is only changed by administrators through Supabase; ordinary users cannot promote themselves.
