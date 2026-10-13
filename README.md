# DayNest

A calm daily planner for tasks, habits, and notes. Built with plain HTML, CSS, and modular JavaScript so it is easy to understand and extend.

## Run locally

Install Node.js 22 or newer, open this folder in VS Code, and run:

```sh
npm start
```

Open **http://127.0.0.1:3000**. No dependency installation, account, or API key is needed. Keep the server running while using the app. Stop it with Ctrl+C.

If port 3000 is occupied, stop the other server or set `PORT` to another port. In PowerShell: `$env:PORT = '3001'`, then `npm start`. Use a consistent address and port: different browser origins have separate saved planners.

## Everyday features

- **Today:** quick-add tasks due today, see overdue tasks, check habits, and capture notes. “Completed today” counts completed tasks whose due date is today.
- **Tasks:** add, edit, complete, reopen, and delete tasks; choose an optional date and priority; filter active, today, upcoming, overdue, and completed tasks.
- **Habits:** create daily rituals, check in or undo today's check-in, and see the last seven calendar days. The app uses your device's local date.
- **Notes:** save and edit short notes and search titles and contents. Titles are required; note contents are optional.
- **Backups:** download a JSON copy, or restore a validated copy after confirming replacement. Invalid files do not replace saved data.

## Data and privacy

Data is saved in this browser's local storage under `daynest.v1`. There is no cloud sync, login, analytics, or background reminder service. Browser data stays on the device; publishing the source repository does not publish your planner.

Clearing browser/site data removes the planner. Other browsers, profiles, ports, and devices have separate data. Export backups regularly and before switching browsers. A backup contains your tasks and notes: store it privately, outside the source folder, and never commit it to GitHub. Imports replace rather than merge data and accept DayNest v1 JSON files up to 5 MB.

If storage cannot be read, saving is paused to protect the original data. Try reopening the page or restoring a known-good backup. If a write fails, the app reports it and preserves the previous state. Editing the same planner in several tabs at once is best avoided; changes from other tabs refresh the open app and close an open editor.

## Tests and debugging

```sh
npm test
npm run check
```

Tests use Node's built-in test runner and cover date boundaries, task filters, habit toggles, backup validation, storage failures, and local HTTP serving. No test dependencies are needed.

In VS Code, select **Run and Debug → DayNest: server** to start the Node server, or run `npm start` in a terminal. Then select **DayNest: browser (start server first)** to launch Edge with JavaScript debugging. Do not start a second server if one is already running. Use browser developer tools to inspect console errors and storage.

## Project structure

- `index.html` — accessible application shell and dialogs.
- `styles.css` — responsive cream-and-teal design; no remote fonts or images.
- `app.js` — views, forms, user interactions, and safe text rendering.
- `model.js` — data validation, persistence, date helpers, and task/habit logic.
- `server.js` — local-only server with an explicit public asset list.
- `test/` — meaningful behavior tests.
- `.vscode/launch.json` — server and browser debugging configurations.

Version one is local only. It does not include hosting, accounts, cloud sync, or reminders while the app is closed.
