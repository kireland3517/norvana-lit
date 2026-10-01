# NORVANA changes — setup and deployment

## Status and baseline

> **Update 2026-10-01:** this work is deployed to production. Day-to-day operation and the security rules are in `HANDOFF.md`. The text below is the original change record and some of it ("not deployed", "do later") is historical.

Implemented locally; **not deployed or pushed to GitHub**. No live spreadsheet data was changed and no real email was sent.

Before editing, all seven original files were compared using Git blob hashes against GitHub `master`, commit `16798c7c41456e5ae2bf460838710ba703f6721d`. Every file matched byte-for-byte. The working directory is a source folder, not a Git checkout.

Read-only inspection on September 15, 2026 verified the linked spreadsheet's tabs, headers, and `America/New_York` timezone. Orders A:K and Order Items A:H match the source. Orders L1:L988 was empty. Config has Lit Chair Email and Dashboard Access Code; it has no Secretary Email entry. There is no Chair Reports tab. Existing reporting tabs are Monthly Report, Monthly Summary, and Annual Overview.

## Changes

- Ordering still uses the manually maintained Schedule tab. Date comparisons use the script timezone and include the entire closing day. The server assigns the open window's meeting month. Active items remain orderable regardless of recorded stock.
- Fulfillment shows current available stock. Ready deducts actual fulfilled quantities and calculates the amount from original order-time prices. Negative counts are allowed. Reopening restores packed quantities and preserves them as a draft; marking Ready again deducts the revised quantities and sends an updated notice.
- Orders have a revision number. Mutations require the revision displayed to the chair and share one script lock. Inventory, item quantities, order status, and revision are committed in one atomic Sheets API batch. Stale/repeated requests fail without another adjustment. Deleting a Ready order restores its stock in the same atomic batch; Completed must first use Undo Pickup. Undo Pickup changes no stock.
- Current Stock Count remains a replacement value. Only stock fields changed in the UI are submitted, so saving prices does not overwrite unchanged stock from an older page. For 30 remaining plus 50 received, enter 80. Spending does not change stock.
- Pending uses New estimates and Ready final amounts. Collected uses Completed final amounts. Reports no longer substitute all months for an empty selected month. New fulfillment drafts do not count as fulfilled in Summary.
- Reports has three tabs: Orders, Inventory, and Chair Report. Orders combines monthly/annual periods with By Group/By Item views and a group filter. Annual views retain a monthly breakdown. Collected, Pending, and Estimated Value remain separate; printed reports and CSV match the selected view and filters. Inventory shows only Item and Count, with a Stock as of date; print/PDF and CSV use the same two columns.
- Chair Report uses the selected reporting month's Completed orders, without shifting the month. Reporting month, Spending, and Notes appear above Save Draft and Finalize / Update Final. One preview shows either Draft or Finalized; a compact control switches versions. The fields are Groups Served, Collected, Spent, and Notes. Saving refreshes draft figures. Finalized snapshots remain frozen until explicitly replaced from a reviewed saved draft. Printing uses the displayed version; email review is available for the finalized version and shows the recipient and finished email before explicit Send.

## Required spreadsheet setup — do later, before deployment

Make a backup copy of the spreadsheet and save the previous Apps Script version first. Coordinate a brief pause in chair edits. Do not run `migrateSettings()` or clear any existing tab.

1. Recheck that Orders column L is still unused. Set **L1 to `Revision`**. Leave existing L2:L values blank; blank means revision zero. Do not insert columns among A:K, reorder rows, or change existing order statuses or quantities. New orders receive revision zero automatically.
2. Add a new tab named **`Chair Reports`**. Set A1:E1 to exactly:

   | A | B | C | D | E |
   |---|---|---|---|---|
   | Reporting Month | Draft JSON | Finalized JSON | Revision | Email Attempt JSON |

   For a new tab, leave the remaining rows empty and keep column A as plain text. Existing tabs with the old `Presentation Month` header and legacy keys are supported without renaming, shifting, or clearing them. Saved JSON `reportingMonth` determines the association. Existing row keys stay unchanged; new rows use the selected reporting month. Do not use column A alone to identify a legacy report. The app writes JSON as literal text, preserving multiline notes safely. This tab is separate from the existing report export tabs; do not repurpose them. If the tab already exists when deploying, inspect it first and do not overwrite its contents.
3. In Config, append **`Secretary Email`** in the Setting column and the intended address in the Value column, or enter it in the new Dashboard Settings field after deployment. Do not replace the other settings. Leaving it blank disables email sending until set.
4. Inspect validation on Catalog column E. Permit negative whole numbers; remove only a conflicting non-negative restriction if present. Existing catalog quantities are left untouched. Inventory now means available stock excluding packed Ready orders. Old code floored counts at zero, so historical undercounts cannot be reconstructed automatically; the chair should reconcile against physical available stock through Current Stock Count when appropriate.
5. Confirm the spreadsheet and Apps Script project timezones are both **America/New_York**.

Direct spreadsheet edits do not participate in the app's lock/revision checks. Avoid editing Orders, Order Items, or Catalog stock directly while chair actions are running. Use the app for these actions. Do not run multiple independent Apps Script projects against the production spreadsheet.

## Schedule findings and corrections

The live Schedule extends through **December 2026**. All 1,000 available schedule rows were checked; there are no later entries. No live corrections were applied.

For the remaining 2026 windows, the required manual corrections are:

| Ordering month | Currently recorded | Intended inclusive window |
|---|---|---|
| October 2026 | September 3–30 | **September 4–October 1** |
| November 2026 | October 1–November 4 | **October 2–November 5** |
| December 2026 | November 5–December 2 | **November 6–December 3** |

Add January 2027 manually when ready: **December 4, 2026–January 7, 2027**, inclusive. Continue maintaining future months in Dashboard Settings. Meetings are the first Thursday; the next window starts Friday. Past schedule rows also differ from the agreed convention (January's recorded close is January 7 rather than January 1); review historical rows deliberately if needed. Do not change existing orders' assigned meeting months.

## Apps Script deployment steps — not performed

This app is itself still being trialed, so there is no separate test project. Changes are made and exercised in the one live project. Before exercising anything destructive, back up the spreadsheet (**File → Make a copy**) so there is a restore point; use fictional groups and orders rather than real records.

1. Confirm `SHEET_ID` in Code.gs is the intended spreadsheet before running anything.
2. Enable **Google Sheets API v4**, identifier **`Sheets`**, under Apps Script **Services → +**. If using a standard Google Cloud project, also enable the Google Sheets API in that project's API console. This is required for atomic updates. See [Google's advanced service setup](https://developers.google.com/apps-script/guides/services/advanced) and [atomic batch update reference](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate).
3. Replace **Code.gs** and **App.html** together. Add **OrderWorkflow.gs**, **ChairReports.gs**, and the HTML file **ReportUI.html** (Apps Script editor name `ReportUI`). Keep the existing helper files. Do not upload `tests`, this guide, or local preview code into Apps Script. App.html includes ReportUI using an Apps Script template include; simply opening App.html from disk will not run it correctly.
4. Preserve the existing manifest, deployments, triggers, script properties, and authorization settings. The original source backup did not include `appsscript.json`; do not generate a replacement manifest blindly. Add the Sheets service to the existing project configuration and authorize required spreadsheet/mail access as the deployment owner.
5. **Email sends are real and unstubbed.** Authorize the script as **norvanalit12@gmail.com** so order confirmations and pickup notices come from the committee address, not a personal one; see [Email sending](#email-sending) below. When exercising submission or Ready actions, put an address you control on the order. Avoid triggering notifications on real historical orders. The provided Node tests stub all mail and spreadsheet services, so they never send.
6. Exercise the acceptance checklist below. Apps Script authorization, Sheets API integration, popup/print behavior, and mobile/dark-theme layout can only be verified in the live project.
7. Update the existing web app deployment to a new version. Preserve **Execute as Me**, current access settings, and the existing deployment URL. Ask open dashboard users to reload so they receive revision-aware code. Retire any separately deployed old version that can still write the spreadsheet; old code does not enforce the new revision checks.

## Email sending

`MailApp.sendEmail` always sends **as the Google account that authorized the script**, regardless of what address appears on an order. The code sets no sender anywhere. Three consequences to expect:

- **Whoever authorizes the script is the sender on every email.** Authorize as **norvanalit12@gmail.com** so groups and the Secretary see the committee address. To change it: open the script signed in as that account, run `authorizeMailApp` once, accept the permission prompt, then redeploy. Re-authorizing under a different account changes the sender for all four send sites.
- **Email you send to yourself lands in Sent, not Inbox.** This is Gmail's behavior, not a fault. If you put your own address on a test order, the confirmation and the ready-for-pickup notice both appear only in Sent. The sends succeeded.
- **The Lit Chair's new-order notice shows the authorizing account as sender**, not the ordering group. The group's address is in the message body instead. Replying to that notice reaches the sending account, so use the address in the body to contact a group.

Sending is subject to a daily quota; `ChairReports.gs` checks remaining quota before Secretary sends and refuses rather than half-sending. There is no delivery receipt — a successful call means accepted for sending, not delivered.

## Reports layout update

Deploy `Code.gs`, `OrderWorkflow.gs`, `ChairReports.gs`, `App.html`, and `ReportUI.html` together when authorized, then reload open dashboards. This change requires **no data migration**. Do not rename or shift existing Chair Report rows. Their saved `reportingMonth` is used for lookup, printing, and email. For example, a legacy row keyed November 2026 with JSON reportingMonth October 2026 is shown when October 2026 is selected, and its final snapshot and email state are preserved. New November selections report November activity. Conflicting or duplicate saved reporting-month associations fail safely rather than overwriting a record.

Orders controls are Period, Month/Year, By Group/By Item, and Group. Monthly By Group lists individual orders; Annual By Group groups each order once. By Item aggregates requested and actually fulfilled quantities using original line prices, including across price changes. New-order fulfillment drafts are excluded from fulfilled quantities and values. Top-level financial totals are computed once per order, not once per line: Pending is New estimates plus Ready final totals; Collected is Completed final totals; Estimated Value is the original estimate. These figures overlap in purpose and must not be added together. Fulfilled Value includes Ready and Completed items and is not a synonym for Collected.

Both annual views provide a collapsible twelve-month breakdown. It is included as a separate section in annual print and CSV exports, with the same group filter. Old links to shared report worksheets are replaced by CSV and Print / PDF generated from the currently displayed selection, so exports do not depend on a stale shared worksheet. Inventory has no month filter; its screen, print, and CSV contain only Item and Count, plus the stock timestamp.

Chair Report has one main preview. Finalize / Update Final uses a saved, reviewed draft; if the saved final is currently displayed, the first Update Final click opens the draft for review. Unsaved inputs disable finalization. Printing uses the displayed version, marking an unsaved draft when applicable. Email review is enabled for the saved final, includes its version and recipient, and retains all retry/resend safeguards. Changing the reporting month or report tab prompts before discarding unsaved inputs. Saving refreshes draft figures without silently changing a finalized snapshot. Previous presentation-month references are omitted from the interface, printouts, and email. Legacy preview tokens are invalidated; review a fresh email after upgrading.

The local preview contains sample data for all four Orders combinations and the stock/Chair reports. Restart it after source changes. Writes and real sending remain disabled. Automated checks cover these controls and export content; no browser was available for visual mobile/print QA. Tables scroll horizontally on small screens, and controls wrap above results.

## Secretary email retry update

The email retry update changes `ChairReports.gs` and `ReportUI.html` at runtime. For the later Reports layout update, deploy all five files listed above. Deploy those runtime files together when authorized and have dashboard users reload. **No additional spreadsheet columns, tabs, migration, or data reset are required for this update.** Keep the existing `Email Attempt JSON` header and values.

Email state in column E is now independent of the finalized JSON/report revision in columns C:D. Each reviewed send gets a unique attempt ID. The preview is bound to the recipient, finalized version, session, and previous email state. A script lock and persisted claim ensure that double-clicks, simultaneous requests, competing previews, and replayed requests cannot send the same attempt twice. A fresh preview plus explicit retry/resend confirmation creates a new attempt without editing or re-finalizing the report. The app never automatically retries a mail call.

- **Failed:** the app did not call the mail service (for example, the daily quota check failed). Resolve the issue and view the finalized report, choose **Review Email**, then **Retry Send**.
- **Uncertain:** the mail call threw, execution stopped, or the final status could not be saved. The email may have sent. The app prompts the chair to check sent mail before an explicit retry; choosing to retry may create another copy.
- **Accepted for sending:** show the sent/acceptance date and recipient, with "Delivery is not confirmed." View the finalized report, choose **Review Email**, review the complete email, and confirm **Resend**.

The latest attempt and most recent accepted timestamp/recipient are stored in column E. This is not a complete email-history log. Updating/finalizing the report no longer clears email state. Legacy `sent` records are read as accepted for sending; legacy `attempted` records are treated as uncertain. They support the same review/retry/resend flow without rewriting the finalized report. A failed later attempt retains the prior accepted date and recipient.

If a send request loses its response, reload to read the persisted status and check sent mail before an explicit retry. If the initial claim write fails, that invocation does not call MailApp. If it committed but its response was lost, its saved claim is treated as uncertain and requires a new reviewed attempt. Generic MailApp exceptions are conservatively uncertain; the app does not infer non-delivery from exception text.

## Tests and acceptance

Run locally with Node 24 or a compatible modern Node version:

```text
node --test tests/workflow.test.cjs
```

The suite uses in-memory Sheets, lock, cache, properties, and MailApp doubles. It tests actual server functions and report rendering calculations, with no network calls. It covers:

- Ready → reopen → Ready with revised quantities; immutable original prices/estimate and revised email total.
- Repeated/stale requests, simulated overlapping actions, rejected atomic writes, and lost responses after successful commits.
- Completed deletion rejection, Undo Pickup, Ready deletion restoration, and New deletion with no stock effect.
- Negative stock, replacement counts, active/inactive filtering, public submission at the end of meeting day, and no reuse of deleted order IDs.
- Zero and invalid quantities; preventing edits to locked fulfillment; pickup-mail failure surfaced after successful stock save.
- Strict meeting-month/year and group selection; annual totals counted once per order; original item prices across price changes; New drafts excluded from fulfilled quantities and values; two-column stock exports; legacy Chair reporting-month associations including year boundaries.
- Frozen Chair Report snapshots, explicit updates, Secretary recipient/preview checks, known pre-send failures, uncertain mail outcomes, explicit retries, confirmed resends, lost status-write responses, competing previews, and duplicate-request prevention. UI tests cover confirmation cancellation, double-click suppression, stale previews, and no automatic send retries.
- Inclusive timezone-aware schedule boundaries, CSV zero totals, script syntax, all four Orders views and export filters, one Chair preview with inputs above results, version-specific printing/email, and unsaved-change safeguards.

For a local **fictional, read-only UI preview**, run `node tests/preview.cjs` and open `http://127.0.0.1:8765`. The server binds only to localhost. Its action stubs disable writes and sending. Stop it with Ctrl+C. No browser was available through the automation tools in this session, so visual browser/print verification is not claimed.

Before relying on the app, verify in the live project, using fictional orders and a spreadsheet backup:

1. Ready 4 from stock 2 gives -2; reopen returns stock 2; Ready 3 gives -1; Pending changes from the original estimate to the revised final amount.
2. Use two dashboard tabs to submit stale fulfillment/reopen/delete actions; only the first valid revision changes stock. Reload after a stale-action message.
3. Mark Picked Up, Undo Pickup, then delete Ready: only deletion restores stock. Confirm no completed-order deletion button/action can delete directly.
4. Inventory shows current stock beside fulfillment and permits manual negative counts. Public ordering offers active items even at zero/negative counts.
5. Selecting October in Chair Report includes only October Completed orders. Save/finalize, then edit an order: the finalized report must remain unchanged. Save a refreshed draft, review, and explicitly update to change it.
6. Review Secretary recipient and full finalized report. Set Secretary Email to an address you control before sending, since this send is real. Send once, then verify the accepted timestamp/recipient and that a second attempt requires an explicit Resend from Review Email. Double-click the same request: only one email must arrive. Compare the finalized JSON and report revision before and after; they must be unchanged. The failure, uncertain-outcome, and retry paths are covered by the Node tests — do not try to force real failures against live data.
7. Check all three report tabs on desktop/mobile and dark theme. Exercise Monthly/Annual and By Group/By Item with and without a group filter. Compare CSV and Print / PDF with the selection, including the annual monthly breakdown. Confirm Inventory has just Item/Count and a stock date. Print both Chair draft and saved final; each must identify the displayed version and reporting month, without presentation-month labels.

## Failure handling and limits

- Stock/status updates are atomic; email is separate. A failed pickup email returns a warning while leaving the order Ready. A response lost immediately after a successful batch may leave Ready saved without an email. Reload and check status; do not reopen merely to retry mail. Contact the group directly if delivery is uncertain.
- Secretary email records a unique attempt before calling the email service. Repeated requests and other previews of the same previous email state cannot send again. A failure before the mail call is marked failed; an exception during the call or an interrupted attempt is marked uncertain because the email may have sent. If the outcome is uncertain, check sent mail first. Use Review Email from the finalized preview, review the recipient and report again, and explicitly confirm Retry Send or Resend. The finalized report and its revision do not change. A successful mail call is recorded as accepted for sending, with its timestamp and recipient; this is not confirmed delivery. MailApp returns no delivery receipt (see [MailApp reference](https://developers.google.com/apps-script/reference/mail/mail-app)). A database update and email delivery cannot form one transaction.
- The live sheet's values/formulas and validation beyond the inspected headers, schedule, and empty revision column were not exhaustively audited. Existing data is preserved; no stock reconciliation or historical backfill was performed.
- Browser visual checks and execution against the real Apps Script/Sheets API remain deployment acceptance checks. Node tests simulate these services, including failure and concurrency behavior.
- If rollback is needed, pause edits first. Preserve the added revision column and Chair Reports tab. Reverting to the old code restores its old stock/deletion behavior, so reconcile any affected orders carefully before resuming chair actions.
