# SnookerMate

SnookerMate is a React + TypeScript snooker scorekeeper. Start by signing in, creating an account, or continuing as a guest. Guests can play locally without saving data; registered users can save player profiles and match history. Supabase row-level security protects user-owned data and gives administrators access to all profiles and matches.

## Run locally

1. Install Node.js 20 or later.
2. Run `npm install`, then `npm run dev`.
3. To enable accounts and saved data, create a Supabase project, copy `.env.example` to `.env.local`, and set the project URL and anon key.
4. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
5. In Supabase Authentication, enable email/password sign-in and set the desired site URL/redirect URLs.
6. To grant an administrator role, update that account's `account_profiles.role` to `admin` using the Supabase SQL editor. The administrator can then choose **Admin sign in** from the sign-in dialog. Never expose the service-role key in the client.

Without Supabase credentials, the frame scorer works as an anonymous, in-memory game; accounts, profiles, and saved history require Supabase.

## Appearance

Use the light/dark toggle on the welcome screen or app header to switch themes. The selected theme is saved in this browser and applies to the welcome screen, frame setup, scorekeeper, and account pages.

## Deploy with Vercel

1. Import this GitHub repository into Vercel and keep the Vite framework preset. The checked-in `vercel.json` configures `npm run build` and publishes the `dist` output directory.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment variables for Production and Preview (and Development if desired). Redeploy after changing environment variables.
3. In Supabase Authentication settings, set the production site URL to your deployed domain and add the production and Vercel Preview URLs to the allowed redirect URLs.

Only use the Supabase project URL and anon/publishable key in this client-side app. Never add the Supabase service-role key to Vercel client environment variables.

## Scoring

Each frame opens with a full-screen table setup. Choose player names or saved profiles to see who breaks off; the opening break alternates between the two players each new frame. The scorer enforces the standard sequence: red, nominated colour, repeat while reds remain, then the colour clearance from yellow through black. Use **Pot multiple reds** to record two or more reds potted in one shot; each scores one point, and the next shot is a colour. Choose a foul penalty from 4 to 7 points before using **Foul**; the points go to the opponent and the turn passes. Use End frame to save the current score at any time. Anonymous frames are not saved.

## Database access

The migration creates `account_profiles`, `player_profiles`, and `matches`, plus row-level security policies. New accounts receive a regular profile through a database trigger. The role field is only changed by administrators through Supabase; ordinary users cannot promote themselves.
