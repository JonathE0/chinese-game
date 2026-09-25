# Setting up cloud saves

Cloud saves let you carry your 青禾小镇 progress between browsers and computers. You sign in with
Google, and your save is kept in a small database you own on [Supabase](https://supabase.com) (the
free plan is enough). Without this setup the game works exactly as before, saving only in the
browser (and, if you choose one, in a folder on your computer).

Only your save file and the time it was written are stored. Nobody else can read it: the database
lets each signed-in player see only their own row.

## Which values are public and which are secret

| Value | Public or secret | Where it goes |
| --- | --- | --- |
| Supabase project URL (`https://<reference>.supabase.co`) | Public | `.env.local` and Netlify |
| Supabase anon (publishable) key | Public | `.env.local` and Netlify |
| Google OAuth client ID (`…apps.googleusercontent.com`) | Public | The Supabase dashboard, `.env.local` and Netlify (`VITE_GOOGLE_CLIENT_ID`) |
| Google OAuth client secret | **Secret** | The Supabase dashboard only. Never in the repository, `.env.local` or Netlify |
| Supabase `service_role` (secret) key | **Secret** | Nowhere. The game never needs it |
| Database password | **Secret** | Your password manager |

The two public values end up inside the web page for anyone to see; that is how Supabase is
designed. What protects the saves is the Row Level Security set up in step 2.

## Steps

1. **Create the Supabase project.** Sign in at <https://supabase.com/dashboard>, choose
   **New project**, give it a name (for example `qinghe`), set a database password and keep it in
   your password manager, pick the region nearest you, and create it. Wait until it has finished
   setting up. The project **reference** is the part of the dashboard address after `/project/`;
   your project URL is `https://<reference>.supabase.co`.

2. **Create the saves table.** In the project open **SQL Editor** → **New query**. Paste the whole
   of `supabase/migrations/20260924000000_cloud_saves.sql` from this repository and press **Run**.
   It should report "Success. No rows returned". This creates `public.saves` with Row Level
   Security, a 1 MB limit per save and a limit of one save every 5 seconds per player (deleting the save does not
   reset that limit).
   To check: **Table Editor** → `saves` should not show the red "RLS disabled" warning.

3. **Create the Google sign-in client.** Go to <https://console.cloud.google.com/> and create (or
   choose) a project.
   1. **APIs & Services** → **OAuth consent screen** (newer consoles call it **Google Auth
      Platform** → **Branding**). Choose **External**, fill in the app name (for example
      Little Mandarin Town), your support email and the developer contact email, and save. The
      default scopes (`openid`, `email`, `profile`) are all that is needed; add no others.
      While the app is in **Testing**, add yourself and anyone else who plays under **Audience** →
      **Test users**, or press **Publish app** so any Google account can sign in.
   2. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
      Application type: **Web application**. Name it `Supabase`.
   3. Under **Authorised JavaScript origins** add your Netlify address (for example
      `https://your-site.netlify.app`), `http://localhost`, `http://localhost:5174` and
      `http://127.0.0.1:5174`. Google's sign-in button only works on pages served from these
      addresses, and for local testing Google asks for `http://localhost` with and without the port.
   4. Under **Authorised redirect URIs** add exactly
      `https://<reference>.supabase.co/auth/v1/callback`.
      This is for the fallback sign-in (see "How sign-in works" below): Google sends players back
      to Supabase, and Supabase then sends them back to the game.
   5. Press **Create**, then copy the **Client ID** and the **Client secret**. The secret goes only
      into the Supabase dashboard in the next step; do not save it anywhere else.

4. **Turn on Google in Supabase, and every other way in off.** In the Supabase dashboard:
   1. **Authentication** → **Sign In / Providers** (older dashboards: **Providers**) → **Google**:
      switch it on, paste the **Client ID** (into **Client IDs**) and the **Client secret**, and
      save. Leave **Skip nonce checks** off: the game sends a nonce with every sign-in.
   2. On the same page open **Email** and switch the provider **off**, and switch **Phone** off too
      if it is on. Leave the separate **Allow new users to sign up** setting (under **Authentication**
      → **Settings** or **Sign In / Providers**) switched **on**: in hosted Supabase it applies to
      every provider, so turning it off would stop new Google players as well.
   3. Make sure **Allow anonymous sign-ins** (on the same page, or under **Authentication** →
      **Settings**) is **off**.

   Now the only way to get an account is a real Google login, so nobody can script sign-ups
   straight at Supabase.

5. **Tell Supabase where the game lives.** **Authentication** → **URL Configuration**:
   - **Site URL**: your Netlify address, for example `https://your-site.netlify.app`.
   - **Redirect URLs**: press **Add URL** for each of these exact addresses (the game is a single
     page, so no wildcards are needed):
     - `https://your-site.netlify.app/`
     - `http://127.0.0.1:5174/`
     - `http://localhost:5174/`

   After signing in, players are sent back to the game's page, and Supabase only allows addresses
   on this list. Admin mode (`/?admin`) never uses the cloud, so it needs no entry.

6. **Give the game the three public values.** In Supabase open **Project Settings** → **API**
   (newer dashboards: **Project Settings** → **Data API** for the URL and **API Keys** for the
   key). Copy the **Project URL** and the **anon public** key (called the **publishable** key in
   newer dashboards). Do **not** copy the `service_role` or secret key. The third value is the
   Google **Client ID** from step 3.
   1. For the dev server: copy `.env.example` in the repository to `.env.local` and fill in the
      lines:
      ```
      VITE_SUPABASE_URL=https://<reference>.supabase.co
      VITE_SUPABASE_ANON_KEY=<the anon or publishable key>
      VITE_GOOGLE_CLIENT_ID=<the client id>.apps.googleusercontent.com
      ```
      `.env.local` is ignored by git. Restart `npm run dev` after changing it.
   2. For the live site: Netlify → your site → **Site configuration** → **Environment variables**
      → **Add a variable**. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
      `VITE_GOOGLE_CLIENT_ID` with the same three values. Then **Deploys** → **Trigger deploy** → **Deploy site**, because the values are built
      into the page.

7. **Try it.** Open the game. While nobody is signed in, the arrival screen offers Google's sign-in
   button or **以游客身份开始** (play as a guest, which keeps the save in this browser only, as
   before). Sign in, choose your Google account, and the game starts straight away. Once signed in,
   the arrival screen shows 已登录 with your address, and settings (key 5) → **云端存档** has the
   rest.
   Press **立即同步**; **上次同步** then shows the time. In Supabase **Table Editor** → `saves`
   there is now one row. Open the game in another browser, sign in there, and it offers to restore
   the save with more progress.

The Playwright tests and a dev server without `.env.local` run with no cloud save at all; that is
expected. Playwright starts its own dev server with the three values blanked, so stop any
`npm run dev` already on port 5174 before running the tests.

## How sign-in works

- With `VITE_GOOGLE_CLIENT_ID` set, the 云端存档 section shows Google's own sign-in button. It is
  served on the game's own address, so Google's window names your site rather than the
  `<reference>.supabase.co` address. Google hands the game a signed ID token, and Supabase checks it
  (and a one-time nonce) before signing the player in. Google's script is only loaded when a player
  opens that section.
- Without the client ID, or when Google's script cannot load (blocked by an extension, or offline),
  the section shows the game's own **用 Google 登录** button instead. That one leaves for Google,
  which names the Supabase address, and comes back through the redirect URLs in step 5.
- Both ways sign in through Google only, and the login session is kept by the Supabase library in
  the browser's storage.

## How the game treats your saves

- The game remembers which cloud save this device wrote last. If the cloud save has changed since
  (another device saved it), or this device has never seen it, the game never writes over it on its
  own. It shows both saves (云端 for the cloud, 本机 for this device, each with its coins and finished
  quests) and asks which one to use: 用云端的 (use the cloud one) or 用这台设备的 (use this device's).
- If the cloud save is the one this device wrote last, this device's progress goes up as you play.
  The cloud save is only offered back (恢复 / 不用了) if it holds more progress, counted as words
  known and then objects named, for example after you imported an older save here.
- Whichever save you do not pick is kept first in the automatic backups in settings, labelled with
  the date and （云端） or （本机）, so either can be restored later. If it cannot be kept, nothing is
  replaced or uploaded.
- Nothing is uploaded until you answer. Closing that box without answering leaves the cloud save
  alone until you press 立即同步.
- If another device saves while you play here, the game reads the cloud again and asks, instead of
  writing over it.
- A cloud save written elsewhere that this version cannot read is left untouched, and settings
  shows 同步失败. 删除云端存档 clears it if you no longer need it.
- A cloud save from a newer version of the game puts the tab in read-only mode, the same as the
  folder does. Reload the page to get the update.
- Nothing on your device is ever lost because of the cloud. A failure shows 同步失败 in settings
  and is retried later.
- Admin mode (`?admin`) never reads or writes the cloud.
- **删除云端存档** deletes your row and signs this device out (other devices stay signed in, and
  their next upload creates the row again). Your Google account and the progress on this device are
  not touched. Signing in again uploads this device's save again.
- **退出登录** signs out this device only.
