# Volleyball Mania — Team Dashboard

A stats dashboard built on top of the rally-by-rally tracking sheets. Drop a CSV in, get
side-out rates, rotation strength, per-player plus/minus, error breakdowns, match flow charts and
trends across every session you have logged.

## Quick start

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5177).

- **Home** — http://localhost:5177/
- **Dashboard** — http://localhost:5177/stats
- **Highlight reel** — http://localhost:5177/highlights
- **Error film** — http://localhost:5177/film
- **Rally tagger** — http://localhost:5177/tagger

## Tagging a match (instead of hand-editing a sheet)

1. Open `/tagger`
2. Paste a YouTube URL, set the match date, add your roster
3. Fill line-ups (and official scores when you know them) under **Line-ups & scores**. Sets share
   Rotation A by default; use **New rotation for set …** when a later set uses a different order.
4. Watch and tag: sticky Set / Rotation / Serving·Receiving, tap Won or Lost (or `Y`/`N`), pick a cause, optionally players, **Commit** (or Enter)
5. Phase and rotation advance automatically. If we win the opening rally while receiving, we
   stay in the set's starting rotation; later side-outs advance to the next rotation.
6. Save the match — either **Save this session → data/…** on the **Repo / admin** tab
   (commits straight to the repo, no download), or **Download CSV** and drop the file into
   `data/` yourself

Drafts autosave in the browser so a refresh does not wipe a half-tagged match.

## Saving to the repo (admin panel)

The **Repo / admin** tab on `/tagger` writes CSVs straight into this repo's `data/` folder
through a small serverless function (`api/data.ts`) that uses the GitHub Contents API. From
there you can:

- **Save this session** — commit the current tagging session as `data/<date>.csv` (overwrites
  the same set(s) if they already exist, while preserving other sets in that date's file).
- **Open** — load an existing repo CSV into the tagger so its rallies can be edited and saved back.
- **List / delete** the CSVs already in `data/`.

Files are grouped by match date (`data/YYYY-MM-DD.csv`). You can tag and save one set at a time:
when that date already exists, a new set label is appended while the other saved sets are kept.
Replacing a set that already exists requires a confirmation showing its saved-versus-draft rally
counts. Use **Open** first when you want to edit or continue the existing set rather than replace
it from a separate draft. After a save or import, unchanged sets are recognized and preserved
rather than rewritten on the next per-set save.

Before an overwrite, the panel shows the saved and draft rally counts for every affected set.
Writes use the repo blob version that was just read and are rejected if the file changes before
the commit completes. Imported drafts also remember the version they came from, so a stale edit
cannot overwrite a newer repo copy. Every successful save remains recoverable in Git history.

Every save and delete is an ordinary **git commit**, so nothing is ever truly lost — a file
deleted here still lives in history and can be restored with `git revert <commit>` or from the
file's **History** on GitHub. Commit messages are greppable (`tagger: save …`, `tagger: delete …`).

Because sessions are bundled at build time (see below), a save triggers a Vercel redeploy; the
dashboard reflects the change once that finishes (~1–2 min).

### Configuration (Vercel env vars)

The endpoint is disabled until these **server-side** environment variables are set in the Vercel
project (never commit them — they are not exposed to the browser):

| Variable        | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `GITHUB_TOKEN`  | Fine-grained PAT with **Contents: read and write** on this repo (or a classic token with `repo`). |
| `GITHUB_REPO`   | `owner/name`, e.g. `axu04/volleyball`.                                    |
| `GITHUB_BRANCH` | Target branch. Optional — defaults to `main`.                            |
| `TAGGER_SECRET` | Shared password required by the panel for any save or delete.            |

Enter the same `TAGGER_SECRET` value in the panel's **Admin password** field (it is remembered in
your browser). The admin API only runs on the deployed site — under `vite dev` there is no
`/api`, so the panel will report that it cannot reach it.

## Adding a new game (manual CSV)

Export the Google Sheet as CSV and save it into the `data/` folder. Every `*.csv` in there is
picked up automatically — the dev server hot-reloads and the new session appears in the filter bar
and in all the over-time charts.

You can also drag a CSV anywhere onto the running dashboard to preview it without saving the file.
Dropped files live in memory only and disappear on refresh.

### File naming

The session date comes from the file name. Anything with a recognisable date works:

- `2026-07-16.csv`
- `volleyball mania - 7_16.csv` (the year is read from the sheet body if it is written out there)
- `7-16-26.csv`

Sessions are sorted by that date, so keeping the naming consistent keeps the trend charts in order.

### Expected columns

The parser finds columns by header name, so extra columns and the scratch area to the right of the
log are ignored. It looks for:

| Column            | Meaning                                                        |
| ----------------- | -------------------------------------------------------------- |
| `Set`             | Set number. Rallies are grouped and scored per set.              |
| `Serving?`        | `Serving` or `Receiving`.                                        |
| `Won?`            | `Yes` / `No` — did we win the rally.                             |
| `Cause`           | How the rally ended (see below).                                 |
| `Player`          | Who it is on. Comma-separate to credit more than one person.     |
| `Rotation`        | 1–6.                                                             |
| `Notes`           | Free text, searchable in the Rally log tab.                      |
| `Timestamp`       | Video timestamp, shown in the Rally log.                         |
| `official scores` | `25-22` style final scores, one row per set, in set order.       |

The `rotation:` block in the spare columns is parsed too — each rotation is two rows, front row
then back row — and rendered as court diagrams on the Rotations tab.

### Cause values

| Cause                 | Counts as                       |
| --------------------- | ------------------------------- |
| `our_point`           | Point won, earned (kill or tip) |
| `aced_on_them_suckas` | Point won, ace                  |
| `opp_err`             | Point won, opponent error       |
| `opp_point`           | Point lost, opponent earned it  |
| `attack_out`          | Error — attacking               |
| `attack_net`          | Error — attacking               |
| `handling_bump`       | Error — ball handling           |
| `handling_set`        | Error — ball handling           |
| `handling_misc`       | Error — ball handling           |
| `serve_err`           | Error — serving                 |
| `aced_on_us`          | Error — serve receive           |
| `coverage`            | Error — defense                 |

Unrecognised causes are not dropped. They show up under "Other", classified as a win or a loss
based on the `Won?` column, so a new tag will never silently vanish from the totals.

## How credit is assigned

Everything follows the sheet's own `Cause` and `Player` columns. The rules, in full:

- A player named on a rally **we won** is credited with the point. That includes `opp_err` rallies —
  naming someone there means they forced the miss, and the notes back that up ("great conversion of
  bad pass by avy", "incredible team hustle"). These show up as **Forced** in the player ledger.
- `opp_err` rallies with **nobody named** are counted separately as **unprompted** opponent
  mistakes, because nothing in the sheet claims we caused them.
- A player named on a rally **we lost** is charged with the error — except `opp_point`, which by
  definition the opponent earned. Those appear as **Beaten** and count against nobody.
- **Net** is points (kills + aces + forced) minus errors.
- Rallies naming two players credit both, so the player columns can total slightly higher than the
  team totals. There were three such rallies on 7/16.

## Who served

The sheet only names a player on serves that ended immediately — an ace or a service error. That
leaves most serves unattributed, which badly distorts per-player serving numbers: three service
errors means something very different across 7 serves than across 18.

So the server is derived instead, from the `Rotation` column plus the line-up block: position 1 is
the last name in each rotation's back row. This is only used after it has been checked against
every serve outcome the sheet tagged by hand. On 7/16 the derived server matched all 30 of them, so
all 73 serves are attributed. **If a future sheet disagrees on even one, the Serving tab disables
itself rather than guess** — see `inferServers` in `src/lib/parse.ts`.

## What the metrics mean

- **Side-out rate** — rally win rate when receiving. The single most predictive number in
  volleyball; if you only track one thing, track this.
- **Point-scoring rate on serve** — rally win rate when serving. This is what produces runs.
- **Error rate** — share of rallies we ended ourselves. Everything except points the opponent
  genuinely earned (`opp_point`).
- **Points per turn** — average points scored during one trip to the service line. The clearest
  measure of who actually generates runs.
- **Mistake battle** — our unforced errors (attack, serve, ball handling) versus the opponent's.
  Being aced and coverage breakdowns are excluded so both sides are counted the same way.

Skill groups such as "Attacking" and "Ball handling" are a convenience layer applied on top of the
raw causes, defined in `src/lib/causes.ts`. The underlying cause names from the sheet are always
shown alongside them.

## Tracking gaps

The dashboard reconstructs the score from the logged rallies and compares it to the `official
scores` column. If a rally was missed, a banner on the Overview tab names the set and says how many
are missing. Set results always prefer the official score when it is present.

## Checking the data

```bash
npx tsx scripts/verify.ts   # what the dashboard computes, with reconciliation checks
npx tsx scripts/audit.ts    # raw counts straight off the CSV, no interpretation
```

`verify.ts` prints per-set scores, line-ups, serving splits and player totals, and asserts they
reconcile — points won must equal kills + aces + opponent errors, attributed serves must equal
serving rallies, and so on.

`audit.ts` is the independent check. It reads the CSV with no shared logic and prints the raw
cause × phase × result cross-tab, then looks for contradictions: service errors logged on a
receiving rally, aces logged while receiving, rallies where the serve/receive column disagrees with
who won the previous point, and rotations that advance without a side-out. On 7/16 it found zero
contradictions and five rotation jumps, which line up with the one rally known to be missing.

## Building

```bash
npm run build     # type-check and bundle into dist/
npm run preview   # serve the production build
```
