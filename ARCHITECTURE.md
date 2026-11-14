# EZorder architecture

EZorder is an upgrade to FeedMe's QR ordering, not a separate product. It adds three things to the flow
FeedMe already has (scan the table QR, browse, order, kitchen gets it):

1. A gateway after the scan: **Normal Menu** or **Big Photos Menu**, from the same single QR code.
2. A Big Photos Menu built for elderly diners, with voice ordering that tolerates Bahasa Rojak.
3. A shared table order that either menu can send, so a diner eating alone is never stuck.

Facts about ILMU below were checked against docs.ilmu.ai in November 2026. Model names change;
`npm run ilmu:check` confirms the ones your key can use.

## 1. How it plugs into FeedMe

| Layer | What FeedMe has today | What this repo does |
|---|---|---|
| Look | Design system `@feedmepos/ui-library` (Vue 3 + Tailwind) | Uses the same tokens (orange `#ff7823`, Inter, greys, radii) in `src/app/globals.css`. FeedMe's components are Vue, this starter is React, so the tokens are shared, not the components. |
| Entry | One QR per table opens the menu | Same QR opens `/t/TABLE`, which shows the gateway first |
| Menu, cart, order | FeedMe backend and POS | Everything goes through one interface, `Store` (`src/lib/store/types.ts`) |
| Kitchen, payment | Kitchen printer / display, pay now or pay later | Stops at "order created". The kitchen progress shown is a timer. |

To run on FeedMe for real, write a third `Store` next to `local.ts` and `supabase.ts`:

```
getMenu()            <- FeedMe menu for this restaurant (names, prices, photos, modifiers)
subscribe(table)     <- FeedMe's open order / cart for this table, plus its change feed
addLine / setQty     <- add or change an item on that open order
confirmOrder(table)  <- FeedMe "place order" (this is what reaches the kitchen and the bill)
clearTable(table)    <- FeedMe already knows when a table is paid and closed
```

No screen changes when the store changes. I do not have FeedMe's API documentation, so that adapter is not written.

## 2. Single QR, two menus

```
scan table QR  ->  /t/5
                    |
        phone has a saved choice? -- yes --> open that menu
                    | no
              GATEWAY (3 languages at once, a picture of each menu)
               /                                   \
     Big Photos Menu                           Normal Menu
     one dish per screen                       category tabs, full list
     tap or speak                              sees the whole table's order
               \                                   /
                 same table sitting, same open order
                              |
               anyone taps "Send to kitchen"  ->  one order
```

- The choice is stored on the phone (`ezorder:menu`), so a returning grandparent goes straight to their menu.
- Either menu can switch to the other in one tap. `?menu=easy|normal` forces a menu without saving (used by `/demo`).
- Each pick records which menu it came from (`cart_items.via`). That one column answers the business
  question "how many orders came through the Big Photos Menu?".

## 3. Voice: Bahasa Rojak and dialects

### Engine: ILMU by YTL AI Labs

ILMU is YTL AI Labs' Malaysian model family, hosted on Malaysian infrastructure, with an
OpenAI-compatible API at `https://api.ilmu.ai/v1`. EZorder uses two of its models:

| Step | Model | What it does here |
|---|---|---|
| Hear | `ilmu-asr-v4.2` | Speech to text. Documented for English, Bahasa Malaysia and Mandarin including code-switching and background noise. Menu words and kopitiam slang go in as a `prompt` hint. |
| Understand | `ilmu-mini-v3.3` | Text plus this restaurant's menu **and its stock** to dishes, in JSON mode. Returns `status` (match / sold_out / suggest), the dishes, what has run out, replacements, and one warm line for the diner. |

Both run in `src/app/api/voice/route.ts`, on our server, so the key never reaches a phone.

### The idea that makes it workable

Do not aim for a perfect transcript. The task is smaller: **choose from the dishes on this
restaurant's menu.** So both steps get the menu, including nicknames people say
(`menu_items.aliases`: "koi png", "teh c", "椰浆饭", "தே தாரிக்"). The speech step gets them as a
`prompt` hint; the understanding step gets the whole menu.

### Pipeline and fallbacks

```
1 CAPTURE    tap mic -> record up to 8 s (MediaRecorder, mono, noise suppression)
2 HEAR       ilmu-asr-v4.2, no language forced (one sentence can mix several)
3 UNDERSTAND ilmu-mini-v3.3 -> {status, items, sold_out, suggestions, message}; else the built-in matcher
4 VALIDATE   real menu ids only, qty 1-10, known requests, merged per dish
5 CONFIRM    big photos, − / +, sold-out notice, "Yes, add it" | "Choose from photos" | "Say it again"
6 CHOOSE     nothing matched or wrong: "Did you mean…?" closest dishes, then every dish
7 LEARN      voice_feedback stores heard / proposed / chosen
```

| What fails | What the diner sees |
|---|---|
| A dish has run out | "Sorry, Laksa is finished today" plus similar dishes to tap. It can never enter the cart: the server drops it even if a model returns it. |
| No ILMU key | Phone's own recogniser; diner picks a language |
| ILMU speech down, slow or out of credit | "The voice AI is busy…", then the phone's own recogniser |
| ILMU understanding fails | Nothing visible: the built-in matcher answers instead |
| Nothing matches | "Did you mean one of these?" with photos, then all dishes |
| Wrong match | "Choose from photos" or − / + on the confirm screen |

### Honest limits

- ILMU's speech model is documented for English, Malay and Mandarin. Tamil, Cantonese and Hokkien
  are not listed. Dish names in those languages still work through aliases and the matcher;
  whole sentences need testing with real speakers.
- Before promising accuracy, record 100 to 200 real orders from elderly diners and measure how often
  the confirm screen is right first time. `voice_feedback` collects exactly that.

## 4. Component structure

```
/t/[code]/page.tsx            validates the table code from the QR
└─ TableScreen                live table state + saved menu choice
   ├─ Gateway (inline)        AppBar, question in 3 languages, two picture buttons
   ├─ EasyMenu                Big Photos Menu
   │  ├─ name picker          six big names to tap; no typing
   │  ├─ Deck                 AppBar + language, one dish card, "I want this", Back / Next
   │  │  ├─ added overlay     tick + dish name; also spoken aloud and vibrated
   │  │  └─ end card          "You have seen every dish" + "Send to kitchen"
   │  ├─ My picks sheet       big − / +, "Send to kitchen", change name
   │  ├─ Send sheet           order summary, "Yes, send it" / "Not yet"
   │  ├─ VoiceSheet           ready -> listening -> thinking -> confirm | not found
   │  └─ order status         four kitchen stages, "Order more"
   └─ NormalMenu              AppBar, name, category tabs, list, table order, sticky total + send
```

Rules the Big Photos Menu follows:

- One decision per screen. No scrolling lists, no cart maths, no login, no payment screen.
- Text 18 px and up, dish names 36 px; primary buttons 80 px tall; orange buttons carry near-black text (6.5:1 contrast,
  where FeedMe's usual white-on-orange is 2.6:1).
- Every action confirms three ways: a full-card tick, a spoken "Added", a vibration.
- A second tap within 1.3 seconds is ignored, so a double tap never orders two.
- Voice never adds anything without a "Yes".

## 5. Data and state

```
menu_items      id, kind, category, name_en/ms/zh, price, image_url, aliases[]
table_sessions  id, table_code, created_at, closed_at        one OPEN row per table (unique index)
cart_items      id, session_id, table_code, item_id, qty, notes[], added_by, added_by_name,
                source (tap|voice), via (easy|normal), order_id (null until sent)
orders          id, session_id, table_code, total, confirmed_by, created_at
voice_feedback  heard, proposed, accepted, engine            write-only for diners
```

- **Session.** The QR carries only the table code. `join_table(code)` returns the open sitting or starts one.
  A sitting ends when staff clear the table or after 3 idle hours, so guests never inherit the last order.
- **Sync.** Both menus render from the same `TableState` (`useTable`). A pick is an insert into `cart_items`;
  Supabase Realtime tells every phone at that `table_code`; each phone re-reads the cart. There is no
  menu-specific state on the server, which is why the two menus cannot drift apart.
- **Sending.** `confirm_order(code)` runs inside the database: it locks the sitting, prices from `menu_items`
  (never from the phone), creates the order and stamps `order_id` on the lines in one transaction.
  Two people tapping at once produce one order; the second gets "nothing to send".
- **Frontend state** kept on the phone only: menu choice, language, name. Everything else is the shared table state.

## 6. Solo ordering

There is no host and no group leader. The rule is: **anyone at the table can send the open order.**

- Big Photos Menu: "Send to kitchen" appears at the end of the dishes and inside "My picks".
  It shows the order, asks once, and sends.
- If other phones have open picks, the text says so ("Others at your table are ordering too. They can send
  the order, or you can."). The button is still there.
- Normal Menu: the sticky bar always has "Send to kitchen".

## 7. What has been run, and what has not

| Part | Status |
|---|---|
| Both menus, gateway, solo send, staff clear, on sample data | Run end to end in a real browser |
| On-phone matcher on mixed sentences ("teh tarik siew dai nng, laksa satu") | Run on typed text |
| `schema.sql`: rules, functions, idle reset | Run in a test Postgres with stand-in roles |
| Supabase Auth, Realtime, Storage against a live project | Not run |
| `/api/voice` against a mock that follows ILMU's documented request and response shapes, including outages | Run |
| `/api/voice` against the real ILMU API | Not run (no key here) |
| A real microphone, real elderly speakers, a noisy restaurant | Not tested |
| FeedMe backend | Not connected |
