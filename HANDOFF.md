# NORVANA Literature Orders - keeping it running (handoff notes)

Written for whoever looks after this next, technical or not. Last updated 2026-10-19.

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
| Free State order email, Bill To and Ship To details | Settings > Free State Order Information |
| Order from Free State and email it | Inventory > Create Free State Order |
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
3. **Keep the live Apps Script project to the nine files in this repo.** Any top-level function in the live project can be
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

## Free State orders

**Inventory > Create Free State Order** builds the monthly order to Free State and emails it from the committee account.

- The list starts with every **Stocked**, active product that is low (yellow) or out (red), across all categories, with a
  Suggested Order quantity in singles that brings it to its Target Stock: Low At plus one order multiple (Pack Size,
  or the optional Order Multiple for bulk items) (rounded up to whole packs). Quantities are editable; blank or 0 leaves a product out. **Add Item** lists every
  active product by category, including Order on Request ones. An optional **Requested For** note on a manually added Order on
  Request product is kept for the chair (in Order History) and is never in the email or printout.
- **Review & Send** shows the exact email (From, To, Subject and the Bill To, Ship To and items tables). **Send Order**
  emails it directly; there is no Gmail draft. The recipient and addresses are read from Settings on the server, never from the browser.
- Unfinished edits live only in that browser tab (sessionStorage) so a refresh keeps them; they do not follow you to another
  device and nothing is saved to the sheet until the order is sent. Signing out clears them.
- Sending never changes On Hand, Target or any count. When stock arrives, update counts the normal way.
- **Settings > Free State Order Information** holds the order email address, Bill To (Group Location, Mailing Address,
  City, State, ZIP, Contact Person, Phone) and Ship To. The Bill To email is the **Lit Chair Email** and the group name is
  fixed in `FreeStateOrders.gs`. The order cannot be sent until every field is filled in; the screen lists what is missing.
  These are stored as `Free State ...` rows in the Config tab.
- **If something goes wrong.** Before it emails, the app writes a "Sending" record (with the whole order) to the
  **Free State Order Log** tab. A repeat of the same review can therefore never email twice.
  - *Email not sent* (for example no quota left): choose **Send again**.
  - *Not certain it was sent* (the mail service gave no clear answer): open Gmail as the committee account, look in **Sent**
    for "NORVANA Literature Order", then choose **It was sent: record it** or **It was not sent: send again**. Sending again when
    it already went out makes a duplicate.
  - *Sent but not recorded* (the history write failed): choose **Record order**. It never emails again.
  - Until an order like this is settled, a new one cannot be sent.
- A successful send means the email was accepted for sending, not that Free State received it. About 100 emails a day are
  available on a normal Gmail account; each Free State order uses one.
- In the demo project, leave the Free State Order Email blank or set it to your own address so test orders never reach Free State.

**Inventory Type.** Each Catalog product is **Stocked** or **Order on Request** (Catalog column I, edited in the sheet like
Low At; there is no control for it in the app). Every product, H&I and Spanish Lit included, is Stocked when column I is
blank, so it has a count, Low At and low/out warnings like everything else; typing `Order on Request` there switches one
product to on-request. Order on Request products have no count, Low At or Target, never show as low or out, are never suggested
automatically, and appear last (marked "On request") in the Inventory Print / Export report. Marking an order Ready still
deducts their stored count as before, so switching one to Stocked later needs a fresh count.

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
- Chair Report: the report month is the area meeting where it is presented (for example November), but the Groups
  Served, Collected and H&I charged figures are the **previous month's** Completed orders (October's, picked up at the
  October meeting). Groups Served counts each group once and never counts the H&I Subcommittee (it is not a group; its
  literature still counts in the H&I charged and literature totals). The screen and the email say "Orders recap: October 2026" so this is never ambiguous. Pick the
  reporting month and enter Spent and Notes. They save automatically (the line under the fields says
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
| Order Items | Row ID, Order ID, Item ID, Item Name, Unit Price, Qty Ordered, Qty Fulfilled, Line Total, Pack Size (saved when the order is placed) |
| Catalog | Item ID, Category, Item Name, Unit Price, Stock, Active (YES/NO), Low At, Pack Size, Inventory Type (optional: Stocked or Order on Request), Order Multiple (optional, see Inventory) |
| Config | Two columns, Setting and Value, with rows: Lit Chair Email, Dashboard Access Code, Secretary Email |
| Schedule | Meeting Month (e.g. "October 2026"), Window Open, Window Close |
| Groups | Group Name (one group per row) |
| Chair Reports | Presentation Month (or Reporting Month), Draft JSON, Finalized JSON, Revision, Email Attempt JSON |
| Order History | Order ID, Sent At, Item #, Description, Quantity, Inventory Type, Requested For, Status, Recipient, Bill To, Ship To, Recorded At (one row per product, created by the app on the first sent order) |
| Free State Order Log | Request ID, Order ID, Status, Created, Updated, Attempt JSON, Snapshot JSON (technical send record, created by the app; leave it alone) |

The Inventory tab's Print / Export button builds one report (Print / PDF or CSV). Its Target Stock is one above each item's Low At (Catalog column G), or one order multiple above. The order multiple is the Pack Size for pack items, 1 for single items, or the optional **Order Multiple** (Catalog column J) for bulk items: the H&I booklets use Low At 20 and Order Multiple 10, so at 0 the suggestion is 30. Pack Size itself is not changed for them because it also scales prices and stock deductions on orders. So Suggested Order = Target Stock - On Hand, rounded up to whole packs, and only for low or out items. Low At also decides when an item turns orange (low, at or below Low At) or red (out). There is no separate target column. Incoming (already ordered) stock is not tracked.

**Lit Chair Completed tab:** the Completed tile and list show one meeting month at a time. It opens on the current ordering/meeting month from the Schedule tab, and the Meeting month dropdown above the list looks back at earlier months; the Completed count is that month's. The All view still hides Completed orders. Nothing is archived or deleted.

**Individual items vs packs.** Order quantities (the order form, Lit Chair screens, Order Items columns F and G) are in packs for pack items. The reports (Reports tab Orders report, Trends and the Monthly Summary tab) count individual items: quantity x the **Pack Size saved on that order line** (Order Items column I, written when the order is placed, so a later Catalog change never rewrites old reports). Dollar values stay at the pack price. Readings (Set of 7) have Pack Size 1, so they count as sets. Order Multiple (Catalog column J) only affects Free State ordering and is ignored here. A line with no value in column I cannot be converted: it counts as 1 and the reports show a WARNING with the count, so fix it by typing its pack size into column I. The one-time backfill of the October 2026 lines copied each item's Catalog pack size. The H&I Subcommittee's literature is in the totals, but it is not counted as a group in Groups Served, and the reports say so.

**Trends and Monthly Summary:** Trends is the third tab in the **Reports** tab (Orders, Trends, Chair Report); the Inventory tab's Trends button is a shortcut that opens it. Trends and the sheet's **Monthly Summary** tab both calculate from Orders and Order Items on every view; nothing is saved, so corrected orders and old months always agree. Requested counts every order for the meeting month; Distributed counts Completed orders only (Ready means packed); value uses the price saved on each order line; the average is the up-to-3 earlier months since tracking began (`TRENDS_START_MONTH_` in `TrendsReport.gs`, October 2026), zero months included. Monthly Summary is written by the script (`MonthlySummary.gs`) from the same calculation as Trends, so the two always match. Run `setupMonthlySummary()` once from the Apps Script editor: it rebuilds the Monthly Summary tab in place (keeping the month in B1; the old layout is replaced), and installs an edit trigger (approve the permission prompt). The tab refreshes when B1, Orders or Order Items is edited by hand and when the app submits, packs, completes, reopens or deletes an order. Spreadsheet formulas were tried and dropped because they break when Order Items has fewer rows than the formula ranges.

Catalog column E counts single items, and Pack Size (column H) is how many singles one ordered unit contains (for
example 5 for a five-pack), so orders count packs while stock counts singles. Leave the Revision,
Chair Reports and Catalog stock columns alone when editing the sheet by hand.

**Renaming and copying:** the app opens the spreadsheet by its ID (the `SHEET_ID` line near the top of `Code.gs`), not by
its name. Renaming the spreadsheet file or moving it to another folder is safe. **Renaming a tab breaks the app**, and so
does making a copy and using the copy (it has a new ID, so the app keeps writing to the original). To move to a new
spreadsheet on purpose, build it per this layout, put its ID in `SHEET_ID`, and publish a new version.
