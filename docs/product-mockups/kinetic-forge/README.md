# Kinetic Forge — Foundry Blackout

[Open the public interactive mockup](https://tim-a-wood.github.io/engineering-ui-kit/mockups/kinetic-forge/) · [Read the PRD](./product/PRD.md)

A cinematic browser-game vertical slice in which a six-wheel recovery rover clears a collapsed gantry, crosses a moving transfer table, delivers an energy core by overhead crane and restarts an industrial foundry. The rover, wheels, suspension response, obstruction, winch cable, bridge, crane, reactor, lighting, sparks, dust and camera movement are all rendered as live Three.js geometry.

The prototype demonstrates authored interaction choreography and game presentation. It does not yet claim a connected rigid-body solver; Rapier remains the target physics adapter for production behavior.

The visible vehicle is real Three.js geometry. Its detailed mechanical chassis is derived from NASA/JPL-Caltech's public Mars 2020 Perseverance Rover GLB, then re-skinned and combined at runtime with Kinetic Forge cargo bodywork, containment hardware, lights, wheels and suspension geometry. NASA does not endorse this prototype. See `ATTRIBUTION.md`.

## Run locally

```bash
npm install
npm run dev
```

Use **Begin Core Delivery**, then respond to the gantry incident and authorize the crane-assisted core transfer. **Replay** runs the complete 36-second cinematic sequence. The interface is desktop-first and also supports iPhone portrait and landscape viewing.

## Reference material

- [Product requirements](./product/PRD.md)
- [Foundry Delivery visual benchmark](./product/foundry-delivery-v1.png)
- [Winch Recovery scenario](./product/winch-recovery-v1.png)
- [Bridge Balance scenario](./product/bridge-balance-v1.png)
