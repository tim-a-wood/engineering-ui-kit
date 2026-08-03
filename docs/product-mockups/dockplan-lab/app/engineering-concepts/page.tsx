const concepts = [
  {
    id: "scenario-authoring",
    number: "01",
    title: "Scenario Definition + Swept-Path Authoring",
    description: "CAD site geometry, vehicle positioning, editable path grips, calculation interval, body and wheel envelopes, and synchronized articulation/steering/clearance traces.",
    image: "/engineering-concepts/scenario-authoring.png",
  },
  {
    id: "planner-diagnostics",
    number: "02",
    title: "Free-Space Planner Diagnostics",
    description: "Occupancy-grid collision geometry, Hybrid A* state expansion, rejected primitives, refined trajectory, solver parameters, convergence traces, objective terms, and event logs.",
    image: "/engineering-concepts/planner-diagnostics.png",
  },
  {
    id: "validation-review",
    number: "03",
    title: "Trajectory Validation + Release Review",
    description: "Accepted-versus-baseline swept paths, closest-approach evidence, formal collision and feasibility checks, engineering plots, run comparison, and exportable artifacts.",
    image: "/engineering-concepts/validation-review.png",
  },
];

export default function EngineeringConceptsPage() {
  return (
    <main className="concept-gallery engineering-gallery">
      <header className="concept-gallery-header">
        <div>
          <span>DockPlan Workbench / Desktop engineering study</span>
          <h1>Grounded engineering concepts</h1>
        </div>
        <p>Desktop-first, orthographic, and evidence-led. Open each image at full resolution to inspect pane density, measurements, plots, and tool interactions.</p>
      </header>

      <section className="engineering-basis">
        <strong>Real-world workflow basis</strong>
        <p>Vehicle position, heading, steering and articulation setup; swept body, wheel and clearance envelopes; costmap-based free-space planning; and formal collision, boundary and kinematic-feasibility validation.</p>
        <div>
          <a href="https://help.autodesk.com/cloudhelp/2022/ENU/Autodesk-VehicleTracking-Help/files/GUID-27BAAA9F-4B94-49C0-B723-8B7B7B8DC0F2.htm" target="_blank" rel="noreferrer">Vehicle positioning ↗</a>
          <a href="https://help.autodesk.com/cloudhelp/PTB/Autodesk-VehicleTracking-Help/files/GUID-64EBAAD9-40FA-4A22-B9A5-31358B565644.htm" target="_blank" rel="noreferrer">Swept-path constraints ↗</a>
          <a href="https://autowarefoundation.github.io/autoware_universe/main/planning/autoware_freespace_planning_algorithms/index.html" target="_blank" rel="noreferrer">Free-space planning ↗</a>
          <a href="https://commonroad.in.tum.de/tools/drivability-checker" target="_blank" rel="noreferrer">Drivability validation ↗</a>
        </div>
      </section>

      <nav className="concept-jump" aria-label="Engineering concept renders">
        {concepts.map((concept) => <a key={concept.id} href={`#${concept.id}`}>{concept.number} {concept.title}</a>)}
      </nav>

      <div className="concept-list">
        {concepts.map((concept) => (
          <article className="concept-item" id={concept.id} key={concept.id}>
            <div className="concept-copy">
              <span>{concept.number}</span>
              <div><h2>{concept.title}</h2><p>{concept.description}</p></div>
              <a href={concept.image} target="_blank" rel="noreferrer">Open full resolution ↗</a>
            </div>
            <a className="concept-image-link" href={concept.image} target="_blank" rel="noreferrer" aria-label={`Open ${concept.title} render at full resolution`}>
              <img src={concept.image} alt={`${concept.title} desktop engineering concept render`} />
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}
