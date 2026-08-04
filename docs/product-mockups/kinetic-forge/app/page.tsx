"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import FoundryScene, { type MissionPhase } from "./FoundryScene";

type Mode = "build" | "simulate" | "replay";

const REPLAY_DURATION = 32_000;

const parts = [
  { code: "WHL-06", name: "All-terrain wheel", detail: "6 fitted", icon: "◉" },
  { code: "SUS-2", name: "Long-travel suspension", detail: "220 mm", icon: "⌁" },
  { code: "DRV-4", name: "High-torque drive", detail: "4 motors", icon: "⚙" },
  { code: "WCH-8", name: "Recovery winch", detail: "80 kN", icon: "⊕" },
];

const modeCopy: Record<Mode, { index: string; label: string }> = {
  build: { index: "01", label: "BUILD" },
  simulate: { index: "02", label: "SIMULATE" },
  replay: { index: "03", label: "REPLAY" },
};

const phaseConfig: Record<MissionPhase, {
  progress: number;
  label: string;
  status: string;
  duration?: number;
  next?: MissionPhase;
}> = {
  ready: { progress: 8, label: "CORE SECURED", status: "STAGED" },
  transit: { progress: 28, label: "GANTRY APPROACH", status: "IN TRANSIT", duration: 6_000, next: "blocked" },
  blocked: { progress: 36, label: "ROUTE OBSTRUCTED", status: "HALTED" },
  winching: { progress: 52, label: "RECOVERY WINCH", status: "80 kN LOAD", duration: 4_600, next: "crossing" },
  crossing: { progress: 76, label: "TURNTABLE CROSSING", status: "BALANCING", duration: 8_500, next: "dock_ready" },
  dock_ready: { progress: 86, label: "REACTOR ALIGNED", status: "DOCK READY" },
  docking: { progress: 96, label: "CORE TRANSFER", status: "COUPLING", duration: 5_200, next: "complete" },
  complete: { progress: 100, label: "FOUNDRY ONLINE", status: "DELIVERED" },
};

const phaseCopy: Record<MissionPhase, string> = {
  ready: "Deliver the portable energy core to restart Foundry Node 7.",
  transit: "Proceed through the blackout zone. Structural telemetry is unstable.",
  blocked: "A transfer gantry has collapsed across the route. Clear it with the recovery winch.",
  winching: "Winch under load. Hold position while the beam clears the wheel path.",
  crossing: "The transfer table is moving. Keep the core inside the stability envelope.",
  dock_ready: "Vehicle aligned. Authorize the core transfer into the reactor cradle.",
  docking: "Core handoff in progress. Maintain containment until the coupler locks.",
  complete: "Node 7 restored. Thermal systems and production machinery are coming online.",
};

function hasReached(phase: MissionPhase, target: MissionPhase) {
  const order: MissionPhase[] = ["ready", "transit", "blocked", "winching", "crossing", "dock_ready", "docking", "complete"];
  return order.indexOf(phase) >= order.indexOf(target);
}
export default function Home() {
  const [mode, setMode] = useState<Mode>("simulate");
  const [phase, setPhase] = useState<MissionPhase>("ready");
  const [phaseProgress, setPhaseProgress] = useState(phaseConfig.ready.progress);
  const [selectedPart, setSelectedPart] = useState(3);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);

  useEffect(() => {
    const config = phaseConfig[phase];
    if (!config.duration || !config.next) return;

    const prior = phase === "transit" ? phaseConfig.ready.progress
      : phase === "winching" ? phaseConfig.blocked.progress
      : phase === "crossing" ? phaseConfig.winching.progress
      : phaseConfig.dock_ready.progress;
    const startedAt = performance.now();
    const tick = window.setInterval(() => {
      const t = Math.min((performance.now() - startedAt) / config.duration!, 1);
      setPhaseProgress(prior + (config.progress - prior) * t);
    }, 80);
    const advance = window.setTimeout(() => {
      setPhaseProgress(config.progress);
      setPhase(config.next!);
    }, config.duration);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(advance);
    };
  }, [phase]);

  useEffect(() => {
    if (!replayPlaying) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = ((now - lastTick) / REPLAY_DURATION) * 100;
      lastTick = now;
      setReplayProgress((current) => {
        const next = current + delta;
        if (next >= 100) {
          setReplayPlaying(false);
          return 100;
        }
        return next;
      });
    }, 70);
    return () => window.clearInterval(timer);
  }, [replayPlaying]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || mode !== "simulate") return;
      if (event.code === "Space" || event.code === "Enter" || event.code === "KeyE") {
        event.preventDefault();
        if (phase === "ready") setPhase("transit");
        else if (phase === "blocked") setPhase("winching");
        else if (phase === "dock_ready") setPhase("docking");
      }
      if (event.code === "KeyR") resetMission();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, phase]);

  const telemetry = useMemo(() => {
    if (phase === "transit") return { speed: "8.4", traction: "91", suspension: "58", stability: "94" };
    if (phase === "winching") return { speed: "0.0", traction: "100", suspension: "71", stability: "88" };
    if (phase === "crossing") return { speed: "3.2", traction: "82", suspension: "66", stability: "76" };
    if (phase === "docking") return { speed: "0.0", traction: "100", suspension: "21", stability: "99" };
    return { speed: "0.0", traction: phase === "complete" ? "100" : "94", suspension: "21", stability: phase === "complete" ? "100" : "97" };
  }, [phase]);

  const displayProgress = mode === "replay" ? replayProgress : phaseProgress;
  const action = phase === "ready"
    ? { label: "BEGIN CORE DELIVERY", detail: "ENGAGE DRIVE", icon: "▶" }
    : phase === "blocked"
      ? { label: "CLEAR GANTRY", detail: "ENGAGE 80 kN WINCH", icon: "⊕" }
      : phase === "dock_ready"
        ? { label: "TRANSFER CORE", detail: "AUTHORIZE COUPLING", icon: "◇" }
        : null;

  function chooseMode(next: Mode) {
    setMode(next);
    setReplayPlaying(false);
    if (next === "replay") {
      setReplayProgress(0);
    } else if (next === "build" && phase === "complete") {
      resetMission();
    }
  }

  function performAction() {
    if (phase === "ready") setPhase("transit");
    else if (phase === "blocked") setPhase("winching");
    else if (phase === "dock_ready") setPhase("docking");
  }

  function resetMission() {
    setPhase("ready");
    setReplayPlaying(false);
    setReplayProgress(0);
    setPhaseProgress(phaseConfig.ready.progress);
  }

  return (
    <main className={`game-shell mode-${mode} phase-${phase}${replayPlaying ? " replay-playing" : ""}`}>
      <section className="scene" aria-label="Foundry Blackout gameplay scene">
        <FoundryScene phase={phase} replayMode={mode === "replay"} replayPlaying={replayPlaying} replayProgress={replayProgress} />
        <div className="scene-drift" />
        <div className="scene-glow" />
        <div className="sparks" aria-hidden="true">
          {Array.from({ length: 22 }, (_, index) => (
            <i
              key={index}
              style={{
                "--spark-x": `${18 + ((index * 17) % 78)}%`,
                "--spark-y": `${55 + ((index * 11) % 40)}%`,
                "--spark-delay": `${(index % 8) * -0.31}s`,
                "--spark-size": `${2 + (index % 3)}px`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="scanlines" />
        <div className="vignette" />
      </section>

      <header className="topbar">
        <button className="brand" aria-label="Kinetic Forge home" onClick={resetMission}>
          <span className="brand-mark"><i /><i /><i /></span>
          <span><b>KINETIC</b><strong>FORGE</strong></span>
          <em>FOUNDRY BLACKOUT / VERTICAL SLICE</em>
        </button>

        <nav className="mode-switcher" aria-label="Game mode">
          {(Object.keys(modeCopy) as Mode[]).map((item) => (
            <button key={item} className={mode === item ? "active" : ""} onClick={() => chooseMode(item)}>
              <small>{modeCopy[item].index}</small>
              <span>{modeCopy[item].label}</span>
            </button>
          ))}
        </nav>

        <div className="top-status">
          <span><i className={phase === "complete" ? "online" : "offline"} />NODE 7 / {phase === "complete" ? "ONLINE" : "BLACKOUT"}</span>
          <span className="fps">60 <small>FPS</small></span>
          <button aria-label="Open settings">⌘</button>
        </div>
      </header>

      <aside className="mission-panel hud-panel">
        <div className="panel-label"><span>RECOVERY MISSION 01</span><i>{phase === "complete" ? "RESTORED" : "ACTIVE"}</i></div>
        <h1>Foundry<br />Blackout</h1>
        <p>{phaseCopy[phase]}</p>
        <div className="route">
          <div className="route-line"><i style={{ width: `${displayProgress}%` }} /></div>
          <span className="route-start">BAY 04</span>
          <span className="route-event">GANTRY</span>
          <span className="route-end">NODE 7</span>
          <b style={{ left: `${displayProgress}%` }} aria-label={`${Math.round(displayProgress)} percent complete`} />
        </div>
        <div className="objective-list">
          <span className="done"><i>✓</i>SECURE PORTABLE CORE</span>
          <span className={hasReached(phase, "blocked") ? "done" : "current"}><i>{hasReached(phase, "blocked") ? "✓" : "2"}</i>REACH TRANSFER GANTRY</span>
          <span className={hasReached(phase, "crossing") ? "done" : phase === "blocked" || phase === "winching" ? "current" : ""}><i>{hasReached(phase, "crossing") ? "✓" : "3"}</i>CLEAR COLLAPSED BEAM</span>
          <span className={hasReached(phase, "dock_ready") ? "done" : phase === "crossing" ? "current" : ""}><i>{hasReached(phase, "dock_ready") ? "✓" : "4"}</i>CROSS TRANSFER TABLE</span>
          <span className={phase === "complete" ? "done" : phase === "dock_ready" || phase === "docking" ? "current" : ""}><i>{phase === "complete" ? "✓" : "5"}</i>RESTART FOUNDRY NODE</span>
        </div>
      </aside>

      <aside className="vehicle-panel hud-panel">
        <div className="vehicle-heading">
          <span><small>ROVER</small><strong>RF–06 / HAULER</strong></span>
          <i>{phaseConfig[phase].status}</i>
        </div>
        <div className="telemetry-grid">
          <div><small>VELOCITY</small><strong>{telemetry.speed}</strong><span>M/S</span></div>
          <div><small>TRACTION</small><strong>{telemetry.traction}</strong><span>%</span></div>
          <div><small>CORE STABILITY</small><strong>{telemetry.stability}</strong><span>%</span></div>
        </div>
        <div className="core-state"><i /><span><small>MISSION STATE</small><strong>{phaseConfig[phase].label}</strong></span></div>
      </aside>

      {(phase === "blocked" || phase === "winching") && mode === "simulate" && (
        <div className="incident-alert" role="status">
          <i>!</i><span><small>STRUCTURAL EVENT / ROUTE 04</small><strong>TRANSFER GANTRY COLLAPSE</strong></span>
        </div>
      )}

      <div className="reticle" aria-hidden="true"><span /><i /></div>

      {mode === "build" && (
        <section className="build-dock" aria-label="Rover build controls">
          <div className="dock-intro">
            <span>ASSEMBLY / RF–06</span>
            <strong>Recovery configuration</strong>
            <p>Configured for heavy extraction and high-stability core transport.</p>
          </div>
          <div className="parts-strip">
            {parts.map((part, index) => (
              <button key={part.code} className={selectedPart === index ? "active" : ""} onClick={() => setSelectedPart(index)}>
                <i>{part.icon}</i><span><small>{part.code}</small><strong>{part.name}</strong><em>{part.detail}</em></span>
              </button>
            ))}
          </div>
          <div className="build-stats">
            <span><small>MASS</small><b>2,940</b><em>KG</em></span>
            <span><small>WINCH</small><b>80</b><em>KN</em></span>
            <span><small>STABILITY</small><b>A–</b><em>RATED</em></span>
          </div>
          <button className="primary-action" onClick={() => { setMode("simulate"); resetMission(); }}><span>DEPLOY ROVER</span><i>→</i></button>
        </section>
      )}

      {mode === "simulate" && (
        <section className="drive-controls" aria-label="Mission controls">
          <div className="sequence-readout">
            <span className="sequence-index">{String(Math.max(1, ["ready", "transit", "blocked", "winching", "crossing", "dock_ready", "docking", "complete"].indexOf(phase) + 1)).padStart(2, "0")}</span>
            <span><small>ACTIVE SEQUENCE</small><strong>{phaseConfig[phase].label}</strong></span>
            <div className="stability-bar"><i style={{ width: `${telemetry.stability}%` }} /></div>
          </div>
          <div className="drive-actions">
            {phase === "complete" ? (
              <button className="success-button" onClick={() => chooseMode("replay")}><span>NODE 7 RESTORED</span><b>VIEW CINEMATIC REPLAY →</b></button>
            ) : action ? (
              <button className="primary-action mission-action" onClick={performAction}>
                <span><small>{action.label}</small>{action.detail}</span><i>{action.icon}</i>
              </button>
            ) : (
              <div className="autopilot-state"><i /><span><small>SEQUENCE RUNNING</small><strong>{phaseConfig[phase].status}</strong></span></div>
            )}
            <button className="icon-action" onClick={resetMission} aria-label="Reset mission">↺</button>
          </div>
        </section>
      )}

      {mode === "replay" && (
        <section className="replay-dock" aria-label="Replay controls">
          <button className="replay-play" onClick={() => { if (replayProgress >= 100) setReplayProgress(0); setReplayPlaying((value) => !value); }}>{replayPlaying ? "Ⅱ" : "▶"}</button>
          <div className="replay-time"><strong>00:{String(Math.round((replayProgress / 100) * 32)).padStart(2, "0")}.00</strong><span>/ 00:32.00</span></div>
          <div className="timeline">
            <div className="timeline-track"><i style={{ width: `${replayProgress}%` }} /><b style={{ left: `${replayProgress}%` }} /></div>
            <span className="event event-a">IMPACT</span>
            <span className="event event-b">WINCH CLEAR</span>
            <span className="event event-c">IGNITION</span>
          </div>
          <button className="speed-button">1.0×</button>
          <button className="capture-button">CAPTURE FRAME</button>
        </section>
      )}

      <div className="motion-proof" aria-live="polite">
        <i />
        <span><small>REAL-TIME 3D SEQUENCE</small><strong>{mode === "replay" ? replayPlaying ? "CINEMATIC REPLAY" : "REPLAY ARMED" : phaseConfig[phase].label}</strong></span>
      </div>
      <div className="concept-note">THREE.JS VERTICAL SLICE · AUTHORED INTERACTION CHOREOGRAPHY · RAPIER PHYSICS ADAPTER TARGET</div>
      <div className="mobile-note">Rotate to landscape for the full cockpit view</div>
    </main>
  );
}
