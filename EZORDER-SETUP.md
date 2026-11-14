# EZorder setup

## How it works at the table

Each table has **one** printed QR card (print them at `/staff`). It always points to `/t/TABLE`.

1. A phone that scans it is asked once: **Big photos** or **Normal menu**. The phone remembers the answer.
2. Both menus feed the same order for that table.
3. Anyone on the normal menu can fix quantities and tap **Send to kitchen**.
   A diner on the big-photo menu who is alone can send it too ("Nobody is ordering for me").
4. When guests leave, staff tap **Clear table** at `/staff`. A table left idle for 3 hours clears itself.

## 1. Run it now (no accounts needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000/demo. Tap "I want this" on the left phone and watch it land on the right phone.
Open http://localhost:3000/t/5 to see what a guest sees after scanning.

In this sample-data mode, tables live in the browser. Two tabs on the same laptop sync. Two real phones do not.
Ship this version first with `/ship-web` (the workshop asks for the local-to-deployed loop before Supabase).

## 2. Turn on sync between real phones (Supabase)

About 10 minutes. Nothing in the app code changes; it switches itself over when it sees the keys.

1. Create a project at supabase.com.
2. **SQL Editor > New query**: paste all of `supabase/schema.sql` and press Run.
   It creates the tables, the security rules, three database functions, the Realtime setup, and the sample menu.
   Running it again wipes every table's cart and orders (the menu is kept).
3. **Authentication > Sign In / Providers**: turn on **Allow anonymous sign-ins**.
   This is what lets every guest in without an account.
4. **Project Settings > API Keys**: copy the Project URL and the publishable key (`sb_publishable_...`).
5. Copy `.env.example` to `.env.local` and paste both values. Restart `npm run dev`.
   The home page now says "Live sync is on".
6. In Vercel: **Project > Settings > Environment Variables**, add the same two variables, then redeploy.

Never put the secret / service-role key in this app. Only the publishable key belongs in `NEXT_PUBLIC_` variables.

### What each Supabase piece does here

| Piece | Used for | Where in the code |
|---|---|---|
| Database | `menu_items`, `table_sessions`, `cart_items`, `orders` | `supabase/schema.sql` |
| Auth (anonymous) | Each phone gets an identity with no login | `ensureUser()` in `src/lib/store/supabase.ts` |
| Row Level Security | Picks are added under your own identity, only to an open table; sent orders are locked | policies in `schema.sql` |
| Realtime | A pick on one phone appears on the others | `subscribe()` in `src/lib/store/supabase.ts` |
| Database functions | `join_table` (scan), `confirm_order` (send), `clear_table` (staff) | `schema.sql` |
| Storage (optional) | Your own dish photos | see below |
| (not used) | Voice AI runs in this app's own server route instead | `src/app/api/voice/route.ts` |

### How a pick travels

```
Phone scans the table QR
  -> join_table('5'): returns table 5's open sitting, or starts a new one
Grandpa taps "I want this"
  -> insert into cart_items (session_id, table_code, item_id, added_by_name)
  -> Realtime tells every phone subscribed to table_code = 5
  -> each phone re-reads the cart and shows the new row
Someone taps "Send to kitchen"
  -> confirm_order('5'): totals from menu prices, inserts into orders,
     stamps order_id on the cart rows (they can no longer be edited)
  -> Realtime tells every phone; all show kitchen progress
Staff taps "Clear table"
  -> clear_table('5'): closes the sitting; the next scan starts empty
```

### If something does not work

| What you see | Cause | Fix |
|---|---|---|
| "Could not sign in" | Anonymous sign-ins are off | Step 3 |
| Menu is empty, or "permission denied" | `schema.sql` was not run (or only partly) | Run the whole file again; it is safe to repeat |
| Picks take about 5 seconds to appear | Realtime is not delivering; the app is falling back to its 5-second refresh | Database > Publications > `supabase_realtime`: `cart_items`, `orders` and `table_sessions` must be on |
| Still says "Sample-data mode" | Keys not loaded | Check `.env.local` names, restart the dev server; on Vercel, redeploy after adding variables |

## 3. Your own menu and photos

Edit rows in **Table Editor > menu_items**. For photos: **Storage > New bucket** (public), upload,
copy the public URL into `image_url`. Fill `aliases` with what people actually say for the dish
("kopi o", "咖啡乌"); voice ordering matches on those.

## 4. Voice ordering with ILMU (YTL AI Labs)

Without a key, voice uses the phone's own speech recogniser plus the built-in word matcher
(one language at a time). With a key, the phone records and the server sends the clip to ILMU,
so the diner can mix languages and never chooses one.

1. Get a key at https://console.ilmu.ai. Transcription is pay-as-you-go, billed per second of audio.
2. Put it in `.env.local` as `ILMU_API_KEY=sk-...` (no `NEXT_PUBLIC_` prefix: it stays on the server).
3. Run `npm run ilmu:check`. It confirms the key works and both models are available.
   `npm run ilmu:check -- my-recording.webm` also transcribes a real clip.
4. Restart `npm run dev`. The voice screen now records instead of asking for a language.
5. In Vercel, add `ILMU_API_KEY` under Settings > Environment Variables, then redeploy.

How a spoken order travels:

```
phone records ≤ 8 s ──> POST /api/voice (our server, key stays here)
   ├─ ilmu-asr-v4.2   speech -> text, menu words sent as a hint, no language forced
   ├─ ilmu-mini-v3.3  text + this restaurant's menu -> dishes as JSON (validated)
   └─ built-in matcher if that step fails
phone shows big photos: "Is this right?"  Yes / Choose from photos / Say it again
```

If ILMU is down or out of credit, the screen says so and the phone's own recogniser takes over.
If nothing matched, the diner sees "Did you mean one of these?" with the closest dishes, then every dish.

Every outcome is saved in `voice_feedback` (when Supabase is on): what was heard, what was proposed,
and what the diner chose instead. Read it in the dashboard and add misheard words to that dish's `aliases`.

## 5. Sold-out dishes

Open `/staff` and tap **Mark sold out** next to a dish. Within a second, on every phone at every table:

- the Big Photos Menu stops showing it,
- the Normal Menu greys it out with a "Sold out" badge and no Add button,
- voice ordering answers "Sorry, Laksa is finished today" and offers similar dishes to tap.

Tap the same button again to put it back. In sample-data mode the mark lives in that browser;
with Supabase it is the `available` column on `menu_items`, changed through `set_item_stock()`.

## Known limits (say these before a judge finds them)

- This is not connected to FeedMe's real system. It uses FeedMe's public design tokens and mirrors the public ordering flow; orders stop in Supabase.
- ILMU's speech model is documented for English, Bahasa Malaysia and Mandarin, including code-switching. Tamil, Cantonese and Hokkien are not on that list: dish nicknames in those languages are caught by `aliases` and the menu matcher, but whole sentences are unproven until tested with real speakers.
- `/api/voice` has a simple per-address limit (20 a minute) that resets on restart. Put a proper rate limiter in front before real traffic, or one visitor can spend your ILMU balance.
- `/staff` has no login: anyone with the link can clear a table or mark dishes sold out.
- Anyone who knows a table number can open that table, change open quantities, send its order, or clear it. There is no staff login.
- The QR cards point at whatever address you opened `/staff` from. Print them from the deployed Vercel link, not from localhost.
- Kitchen progress is a timer, not a real kitchen screen.
- "Send to kitchen" stops at the order. Payment and POS hand-off are not built; the app says "Pay at the counter".
