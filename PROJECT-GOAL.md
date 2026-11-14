# Project goal: EZorder

Drafted for the team from the pitch notes. Change anything that is wrong before running `/one-shot`.

## Goal

Elderly diners order by themselves from a phone, without frustration, and the restaurant turns tables faster,
with only one QR code on each table.

## Evidence

Two phones open the same table link. One chooses the big-photo menu, the other the normal menu.
A dish picked on the big-photo phone appears on the normal-menu phone within a second, and one tap sends
a single order for the whole table to the kitchen.

## Smallest journey

1. A diner scans the table's QR code (or opens `/t/5`) and chooses "Big Photos Menu" or "Normal Menu".
2. On the big-photo menu, Grandpa taps his name and sees one dish as a large photo.
3. He taps "I want this" (or says the order). The phone shows, says, and vibrates "Added".
4. The pick appears under his name on the normal-menu phone at the same table.
5. Anyone taps "Send to kitchen", including Grandpa on his own. Both phones show kitchen progress.

Try it on one laptop at `/demo`.

## Built

- `/` type a table number
- `/t/TABLE` the page behind the table QR: menu chooser, then the big-photo menu or the normal menu
- `/staff` printable QR card per table, and "Clear table"
- `/demo` both menus side by side at one table

## Later

- Supabase keys for sync between real phones (code and SQL are ready, see `EZORDER-SETUP.md`)
- Voice AI with ILMU (YTL AI Labs) through `/api/voice` (built, needs an ILMU key to run live)
- Real payment and POS hand-off; staff login for clearing tables
- Restaurant menu editor and photo upload
