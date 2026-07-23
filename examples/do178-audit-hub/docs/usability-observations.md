# Audit Hub usability observations

This is a working observation log. The completion report will consolidate
these findings, remove duplicates, rank them, and connect each recommendation
to verified workflows.

## Engineering UI Kit workflow

- **Completed projects are not discoverable.** Opening a completed handoff
  started a blank Build form instead of reopening the completed Test preview.
  A human cannot inspect the delivered product without changing persisted run
  state. The project list needs an explicit **Open result** action and
  separate **Start new handoff** action.
- **“Continue” is ambiguous.** It can mean resume an unfinished run, create a
  new run, or open a result. Labels should state the destination and preserve
  completed-run history.
- **Preview port drift is invisible.** The project was configured for `4183`
  while the application served `4182`; Test remained on “Starting the app”
  without a timely, actionable diagnosis. The preview should show probe
  attempts, detected listening ports, and a one-click correction.
- **Build/Test status obscures product maturity.** A polished frontend inside
  Test looked like a completed application even though its connection dialog
  explicitly had no adapters. Handoffs should display capability coverage:
  UI, contracts, domain operations, adapters, persistence, and end-to-end
  verification.

## Audit Hub product

- **Frontend-only status was too easy to miss.** A “Connect real project”
  action opened a configuration preview rather than a working connection.
  Until integration is available, primary actions should not imply a working
  production path.
- **Sample fidelity masks integration gaps.** Rich deterministic data makes
  the UI convincing, but users need a persistent, glanceable indicator of
  which data came from a live adapter, a normalized sidecar, or the synthetic
  sample.
- **Architecture provenance was split across projects.** The UI and
  Capabilities definition appeared as two projects with similar names and no
  visible relationship. They are now consolidated in one implementation
  tree; the product should expose its capability/adapter health in Settings.
- **Connecting a project required typing an absolute path.** This is precise
  but slow and error-prone for a human. The desktop product should offer a
  native folder picker, show the selected controlled root, and retain a
  pasteable path field for expert use.
- **Sample context leaked into a live project.** The first connected snapshot
  changed the header but left AeroNav names, fixed `2.3.0`/`2.4.0` controls,
  and sample-specific narrative in the working surface. The reusable product
  now separates data-driven connected-project subviews from the specialized
  sample views and derives baseline controls from the snapshot.
- **Initial hydration flashed convincing sample data.** A returning real
  project briefly showed the sample while the backend selection completed.
  This can make a reviewer question which evidence they are seeing. The main
  surface now shows an explicit workspace-loading state until identity and
  snapshot selection are known.
- **An existing snapshot did not gain a newly derived trace chain until
  refresh.** Schema or projection upgrades need an explicit migration or
  “refresh recommended” banner so users do not mistake an old projection for
  missing source traceability.
- **Refresh counts mixed evidence and assurance outputs.** The review adapter
  produced two reviews but displayed “0 records” because only evidence rows
  were counted. Source status should name and count each output type, or use a
  clearly defined combined “normalized outputs” count.
- **Review date defaulted to a fixed sample date.** A live review could be
  recorded with an obsolete date by accident. It now defaults to the user's
  current date while remaining editable.
- **The package builder defaulted to only Requirements and Verification.**
  That is convenient for a narrow audit but risky for a button labeled
  “Build audit package.” It now begins with the full lifecycle selected so
  exclusions are deliberate.
- **Package completion exposed a filesystem path but no download action.**
  The archive was real and hashed, yet retrieving it still required leaving
  the workflow. A first-class verified download/open action should sit beside
  the archive hash.
- **Package timestamps disagreed across the completion dialog and register.**
  One used snapshot time and one used wall-clock persistence time. The package
  register should use the canonical manifest timestamp everywhere.
- **Loading controls still showed sample-derived values.** The main surface
  was masked during workspace selection, but the baseline, comparison, and
  alert controls briefly exposed sample state. They now show neutral loading
  labels and disable actions until the selected snapshot is known.
- **“Available” adapters implied installed prerequisites.** The connection
  dialog initially called every supported source adapter “Available” even
  when licensed MATLAB was absent. The table now says **Supported**; a future
  preflight should report actual local readiness separately.
- **DO-331 and the objective profile looked configurable but were not fully
  connected.** DO-331 was initially hard-coded and the objective-profile path
  was presentation-only. Both now participate in workspace configuration and
  objective evidence publication.
- **Imported reviews appeared in the phase of their file location.** Humans
  expect a review to appear with its reviewed subject. Review phase now
  projects from the linked canonical evidence record.
- **Trace completeness overwhelmed the task.** Opening the top-level sample
  requirement immediately rendered more than fifty transitive nodes. The
  inspector now leads with the representative end-to-end path (or direct
  neighbors) and offers the full bounded impact graph on demand.
- **The findings rail squeezed important evidence columns.** On common laptop
  widths, review, trace, and action columns disappeared behind hard-to-notice
  horizontal scrolling. The rail now stacks below the explorer below
  1800 px, and remaining horizontal tables use a visible scrollbar.
- **Package scope counts did not match the completed manifest.** The full
  sample package promised 45 reviews but exported 40 because reviews of CM and
  certification records outside the canonical evidence array were dropped.
  Package scope now carries lifecycle phases explicitly; the builder and ZIP
  both report 508 evidence, 12 findings, and 45 reviews.
- **Reset removed package records but left generated archives on disk.** The
  sample reset now removes its validated generated ZIP files as well as the
  sandbox records, while leaving authoritative sample evidence untouched.
- **A developer-only state control appeared in production.** The sample menu
  exposed loading/error demo controls, making the product feel unfinished.
  The control is now compiled into development builds only.
- **Header controls could crush the product name to “DO”.** At 1280 px the
  dense global actions won the flex layout. Product identity now has priority
  and the controls move as a group to a second row when needed.
- **Positive: the sample creates an immediate, credible first success.** A
  first-time user can see readiness, open work, and an eight-record evidence
  chain without configuration or network access. The persistent sample badge
  and export watermark prevent that convenience from becoming deceptive.
- **Positive: assurance workflows explain why an action is blocked.** The
  closure-ready finding makes reverification evidence and an independent
  verifier visible before the transition. This turns a rejection into a clear
  next action rather than a generic error.
- **Positive: package completion provides satisfying closure.** A stable
  package ID, exact counts, visible SHA-256 hash, and immediate ZIP download
  make the end of the workflow concrete and verifiable.
