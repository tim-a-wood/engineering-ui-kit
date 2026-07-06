# Bench Monitor — requirements

This file is the **entire specification** behind the demo recorded in the repo
README: it was written first, and the front end in `src/` was built from it and
the standards package alone — no wireframes, no mockups, no component list. In
the workbench it maps onto the *Build a new UI from requirements (no backend)*
task template.

## What we need

A single-screen monitoring console for our environmental test bench (Bench 3).
Test engineers run thermal soak qualifications that last a couple of hours and
they currently watch raw logger output. They need one page that answers, at a
glance: *is the run healthy, is every channel behaving, and what happened while
I was away?*

## Requirements

1. **Run header.** Show the rig name, the run identifier and profile, the run
   state (e.g. `Running`), and elapsed time against the planned duration.
2. **Key figures.** Show the current chamber temperature against setpoint, the
   worst live deviation against the ±1.5 °C tolerance, how many thermocouple
   channels are online, and how many alerts are active. Each figure needs
   enough context to be read without the chart.
3. **Temperature trace.** Plot measured chamber temperature against the
   setpoint profile for the whole run (30-minute ramp from ambient to 85 °C,
   then a soak hold). Units and axes must be labeled, the two series must be
   distinguishable without relying on color alone, and exact values should be
   available on the points. Let the engineer narrow the view to the ramp stage
   or the soak stage. Include a plain-text summary of the soak window so the
   numbers survive screenshots and reports.
4. **Channel table.** List every thermocouple with its location, latest
   reading, deviation from setpoint, and status (`OK`, `Warning`, `Fault`).
   Status must be readable as text, not only as a color. Let the engineer
   filter the table by status. A faulted channel should say what went wrong
   and when.
5. **Event log.** A reverse-chronological log of run events (stage changes,
   warnings, faults) with timestamps and severity.
6. **Feel.** Dark, calm, engineering-grade — this sits on a monitor beside the
   bench for hours. Follow the Engineering UI Kit standards package: semantic
   tokens only, dark-first, keyboard-visible focus, reduced-motion safe.

## Constraints

- React + TypeScript + Vite, no chart library, no runtime network access.
- Deterministic sample data checked into the repo so the screen is
  reproducible — this is a demo target, not a live integration.
