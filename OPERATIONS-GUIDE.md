# RouteWatch Mission Control

## Start locally

Use Node.js 22.13 or newer (SQLite support is required):

```sh
node scripts/dev.mjs
```

Open http://localhost:4173. The home screen is now Mission Control. The SQLite database lives in `.data/routewatch.sqlite`; saved trips, assessments, decisions, notes and alerts survive browser and server restarts. The database and environment files are excluded from the source archive and Git. The local server binds to loopback and runs as one local administrator. This is not local multi-user authentication.

## A complete workflow

1. Click **Plan a trip**, choose airports/dates/local planning times, and assess.
2. Inspect the executive briefing and cited evidence. Ask **AI Copilot** why it was flagged, which airport has fewer forecast signals, what is missing, or what action to consider.
3. Use **Trip decision simulator** to compare the original, an earlier departure, a later departure and a nearby alternative arrival airport. The server retrieves real source data for the different windows. Time shifts preserve the selected leg's elapsed duration; invalid connections are rejected. A lower signal requires complete original and scenario source coverage. These are not actual flight schedules.
4. Scrub the **map forecast timeline**, switch gusts/precipitation, or press Play. Values come from hourly forecasts at assessed airport points. Local-hour comparison is not simultaneous UTC weather. No regional interpolation, observed radar, wind direction or flight-path weather is invented.
5. Click **Save to Mission Control**. Enter a trip label and optional employee reference. Enable monitoring if wanted. The server establishes a fresh baseline; a first assessment does not trigger a change alert.
6. Open the trip from the fleet table. Assign an operator, mark it investigating/reviewed/resolved, record a decision, and add timestamped internal notes. Changes are written to an append-only activity log. Concurrent edits require reloading instead of silently overwriting another change.
7. Subscribe a recipient to email alerts. Subscribers receive risk increases and significant new FAA/NWS advisories after baseline. In-app alerts appear in the attention queue whether or not email is configured. Acknowledge an alert after review. New concerning changes reset the trip to unreviewed.
8. Review portfolio analytics: latest risk distribution, unique advisory-affected trips per airport, and classification changes across stored assessments. Trends are UTC-day assessment observations, not a measured airline cancellation rate. Incomplete coverage remains visible.

The dashboard supports up to 250 saved trips, including a 25-trip portfolio, with route/employee/owner search and filters for elevated risk, review, incomplete evidence, monitoring and archived trips. Upcoming travel drops out of the active view once its final entered arrival is past. Archiving preserves history and stops checks. The current UI has no permanent-delete action.

## Monitoring and delivery

Local scheduled checks run on a one-minute scheduler tick; each enabled itinerary is due every 15 minutes. The local server must stay running. Dashboard state refreshes every 30 seconds while visible. An assessment failure retains the previous evidence, displays an error and retries later. Completed travel automatically pauses monitoring.

For hosted use, the included Worker implements `scheduled` and `queue` handlers. Cloudflare Cron checks for due trips, and Cloudflare Queues executes leased jobs. Each job has a token so duplicate queue messages cannot create duplicate assessment/alert records. Expired leases can be reclaimed. Delivery is separate from assessment; email errors do not discard evidence.

Resend messages use stable per-delivery idempotency keys, bounded timeouts, a delivery lease and up to five attempts with increasing delay. **Accepted by Resend** means the email API accepted the message; inbox delivery/bounces are not tracked. Slack and Microsoft Teams delivery are future integrations, not active features.

## Configure Resend

Copy `.env.example` to `.env.local` and enter the key and approved sender locally:

```dotenv
RESEND_API_KEY=your_sending_key
ALERT_FROM=RouteWatch <alerts@your_verified_domain>
PUBLIC_BASE_URL=
```

Restart the server after changing these values. Do not put credentials into browser code, screenshots or Git. Leave PUBLIC_BASE_URL blank locally; hosted notification links need your HTTPS application origin. No actual email can be sent without a key and sender. The integration has been tested with an isolated delivery transport; no real email was sent during development.

Documentation: [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email).

## Configure hosted team access and persistence

`wrangler.example.jsonc` is a deployment template, not a provisioned production environment.

1. Create the D1 database and assessment/dead-letter queues in your Cloudflare account.
2. Copy the template to your deployment configuration, replace identifiers, and apply `migrations/0001_operations.sql` to D1.
3. Bind DB and ASSESSMENT_QUEUE and enable the included Cron schedule.
4. Protect the application with Cloudflare Access and configure ACCESS_TEAM_DOMAIN and ACCESS_AUD.
5. Set TEAM_MEMBERS to an email-to-membership map, for example `{"operator@example.com":{"org":"company-a","role":"operator"}}`. Supported roles are admin, operator and viewer. Only configured members can access their organization's operations records. Viewers cannot modify trips, notes, subscriptions or decisions.
6. Set RESEND_API_KEY as a Worker secret and configure ALERT_FROM and PUBLIC_BASE_URL. Use a sending-only key where available.
7. Add shared edge rate limits and inspect structured error/assessment logs. Test with two organizations and a viewer before allowing real employee data.

The Worker verifies the Access JWT signature, issuer, audience and expiration against the configured issuer's keys. A claimed email header alone is insufficient. Missing configuration fails closed for operations APIs. Membership administration is currently deployment configuration; there is no account-invitation UI. This hosted setup has not been deployed or tested against a live Cloudflare account.

References: [Cloudflare Access token validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [Queues configuration](https://developers.cloudflare.com/queues/configuration/configure-queues/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## AI and examples

Copilot uses the existing on-device MobileBERT model for supported-question routing, with deterministic safeguards for clear supported questions. Its response sentences are assembled from retrieved structured evidence rather than generated by a cloud chat model. Answers cite source records, state missing checks, identify recorded data and acknowledge unsupported questions. AI loading failure produces an explicitly labeled evidence-only answer. It cannot execute instructions, change a risk level, send messages or book a flight.

First-time visitors receive a six-step interactive tour, which can be reopened. Clear and elevated examples are real timestamped source captures. The incomplete example is a clearly labeled connectivity exercise: actual NWS requests were attempted with a deliberate 1 ms timeout; other retrieved evidence is real. This is not a claim that NWS was down. Samples never populate the monitored portfolio automatically.

## Retention, limitations and checks

Operations records are stored on the server, separately from optional browser history. Use internal references rather than unnecessary personal details. Assessments retain the latest 40 per trip plus captures referenced by alerts. Audit notes and actions are append-only and are not automatically purged. Back up the SQLite/D1 database securely and establish a retention/purge policy before storing real employee information.

Monitoring is itinerary/endpoint screening, not flight-specific tracking. Multi-day itineraries whose earlier legs are already outside the supported forecast-date window need a new plan for remaining travel; the app will retain prior evidence and show a check error rather than invent historical forecasts. Alerts are based on periodic checks, not instant FAA/NWS push events. Rate limits are per instance and need shared enforcement for public deployments.

```sh
npm run check
npm run build
npm run validate
```

Tests cover live sources and simulator windows, timing/DST, organization isolation, signed JWTs, viewer permissions, concurrent edits, append-only audit records, baseline/duplicate-alert behavior, delivery retries/idempotency, snapshots and malformed/oversized requests. Browser checks cover saving trips, assignments/notes, copilot citations, simulator comparisons, map playback, examples and responsive layouts. Test-only injected failures and delivery assertions are not production mocked responses.
