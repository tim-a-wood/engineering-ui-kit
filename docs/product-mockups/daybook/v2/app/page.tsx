"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = {
  name: string;
  minutes: number;
  children: string;
  adult: string;
  notice: string;
};

type Lesson = {
  id: string;
  day: string;
  date: string;
  time: string;
  colour: string;
  kind: string;
  title: string;
  group: string;
  intention: string;
  threads: string[];
  phases: Phase[];
  resources: string[];
  setup: string;
  adults: { person: string; role: string }[];
  note: string;
};

const lessons: Lesson[] = [
  {
    id: "five-hide",
    day: "Monday",
    date: "12 Oct",
    time: "09:15–09:45",
    colour: "amber",
    kind: "Guided maths",
    title: "How many ways can five hide?",
    group: "Foxes · Reception · 8 children",
    intention: "Children notice that five can be composed in different ways, and explain what they see.",
    threads: ["Mathematics", "Communication & language"],
    phases: [
      {
        name: "Gather",
        minutes: 5,
        children: "Join the carpet circle and meet five wooden owls. Look away while some hide beneath a cloth.",
        adult: "Keep the whole visible before hiding a part. Ask: ‘What can you see? What must be hiding?’",
        notice: "Who counts all five again? Who reasons from the visible part?",
      },
      {
        name: "Explore",
        minutes: 18,
        children: "Work in pairs with five counters and two nests. Find a split, then challenge a partner to name the hidden part.",
        adult: "Model 4 and 1 once, then step back. Invite children to record a split with marks, objects or numerals.",
        notice: "Language such as ‘three and two make five’; systematic ways of finding combinations.",
      },
      {
        name: "Bring it together",
        minutes: 7,
        children: "Share one surprising way to make five and compare it with another pair’s arrangement.",
        adult: "Place examples side by side. Revoice children’s explanations without replacing their words.",
        notice: "Whether children recognise the total stays five when the arrangement changes.",
      },
    ],
    resources: ["5 wooden owls", "Pair trays", "Two cloth nests", "Counters", "Mini clipboards"],
    setup: "Carpet semicircle → two-person tables → share-back rail",
    adults: [
      { person: "Maya", role: "Lead the carpet launch, then observe table 1" },
      { person: "Jon", role: "Sit alongside Noor and Imani; model partner turn-taking" },
    ],
    note: "Yesterday several children counted the hidden set from one. Leave the whole visible for the first two turns.",
  },
  {
    id: "storm-whale",
    day: "Tuesday",
    date: "13 Oct",
    time: "10:20–10:50",
    colour: "blue",
    kind: "Story & talk",
    title: "The storm whale: whose voice can we hear?",
    group: "Whole class · Reception",
    intention: "Children use clues from illustration, gesture and dialogue to infer how a character might feel.",
    threads: ["Literacy", "Communication & language", "PSED"],
    phases: [
      { name: "Tune in", minutes: 6, children: "Listen to a short recording of wind and sea. Describe what the sound makes you picture.", adult: "Gather children’s words on the floor cards. Welcome home-language contributions and gesture.", notice: "Vocabulary for intensity, movement and feeling." },
      { name: "Read and pause", minutes: 17, children: "Study three key spreads, turn and talk, then choose a line of dialogue for Noi.", adult: "Pause before reading the printed text. Ask what in the picture supports each idea.", notice: "Children connecting visual evidence to an inference." },
      { name: "Echo the voices", minutes: 7, children: "Perform one line as Noi, the father or the whale; change pace and volume to show feeling.", adult: "Invite contrasting readings rather than a single ‘right’ performance.", notice: "How vocal choices communicate character." },
    ],
    resources: ["The Storm Whale", "Sea sound clip", "Word floor cards", "Blue story cloth"],
    setup: "Story rug with book on visualiser; voice cards along front edge",
    adults: [{ person: "Maya", role: "Read and facilitate talk partners" }, { person: "Jon", role: "Scribe children’s exact phrases on floor cards" }],
    note: "Keep the book visible after the session so children can revisit the spreads in provision.",
  },
  {
    id: "bridge-builders",
    day: "Wednesday",
    date: "14 Oct",
    time: "13:20–14:05",
    colour: "green",
    kind: "Outdoor inquiry",
    title: "Bridge builders: can the cart cross?",
    group: "Garden workshop · Mixed group",
    intention: "Children test, adapt and explain structures that span a gap and carry a moving load.",
    threads: ["Understanding the world", "Physical development", "EAD"],
    phases: [
      { name: "Meet the problem", minutes: 7, children: "Find the blocked cart route and inspect the 60 cm ‘stream’ between two crates.", adult: "Define the constraint: the bridge cannot touch the ground between the banks.", notice: "Children identifying span, support and load." },
      { name: "Build, test, change", minutes: 30, children: "Choose loose parts, make a bridge, roll the weighted cart across and revise the design.", adult: "Photograph versions only when a child says the design has changed. Ask what changed and why.", notice: "Prediction, fair testing, collaboration and response to failure." },
      { name: "Site meeting", minutes: 8, children: "Tour two bridges and leave a peg beside a feature that made one stronger.", adult: "Help builders explain a decision using the actual materials.", notice: "Use of evidence from the load test." },
    ],
    resources: ["Two low crates", "Planks and gutters", "Weighted cart", "Clamps", "Marker pegs"],
    setup: "Two build bays outdoors; taped 60 cm gap; materials sorted by length",
    adults: [{ person: "Jon", role: "Safety and tool support at build bay" }, { person: "Maya", role: "Observe design changes and capture children’s explanations" }],
    note: "Check plank edges and clamp travel before children arrive. Keep a dry indoor version ready if wind exceeds the setting limit.",
  },
  {
    id: "sound-hunt",
    day: "Thursday",
    date: "15 Oct",
    time: "09:05–09:25",
    colour: "rose",
    kind: "Phonics",
    title: "Sound detectives: /m/ around our room",
    group: "Whole class · Reception",
    intention: "Children hear /m/ at the beginning of spoken words and connect the sound to its grapheme.",
    threads: ["Literacy", "Communication & language"],
    phases: [
      { name: "Hear it", minutes: 4, children: "Join in with a short mouth movement rhyme and feel the humming sound.", adult: "Model pure /m/ without adding ‘uh’. Make the mouth shape visible.", notice: "Children sustaining and discriminating the target sound." },
      { name: "Hunt and sort", minutes: 11, children: "Find picture tokens around the room and decide whether each begins with /m/.", adult: "Say each pictured word naturally before stretching only its first sound.", notice: "Listening rather than guessing from the image category." },
      { name: "Map it", minutes: 5, children: "Trace m in the air, on a partner’s back, then once on a large writing strip.", adult: "Use the agreed formation language and watch starting points.", notice: "Sound–grapheme connection and movement pattern." },
    ],
    resources: ["Picture tokens", "Two sorting hoops", "Large writing strips", "Chunky pencils"],
    setup: "Tokens at child height; hoops on carpet; writing strips at tables",
    adults: [{ person: "Maya", role: "Lead oral blending and formation" }, { person: "Jon", role: "Support the room hunt; note confusions" }],
    note: "Do not display the grapheme until after the first listening sort.",
  },
  {
    id: "market",
    day: "Friday",
    date: "16 Oct",
    time: "All morning",
    colour: "purple",
    kind: "Continuous provision",
    title: "The autumn market",
    group: "Open provision · Nursery & Reception",
    intention: "Children develop shared narratives, purposeful mark-making and comparison through a familiar market context.",
    threads: ["PSED", "Literacy", "Mathematics", "EAD"],
    phases: [
      { name: "Invitation", minutes: 8, children: "Help open the market: decide what needs a label, a price and a place.", adult: "Offer the real objects first. Introduce only the minimum props needed to start play.", notice: "Children negotiating roles and giving marks a purpose." },
      { name: "Sustain the play", minutes: 35, children: "Buy, sell, sort, wrap, weigh and restock using their own play ideas.", adult: "Join briefly in role when play needs a new problem: a missing order, an uneven balance, a queue.", notice: "Counting with one-to-one correspondence; language for comparison; collaborative storylines." },
      { name: "Revisit", minutes: 7, children: "Choose one item the market needs tomorrow and leave a plan for the next group.", adult: "Photograph the plan in place; capture the child’s explanation verbatim.", notice: "Reflection and continuity across provision sessions." },
    ],
    resources: ["Baskets and produce", "Balance scales", "Paper bags", "Blank labels", "Clipboards"],
    setup: "Role-play corner linked to writing shelf and maths measure trolley",
    adults: [{ person: "Maya", role: "Observe role negotiation; join only to extend play" }, { person: "Jon", role: "Support weighing and counting at the stall" }],
    note: "Add the children’s own signs from Thursday. Avoid pre-printing price tags.",
  },
];

const navigation = ["Week book", "Plans", "Classroom", "Resources", "Reflections"];

type QuickNote = { stamp: string; text: string };

export default function Home() {
  const [section, setSection] = useState<(typeof navigation)[number]>("Week book");
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const [view, setView] = useState<"plan" | "room" | "print">("plan");
  const [teachingOpen, setTeachingOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(1);
  const [ready, setReady] = useState<string[]>(["5 wooden owls", "Pair trays"]);
  const [toast, setToast] = useState("");
  const [viewerScale, setViewerScale] = useState(1);
  const [mobileViewer, setMobileViewer] = useState(false);
  const [quickNotes, setQuickNotes] = useState<Record<string, QuickNote[]>>({});
  const [reflectionFocus, setReflectionFocus] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const lesson = useMemo(() => lessons.find((item) => item.id === lessonId) ?? lessons[0], [lessonId]);
  const lessonSampleIndex = Math.max(0, lessons.findIndex((item) => item.id === lesson.id));

  useEffect(() => {
    const fit = () => {
      const compact = window.innerWidth < 900;
      setMobileViewer(compact);
      if (compact) setViewerScale(Math.max(0.28, Math.min(0.72, (window.innerWidth - 20) / 1280)));
      else setViewerScale(1);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const chooseLesson = (id: string) => {
    setSection("Week book");
    setTeachingOpen(false);
    setLessonId(id);
    setSelectedPhase(1);
    setReady([]);
    setView("plan");
  };

  const toggleReady = (item: string) => {
    setReady((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  };

  const addQuickNote = (id: string, note: QuickNote) => {
    setQuickNotes((current) => ({ ...current, [id]: [...(current[id] ?? []), note] }));
  };

  const finishTeaching = () => {
    setTeachingOpen(false);
    setReflectionFocus(lesson.id);
    setSection("Reflections");
    showToast("Lesson reflection opened with this plan attached.");
  };

  const phase = lesson.phases[selectedPhase] ?? lesson.phases[0];
  const scaledHeight = mobileViewer ? 830 * viewerScale : undefined;

  return (
    <main className="wonderroom-site">
      {mobileViewer && (
        <div className="phone-viewer-bar" aria-label="Desktop view controls">
          <div><strong>Desktop view</strong><span>Drag to move around</span></div>
          <div className="phone-viewer-actions">
            <button onClick={() => setViewerScale(Math.max(0.28, viewerScale - 0.08))} aria-label="Zoom out">−</button>
            <button onClick={() => setViewerScale(Math.max(0.28, Math.min(0.72, (window.innerWidth - 20) / 1280)))}>Fit</button>
            <button onClick={() => setViewerScale(Math.min(1, viewerScale + 0.08))} aria-label="Zoom in">+</button>
          </div>
        </div>
      )}

      <div className={`desktop-viewport ${mobileViewer ? "is-phone" : ""}`} style={{ height: scaledHeight }}>
        <div
          className="desktop-scaler"
          style={{ transform: `scale(${viewerScale})` }}
          ref={frameRef}
        >
          <section className="planner-shell" aria-label="Daybook teacher planning studio">
            <aside className="left-rail">
              <div className="brand-lockup">
                <span className="daybook-logo" aria-hidden="true"><i /></span>
                <div><strong>Daybook</strong><span>Teacher planning book</span></div>
              </div>

              <div className="rail-room-context"><span>Reception</span><strong>Rowan room</strong><small>Autumn 1 · Week 7</small></div>

              <nav className="primary-nav" aria-label="Main navigation">
                {navigation.map((item, index) => (
                  <button className={section === item ? "active" : ""} key={item} onClick={() => setSection(item)}>
                    <span className="nav-glyph">{["▤", "✎", "⌂", "▧", "✓"][index]}</span>{item}
                  </button>
                ))}
              </nav>

              <div className="rail-section">
                <div className="rail-label"><span>This week</span><button aria-label="Add lesson" onClick={() => showToast("A blank lesson page is ready.")}>＋</button></div>
                {lessons.map((item) => (
                  <button className={`rail-lesson ${item.colour} ${item.id === lesson.id ? "active" : ""}`} key={item.id} onClick={() => chooseLesson(item.id)}>
                    <i className="tab-cloth" aria-hidden="true" />
                    <span className={`lesson-dot ${item.colour}`} />
                    <span><strong>{item.day.slice(0, 3)} · {item.time.split("–")[0]}</strong><small>{item.title}</small></span>
                  </button>
                ))}
              </div>

              <div className="class-card">
                <span className="class-avatar">RF</span>
                <span><strong>Rowan & Foxes</strong><small>32 children · 3 adults</small></span>
                <button aria-label="Class menu">···</button>
              </div>
            </aside>

            <div className="workspace">
              {section === "Week book" ? <>
              <header className="workspace-header">
                <div className="week-heading">
                  <span className="eyebrow">Rowan room · Weekly planning book</span>
                  <div><button aria-label="Previous week">‹</button><h1>12–16 October 2026</h1><button aria-label="Next week">›</button><button className="today-button">Today</button></div>
                </div>
                <div className="header-actions">
                  <span className="saved-state">✓ Saved just now</span>
                  <button className="quiet-button" onClick={() => showToast("Print pack prepared for the staff room printer.")}>Print</button>
                  <button className="share-button" onClick={() => showToast("Shared with the Rowan room team.")}>Share with team</button>
                </div>
              </header>

              <div className="week-strip" aria-label="Week lessons">
                {lessons.map((item) => (
                  <button className={`day-column ${item.colour} ${item.id === lesson.id ? "selected" : ""}`} key={item.id} onClick={() => chooseLesson(item.id)}>
                    <span className="day-date"><strong>{item.day.slice(0, 3)}</strong><small>{item.date.split(" ")[0]}</small></span>
                    <span className={`day-lesson ${item.colour}`}><small>{item.time}</small><strong>{item.kind}</strong></span>
                    <i className="day-dot" aria-hidden="true" />
                  </button>
                ))}
              </div>

              <div className="document-toolbar">
                <div className="view-tabs">
                  <button className={view === "plan" ? "active" : ""} onClick={() => setView("plan")}>Planning sheet</button>
                  <button className={view === "room" ? "active" : ""} onClick={() => setView("room")}>Classroom setup</button>
                  <button className={view === "print" ? "active" : ""} onClick={() => setView("print")}>Resources & print</button>
                </div>
                <button className="teach-button" onClick={() => setTeachingOpen(true)}>▶ Open teaching view</button>
              </div>

              {view === "plan" && (
                <div className="planning-canvas">
                  <article className="planning-page">
                    <div className="lesson-heading-row">
                      <div>
                        <span className={`lesson-type ${lesson.colour}`}>{lesson.kind}</span>
                        <h2 contentEditable suppressContentEditableWarning>{lesson.title}</h2>
                        <p>{lesson.day} · {lesson.time} · {lesson.group}</p>
                      </div>
                      <button className="more-button" aria-label="Lesson options">•••</button>
                    </div>

                    <section className="intention-line">
                      <span>Learning intention</span>
                      <p contentEditable suppressContentEditableWarning>{lesson.intention}</p>
                      <div className="thread-list">{lesson.threads.map((thread) => <span key={thread}>{thread}</span>)}</div>
                    </section>

                    <section className="teaching-flow">
                      <div className="section-title"><div><span>Teaching flow</span><small>{lesson.phases.reduce((total, item) => total + item.minutes, 0)} minutes planned</small></div><button onClick={() => showToast("A new phase was added after the selected step.")}>＋ Add phase</button></div>
                      <div className="phase-list">
                        {lesson.phases.map((item, index) => (
                          <button className={`phase-card ${selectedPhase === index ? "selected" : ""}`} key={item.name} onClick={() => setSelectedPhase(index)}>
                            <span className="phase-number">{index + 1}</span>
                            <span className="phase-copy"><strong>{item.name}</strong><span>{item.children}</span></span>
                            <span className="phase-minutes">{item.minutes}<small>min</small></span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="selected-phase-detail">
                      <div className="detail-heading">
                        <div><span>Step {selectedPhase + 1}</span><h3>{phase.name}</h3></div>
                        <div className="minute-stepper"><button aria-label="Reduce time">−</button><strong>{phase.minutes} min</strong><button aria-label="Increase time">＋</button></div>
                      </div>
                      <div className="detail-columns three-up">
                        <div><span className="detail-label"><i className="d-ico child" aria-hidden="true" />What children are doing</span><p contentEditable suppressContentEditableWarning>{phase.children}</p></div>
                        <div><span className="detail-label"><i className="d-ico speech" aria-hidden="true" />Adult role & language</span><p contentEditable suppressContentEditableWarning>{phase.adult}</p></div>
                        <div className="notice-column"><span className="detail-label"><i className="d-ico eye" aria-hidden="true" />Listen and look for</span><p contentEditable suppressContentEditableWarning>{phase.notice}</p></div>
                      </div>
                    </section>
                  </article>

                  <aside className="lesson-sidebar">
                    <section className="sidebar-block room-plan-block">
                      <div className="sidebar-title"><span>In the room</span><button onClick={() => setView("room")}>Edit setup</button></div>
                      <div className="mini-room illustrated" aria-label="Illustrated classroom layout preview">
                        <svg viewBox="0 0 200 120" role="img" aria-hidden="true">
                          <rect x="1.5" y="1.5" width="197" height="117" rx="5" fill="#f6efdf" stroke="#c9b98f" strokeWidth="2" />
                          <rect x="8" y="8" width="184" height="10" rx="3" fill="#e8ddc2" />
                          <text x="100" y="15.5" textAnchor="middle" fontSize="6.5" fill="#8a7b54" fontFamily="Inter, Arial" letterSpacing="1.4">WINDOWS · GARDEN</text>
                          <ellipse cx="52" cy="52" rx="34" ry="22" fill="#dfe8dc" stroke="#a8bba1" strokeWidth="1.6" strokeDasharray="none" />
                          <text x="52" y="50" textAnchor="middle" fontSize="8" fill="#48604a" fontFamily="Georgia, serif" fontStyle="italic">Carpet</text>
                          <text x="52" y="60" textAnchor="middle" fontSize="5.5" fill="#7c8f7a">launch circle</text>
                          <g fill="#e7cf9f" stroke="#b99b57" strokeWidth="1.4">
                            <rect x="120" y="30" width="34" height="20" rx="4" />
                            <rect x="120" y="70" width="34" height="20" rx="4" />
                          </g>
                          <g fill="#f6efdf" stroke="#b99b57" strokeWidth="1.1">
                            <circle cx="116" cy="34" r="3.4" /><circle cx="116" cy="46" r="3.4" />
                            <circle cx="158" cy="34" r="3.4" /><circle cx="158" cy="46" r="3.4" />
                            <circle cx="116" cy="74" r="3.4" /><circle cx="116" cy="86" r="3.4" />
                            <circle cx="158" cy="74" r="3.4" /><circle cx="158" cy="86" r="3.4" />
                          </g>
                          <text x="137" y="42" textAnchor="middle" fontSize="6" fill="#7a642f" fontFamily="Inter, Arial">Table 1</text>
                          <text x="137" y="82" textAnchor="middle" fontSize="6" fill="#7a642f" fontFamily="Inter, Arial">Table 2</text>
                          <rect x="168" y="26" width="10" height="68" rx="2" fill="#d9c9a4" stroke="#b99b57" strokeWidth="1.2" />
                          <text x="173" y="62" textAnchor="middle" fontSize="5" fill="#7a642f" transform="rotate(90 173 60)">resources</text>
                          <path d="M22 108 a14 14 0 0 1 14 -14" fill="none" stroke="#a09274" strokeWidth="1.4" strokeDasharray="2.5 2" />
                          <text x="18" y="114" fontSize="5.5" fill="#8a7b54">door</text>
                          <path d="M60 66 C 82 84, 96 56, 116 44" fill="none" stroke="#cf9c33" strokeWidth="2.2" strokeDasharray="5 4" strokeLinecap="round" />
                          <path d="M112 48 l5 -4.5 l-6.6 -1.4" fill="none" stroke="#cf9c33" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p>{lesson.setup}</p>
                    </section>

                    <section className="sidebar-block">
                      <div className="sidebar-title"><span>Adults</span><button onClick={() => showToast("Adult deployment copied to the room briefing.")}>Copy brief</button></div>
                      <div className="adult-list">{lesson.adults.map((adult) => <div key={adult.person}><span>{adult.person.slice(0, 1)}</span><p><strong>{adult.person}</strong><small>{adult.role}</small></p></div>)}</div>
                    </section>

                    <section className="sidebar-block">
                      <div className="sidebar-title"><span>Resources</span><small>{ready.length} of {lesson.resources.length} ready</small></div>
                      <div className={`resource-sample-crop sample-${lessonSampleIndex}`}><span>Pack preview</span></div>
                      <div className="ready-meter" aria-hidden="true">
                        <span className="ready-fill" style={{ width: `${(ready.length / lesson.resources.length) * 100}%` }} />
                        <span className="ready-scale">{lesson.resources.map((_, index) => <i key={index}>{index + 1}</i>)}</span>
                      </div>
                      <div className="resource-list">{lesson.resources.map((item) => <button key={item} onClick={() => toggleReady(item)} className={ready.includes(item) ? "ready" : ""}><span>{ready.includes(item) ? "✓" : ""}</span>{item}</button>)}</div>
                    </section>

                    <section className="class-note">
                      <span>From yesterday</span>
                      <p contentEditable suppressContentEditableWarning>{lesson.note}</p>
                    </section>
                  </aside>
                </div>
              )}

              {view === "room" && <RoomSetup lesson={lesson} onReturn={() => setView("plan")} />}
              {view === "print" && <PrintPack lesson={lesson} ready={ready} onReady={toggleReady} onPrint={() => showToast("Four-page lesson pack is ready to print.")} />}
              </> : null}
              {section === "Plans" && <PlansWorkspace onOpenLesson={chooseLesson} onToast={showToast} />}
              {section === "Classroom" && <ClassroomWorkspace onToast={showToast} />}
              {section === "Resources" && <ResourcesWorkspace onToast={showToast} />}
              {section === "Reflections" && <ReflectionsWorkspace onOpenLesson={chooseLesson} onToast={showToast} focusId={reflectionFocus} teachingNotes={quickNotes} />}
            </div>
            {teachingOpen && <TeachingView lesson={lesson} step={selectedPhase} sampleIndex={lessonSampleIndex} onStep={setSelectedPhase} onClose={() => setTeachingOpen(false)} onToast={showToast} onFinish={finishTeaching} notes={quickNotes[lesson.id] ?? []} onAddNote={(note) => addQuickNote(lesson.id, note)} />}
          </section>
        </div>
      </div>

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}

function TeachingView({ lesson, step, sampleIndex, onStep, onClose, onToast, onFinish, notes, onAddNote }: { lesson: Lesson; step: number; sampleIndex: number; onStep: (step: number) => void; onClose: () => void; onToast: ToastFn; onFinish: () => void; notes: { stamp: string; text: string }[]; onAddNote: (note: { stamp: string; text: string }) => void }) {
  const phase = lesson.phases[step] ?? lesson.phases[0];
  const [remaining, setRemaining] = useState(phase.minutes * 60);
  const [running, setRunning] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [roomDisplay, setRoomDisplay] = useState(false);

  useEffect(() => {
    setRemaining(phase.minutes * 60);
    setRunning(false);
  }, [lesson.id, step, phase.minutes]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const interval = window.setInterval(() => setRemaining((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [running, remaining]);

  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  const progress = 1 - remaining / (phase.minutes * 60);
  const moveStep = (next: number) => {
    if (next >= 0 && next < lesson.phases.length) onStep(next);
  };

  return <div className="teaching-overlay" role="dialog" aria-modal="true" aria-label={`Teaching view for ${lesson.title}`}>
    <header className="teaching-topbar">
      <div className="teaching-brand"><span className="daybook-logo" aria-hidden="true"><i /></span><div><strong>Teaching view</strong><small>Daybook · Rowan room</small></div></div>
      <div className="teaching-lesson-title"><span className={`lesson-tab ${lesson.colour}`}>{lesson.kind}</span><div><strong>{lesson.title}</strong><small>{lesson.day} · {lesson.time} · {lesson.group}</small></div></div>
      <div className="teaching-top-actions"><button onClick={() => setRoomDisplay(true)}>▣ Room display</button><button className="end-view" onClick={onClose}>Exit teaching view</button></div>
    </header>

    <div className="teaching-workspace">
      <aside className="teaching-steps">
        <span className="teaching-side-label">Lesson sequence</span>
        {lesson.phases.map((item, index) => <button className={`${index === step ? "current" : ""} ${index < step ? "complete" : ""}`} key={item.name} onClick={() => onStep(index)}><span>{index < step ? "✓" : index + 1}</span><p><strong>{item.name}</strong><small>{item.minutes} minutes</small></p></button>)}
        <div className="teaching-intention"><span>Learning intention</span><p>{lesson.intention}</p></div>
      </aside>

      <main className="teaching-stage">
        <div className="teaching-stage-heading"><div><span>Step {step + 1} of {lesson.phases.length}</span><h1>{phase.name}</h1></div><span className="phase-duration">{phase.minutes} min</span></div>
        <section className="children-doing-card"><span>Children are…</span><p>{phase.children}</p></section>
        <section className="look-listen-card"><span><i>◎</i> Listen and look for</span><p>{phase.notice}</p></section>
        <div className="teaching-progress"><span style={{ width: `${Math.max(3, progress * 100)}%` }} /><i style={{ left: `${Math.min(98, Math.max(1, progress * 100))}%` }} /></div>
        <nav className="teaching-navigation" aria-label="Teaching phase navigation">
          <button disabled={step === 0} onClick={() => moveStep(step - 1)}>← Previous step</button>
          <div><span>{step + 1}</span><small>of {lesson.phases.length}</small></div>
          {step < lesson.phases.length - 1 ? <button className="next-step" onClick={() => moveStep(step + 1)}>Next: {lesson.phases[step + 1].name} →</button> : <button className="finish-lesson" onClick={onFinish}>Finish & reflect →</button>}
        </nav>
      </main>

      <aside className="teaching-support">
        <section className="teaching-timer">
          <div><span>Phase timer</span><small>{running ? "Running" : remaining === 0 ? "Time · a prompt, not a rule" : "Ready"}</small></div>
          <strong>{minutes}<i>:</i>{seconds}</strong>
          <div className="timer-progress"><span style={{ width: `${progress * 100}%` }} /></div>
          <div className="timer-actions"><button onClick={() => { setRunning(false); setRemaining(phase.minutes * 60); }}>Reset</button><button onClick={() => setRemaining((current) => current + 120)}>＋2 min</button><button className="timer-main" onClick={() => { if (remaining === 0) { setRemaining(120); setRunning(true); } else { setRunning((current) => !current); } }}>{running ? "Pause" : remaining === 0 ? "Restart" : "Start timer"}</button></div>
        </section>
        <section className="adult-cue-card"><span>Adult role & language</span><p>{phase.adult}</p><button onClick={() => onToast("Adult prompt enlarged for a quick team glance.")}>Enlarge prompt</button></section>
        <section className="teaching-resources"><div><span>At hand</span><small>{lesson.resources.length} items</small></div><div className={`teaching-resource-image sample-${sampleIndex}`} />{lesson.resources.slice(0, 3).map((item) => <p key={item}><span>✓</span>{item}</p>)}</section>
        {noteOpen ? (
          <div className="quick-note-capture">
            <input
              value={noteDraft}
              autoFocus
              placeholder="What did you see or hear?"
              aria-label="Quick note"
              onChange={(event) => setNoteDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { saveNote(); } if (event.key === "Escape") { setNoteOpen(false); setNoteDraft(""); } }}
            />
            <button onClick={saveNote}>Save</button>
          </div>
        ) : (
          <button className="quick-note" onClick={() => setNoteOpen(true)}>✎ Add a quick note</button>
        )}
        {notes.length > 0 && (
          <div className="quick-note-list">
            {notes.map((note, index) => <p key={index}><b>{note.stamp}</b>{note.text}</p>)}
          </div>
        )}
      </aside>
    </div>

    {roomDisplay && (
      <div className="room-display" role="dialog" aria-label="Room display">
        <span className="room-display-kicker">{lesson.title} · {phase.name}</span>
        <p>{phase.children}</p>
        <footer>
          <small>Only this approved child-facing prompt is shown. No notes or records are visible.</small>
          <button onClick={() => setRoomDisplay(false)}>Exit room display</button>
        </footer>
      </div>
    )}
  </div>;

  function saveNote() {
    const text = noteDraft.trim();
    if (!text) return;
    const used = Math.max(0, phase.minutes * 60 - remaining);
    const mm = Math.floor(used / 60).toString().padStart(2, "0");
    const ss = (used % 60).toString().padStart(2, "0");
    onAddNote({ stamp: `${phase.name} +${mm}:${ss}`, text });
    setNoteDraft("");
    setNoteOpen(false);
    onToast("Quick note captured against this phase.");
  }
}

type ToastFn = (message: string) => void;

const termWeeks = [
  { week: "1", dates: "2–6 Nov", focus: "Stories of light", note: "Build shared language for light, dark and shadow.", plans: [{ label: "Shadow portraits", kind: "Workshop", colour: "blue" }, { label: "Five in the night", kind: "Maths", colour: "amber" }] },
  { week: "2", dates: "9–13 Nov", focus: "Maps and pathways", note: "Represent familiar routes through talk, marks and construction.", plans: [{ label: "Our route to the garden", kind: "Inquiry", colour: "green" }, { label: "Rosie’s Walk", kind: "Story", colour: "blue" }] },
  { week: "3", dates: "16–20 Nov", focus: "Making shelter", note: "Explore materials, joining and protection from weather.", plans: [{ label: "A den for Mouse", kind: "Build", colour: "green" }, { label: "Which roof keeps dry?", kind: "Investigation", colour: "purple" }] },
  { week: "4", dates: "23–27 Nov", focus: "Messages that travel", note: "Give writing, signs and symbols a real social purpose.", plans: [{ label: "Post office opens", kind: "Provision", colour: "rose" }, { label: "The Jolly Postman", kind: "Story", colour: "blue" }] },
  { week: "5", dates: "30 Nov–4 Dec", focus: "Pattern and rhythm", note: "Notice, continue and invent repeating structures.", plans: [{ label: "Pattern procession", kind: "Music", colour: "purple" }, { label: "Wrap the parcels", kind: "Maths", colour: "amber" }] },
  { week: "6", dates: "7–11 Dec", focus: "A gathering", note: "Revisit the term through children’s chosen stories and making.", plans: [{ label: "Our winter museum", kind: "Project", colour: "rose" }, { label: "Shared story circle", kind: "Talk", colour: "blue" }] },
];

function PlansWorkspace({ onOpenLesson, onToast }: { onOpenLesson: (id: string) => void; onToast: ToastFn }) {
  const [mode, setMode] = useState<"map" | "library">("map");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState(0);
  const current = termWeeks[selectedWeek];
  const chosen = current.plans[selectedPlan] ?? current.plans[0];

  return (
    <div className="product-section plans-section">
      <header className="section-header">
        <div><span className="section-kicker">Curriculum planning</span><h1>Plans</h1><p>Reception · Autumn term 2026</p></div>
        <div className="section-header-actions"><button className="section-quiet" onClick={() => onToast("The half-term map is ready to print.")}>Print overview</button><button className="section-primary" onClick={() => onToast("A blank plan has been added to week 2.")}>＋ New plan</button></div>
      </header>
      <div className="section-subnav">
        <div><button className={mode === "map" ? "active" : ""} onClick={() => setMode("map")}>Half-term map</button><button className={mode === "library" ? "active" : ""} onClick={() => setMode("library")}>Plan library</button></div>
        <div className="term-stepper"><button aria-label="Previous half term">‹</button><strong>Autumn 2 · 2 Nov–18 Dec</strong><button aria-label="Next half term">›</button></div>
      </div>

      {mode === "map" ? (
        <div className="plans-body">
          <main className="term-map">
            <section className="term-intent">
              <span>Half-term intention</span>
              <p contentEditable suppressContentEditableWarning>Children use stories, materials and shared projects to represent how people find their way, communicate and make places together.</p>
              <button onClick={() => onToast("Half-term intention is ready to edit.")}>Edit</button>
            </section>
            <div className="term-week-grid">
              {termWeeks.map((item, weekIndex) => (
                <article className={`term-week ${selectedWeek === weekIndex ? "selected" : ""}`} key={item.week}>
                  <button className="term-week-heading" onClick={() => { setSelectedWeek(weekIndex); setSelectedPlan(0); }}><span>Week {item.week}</span><small>{item.dates}</small></button>
                  <h3>{item.focus}</h3>
                  <p>{item.note}</p>
                  {weekIndex === 0 && <span className="carried-tag">↷ 2 carry-forwards from reflections land here</span>}
                  <div className="term-plan-stack">
                    {item.plans.map((plan, planIndex) => <button className={`term-plan-chip ${plan.colour} ${selectedWeek === weekIndex && selectedPlan === planIndex ? "active" : ""}`} key={plan.label} onClick={() => { setSelectedWeek(weekIndex); setSelectedPlan(planIndex); }}><span>{plan.kind}</span><strong>{plan.label}</strong></button>)}
                  </div>
                  <button className="week-add" onClick={() => onToast(`A plan can now be added to week ${item.week}.`)}>＋</button>
                </article>
              ))}
            </div>
            <section className="curriculum-threads">
              <div><span>Thread running through the half term</span><h3>Representing places and journeys</h3></div>
              <div className="thread-path"><span>Talk & story</span><i>→</i><span>Drawing & maps</span><i>→</i><span>Building & testing</span><i>→</i><span>Shared exhibition</span></div>
            </section>
          </main>
          <aside className="plan-peek">
            <span className={`peek-type ${chosen.colour}`}>{chosen.kind}</span>
            <h2>{chosen.label}</h2>
            <p className="peek-date">Week {current.week} · {current.dates}</p>
            <div className="peek-rule" />
            <span className="peek-label">Why this, now?</span>
            <p>{current.note} This plan gives children a concrete problem to revisit across talk, play and guided teaching.</p>
            <span className="peek-label">Connects with</span>
            <div className="peek-links"><button>{current.focus}</button><button>Language across provision</button><button>Room invitation</button></div>
            <div className="plan-state"><span>Ready to develop</span><small>Team can see this plan</small></div>
            <button className="open-plan" onClick={() => onOpenLesson(lessons[Math.min(selectedWeek, lessons.length - 1)].id)}>Open planning sheet →</button>
          </aside>
        </div>
      ) : <PlanLibrary onOpenLesson={onOpenLesson} onToast={onToast} />}
    </div>
  );
}

function PlanLibrary({ onOpenLesson, onToast }: { onOpenLesson: (id: string) => void; onToast: ToastFn }) {
  const [filter, setFilter] = useState("All plans");
  const plans = [
    { title: "How many ways can five hide?", type: "Guided maths", use: "Used this week", colour: "amber", id: "five-hide" },
    { title: "Bridge builders: can the cart cross?", type: "Outdoor inquiry", use: "Used this week", colour: "green", id: "bridge-builders" },
    { title: "The storm whale: whose voice can we hear?", type: "Story & talk", use: "Used this week", colour: "blue", id: "storm-whale" },
    { title: "Story stones for retelling", type: "Small-group talk", use: "Last used 18 Sep", colour: "purple", id: "storm-whale" },
    { title: "Which container holds more?", type: "Provision invitation", use: "Last used 7 Jul", colour: "amber", id: "five-hide" },
    { title: "A home for minibeasts", type: "Outdoor project", use: "Team template", colour: "green", id: "bridge-builders" },
  ];
  return <div className="library-body">
    <div className="library-controls"><div>{["All plans", "My plans", "Team templates", "Favourites"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><button onClick={() => onToast("Plans are ordered by most recently used.")}>Recently used ↓</button></div>
    <div className="library-table"><div className="library-table-head"><span>Plan</span><span>Learning thread</span><span>Last used</span><span /></div>{plans.map((plan) => <button className="library-row" key={plan.title} onClick={() => onOpenLesson(plan.id)}><span className={`library-plan-mark ${plan.colour}`}>{plan.title.slice(0, 1)}</span><span><strong>{plan.title}</strong><small>{plan.type}</small></span><span>Communication · Making</span><span>{plan.use}</span><span>Open →</span></button>)}</div>
  </div>;
}

const roomAreas = [
  { id: "story", label: "Story corner", state: "Ready", intent: "Retell and adapt familiar journeys", invitation: "The Storm Whale, blue cloth, character stones and children’s recorded sea words.", colour: "blue", position: "story-area", linked: "The storm whale" },
  { id: "workshop", label: "Workshop", state: "Refresh", intent: "Join materials to make stable structures", invitation: "Short and long card strips, split pins, tape tabs and bridge photographs.", colour: "green", position: "workshop-area", linked: "Bridge builders" },
  { id: "maths", label: "Maths shelf", state: "Ready", intent: "Compose and partition five", invitation: "Five-frames, wooden owls, two nests and blank representation cards.", colour: "amber", position: "maths-area", linked: "Five can hide" },
  { id: "role", label: "Role play", state: "Developing", intent: "Negotiate roles and use marks purposefully", invitation: "Autumn market baskets, paper bags, balance scales and children’s signs.", colour: "purple", position: "role-area", linked: "Autumn market" },
  { id: "making", label: "Making table", state: "Ready", intent: "Represent movement and sound through materials", invitation: "Charcoal, chalk, tracing paper and clips from the sound walk.", colour: "rose", position: "making-area", linked: "Sound detectives" },
];

function ClassroomWorkspace({ onToast }: { onToast: ToastFn }) {
  const [selected, setSelected] = useState(roomAreas[1].id);
  const [day, setDay] = useState("Today");
  const [checked, setChecked] = useState<string[]>(["Materials at child height", "Adult prompt card placed"]);
  const area = roomAreas.find((item) => item.id === selected) ?? roomAreas[0];
  const checks = ["Materials at child height", "Adult prompt card placed", "Clear route for movement", "Photo of starting state"];
  return <div className="product-section classroom-section">
    <header className="section-header"><div><span className="section-kicker">Environment as the third teacher</span><h1>Classroom</h1><p>Rowan & Foxes · Monday 12 October</p></div><div className="section-header-actions"><button className="section-quiet" onClick={() => onToast("The room briefing has been prepared.")}>Print room brief</button><button className="section-primary" onClick={() => onToast("A new provision area is ready to place.")}>＋ Add area</button></div></header>
    <div className="section-subnav classroom-subnav"><div>{["Today", "This week", "Base layout"].map((item) => <button className={day === item ? "active" : ""} onClick={() => setDay(item)} key={item}>{item}</button>)}</div><span><i /> 4 areas ready · 1 needs a refresh</span></div>
    <div className="classroom-body">
      <main className="classroom-plan">
        <div className="room-plan-topline"><span>Rowan room · 8:40 setup</span><div><button>−</button><button>Fit</button><button>＋</button></div></div>
        <div className="provision-map">
          <div className="map-window">WINDOWS TO GARDEN</div>
          <div className="map-sink">SINK</div>
          <div className="map-door">ENTRY</div>
          <div className="map-carpet">Whole-group carpet<span>clear after 10:30</span></div>
          {roomAreas.map((item) => <button className={`provision-area ${item.position} ${item.colour} ${selected === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelected(item.id)}><span>{item.state}</span><strong>{item.label}</strong><small>{item.intent}</small></button>)}
          <div className="adult-route"><span>M</span><i>08:45</i><b>→</b><span>J</span><i>09:10</i></div>
          <div className="movement-line one" /><div className="movement-line two" />
        </div>
        <div className="room-team-strip"><span>Adult deployment</span><div><b>M</b><p><strong>Maya</strong><small>Welcome families → maths shelf → story group</small></p></div><div><b>J</b><p><strong>Jon</strong><small>Workshop safety → garden build bay</small></p></div><div><b>L</b><p><strong>Leila</strong><small>Role-play observation → snack table</small></p></div></div>
      </main>
      <aside className="area-inspector">
        <div className="area-inspector-head"><span className={`area-colour ${area.colour}`} /><div><small>{area.state}</small><h2>{area.label}</h2></div><button>•••</button></div>
        <span className="inspector-label">Learning intention in this area</span><p className="area-intent" contentEditable suppressContentEditableWarning>{area.intent}</p>
        <span className="inspector-label">Today’s invitation</span><p className="area-invitation" contentEditable suppressContentEditableWarning>{area.invitation}</p>
        <button className="linked-plan">↗ <span><small>Linked plan</small><strong>{area.linked}</strong></span></button>
        <div className="reset-checks"><span className="inspector-label">Before children arrive</span>{checks.map((item) => <button className={checked.includes(item) ? "checked" : ""} key={item} onClick={() => setChecked((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}><span>{checked.includes(item) ? "✓" : ""}</span>{item}</button>)}</div>
        <div className="area-footer"><button onClick={() => onToast(`${area.label} setup copied to tomorrow.`)}>Copy to tomorrow</button><button onClick={() => onToast(`${area.label} marked ready.`)}>Mark ready</button></div>
      </aside>
    </div>
  </div>;
}

const resourcePacks = [
  { title: "Five can hide", kind: "Guided maths", colour: "amber", count: 5, ready: 3, contents: ["5 wooden owls", "Pair trays × 4", "Cloth nests × 8", "Counters", "Mini clipboards"] },
  { title: "The storm whale", kind: "Story & talk", colour: "blue", count: 4, ready: 4, contents: ["The Storm Whale", "Sea sound clip", "Word floor cards", "Blue story cloth"] },
  { title: "Bridge builders", kind: "Outdoor inquiry", colour: "green", count: 5, ready: 2, contents: ["Two low crates", "Planks and gutters", "Weighted cart", "Clamps", "Marker pegs"] },
  { title: "Sound detectives", kind: "Phonics", colour: "rose", count: 4, ready: 4, contents: ["Picture tokens", "Sorting hoops", "Writing strips", "Chunky pencils"] },
  { title: "Autumn market", kind: "Continuous provision", colour: "purple", count: 5, ready: 3, contents: ["Baskets and produce", "Balance scales", "Paper bags", "Blank labels", "Clipboards"] },
];

function ResourcesWorkspace({ onToast }: { onToast: ToastFn }) {
  const [tab, setTab] = useState<"week" | "library" | "queue">("week");
  const [packIndex, setPackIndex] = useState(2);
  const [packed, setPacked] = useState<string[]>(["Two low crates", "Weighted cart"]);
  const pack = resourcePacks[packIndex];
  return <div className="product-section resources-section">
    <header className="section-header"><div><span className="section-kicker">Materials and printables</span><h1>Resources</h1><p>Prepare once, then put the right materials where teaching happens.</p></div><div className="section-header-actions"><button className="section-quiet" onClick={() => setTab("queue")}>Print queue · 6</button><button className="section-primary" onClick={() => onToast("A blank resource pack has been created.")}>＋ New resource pack</button></div></header>
    <div className="section-subnav"><div><button className={tab === "week" ? "active" : ""} onClick={() => setTab("week")}>This week</button><button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>Shared library</button><button className={tab === "queue" ? "active" : ""} onClick={() => setTab("queue")}>Print queue</button></div><div className="resource-filter"><button>All types</button><button>Room: Rowan</button></div></div>
    {tab !== "queue" ? <div className="resources-body">
      <main className="resource-shelf"><div className="shelf-heading"><div><h2>{tab === "week" ? "Ready for this week" : "Shared resource library"}</h2><p>{tab === "week" ? "Five packs linked to the current week book." : "Reusable materials and print masters from your setting."}</p></div><button onClick={() => onToast("Resource packs are now grouped by lesson day.")}>Group by day</button></div>
        <div className="resource-pack-grid">{resourcePacks.map((item, index) => <button className={`resource-pack ${item.colour} ${packIndex === index ? "selected" : ""}`} onClick={() => { setPackIndex(index); setPacked(item.contents.slice(0, item.ready)); }} key={item.title}><div className={`pack-visual sample-${index}`}><span>Open pack</span></div><span className="pack-kind">{item.kind}</span><strong>{item.title}</strong><small>{item.ready} of {item.count} items ready</small><div className="pack-progress"><span style={{ width: `${(item.ready / item.count) * 100}%` }} /></div></button>)}</div>
        <section className="loose-resources"><div><span>Recently returned</span><button>See library →</button></div>{["Large number cards", "Story stones", "Bug viewers", "Long tape measures"].map((item, index) => <button key={item}><span>{["12", "8", "6", "4"][index]}</span><strong>{item}</strong><small>Available in store cupboard</small></button>)}</section>
      </main>
      <aside className="pack-inspector"><div className="pack-inspector-head"><span className={`pack-badge ${pack.colour}`}>{pack.title.slice(0, 1)}</span><div><small>{pack.kind}</small><h2>{pack.title}</h2></div></div><p>Pack for {lessons[packIndex]?.day ?? "Monday"} · Rowan room</p><div className={`inspector-resource-render sample-${packIndex}`}><span>Prepared pack · actual materials</span></div><div className="pack-list-head"><span>Pack checklist</span><small>{packed.length}/{pack.contents.length} ready</small></div><div className="pack-list">{pack.contents.map((item) => <button className={packed.includes(item) ? "packed" : ""} key={item} onClick={() => setPacked((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}><span>{packed.includes(item) ? "✓" : ""}</span>{item}<small>···</small></button>)}</div><div className="pack-printables"><span>Printables</span><div className="printable-render sample-5"><span>Sample pages</span></div><button><b>PDF</b><p><strong>Partner challenge cards</strong><small>2 pages · A5</small></p><i>＋</i></button><button><b>PDF</b><p><strong>Adult prompt card</strong><small>1 page · A6</small></p><i>＋</i></button></div><div className="pack-actions"><button onClick={() => onToast(`${pack.title} labels sent to the print queue.`)}>Print labels</button><button onClick={() => onToast(`${pack.title} marked packed.`)}>Mark pack ready</button></div></aside>
    </div> : <PrintQueue onToast={onToast} />}
  </div>;
}

function PrintQueue({ onToast }: { onToast: ToastFn }) {
  const [selected, setSelected] = useState<string[]>(["Five can hide · adult prompt", "Sound detectives · picture tokens", "Autumn market · blank labels"]);
  const jobs = ["Five can hide · adult prompt", "Five can hide · challenge cards", "Sound detectives · picture tokens", "Bridge builders · test record", "Autumn market · blank labels", "Weekly room briefing"];
  return <div className="print-queue"><main><div className="queue-title"><div><h2>Monday print run</h2><p>6 documents · 13 pages · staff-room printer</p></div><button onClick={() => setSelected(jobs)}>Select all</button></div><div className="print-jobs"><div className="print-job-head"><span /><span>Document</span><span>Format</span><span>Copies</span><span>Source</span></div>{jobs.map((item, index) => <button className={selected.includes(item) ? "selected" : ""} key={item} onClick={() => setSelected((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}><span>{selected.includes(item) ? "✓" : ""}</span><span><strong>{item}</strong><small>Updated today</small></span><span>{index % 2 ? "A5 · colour" : "A4 · mono"}</span><span>{index % 3 === 0 ? "2" : "1"}</span><span>{index < 2 ? "Maths plan" : "Week book"}</span></button>)}</div></main><aside><span className="queue-label">Print summary</span><h2>{selected.length} documents selected</h2><div><span>Pages</span><strong>{selected.length * 2 + 1}</strong></div><div><span>Paper</span><strong>Mostly A4</strong></div><div><span>Destination</span><strong>Staff room · HP 602</strong></div><button onClick={() => onToast(`${selected.length} documents sent to the staff-room printer.`)}>Print selected</button><small>Nothing is printed until you confirm at the device.</small></aside></div>;
}

const reflections = [
  { id: "five-hide", day: "Mon", date: "12", title: "Five can hide", kind: "Guided maths", colour: "amber", note: "Pairs stayed with the hidden-part challenge for longer than expected. Imani began explaining without recounting the whole set; Theo copied her language after watching one turn.", keep: "Keep the two-nest structure and partner reveal.", change: "Use one fewer demonstration. Several children were ready before I handed over.", next: "Offer six to the confident pairs, but retain five for those still recounting.", quote: "‘I don’t need to count those because two are out and it has to be three.’ — Imani" },
  { id: "storm-whale", day: "Tue", date: "13", title: "The storm whale", kind: "Story & talk", colour: "blue", note: "Children used the illustration closely, especially the empty chair and dark window. The sound clip created focus but our first partner-talk question was too broad.", keep: "Pause before reading the printed text.", change: "Give one precise visual clue to discuss first.", next: "Revisit the final spread in the story corner with voice cards.", quote: "‘His dad is quiet because the chair is pointing away.’ — Sam" },
  { id: "bridge-builders", day: "Wed", date: "14", title: "Bridge builders", kind: "Outdoor inquiry", colour: "green", note: "The weighted cart made success visible. Two groups rebuilt after collapse without adult prompting. The build bays were too close and materials became mixed.", keep: "Use a moving load rather than a static weight.", change: "Separate build bays and colour-mark each material set.", next: "Compare triangular and rectangular supports using photographs from today.", quote: "‘It didn’t break, it twisted. We need one across this way.’ — Erin" },
  { id: "sound-hunt", day: "Thu", date: "15", title: "Sound detectives", kind: "Phonics", colour: "rose", note: "Not taught yet. Add a note after the session.", keep: "—", change: "—", next: "—", quote: "No child voice captured yet." },
  { id: "market", day: "Fri", date: "16", title: "Autumn market", kind: "Continuous provision", colour: "purple", note: "Not taught yet. Add a note after the session.", keep: "—", change: "—", next: "—", quote: "No child voice captured yet." },
];

function ReflectionsWorkspace({ onOpenLesson, onToast, focusId, teachingNotes }: { onOpenLesson: (id: string) => void; onToast: ToastFn; focusId?: string | null; teachingNotes?: Record<string, { stamp: string; text: string }[]> }) {
  const [selected, setSelected] = useState(0);
  const [carried, setCarried] = useState(["Change the first partner-talk question", "Colour-mark outdoor material sets"]);

  useEffect(() => {
    if (!focusId) return;
    const index = reflections.findIndex((entry) => entry.id === focusId);
    if (index >= 0) setSelected(index);
  }, [focusId]);

  const item = reflections[selected];
  const sessionNotes = teachingNotes?.[item.id] ?? [];
  return <div className="product-section reflections-section">
    <header className="section-header"><div><span className="section-kicker">Teacher reflection</span><h1>Reflections</h1><p>Week of 12–16 October · Rowan & Foxes</p></div><div className="section-header-actions"><button className="section-quiet" onClick={() => onToast("This week’s reflections are ready to print.")}>Print week</button><button className="section-primary" onClick={() => onToast("Next week’s planning map now includes three carry-forwards.")}>Carry into next week</button></div></header>
    <div className="reflection-week-line"><div className="week-complete"><span style={{ width: "60%" }} /></div><span>3 of 5 teaching reflections complete</span><p>No attainment scores—record what changed your teaching judgement.</p></div>
    <div className="reflections-body">
      <aside className="reflection-days"><span className="reflection-label">This week</span>{reflections.map((reflection, index) => <button className={selected === index ? "active" : ""} key={reflection.id} onClick={() => setSelected(index)}><span className="reflection-date"><b>{reflection.day}</b><i>{reflection.date}</i></span><span className={`reflection-dot ${reflection.colour}`} /><span><strong>{reflection.title}</strong><small>{reflection.kind}</small></span>{index < 3 ? <b className="reflection-done">✓</b> : <b className="reflection-empty">○</b>}</button>)}</aside>
      <main className="reflection-page">
        <div className="reflection-heading"><div><span className={`lesson-type ${item.colour}`}>{item.kind}</span><h2>{item.title}</h2><p>{item.day} {item.date} October · reflection saved 14:26</p></div><button onClick={() => onOpenLesson(item.id)}>Open original plan ↗</button></div>
        <section className="what-happened"><span className="reflection-label">What happened?</span><p contentEditable suppressContentEditableWarning>{item.note}</p><div className="evidence-strip"><button className="evidence-photo one"><span>Table 1 · split of five</span></button><button className="evidence-photo two"><span>Child representation</span></button><button className="add-evidence" onClick={() => onToast("Choose a photo, voice note or scanned work sample.")}>＋<span>Add evidence</span></button></div></section>
        <section className="reflection-decisions"><article className="keep"><span>Keep</span><p contentEditable suppressContentEditableWarning>{item.keep}</p></article><article className="change"><span>Change</span><p contentEditable suppressContentEditableWarning>{item.change}</p></article><article className="next"><span>Try next</span><p contentEditable suppressContentEditableWarning>{item.next}</p></article></section>
        <section className="child-voice"><span>Child’s thinking, in their words</span><blockquote contentEditable suppressContentEditableWarning>{item.quote}</blockquote><button onClick={() => onToast("A second child-voice note can now be added.")}>＋ Add another</button></section>
      </main>
      <aside className="reflection-sidebar">
        <section><span className="reflection-label">Return to the plan</span><h3>What were you listening and looking for?</h3><p>{lessons[selected]?.phases[1]?.notice ?? lessons[0].phases[1].notice}</p><button onClick={() => onOpenLesson(item.id)}>Compare with planning sheet</button></section>
        <section className="teaching-note-recall"><span className="reflection-label">Notes from teaching</span>{sessionNotes.length ? sessionNotes.map((note, index) => <div className="recalled-note" key={index}><b>{note.stamp}</b><p>{note.text}</p></div>) : <p className="no-notes">No quick notes were captured in teaching view for this lesson.</p>}</section>
        <section className="carry-forward"><div><span className="reflection-label">Carry forward</span><button onClick={() => onToast("A carry-forward note is ready to add.")}>＋</button></div>{carried.map((note) => <button key={note} onClick={() => setCarried((current) => current.filter((value) => value !== note))}><span>✓</span><p>{note}</p></button>)}<small>These appear beside next week’s related plans.</small></section>
        <section className="team-response"><span className="reflection-label">Team response</span><div><b>J</b><p><strong>Jon · 14:42</strong><small>“I saw the same shift with Theo. Let’s keep those two together once more.”</small></p></div><button onClick={() => onToast("Team reply box opened.")}>Reply to Jon</button></section>
      </aside>
    </div>
  </div>;
}

function RoomSetup({ lesson, onReturn }: { lesson: Lesson; onReturn: () => void }) {
  return (
    <div className="room-setup-view">
      <div className="view-heading"><div><span>{lesson.day} · {lesson.time}</span><h2>{lesson.title}</h2><p>Place the people, materials and transitions where the team will use them.</p></div><button onClick={onReturn}>Back to planning sheet</button></div>
      <div className="room-workspace">
        <div className="large-room-map">
          <div className="room-wall-label north">WINDOWS · GARDEN</div>
          <div className="room-zone book"><strong>Book corner</strong><span>Story basket</span></div>
          <div className="room-zone carpet-large"><strong>Carpet</strong><span>8 places · launch</span></div>
          <div className="room-zone table-a"><strong>Table 1</strong><span>Pair trays × 4</span></div>
          <div className="room-zone table-b"><strong>Table 2</strong><span>Counters + nests</span></div>
          <div className="room-zone shelf-large"><strong>Maths shelf</strong><span>Revisit basket</span></div>
          <div className="transition-arrow">1&nbsp; Gather → &nbsp;2&nbsp; Explore → &nbsp;3&nbsp; Share</div>
          <div className="adult-pin maya">M<span>Maya</span></div>
          <div className="adult-pin jon">J<span>Jon</span></div>
          <div className="room-door">DOOR</div>
        </div>
        <aside className="room-brief">
          <span className="brief-kicker">Room briefing</span>
          <h3>Ready before 09:10</h3>
          <ol>
            <li><span>01</span><p><strong>Set the whole</strong><small>Five owls visible on the carpet rail.</small></p></li>
            <li><span>02</span><p><strong>Prepare pair trays</strong><small>Five counters and two cloth nests on each.</small></p></li>
            <li><span>03</span><p><strong>Keep the route clear</strong><small>Children move clockwise from carpet to tables.</small></p></li>
          </ol>
          <div className="brief-note"><strong>Team note</strong><p>{lesson.note}</p></div>
        </aside>
      </div>
    </div>
  );
}

function PrintPack({ lesson, ready, onReady, onPrint }: { lesson: Lesson; ready: string[]; onReady: (item: string) => void; onPrint: () => void }) {
  return (
    <div className="print-pack-view">
      <div className="view-heading"><div><span>Resources & print</span><h2>{lesson.title}</h2><p>Everything the room team needs, without opening the full plan.</p></div><button className="primary-print" onClick={onPrint}>Print 4-page pack</button></div>
      <div className="print-pack-grid">
        <article className="paper-preview"><span>PAGE 1</span><h3>{lesson.title}</h3><p>{lesson.intention}</p><div className="paper-rule" /><strong>Teaching flow</strong>{lesson.phases.map((item, index) => <div className="paper-phase" key={item.name}><b>{index + 1}</b><p><strong>{item.name} · {item.minutes} min</strong><small>{item.children}</small></p></div>)}</article>
        <article className="paper-preview secondary"><span>PAGE 2</span><h3>Room briefing</h3><p>{lesson.setup}</p><div className="paper-rule" /><strong>Adult deployment</strong>{lesson.adults.map((adult) => <div className="paper-person" key={adult.person}><b>{adult.person.slice(0, 1)}</b><p><strong>{adult.person}</strong><small>{adult.role}</small></p></div>)}</article>
        <aside className="pack-options">
          <h3>Pack contents</h3>
          {["Planning sheet", "Room briefing", "Resource checklist", "Blank reflection page"].map((item) => <button key={item}><span>✓</span>{item}<small>1 page</small></button>)}
          <h3>Resource check</h3>
          {lesson.resources.map((item) => <button className={ready.includes(item) ? "ready" : ""} key={item} onClick={() => onReady(item)}><span>{ready.includes(item) ? "✓" : ""}</span>{item}</button>)}
        </aside>
      </div>
    </div>
  );
}
