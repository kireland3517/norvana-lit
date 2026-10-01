# NORVANA Literature Ordering

Google Apps Script web app backed by Google Sheets. This folder contains the implementation prepared from GitHub master commit `16798c7c41456e5ae2bf460838710ba703f6721d`.

## Runtime files

- `Code.gs`: public ordering, dashboard data, settings, existing reports.
- `OrderWorkflow.gs`: atomic fulfillment/reopen/delete transitions, monthly/annual Orders aggregation, and current-stock reporting.
- `ChairReports.gs`: Literature Chair Report drafts, finalized snapshots, reviewed Secretary email.
- `App.html`: existing application and updated controls.
- `ReportUI.html`: Orders, Inventory, and Chair Report controls, CSV, and print/PDF views.
- `authorizeMailApp.gs`: run once from the editor to grant mail permission (sends no email).
- `local-only-maintenance/`: one-time setup/repair tools. **Never paste these into the live Apps Script project** (they can erase data or reset the password).
- `HANDOFF.md`: how to keep the app running and what must stay locked down.

Read [DEPLOYMENT.md](DEPLOYMENT.md) before installing this version. It documents the required new revision column, Chair Reports tab, Secretary Email setting, Sheets advanced service, schedule corrections, reporting-month compatibility, email sending behavior, acceptance checks, and deployment steps.

There is no separate test project — the app is still being trialed, so changes are exercised in the one live project. Back up the spreadsheet (**File → Make a copy**) before testing anything that writes, and use fictional orders. **Emails are real:** every send goes out as the account that authorized the script, so authorize as `norvanalit12@gmail.com` and put an address you control on test orders.

## Local verification

```text
node --test tests/workflow.test.cjs
```

Tests use fictional in-memory spreadsheet data and mocked email. No dependencies or network access are needed.

Optional local UI fixture:

```text
node tests/preview.cjs
```

Open `http://127.0.0.1:8765`. Writes and email are disabled in that preview. Stop it with Ctrl+C.

`README.txt` describes the original source backup, including its missing Apps Script manifest and deployment metadata. Preserve the real project's existing manifest rather than replacing it from this folder.
