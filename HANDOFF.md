# NORVANA Literature Orders - keeping it running (handoff notes)

Written for whoever looks after this next, technical or not. Last updated 2026-10-01.

## What it is

One web link (and QR code) for groups to order literature, plus a passcode-protected dashboard for the Literature
Committee. It is a Google Apps Script web app that stores everything in a Google Sheet. It costs nothing to run.

- The Apps Script project and the spreadsheet belong to the committee Google account (norvanalit12).
- The web app runs **as that account** and **anyone with the link can open it**. Visitors never need a Google login.
- Groups never touch the spreadsheet. The app reads and writes it for them.

## Everyday work happens in the app, not the spreadsheet

Sign in through **Dashboard** with the access code. From there you can:

| Task | Where |
|---|---|
| See, fulfill, mark ready/picked up, reopen, delete orders | Orders |
| Reports, CSV downloads, print/PDF, Chair Report and Secretary email | Reports |
| Stock counts, prices, turn items on/off, add new items | Inventory |
| Change the access code, Lit Chair email, Secretary email | Settings > Access |
| Add or edit months and order-window dates | Settings > Order Window Schedule |
| Add or remove groups | Settings > NA Groups |

**Add future months before the schedule runs out.** When no window is open, the order form refuses orders. The schedule
currently ends December 2027.

## The access code

- Numbers only, at least 6 digits. Change it in Settings. Changing it signs every other device out.
- After 10 wrong tries in a row, **everyone** (including you) is locked out for 15 minutes. Wait and try again.
- If the code is forgotten: sign in to Google as the committee account, open the spreadsheet, go to the **Config**
  tab, and type a new value next to **Dashboard Access Code**.
- Never leave it blank or as `changeme`. The dashboard refuses to open in that state.

## Keep these true (security)

1. **Spreadsheet sharing stays "Restricted."** Only the committee account and the current admin need access. Never
   set it to "Anyone with the link": that shows the Config tab (with the access code) and every group's contact details.
2. **The committee Google account is the master key.** Turn on 2-step verification and change its password whenever
   the Lit Chair or Secretary role changes hands.
3. **Do not paste one-time tools into the live Apps Script project.** Everything in `local-only-maintenance/` can wipe
   data or reset the password. Any top-level function in the live project can be called by any visitor to the link.
   Helper functions whose names end with an underscore (`_`) are private and safe; plain names are public.
4. **Never embed the app on another website.** Use the link or QR code only.

## Emails

Order confirmations, "ready for pickup" notices and the Secretary report are sent from the committee account. A normal
Gmail account may send about 100 emails a day (each order sends 2), so a very busy day can hit the limit.

## Publishing a change

1. Open the Apps Script project signed in as the committee account and paste the changed files.
2. **Deploy > Manage deployments > pencil icon > Version: New version > Deploy.**
3. **Never choose "New deployment."** That creates a new link and the old QR code stops working.
4. To undo a bad release: the same pencil screen, pick the previous version.

The `tests/` folder has an automated test suite (`node --test tests/workflow.test.cjs`). Run it before releasing.

## Built-in protections (so you know they are intentional)

- Wrong-code lockout and no default password (see above).
- The order form checks everything on the server: the group must be on the Groups list, items must be real and active,
  prices come from the Catalog, and quantities are capped.
- A repeated submission of the same order (double tap, lost connection) returns the original order instead of a second.
- An email address may place 5 orders an hour and a group 10 an hour.
- Text typed by visitors is stored as plain text so spreadsheet formulas cannot run.
- A failed save removes any half-written order rather than leaving it behind.
- The dashboard keeps only a temporary session token in the browser, never the access code. Sessions last up to 6 hours.
