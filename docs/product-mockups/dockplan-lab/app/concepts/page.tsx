const concepts = [
  {
    id: "scenario",
    number: "01",
    title: "Scenario",
    description: "The manoeuvre owns the screen. Playback and three essential measurements remain visible without shrinking the yard.",
    image: "/concepts/scenario.png",
  },
  {
    id: "optimizer",
    number: "02",
    title: "Search + Optimizer",
    description: "Search expansion and the refined trajectory stay spatial. Solver evidence is reduced to one convergence trace and four KPIs.",
    image: "/concepts/optimizer.png",
  },
  {
    id: "validation",
    number: "03",
    title: "Validation Review",
    description: "The accepted and rejected paths remain directly comparable, with release evidence presented as a readable bottom sheet.",
    image: "/concepts/validation.png",
  },
];

export default function ConceptsPage() {
  return (
    <main className="concept-gallery">
      <header className="concept-gallery-header">
        <div>
          <span>DockPlan Lab / Mobile study</span>
          <h1>Full-scale concept renders</h1>
        </div>
        <p>Tap any render to open the original image, then pinch to inspect it at full resolution.</p>
      </header>

      <nav className="concept-jump" aria-label="Concept renders">
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
              <img src={concept.image} alt={`${concept.title} mobile concept render for DockPlan Lab`} />
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}
