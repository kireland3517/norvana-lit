# NORVANA Literature Orders

Order form and committee dashboard for NORVANA literature. A Google Apps Script web app that stores its data in a Google
Sheet, so it costs nothing to run and can be maintained from inside the app by non-technical volunteers.

**Keeping it running, security rules and how to publish a change: read [HANDOFF.md](HANDOFF.md).**

## Files (the whole deployed project)

| File | Purpose |
|---|---|
| `Code.gs` | Order form data, order submission, dashboard login and sessions, settings, catalog, groups, schedule |
| `OrderWorkflow.gs` | Atomic fulfill / reopen / delete, inventory, monthly and annual reports |
| `ChairReports.gs` | Chair Report drafts, finalized snapshots, reviewed Secretary email |
| `App.html` | The app: order form and dashboard |
| `ReportUI.html` | Reports screens, CSV and print views (included by `App.html`) |
| `authorizeMailApp.gs` | Run once from the editor to grant email permission (sends nothing) |
| `tests/` | Automated tests |

To publish: paste the changed files into the Apps Script project, then Deploy > Manage deployments > edit > New version.
Do not create a new deployment (it changes the link). Details are in HANDOFF.md.

## Tests

```
node --test tests/workflow.test.cjs
```

The tests use made-up in-memory spreadsheet data and fake email. No installs or network needed. To look at the screens
locally, run `node tests/preview.cjs` and open http://127.0.0.1:8765 (writes and email are switched off in the preview).
