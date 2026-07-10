# GaugeLab — calibration tracking for the instrument lab

We are a six-person instrument lab responsible for roughly two hundred gauges,
meters, and sensors spread across three buildings. Today the calibration
schedule lives in a shared spreadsheet that only one person really understands.
We want one small web app — one deployable, running on a lab PC — that answers
three questions at any moment: **what is overdue, what is due soon, and what
did we last do to this instrument?**

## Requirements

1. **Instrument registry.** Every instrument carries an asset tag, a name, a
   category (pressure, temperature, electrical, or dimensional), a location,
   a calibration interval in months, and an in-service / out-of-service flag.
   We add a few instruments a month and we move them between rooms all the
   time, so creating and editing must be quick forms with validation: asset
   tag is required and must be unique; the interval must be between 1 and 60
   months.

2. **Calibration log.** Each instrument accumulates dated calibration entries:
   the date performed, the technician's initials, a result — pass, adjusted,
   or fail — and a short note. Logging a calibration sets the instrument's
   next-due date to the performed date plus its interval. A failed calibration
   should also let the tech take the instrument out of service in the same
   motion.

3. **Due-date visibility.** The landing page must answer at a glance: how many
   instruments are overdue, how many come due in the next 30 days, how many
   are in service, and how many are out. Below the numbers, show the actual
   overdue and due-soon instruments with days overdue / days remaining,
   worst first, and let us jump straight to any of them.

4. **Find things fast.** The instruments page needs text search over asset tag
   and name, filters for category, status, and due state (overdue / due soon /
   current), and sorting by next-due date. Two hundred rows must stay
   responsive and readable.

5. **It keeps its own records.** Data lives on the server in a JSON file next
   to the app — an app restart must not lose anything. The frontend talks to
   the server through a small JSON API. Seed the app with about two dozen
   realistic instruments and a plausible calibration history so every screen
   is populated the first time we open it.

6. **One deployable.** `npm run build` followed by `npm start` serves the
   whole thing — UI, API, and data — on one local port. `npm run typecheck`
   and `npm run build` must pass.

7. **Lab-floor legibility.** Dark interface. Overdue must be unmissable and
   must say so in text, not color alone. Everything operable by keyboard.
   A technician reads this from a laptop cart a meter away, so status, tags,
   and dates need to be big and unambiguous. Anything loading from the API
   needs visible loading, empty, and error states — the lab Wi-Fi is not our
   proudest asset.
