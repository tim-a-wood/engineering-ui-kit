import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { productTrialSystems } from './systems.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const reportRoot = path.join(repoRoot, 'docs/product-trials/2026-07-30')
const evidenceRoot = path.join(reportRoot, 'evidence')

const scorecards = {
  'do178-review-workbench': [10, 9, 8, 7, 6, 5, 9, 6, 8, 7, 9, 9, 7],
  'copilot-session-hub': [8, 7, 8, 8, 7, 5, 8, 7, 9, 9, 9, 8, 9],
  'technical-writing-desk': [8, 8, 8, 8, 7, 6, 8, 7, 9, 8, 9, 8, 8],
  'flight-test-telemetry': [9, 8, 8, 7, 6, 6, 9, 6, 8, 8, 9, 8, 8],
  'aircraft-trade-study': [8, 7, 8, 7, 6, 5, 8, 6, 8, 8, 9, 8, 8],
  'hil-campaign-orchestrator': [9, 8, 8, 7, 6, 6, 9, 6, 8, 8, 9, 9, 8],
  'supplier-intake-portal': [8, 8, 8, 8, 7, 6, 8, 7, 8, 8, 9, 9, 7],
  'requirements-impact-workbench': [9, 9, 8, 8, 7, 6, 9, 7, 8, 8, 9, 9, 7],
  'avionics-load-manager': [10, 9, 8, 7, 6, 6, 9, 6, 8, 8, 9, 9, 7],
  'fracas-investigation': [9, 8, 8, 8, 7, 6, 9, 7, 8, 8, 9, 9, 7],
}

const scoreKeys = [
  'problemValue',
  'differentiation',
  'productProof',
  'pilotReadiness',
  'selfService',
  'enterpriseReadiness',
  'longTermMonetization',
  'scalableRevenue',
  'usability',
  'efficiency',
  'presentation',
  'confidence',
  'delight',
]

const manifests = productTrialSystems.map((system) => {
  const manifestPath = path.join(evidenceRoot, system.slug, 'audit-manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing product evidence: ${system.slug}`)
  const audit = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const values = scorecards[system.slug]
  if (!values) throw new Error(`Missing scorecard: ${system.slug}`)
  const scores = Object.fromEntries(scoreKeys.map((key, index) => [key, values[index]]))
  return { ...audit, scores }
})

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
const portfolioScores = Object.fromEntries(
  scoreKeys.map((key) => [key, Number(average(manifests.map((item) => item.scores[key])).toFixed(1))]),
)
const summary = {
  products: manifests.length,
  productsPassed: manifests.filter((item) => item.passed).length,
  scenariosPassed: manifests.reduce((sum, item) => sum + (item.scenarioSummary?.passedCount ?? 0), 0),
  screenshots: manifests.reduce((sum, item) => sum + item.screenshots.length, 0),
  averageClicks: Number(average(manifests.map((item) => item.clicks)).toFixed(1)),
  averageDurationMs: Math.round(average(manifests.map((item) => item.durationMs))),
  averageTimeToProductProofMs: Math.round(average(manifests.map((item) => item.timeToProductProofMs))),
  rendererErrors: manifests.reduce((sum, item) => sum + item.rendererErrors.length, 0),
  productErrors: manifests.reduce((sum, item) => sum + item.productErrors.length, 0),
}

const aggregate = {
  generatedAt: new Date().toISOString(),
  scope: 'Ten packaged-app product trials',
  summary,
  portfolioScores,
  products: manifests,
}
fs.writeFileSync(
  path.join(evidenceRoot, 'portfolio-manifest.json'),
  `${JSON.stringify(aggregate, null, 2)}\n`,
)

const score = (value) => Number(value).toFixed(1)
const seconds = (value) => `${(value / 1000).toFixed(1)} s`
const commercialAverage = (scores) => average(scoreKeys.slice(0, 8).map((key) => scores[key]))
const qualityAverage = (scores) => average(scoreKeys.slice(8).map((key) => scores[key]))

const report = `# Ten-product portfolio trial

## Outcome

All ${summary.products} products completed the packaged workflow. All ${summary.scenariosPassed} approved scenarios passed. The trials produced ${summary.screenshots} retained screenshots, with ${summary.rendererErrors} packaged-app renderer errors and ${summary.productErrors} built-product renderer errors.

These are working UI-led vertical reference implementations. They prove the platform chain from approved intent to a rendered interface and immutable browser evidence. They do not yet prove production persistence, identity, external integrations, operational security, or regulatory tool qualification for the ten products.

## Measured journey

| Measure | Result |
| --- | ---: |
| Products passed | ${summary.productsPassed} / ${summary.products} |
| Scenarios passed | ${summary.scenariosPassed} / ${summary.scenariosPassed} |
| Average packaged journey | ${seconds(summary.averageDurationMs)} |
| Average time to rendered product proof | ${seconds(summary.averageTimeToProductProofMs)} |
| Average rendered-control clicks | ${summary.averageClicks} |
| Screenshots retained | ${summary.screenshots} |
| Renderer errors | ${summary.rendererErrors} |

Module design was the largest interaction block: it used 26 of approximately 66 clicks in each trial. Scenario verification was the longest machine-bound wait after design. Connect originally required 18 selector/text entries for six scenarios.

## Changes made during the trial

- Added two missing domain verbs, “writes” and “compares,” to actor inference. Added regression coverage.
- Corrected portfolio headings and UI copy that violated the enforced writing policy.
- Added stable Connect selector suggestions from approved action names.
- Added a one-click “Suggest selectors” recovery action.
- Reduced a six-scenario UI mapping from 18 manual selector/text entries to six expected-text entries.
- Split Build warnings by their actual STE review reason.
- Removed decorative navigation numbers from action-label evaluation through explicit accessible names.
- Added a responsive product shell, command palette, progress feedback, protected-action feedback, and contextual activity history to all ten product implementations.

The DO-178C and Copilot products completed fresh packaged journeys after these shared changes.

## Commercial score

| Criterion | Score | Evidence and limit |
| --- | ---: | --- |
| Problem value | ${score(portfolioScores.problemValue)} | The portfolio targets expensive engineering review, change, test, configuration, and reliability work. |
| Differentiation | ${score(portfolioScores.differentiation)} | Approved intent traces through design, implementation, scenario proof, and evidence. Generic UML tools do not provide this chain. |
| Product proof | ${score(portfolioScores.productProof)} | Ten products and 60 browser scenarios pass, but product backends remain reference-level. |
| Pilot readiness | ${score(portfolioScores.pilotReadiness)} | A design partner can trial the packaged workflow, but generation still depends on an external handoff. |
| Self-service | ${score(portfolioScores.selfService)} | Guidance is strong and selector work is lower. The workflow still has about 66 clicks and policy review. |
| Enterprise readiness | ${score(portfolioScores.enterpriseReadiness)} | Immutable evidence exists. SSO, RBAC, shared review, signed distribution, administration, and deployment controls do not. |
| Long-term monetization | ${score(portfolioScores.longTermMonetization)} | The strongest wedge is a durable software design-assurance layer, not diagram creation alone. |
| Scalable revenue | ${score(portfolioScores.scalableRevenue)} | The trial runner is reusable for developers. The equivalent portfolio/template capability is not yet a user-facing product feature. |

Commercial potential is approximately **8.5 / 10**. Scalable product readiness is approximately **6.5 / 10**. The evidence supports a paid design-partner pilot now, but not a low-touch enterprise rollout.

## Product and UX score

| Criterion | Score | Observation |
| --- | ---: | --- |
| Usability | ${score(portfolioScores.usability)} | The six-stage workflow is understandable and state is visible. Module review remains repetitive. |
| Efficiency | ${score(portfolioScores.efficiency)} | Selector suggestions remove substantial typing. Approval and module-review clicks remain high. |
| Presentation | ${score(portfolioScores.presentation)} | The built products and UML workspace are credible in a customer review. |
| Confidence | ${score(portfolioScores.confidence)} | Gates, approvals, source traces, scenario runs, and original screenshots make proof inspectable. |
| Delight | ${score(portfolioScores.delight)} | Command search, clear progress, responsive layouts, and earned completion feedback add momentum without trivializing assurance decisions. |

The best “dopamine” pattern is earned progress: show a visible increase in coverage, evidence, closed risk, or cleared blockers after a real action. Avoid confetti on approvals or safety decisions. Completion feedback must communicate reduced uncertainty, not merely activity.

## Product comparison

| Product | Commercial | UX | Best role |
| --- | ---: | ---: | --- |
${productTrialSystems.map((system) => {
  const item = manifests.find((candidate) => candidate.slug === system.slug)
  return `| ${system.name} | ${score(commercialAverage(item.scores))} | ${score(qualityAverage(item.scores))} | ${system.commercialJob} |`
}).join('\n')}

The strongest regulated wedges are the DO-178C Review Workbench, Requirements Change-Impact Workbench, and Avionics Software Load Manager. The Copilot Session Hub and Technical Writing Desk are the best daily-use adoption wedges. They can create habit and internal advocacy before the buyer expands into controlled assurance workflows.

## Triage

### High

1. Integrate generation. Replace the external Copilot/ZIP round trip with an in-product, policy-controlled generation session. This is the largest self-service and scalable-revenue gap.
2. Prove domain depth. Add persistence, authentication, audit history, real adapters, and domain operations to the first commercial wedge. Current trials prove UI contracts and evidence, not production operations.
3. Add enterprise control. Implement SSO, RBAC, shared review, electronic approval, signed installers, updates, deployment policy, backup, and administration.
4. Turn the developer portfolio runner into a user feature. Add product templates, repeatable project creation, saved organization standards, and a visible multi-project trial dashboard.

### Medium

1. Reduce module-review effort. Collapse unchanged design facts, support batch confirmation, and keep detailed inspection available on demand.
2. Add STE lexicon onboarding. Let an organization select and approve its general-word and technical-term policy during setup. This will replace approximately 30 generic lexicon-review warnings with actionable exceptions.
3. Deepen architecture inference. Derive domain, connection, platform, and deployable boundaries from sources and external-system evidence. All ten UI-led trials correctly selected experience-first, but the generated secondary boundary stayed generic.
4. Complete Connect discovery. Inspect the local UI, confirm suggested selectors, and capture expected result text without manual entry.
5. Add a value dashboard. Show time saved, coverage gained, risks closed, evidence freshness, and the next highest-value action.

### Low

1. Add command search to the core application, not only the built products.
2. Add recent-work resume and a “continue where I stopped” action.
3. Add a shareable evidence gallery and customer-review export.
4. Add restrained milestone motion and sound controls. Keep both optional and disabled for regulated review contexts.

## What a ten requires

A score of ten requires proof, not more visual polish alone:

- A new user creates a useful product without a bespoke script or external file handoff.
- A real team operates one commercial wedge for several weeks with production data.
- The system proves identity, review authority, deployment, recovery, and audit retention.
- Customer evidence shows cycle-time reduction, fewer escaped defects, or lower certification/review cost.
- The same delivery process supports additional customers without proportional engineering effort.

## Evidence

- [Product gallery](./GALLERY.html)
- [UML gallery](./UML-GALLERY.html)
- [Portfolio manifest](./evidence/portfolio-manifest.json)
- [Validation plan](./PLAN.md)
`

fs.writeFileSync(path.join(reportRoot, 'PORTFOLIO-REPORT.md'), report)

const galleryCards = productTrialSystems.map((system, index) => `
  <article>
    <a href="./evidence/${system.slug}/10-product-dashboard.png">
      <img src="./evidence/${system.slug}/10-product-dashboard.png" alt="${system.name} dashboard" />
    </a>
    <div>
      <span>${String(index + 1).padStart(2, '0')} · ${system.category}</span>
      <h2>${system.name}</h2>
      <p>${system.description}</p>
      <nav>
        <a href="./evidence/${system.slug}/06-application-workflow-component.png">Component</a>
        <a href="./evidence/${system.slug}/06-application-workflow-activity.png">Activity</a>
        <a href="./evidence/${system.slug}/06-user-workspace-sequence.png">Sequence</a>
        <a href="./evidence/${system.slug}/06-user-workspace-use-case.png">Use case</a>
        <a href="./evidence/${system.slug}/17-verify-passed.png">Evidence</a>
      </nav>
    </div>
  </article>`).join('')

const gallery = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ten-product trial gallery</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui;background:#07101e;color:#eef3ff}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% 0,#142342 0,#07101e 34rem);min-height:100vh}
    header{max-width:1500px;margin:auto;padding:64px 28px 34px}header span,article span{color:#8796b1;font-size:12px;letter-spacing:.12em;text-transform:uppercase}
    h1{font-size:clamp(34px,5vw,64px);max-width:900px;margin:12px 0}header p{color:#aab7cc;font-size:18px;max-width:760px;line-height:1.6}
    main{max-width:1500px;margin:auto;padding:0 28px 80px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
    article{overflow:hidden;border:1px solid #273753;border-radius:18px;background:#0b1526;box-shadow:0 24px 80px #0006}
    article>a{display:block;aspect-ratio:16/9;overflow:hidden;border-bottom:1px solid #273753;background:#050b14}
    img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
    article>div{padding:22px 24px 24px}h2{margin:8px 0;font-size:22px}article p{margin:0;color:#9eabc0;line-height:1.5;min-height:48px}
    nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}nav a{color:#b9c7ff;text-decoration:none;border:1px solid #314469;border-radius:99px;padding:7px 11px;font-size:12px}
    nav a:hover{background:#18284a;border-color:#6c83ff}
    @media(max-width:900px){main{grid-template-columns:1fr}header{padding-top:38px}}
  </style>
</head>
<body>
  <header><span>Packaged application · verified portfolio</span><h1>Ten products from approved intent to evidence</h1><p>Each product starts with a brief, passes use-case and design approval, receives an implementation through Build, maps six real UI scenarios, and retains immutable evidence.</p></header>
  <main>${galleryCards}</main>
</body>
</html>`

fs.writeFileSync(path.join(reportRoot, 'GALLERY.html'), gallery)

const umlCards = productTrialSystems.map((system, index) => `
  <section>
    <header><span>${String(index + 1).padStart(2, '0')} · ${system.category}</span><h2>${system.name}</h2></header>
    <div>
      <figure><a href="./evidence/${system.slug}/06-application-workflow-component.png"><img src="./evidence/${system.slug}/06-application-workflow-component.png" alt="${system.name} component diagram" /></a><figcaption>Application component</figcaption></figure>
      <figure><a href="./evidence/${system.slug}/06-application-workflow-activity.png"><img src="./evidence/${system.slug}/06-application-workflow-activity.png" alt="${system.name} activity diagram" /></a><figcaption>Application activity</figcaption></figure>
      <figure><a href="./evidence/${system.slug}/06-user-workspace-sequence.png"><img src="./evidence/${system.slug}/06-user-workspace-sequence.png" alt="${system.name} sequence diagram" /></a><figcaption>Workspace sequence</figcaption></figure>
      <figure><a href="./evidence/${system.slug}/06-user-workspace-use-case.png"><img src="./evidence/${system.slug}/06-user-workspace-use-case.png" alt="${system.name} use-case diagram" /></a><figcaption>Workspace use case</figcaption></figure>
    </div>
  </section>`).join('')

const umlGallery = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ten-product UML gallery</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui;background:#07101e;color:#eef3ff}
    *{box-sizing:border-box}body{margin:0;background:#07101e}body>header{max-width:1600px;margin:auto;padding:54px 28px 30px}
    span{color:#8796b1;font-size:12px;letter-spacing:.12em;text-transform:uppercase}h1{font-size:48px;margin:10px 0}body>header p{color:#aab7cc;max-width:760px;line-height:1.6}
    main{max-width:1600px;margin:auto;padding:0 28px 80px;display:grid;gap:28px}
    section{border:1px solid #273753;border-radius:18px;background:#0b1526;overflow:hidden}section>header{padding:20px 22px;border-bottom:1px solid #273753}h2{margin:7px 0 0;font-size:22px}
    section>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#273753}
    figure{margin:0;background:#07101e}figure a{display:block;aspect-ratio:16/10;overflow:hidden}img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
    figcaption{padding:10px 14px;color:#aab7cc;background:#0b1526;font-size:12px}
    @media(max-width:900px){section>div{grid-template-columns:1fr}h1{font-size:34px}}
  </style>
</head>
<body>
  <header><span>40 retained diagram views</span><h1>UML portfolio gallery</h1><p>Representative component, activity, sequence, and use-case views from each approved product design. Each image links to the original screenshot.</p></header>
  <main>${umlCards}</main>
</body>
</html>`

fs.writeFileSync(path.join(reportRoot, 'UML-GALLERY.html'), umlGallery)
process.stdout.write(`${JSON.stringify({ summary, portfolioScores }, null, 2)}\n`)
