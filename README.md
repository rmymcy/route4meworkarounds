# Route4Me Workaround

A single-file, offline HTML tool that converts an ERP survey export into a
Route4Me-ready upload — and (coming next) converts Route4Me's export back into
the ERP's expected format.

## Use it
Open **`index.html`** in any browser. The header has four region tabs —
**FL · HOU · DFW · ASA** — and each region is a fully separate workspace:
its own subdivision library, crews, imports, KMZ cache and settings.
Nothing ever crosses between regions (every region stores under its own
browser-storage prefix). FL is the original curated model; the other three
start empty so each region's own library can be built up.

The accent color, map default view, and export filenames
(`Route4Me Upload HOU 2026-08-26.csv`) follow the active region so files
from different regions can't get mixed up.

Nothing is uploaded; all processing happens locally and the libraries are
saved in your browser. (`company_subs.json` keeps the full deduplicated
Customer Zone list from the Geotab export as seed data for the new regions.)

### Convert (ERP → Route4Me)
Drop your ERP CSV. The tool:
- inserts **Latitude** / **Longitude** columns after `Address 1` (from the library),
- appends a **Depot** column,
- appends one **depot row per crew** (crew home, `Depot = 1`),
- gives every job in a subdivision the *same* coordinates on purpose — this forces
  Route4Me to cluster a subdivision's jobs onto one route,
- preserves every original field byte-for-byte (fixed-width padding included),
- pops up any subdivision it can't match so you can add + geocode it by hand.

Matching order: exact name → alias → 25-character truncation (the ERP truncates
`Subdiv Name` to 25 chars; aliases hold those shortened/misspelled forms).

### Libraries
- **Subdivisions** — the lat/long source. Add / edit / delete subs and aliases.
- **Crews / Depots** — each crew's home; becomes the depot rows.

Both seed from the starting data and can be exported/imported as JSON for backup.

## Roadmap
- Export side: turn Route4Me's routed export back into the ERP import format,
  patching only the changed dispatch values against the stored original.
