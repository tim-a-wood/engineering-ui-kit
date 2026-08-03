# Kinetic Forge — Foundry Delivery

[Open the public interactive mockup](https://tim-a-wood.github.io/engineering-ui-kit/mockups/kinetic-forge/) · [Read the PRD](./product/PRD.md)

A cinematic browser-game concept demonstrating a six-wheel rover carrying an energy core across a foundry service bridge. The current motion revision replaces the earlier composited image treatment with a real-time Three.js scene: the rover, wheels, suspension response, bridge, platform, lighting, sparks, dust and camera movement are all rendered as 3D geometry.

The prototype demonstrates authored vehicle motion and game presentation. It does not yet claim rigid-body physics, collision solving or deformable suspension simulation.

## Run locally

```bash
npm install
npm run dev
```

Use **Engage Drive** to run the crossing. **Replay** repeats it. The interface is desktop-first and also supports iPhone portrait and landscape viewing.

## Reference material

- [Product requirements](./product/PRD.md)
- [Foundry Delivery visual benchmark](./product/foundry-delivery-v1.png)
- [Winch Recovery scenario](./product/winch-recovery-v1.png)
- [Bridge Balance scenario](./product/bridge-balance-v1.png)
