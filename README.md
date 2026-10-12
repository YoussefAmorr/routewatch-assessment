# Routewatch — Travel intelligence prototype

A working U.S. travel operations dashboard with real FAA, NWS and Open-Meteo data, browser-run AI and persistent Mission Control. Core travel checks require no API keys or dependency installation. Email alerts require Resend configuration.

## Run and edit
Requires Node.js 22.13 or newer and internet access. No npm install is required. Run commands from the extracted routewatch folder. Node.js 24 or newer is also supported.

    node scripts/dev.mjs

Open http://localhost:4173. Stop an older server with Ctrl+C before starting the updated version. Edit worker/index.js, save, and refresh; the development server reloads the module automatically. The entire deployable application is embedded in this file. The data/ directory contains the airport directory and its license; genuine recorded examples are embedded in worker/index.js.

## Mission Control additions

- Persistent multi-trip portfolio with search, filters, source gaps, review priorities and individual briefings; supports up to 250 saved trips.
- Automatic 15-minute itinerary monitoring, baseline comparison, in-app attention queue and configurable Resend email subscriptions.
- Evidence-citing AI Copilot for risks, airport forecast comparison, missing information, next steps and time-window questions.
- Decision simulator comparing the original, earlier/later departures and a nearby arrival-airport option with fresh source retrieval.
- Animated airport-point forecast map with a local-hour scrubber, gust/precipitation layers and explicit forecast/radar distinction.
- Aggregate latest-risk, advisory-airport and stored-assessment trend analytics.
- Operator assignment, internal notes, reviewed/resolved status, recorded decisions and append-only audit records.
- Guided onboarding and real clear/elevated captures plus an explicitly labeled real-request timeout exercise for incomplete evidence.
- SQLite local persistence and a Cloudflare D1 / Cron / Queues deployment template with verified Access JWTs and organization-scoped admin/operator/viewer roles.

Read [OPERATIONS-GUIDE.md](OPERATIONS-GUIDE.md) for the workflow, Resend setup, hosted team configuration, privacy and limitations. Local monitoring requires the server to remain running. Hosted services are implemented but have not been provisioned. Slack/Teams delivery remains a future integration.

## Existing trip-intelligence features
1. Executive briefing: route, dates and local times, risk, main concern, action and source completeness appear before the detailed panels. The planner collapses after assessment.
2. Hourly weather intelligence: wind and gusts, precipitation amount and probability, and snow around the entered airport-local travel time. Each chart has metric controls, a cursor, an accessible data table, a ±3-hour screening band, and published alert intervals. Forecasts are explicitly distinguished from confirmed events.
3. Interactive map: clickable assessed airports, zoom/reset, drag-to-pan, expandable evidence, FAA advisory diamonds, forecast rings and NWS layers. Official warning polygons are shown when supplied; otherwise an airport-associated halo is explicitly not a warning boundary. Routes are illustrative.
4. Explainable AI: Why RouteWatch flagged this trip lists up to three contributing evidence items and sources. MobileBERT classifies the content, interprets whether it suggests a possible disruption, and compares that interpretation with the rule flags. Low-preference interpretations are uncertain; AI does not validate severity or predict cancellations. It also selects a supplemental operational checklist.
5. Side-by-side comparison: the original, rechecked airport pair and two selectable nearby alternatives show severity, relative signal, source completeness, planning times, window weather, airport substitution distances and evidence. For multi-city trips, select a leg to compare. This is a leg-level comparison, not a scored whole-itinerary reroute. Missing or unavailable candidates are never invented.
6. Share links: fresh-check links encode the entered plan and retrieve current data when opened. Compressed snapshot links preserve source records and timestamps in the URL fragment, with no server-side snapshot storage. Localhost recipients need a running copy at that origin; cross-device sharing requires an accessible hosted app. Shared snapshots are supplied evidence and are not independently reverified. Links are not encrypted.
7. Risk change detection: compare each fresh assessment with the preceding saved assessment of the exact same airports, dates and planning times. Show risk changes, missing-source changes, new/removed signals, updated advisories and forecast metric changes. Stable data shows No material changes.
8. Multi-city: up to three stops/four legs with separate local dates, arrival times and next departure times. Each leg gets full source checks and forecasts; the overall briefing uses the highest signal level and shows connection buffers. Invalid leg continuity, arrival-before-departure and impossible/ambiguous daylight-saving times are rejected. Connections under 90 minutes get a planning notice; actual carrier minimums are not checked.
9. History: optional browser-local snapshots, limited to the newest 20 and subject to browser storage quota. Open recorded evidence without automatically fetching sources; use Recheck live for a new assessment. Clear local history requires a user confirmation. This optional browser history is separate from the server-side records explicitly saved to Mission Control.
10. Demo: Replay demo loads a real, timestamped FAA/NWS/Open-Meteo capture, including hourly weather and a recorded comparison. It is clearly labeled recorded data. There are no fabricated provider responses. Static map/model assets may still need internet access on first use.

Existing airport search (1,950 U.S. IATA-coded airports), swap controls, source progress, collapsible evidence, source health, active navigation, JSON export, printing, keyboard interaction and responsive layouts remain available.

## Data, AI and architecture
- FAA XML: https://nasstatus.faa.gov/api/airport-status-information. Match IATA or FAA local identifiers. Reject feeds older than one hour. Reported advisories affect the matching local travel day; they are not cancellation confirmations or future forecasts.
- NWS GeoJSON: https://api.weather.gov/alerts/active?point=LAT,LON. Match published onset/end timestamps against the entered ±3-hour planning window. Active warnings do not guarantee coverage for distant future dates.
- Open-Meteo: https://api.open-meteo.com/v1/forecast. Retrieve daily and hourly data using Unix timestamps and each airport's IANA time zone. Include adjacent-day hours for windows crossing midnight. Units: mph wind, mm precipitation, cm snowfall, percent precipitation probability. Attribution: Open-Meteo, CC BY 4.0.
- Directory: airportsdata (MIT) joined with OurAirports metadata, captured October 12, 2026. The 1,950-airport directory includes non-airline fields with IATA codes; it is not an exhaustive list of every U.S. airstrip or a flight schedule. Nearby candidate selection is limited to major airports marked as scheduled-service.
- AI: @huggingface/transformers 3.7.2, Xenova/mobilebert-uncased-mnli, quantized WASM on the visitor's device. First use downloads the real model; failure is independent of source retrieval.
- Map: d3-geo 3.1.1, topojson-client 3.1.0, us-atlas 3.0.1 (U.S. Census-derived geometry) via jsDelivr.
- Fonts: Google Fonts DM Sans/Manrope, with system fallbacks.
- Server: dependency-free Worker-compatible JavaScript with POST /api/assess, /api/alternatives, /api/assess-stream and /api/itinerary-stream, plus POST /api/simulate, GET /api/demo and /api/examples, and organization-scoped /api/ops/* APIs. Source requests have 20-second timeouts and are deduplicated within itinerary/comparison checks.
- Persistence: built-in Node SQLite locally; D1 binding for hosted operations. Optional Resend sending key stays server-side.
- Client: HTML/CSS/JavaScript, SVG charts/maps, localStorage history, CompressionStream snapshot links. No secrets or authentication credentials are present in client code.

## Risk rules and limits
The strongest applicable source signal determines severity; sources are not averaged or counted as independent votes. Elevated: severe/extreme overlapping NWS warning, applicable current FAA advisory, planning-window gust ≥40 mph, window snow ≥5 cm, or thunderstorm code ≥95. Monitor: other overlapping alerts, gust ≥25 mph, any snow, precipitation probability ≥70%, or fog code 45/48. These are prototype screening thresholds, not calibrated cancellation probabilities. Missing data is explicitly reported and never treated as a clear signal.

Entered times are planning assumptions, not verified schedules. Flight-specific cancellations, available flights, seats, fares, driving times, runway crosswinds, aircraft rotations, en-route conditions, security queues and staffing are not checked. Nearby pairs and entered connections are not booking recommendations. AI agreement concerns evidence interpretation, not validation of severity or cancellation prediction.

## Checks
    npm run check
    npm run build
    npm run validate

Checks exercise live retrieval, transport outages, streaming source events, directory selection, nearby alternatives, airport-local/DST validation, ordered multi-city legs, hourly forecast records and the captured demo. Browser checks verified the executive briefing above the fold, map inspection/zoom, hourly controls, shared snapshot round-trip, history replay, multi-city inputs, comparison columns and desktop/390px phone layouts. Print styling is provided; final pagination depends on the browser/printer.

This submission runs locally. Optional hosted services are implemented but have not been provisioned.

## Security & reliability

Server input/body limits, bounded provider requests, same-origin APIs, per-instance rate limiting and security headers are enabled. Trip history saving is opt-in. See [SECURITY.md](SECURITY.md) for verified controls, test commands and deployment limitations. Public hosting requires HTTPS and a shared edge rate limit.
