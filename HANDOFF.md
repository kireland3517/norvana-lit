# NORVANA Literature Orders - keeping it running (handoff notes)

Written for whoever looks after this next, technical or not. Last updated 2026-10-05.

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
3. **Keep the live Apps Script project to the seven files in this repo.** Any top-level function in the live project can be
   called by any visitor to the link. Helper functions whose names end with an underscore (`_`) are private and safe;
   plain names are public. Never add one-time setup, cleanup or debugging functions to the live project. If one is ever
   needed, use a separate copy of the project and spreadsheet.
4. **Never embed the app on another website.** Use the link or QR code only.

## Emails

Order confirmations, "ready for pickup" notices, receipts and the Secretary report are sent from the committee account. A
normal Gmail account may send about 100 emails a day. Each order sends 2 when submitted, 1 when marked Ready and 1 receipt
when marked Completed, so a very busy day can hit the limit.

**Receipts:** marking an order **Completed** (Picked Up) emails the group contact a receipt listing what was actually
fulfilled and the total paid, to hand to the group treasurer. A completed order is treated as paid in full. For H&I
Subcommittee it says "charged to H&I budget" instead of "paid". An order with nothing fulfilled sends no receipt. If the
receipt email fails the order is still Completed and the dashboard shows a warning. Undo Pickup sends nothing, but
completing the order again sends a fresh receipt.

The group confirmation, the Lit Chair alert, the pickup notice and the receipt are styled (NORVANA header with the logo). The look
lives in one place, `EmailTemplate.gs`, and the logo is a small PNG stored inside that file, so nothing is hosted
elsewhere. Each email also carries a plain-text version, and if the styled version ever fails to build, the plain email is
still sent. The Secretary report email is deliberately plain: the Lit Chair reviews its exact text before it is sent.

## Publishing a change

1. Open the Apps Script project signed in as the committee account and paste the changed files.
2. **Deploy > Manage deployments > pencil icon > Version: New version > Deploy.**
3. **Never choose "New deployment."** That creates a new link and the old QR code stops working.
4. To undo a bad release: the same pencil screen, pick the previous version.

The `tests/` folder has an automated test suite (`node --test tests/workflow.test.cjs`). Run it before releasing.

### The demo project

Admins can practice in a separate demo Apps Script project that points at its own spreadsheet, so live numbers stay accurate. It is the same files as live except two lines at the top of `Code.gs`: `SHEET_ID` (the demo spreadsheet) and `DEMO_MODE = true`. `DEMO_MODE` adds an orange "DEMO - test orders only" banner, a DEMO browser-tab title and a "[DEMO]" prefix on every email subject. Keep `DEMO_MODE = false` in live, and never copy the demo `Code.gs` over the live one (or the reverse). Every other file is pasted unchanged into both.

## Built-in protections (so you know they are intentional)

- Wrong-code lockout and no default password (see above).
- The order form checks everything on the server: the group must be on the Groups list, items must be real and active,
  prices come from the Catalog, and quantities are capped.
- A repeated submission of the same order (double tap, lost connection) returns the original order instead of a second.
- An email address may place 5 orders an hour and a group 10 an hour.
- Text typed by visitors is stored as plain text so spreadsheet formulas cannot run.
- A failed save removes any half-written order rather than leaving it behind.
- The dashboard keeps only a temporary session token in the browser, never the access code. Sessions last up to 6 hours.

## How ordering and stock behave

- Groups can order while a window is open in the **Schedule** (dates include the whole closing day, in the script's time
  zone, America/New_York). The server decides the meeting month, never the browser. Items stay orderable even if the
  recorded stock is zero.
- Marking an order **Ready** deducts the quantities actually fulfilled and prices them at the original order-time prices.
  **Reopen** puts the stock back so the order can be edited and marked Ready again. Deleting a Ready order also restores
  its stock. **Completed** orders must use Undo Pickup first. Stock counts may go negative.
- **Current Stock Count** in Inventory is a replacement value: enter what is physically on the shelf (30 left plus 50
  received = enter 80). Spending does not change stock.
- Every order has a revision number so two people editing the same order cannot overwrite each other. If the app says
  "Order changed. Reload it," reload and try again.
- Chair Report: pick the reporting month and enter Spent and Notes. They save automatically (the line under the fields says
  Saved, or NOT SAVED in red if something went wrong). Review Email shows the recipient and the full message; Send emails it
  and saves that exact version, with its sent date, in the Chair Reports tab (column C, Finalized JSON). Later orders or
  edits never change a sent version. Sending again saves a new version and keeps the earlier ones in its history.

## H&I Subcommittee (special rules)

H&I orders through the normal form by choosing the group **H&I Subcommittee**. The rules are keyed to that exact name
(`HI_GROUP_` near the top of `Code.gs`).

- **Never rename that group on its own.** If it is renamed in Settings > NA Groups, change `HI_GROUP_` to match and
  publish a new version. Until then the special behavior silently stops.
- **Items:** H&I-only items go in the Catalog with the category **H&I** (NAWS item numbers as Item IDs). Only H&I
  Subcommittee sees them. H&I does not see Keytags or Medallions. Every other tab (Books, IPs, Special, Spanish) is
  shared. The server rejects an order that breaks these rules, so hiding is not just cosmetic.
- **Payment:** the area treasurer moves the money internally, so nothing is collected at pickup. The status flow is the
  same (New, Ready, Completed). The H&I emails say the order is charged to the subcommittee budget instead of asking
  for cash/check.
- **Reports:** Completed H&I orders count as **Charged to H&I**, not **Collected**. The Chair Report and the Secretary
  email show an "H&I charged to subcommittee budget" line, which is the number for the treasurer's transfer. Chair
  Reports sent before this change have no such line and are not altered.

## Sheet layout (needed to rebuild the spreadsheet)

The app reads these tabs by name. Row 1 is the header row. The Apps Script project also needs the **Google Sheets API**
advanced service turned on (Services > Sheets API) and the script time zone set to America/New_York.

| Tab | Columns (A onward) |
|---|---|
| Orders | Order ID, Timestamp, Area Meeting Month, Group Name, Contact Name, Email, Phone, Estimated Total, Fulfilled Total, Status, Fulfilled At, **Revision** (column L must be exactly "Revision") |
| Order Items | Row ID, Order ID, Item ID, Item Name, Unit Price, Qty Ordered, Qty Fulfilled, Line Total |
| Catalog | Item ID, Category, Item Name, Unit Price, Stock, Active (YES/NO), Low At, Pack Size |
| Config | Two columns, Setting and Value, with rows: Lit Chair Email, Dashboard Access Code, Secretary Email |
| Schedule | Meeting Month (e.g. "October 2026"), Window Open, Window Close |
| Groups | Group Name (one group per row) |
| Chair Reports | Presentation Month (or Reporting Month), Draft JSON, Finalized JSON, Revision, Email Attempt JSON |

Catalog column E counts single items, and Pack Size (column H) is how many singles one ordered unit contains (for
example 5 for a five-pack), so orders count packs while stock counts singles. Leave the Revision,
Chair Reports and Catalog stock columns alone when editing the sheet by hand.

**Renaming and copying:** the app opens the spreadsheet by its ID (the `SHEET_ID` line near the top of `Code.gs`), not by
its name. Renaming the spreadsheet file or moving it to another folder is safe. **Renaming a tab breaks the app**, and so
does making a copy and using the copy (it has a new ID, so the app keeps writing to the original). To move to a new
spreadsheet on purpose, build it per this layout, put its ID in `SHEET_ID`, and publish a new version.
