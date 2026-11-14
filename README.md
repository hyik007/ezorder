# EZorder

One QR code per restaurant table. Each diner chooses the **Normal Menu** or the **Big Photos Menu**
(for elderly diners: one dish per screen, big buttons, voice ordering in Bahasa Rojak).
Every phone at the table feeds one shared order, and anyone, including a grandparent eating alone,
can send it to the kitchen.

Built as an upgrade to FeedMe's QR ordering for the SUC × FeedMe hackathon. It uses FeedMe's public
design tokens; it is **not** connected to FeedMe's backend.

## Run it in VS Code

Needs Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local      # optional: leave empty to run on sample data
npm run dev
```

Open http://localhost:3000/demo for both menus side by side, or http://localhost:3000/t/5 for what a
diner sees after scanning table 5's QR code. VS Code will offer the recommended extensions
(ESLint, Tailwind CSS, Prettier) from `.vscode/extensions.json`.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run verify` | Lint and production build; run before every push |
| `npm run build` / `npm start` | Production build and server |
| `npm run ilmu:check` | Tests your ILMU key and models (add `-- clip.webm` to transcribe a recording) |

## What turns on what

| You set in `.env.local` | You get |
|---|---|
| Nothing | Everything works on sample data in one browser. Tabs sync; separate phones do not. Voice uses the phone's own recogniser. |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Real sync between phones, shared orders, voice feedback log. Setup: `EZORDER-SETUP.md` section 2. |
| `ILMU_API_KEY` | Voice ordering through ILMU by YTL AI Labs: mixed-language speech, no language to choose. Setup: `EZORDER-SETUP.md` section 4. |

## Pages

| Path | For |
|---|---|
| `/` | Type a table number |
| `/t/[table]` | What the table QR opens: menu chooser, then either menu (`?menu=easy` or `?menu=normal` forces one) |
| `/staff` | Mark dishes sold out, printable QR cards for tables 1–8, and "Clear table" |
| `/demo` | Both menus at table 5, side by side, for pitching |
| `/api/voice` | Server route for voice ordering (GET: which engine; POST: audio or text) |

## Project structure

```
src/
  app/
    layout.tsx, globals.css        Fonts, FeedMe colour tokens, animations
    page.tsx                       Home
    t/[code]/page.tsx              Table page (validates the code from the QR)
    staff/page.tsx, demo/page.tsx
    api/voice/route.ts             Voice: ILMU speech + understanding, with fallbacks
  components/
    TableScreen.tsx                Menu chooser and live table state
    EasyMenu.tsx                   Big Photos Menu (+ My picks, solo send, order status)
    NormalMenu.tsx                 Normal Menu (category tabs, table order, send)
    VoiceSheet.tsx                 Voice: record, confirm, sold-out notice, choose from photos
    AppBar.tsx, LangPicker.tsx, TableCard.tsx, bits.tsx
  lib/
    types.ts, menu.ts, i18n.ts     Data shapes, sample menu, English / Melayu / 中文 text
    match.ts                       Word matcher, "did you mean", sold-out replacements (phone and server)
    voice.ts                       Browser: microphone, speech recognition, spoken feedback
    voiceClient.ts                 Browser side of /api/voice
    useTable.ts, useStored.ts      Live table state, values remembered on the phone
    store/                         Backend interface: local.ts (sample data), supabase.ts (live)
    server/ilmu.ts, server/menu.ts Server only: ILMU calls, the trusted menu
supabase/schema.sql                Tables, security rules, database functions, sample menu
scripts/check-ilmu.mjs             ILMU key checker
public/menu/                       Dish photos
```

`ARCHITECTURE.md` explains the design decisions. The workshop's own files (`WORKSHOP-README.md`,
`START-HERE.md`, `.claude/skills/`, and the other workshop guides) are kept so `/ship-web` still works.

## Deploy

Push to GitHub and import the repo in Vercel (or run `/ship-web` in Claude Code). Add the same
environment variables in Vercel > Settings > Environment Variables, then redeploy. Print the table QR
cards from the deployed `/staff` page, not from localhost.

## Before real customers

These are known gaps, not bugs:

- No staff login: anyone with the `/staff` link can clear a table, and anyone who knows a table
  number can open and send that table's order.
- `/api/voice` limits each address to 20 requests a minute in memory. Use a real rate limiter in
  front of it before public traffic.
- No payment and no kitchen screen: "Send to kitchen" creates the order; progress is a timer.
- Not connected to FeedMe. The `Store` interface in `src/lib/store/types.ts` is where a FeedMe
  adapter would go.
- Voice has been tested against a mock of ILMU's documented API, not the live service, and not
  with real elderly speakers in a noisy restaurant.
