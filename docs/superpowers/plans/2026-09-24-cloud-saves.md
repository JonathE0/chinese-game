# Cloud saves with Google sign-in (2026-09-24)

Player: progress "resets" in every browser and every account, because each browser keeps its own
copy and the game has no server. They chose **Supabase** as the backend and **Google sign-in only**,
and asked for protection against people making lots of bot accounts.

## Design

- **Sign-in:** Google only, through Supabase Auth (`signInWithOAuth`, PKCE, redirect back to the
  page). Supabase's email sign-up is switched **off** in the dashboard, and anonymous sign-ins stay
  off, so accounts can only be made through a real Google login — Google's own defences are the bot
  wall, and nobody can script sign-ups straight at the Supabase API.
- **Storage:** one row per player in `public.saves` (`user_id` primary key → `auth.users`, `data jsonb`,
  `version int` = the save format version, `updated_at timestamptz`). One row per account bounds what
  any account can store.
- **Row Level Security:** enabled; policies `to authenticated` for select/insert/update/delete only
  where `user_id = auth.uid()`. The anon key in the page is public by design; RLS is the lock.
- **Abuse limits in the database:** a size check (`octet_length(data::text) <= 1000000`); a `before
  insert or update` trigger that sets `updated_at := now()` and rejects an update less than 5 seconds
  after the last one (errcode `P0001`, message `too many saves`). No service-role key anywhere in the
  client or the repo.
- **Sync, with the same data-safety rules as the save folder** (`offerFolderRestore` in
  `src/ui/panels.js`, `moreProgress` in `src/core/backup.js`):
  - On sign-in and on each start while signed in: read the cloud row. A newer save format than this
    build (`isNewerSave`) puts the session in read-only mode, as the folder does. If the cloud save
    has more progress (`moreProgress`), offer to restore it (恢复 / 不用了) and upload nothing until the
    player answers; otherwise upload the local save.
  - While playing: upload after saves, debounced (about 10 s), never while `holdSync` or `readOnly`.
  - **Optimistic concurrency:** remember the cloud row's `updated_at` from the last read or write;
    update with `.eq('updated_at', lastSeen)`. Zero rows updated means another device wrote in
    between: read the row again and go through the restore offer instead of overwriting.
  - A throttle rejection is retried quietly at the next debounce; other errors show 同步失败 in the
    settings section and retry later. Nothing is ever lost locally because of a cloud failure.
  - `?dev` mode never reads or writes the cloud (like the folder).
- **Not configured:** without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` the section does not
  appear and the game behaves exactly as today. Tests run in this state.
- **Privacy:** only the save JSON and timestamps are stored. The settings section says so, and has
  删除云端存档 to delete the player's row (the Google account itself is untouched).

## Build (task id **C2-cloud**, model: opus)

- `npm install @supabase/supabase-js` (the official client; don't hand-roll OAuth).
- `supabase/migrations/20260924000000_cloud_saves.sql`: the table, RLS policies, size check and
  throttle trigger above.
- `src/services/cloud.js`: the client (created only when configured), `signIn`, `signOut`, `user`,
  `readSave`, `writeSave` (insert or conditional update), `deleteSave`.
- `src/core/cloudsync.js`: the decisions (restore offer vs upload, conflict, retry), written against an
  injected client so it can be unit-tested with a fake.
- `src/ui/panels.js` settings: a 云端存档 section below the folder section; `src/main.js`: start-up
  check after the folder check, and cloud upload alongside `syncSoon`.
- `.env.example` with the two variables; make sure `.env.local` is gitignored.
- `docs/CLOUD_SETUP.md`: the checklist below, written for the player.
- Tests: unit tests for `cloudsync.js` (cloud fuller → offer, local fuller → upload, stale
  `updated_at` → re-read and offer, throttle → retry, read-only/dev → nothing). Browser: with no env,
  the settings panel has no 云端存档 section and nothing calls Supabase.

### Chinese (use exactly; UI labels, no clips)

| use | zh | en |
| --- | --- | --- |
| section title | 云端存档 | Cloud save |
| sign in | 用 Google 登录 | Sign in with Google |
| signed in | 已登录：{email} | Signed in as {email} |
| last synced | 上次同步：{time} | Last synced: {time} |
| sync now | 立即同步 | Sync now |
| sign out | 退出登录 | Sign out |
| delete | 删除云端存档 | Delete cloud save |
| delete confirm | 确定要删除云端存档吗？这台设备上的进度不会受影响。 | Delete your cloud save? Progress on this device isn't affected. |
| delete buttons | 删除 / 取消 | Delete / Cancel |
| restore offer | 云端有进度更多的存档，要恢复吗？ | The cloud holds a save with more progress. Restore it? |
| restore buttons | 恢复 / 不用了 (reuse the folder's) | Restore / No thanks |
| failure | 同步失败，稍后会再试。 | Sync failed; will try again later. |
| privacy | 只保存你的游戏进度，不会公开。 | Only your game progress is stored, and it's never shown to anyone. |

## Setup the player does (docs/CLOUD_SETUP.md)

1. Create a free Supabase project. SQL Editor → run the migration file.
2. Google Cloud Console → OAuth consent screen (External) → Credentials → OAuth client (Web). Add
   the Supabase callback `https://<project>.supabase.co/auth/v1/callback` as an authorised redirect URI.
3. Supabase → Authentication → Providers: enable Google with that client id and secret; **turn off
   Email** (or at least "Allow new users to sign up") and leave anonymous sign-ins off.
4. Supabase → Authentication → URL Configuration: Site URL = the Netlify address; redirect URLs =
   the Netlify address, `http://127.0.0.1:5174` and `http://localhost:5174`.
5. Project URL and anon (publishable) key → `.env.local` for the dev server, and the same two as
   Netlify environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), then redeploy.
