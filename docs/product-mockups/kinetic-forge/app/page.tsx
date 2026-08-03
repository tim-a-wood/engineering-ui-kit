"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import FoundryScene from "./FoundryScene";

type Mode = "build" | "simulate" | "replay";
type RunState = "ready" | "running" | "complete";

const parts = [
  { code: "WHL-06", name: "All-terrain wheel", detail: "6 fitted", icon: "◉" },
  { code: "SUS-2", name: "Long-travel suspension", detail: "220 mm", icon: "⌁" },
  { code: "DRV-4", name: "High-torque drive", detail: "4 motors", icon: "⚙" },
  { code: "CRD-1", name: "Energy-core cradle", detail: "Secured", icon: "◇" },
];

const modeCopy: Record<Mode, { index: string; label: string }> = {
  build: { index: "01", label: "BUILD" },
  simulate: { index: "02", label: "SIMULATE" },
  replay: { index: "03", label: "REPLAY" },
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("simulate");
  const [runState, setRunState] = useState<RunState>("ready");
  const [progress, setProgress] = useState(34);
  const [selectedPart, setSelectedPart] = useState(1);
  const [replayPlaying, setReplayPlaying] = useState(false);

  useEffect(() => {
    if (runState !== "running") return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const next = current + 0.52;
        if (next >= 91) {
          window.clearInterval(timer);
          setRunState("complete");
          return 91;
        }
        return next;
      });
    }, 85);
    return () => window.clearInterval(timer);
  }, [runState]);

  useEffect(() => {
    if (!replayPlaying) return;
    const timer = window.setInterval(() => {
      setProgress((current) => (current >= 91 ? 19 : current + 0.55));
    }, 70);
    return () => window.clearInterval(timer);
  }, [replayPlaying]);

  const telemetry = useMemo(() => {
    if (runState === "running") {
      return { speed: "12.8", traction: "87", suspension: "62", status: "LIVE" };
    }
    if (runState === "complete") {
      return { speed: "0.0", traction: "100", suspension: "18", status: "DELIVERED" };
    }
    return { speed: "0.0", traction: "94", suspension: "21", status: "STAGED" };
  }, [runState]);

  function chooseMode(next: Mode) {
    setMode(next);
    setReplayPlaying(false);
    if ((next === "simulate" || next === "build") && runState === "complete") {
      setRunState("ready");
      setProgress(34);
    }
  }

  function deploy() {
    setMode("simulate");
    setProgress(34);
    setRunState("running");
  }

  function resetRun() {
    setRunState("ready");
    setReplayPlaying(false);
    setProgress(34);
  }

  return (
    <main className={`game-shell mode-${mode} run-${runState}${replayPlaying ? " replay-playing" : ""}`}>
      <section className="scene" aria-label="Foundry Delivery gameplay scene">
        <FoundryScene motionState={runState} replayPlaying={replayPlaying} />
        <div className="scene-drift" />
        <div className="scene-glow" />
        <div className="sparks" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--spark-x": `${24 + ((index * 17) % 72)}%`,
                  "--spark-y": `${58 + ((index * 11) % 35)}%`,
                  "--spark-delay": `${(index % 7) * -0.31}s`,
                  "--spark-size": `${2 + (index % 3)}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="scanlines" />
        <div className="vignette" />
      </section>

      <header className="topbar">
        <button className="brand" aria-label="Kinetic Forge home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><b>KINETIC</b><strong>FORGE</strong></span>
          <em>PROTOTYPE 01</em>
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
          <span><i className="online" />FOUNDRY NODE</span>
          <span className="fps">60 <small>FPS</small></span>
          <button aria-label="Open settings">⌘</button>
        </div>
      </header>

      <aside className="mission-panel hud-panel">
        <div className="panel-label"><span>CHALLENGE 01</span><i>ACTIVE</i></div>
        <h1>Foundry<br />Delivery</h1>
        <p>Carry the energy core across the service bridge and reach the marked platform.</p>
        <div className="route">
          <div className="route-line"><i style={{ width: `${progress}%` }} /></div>
          <span className="route-start">BAY 04</span>
          <span className="route-end">PLATFORM 7</span>
          <b style={{ left: `${progress}%` }} aria-label={`${Math.round(progress)} percent complete`} />
        </div>
        <div className="objective-list">
          <span className="done"><i>✓</i>ENERGY CORE SECURED</span>
          <span className={runState === "complete" ? "done" : ""}><i>{runState === "complete" ? "✓" : "2"}</i>CROSS SERVICE BRIDGE</span>
          <span className={runState === "complete" ? "done" : ""}><i>{runState === "complete" ? "✓" : "3"}</i>DELIVER TO PLATFORM</span>
        </div>
      </aside>

      <aside className="vehicle-panel hud-panel">
        <div className="vehicle-heading">
          <span><small>ROVER</small><strong>RF–06 / HAULER</strong></span>
          <i>{telemetry.status}</i>
        </div>
        <div className="telemetry-grid">
          <div><small>VELOCITY</small><strong>{telemetry.speed}</strong><span>M/S</span></div>
          <div><small>TRACTION</small><strong>{telemetry.traction}</strong><span>%</span></div>
          <div><small>SUSPENSION</small><strong>{telemetry.suspension}</strong><span>%</span></div>
        </div>
        <div className="core-state"><i /><span><small>CARGO STATE</small><strong>ENERGY CORE / LOCKED</strong></span></div>
      </aside>

      <div className="reticle" aria-hidden="true"><span /><i /></div>

      {mode === "build" && (
        <section className="build-dock" aria-label="Rover build controls">
          <div className="dock-intro">
            <span>ASSEMBLY / RF–06</span>
            <strong>Hauler configuration</strong>
            <p>Balanced for cargo stability and bridge clearance.</p>
          </div>
          <div className="parts-strip">
            {parts.map((part, index) => (
              <button key={part.code} className={selectedPart === index ? "active" : ""} onClick={() => setSelectedPart(index)}>
                <i>{part.icon}</i><span><small>{part.code}</small><strong>{part.name}</strong><em>{part.detail}</em></span>
              </button>
            ))}
          </div>
          <div className="build-stats">
            <span><small>MASS</small><b>2,840</b><em>KG</em></span>
            <span><small>POWER</small><b>468</b><em>KW</em></span>
            <span><small>STABILITY</small><b>A–</b><em>RATED</em></span>
          </div>
          <button className="primary-action" onClick={deploy}><span>DEPLOY ROVER</span><i>→</i></button>
        </section>
      )}

      {mode === "simulate" && (
        <section className="drive-controls" aria-label="Simulation controls">
          <div className="key-cluster"><span><kbd>W</kbd><small>DRIVE</small></span><span><kbd>A</kbd><kbd>D</kbd><small>STEER</small></span><span><kbd>SPACE</kbd><small>BRAKE</small></span></div>
          <div className="drive-actions">
            {runState === "complete" ? (
              <button className="success-button" onClick={() => chooseMode("replay")}><span>DELIVERY COMPLETE</span><b>VIEW REPLAY →</b></button>
            ) : (
              <button className={runState === "running" ? "primary-action running" : "primary-action"} onClick={() => runState === "running" ? setRunState("ready") : deploy()}>
                <span>{runState === "running" ? "PAUSE RUN" : "ENGAGE DRIVE"}</span><i>{runState === "running" ? "Ⅱ" : "▶"}</i>
              </button>
            )}
            <button className="icon-action" onClick={resetRun} aria-label="Reset simulation">↺</button>
          </div>
        </section>
      )}

      {mode === "replay" && (
        <section className="replay-dock" aria-label="Replay controls">
          <button className="replay-play" onClick={() => setReplayPlaying((value) => !value)}>{replayPlaying ? "Ⅱ" : "▶"}</button>
          <div className="replay-time"><strong>00:18.42</strong><span>/ 00:41.08</span></div>
          <div className="timeline">
            <div className="timeline-track"><i style={{ width: `${progress}%` }} /><b style={{ left: `${progress}%` }} /></div>
            <span className="event event-a">CORE LOCKED</span>
            <span className="event event-b">BRIDGE RELEASE</span>
            <span className="event event-c">DELIVERY</span>
          </div>
          <button className="speed-button">1.0×</button>
          <button className="capture-button">CAPTURE FRAME</button>
        </section>
      )}

      <div className="motion-proof" aria-live="polite">
        <i />
        <span><small>REAL-TIME 3D SCENE</small><strong>{runState === "running" || replayPlaying ? "ROVER IN TRANSIT" : runState === "complete" ? "PLATFORM REACHED" : "READY TO DRIVE"}</strong></span>
      </div>
      <div className="concept-note">THREE.JS PROTOTYPE · AUTHORED VEHICLE DYNAMICS · PHYSICS SOLVER NOT CONNECTED</div>
      <div className="mobile-note">Rotate to landscape for the full cockpit view</div>
    </main>
  );
}
