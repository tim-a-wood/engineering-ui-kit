"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type MotionState = "ready" | "running" | "complete";

type FoundrySceneProps = {
  motionState: MotionState;
  replayPlaying: boolean;
};

type MotionClock = {
  state: MotionState;
  replay: boolean;
  startedAt: number;
};

const RUN_DURATION = 9_320;
const WHEEL_RADIUS = 0.92;
const WHEEL_CENTER_Y = 1.1;
const START_Z = 2.8;
const RUN_DISTANCE = 14.7;

export default function FoundryScene({ motionState, replayPlaying }: FoundrySceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<MotionClock>({ state: motionState, replay: replayPlaying, startedAt: 0 });

  useEffect(() => {
    motionRef.current = { state: motionState, replay: replayPlaying, startedAt: performance.now() };
  }, [motionState, replayPlaying]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2b2119, 0.012);

    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Real-time six-wheel industrial rover crossing a clear foundry bridge");
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
      geometries.push(geometry);
      return geometry;
    };
    const trackMaterial = <T extends THREE.Material>(material: T): T => {
      materials.push(material);
      return material;
    };

    const armor = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x171a1a, roughness: 0.38, metalness: 0.86 }));
    const armorPanel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x252827, roughness: 0.5, metalness: 0.76 }));
    const gunmetal = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x343735, roughness: 0.42, metalness: 0.82 }));
    const brightSteel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x69645a, roughness: 0.36, metalness: 0.88 }));
    const rubber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x111313, roughness: 0.94, metalness: 0.02 }));
    const treadRubber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x202322, roughness: 0.96, metalness: 0.01 }));
    const suspension = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xb36a12, roughness: 0.35, metalness: 0.78 }));
    const cyan = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x55dff8, emissive: 0x0788ac, emissiveIntensity: 3.4, roughness: 0.16, metalness: 0.32 }));
    const cyanGlass = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x39d9ff, emissive: 0x087a9d, emissiveIntensity: 2.1, transparent: true, opacity: 0.38, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide }));
    const amber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xd58a1f, emissive: 0x5e2705, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.72 }));
    const redLight = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xff3b28, emissive: 0xff180c, emissiveIntensity: 5.5, roughness: 0.2 }));
    const paleLight = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xffe7bd, emissive: 0xffa42e, emissiveIntensity: 4.5, roughness: 0.18 }));

    function addBox(
      parent: THREE.Object3D,
      size: [number, number, number],
      material: THREE.Material,
      position: [number, number, number],
      castShadow = true,
    ) {
      const mesh = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(...size)), material);
      mesh.position.set(...position);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function beam(
      parent: THREE.Object3D,
      start: THREE.Vector3,
      end: THREE.Vector3,
      radius: number,
      material: THREE.Material,
      radialSegments = 10,
    ) {
      const direction = new THREE.Vector3().subVectors(end, start);
      const mesh = new THREE.Mesh(
        trackGeometry(new THREE.CylinderGeometry(radius, radius, direction.length(), radialSegments)),
        material,
      );
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addNode(parent: THREE.Object3D, position: THREE.Vector3, radius = 0.13) {
      const node = new THREE.Mesh(trackGeometry(new THREE.SphereGeometry(radius, 12, 8)), brightSteel);
      node.position.copy(position);
      node.castShadow = true;
      parent.add(node);
      return node;
    }

    function framedModule(
      parent: THREE.Object3D,
      center: THREE.Vector3,
      width: number,
      height: number,
      depth: number,
    ) {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const halfDepth = depth / 2;
      const points = [
        [-halfWidth, -halfHeight, -halfDepth], [halfWidth, -halfHeight, -halfDepth],
        [-halfWidth, halfHeight, -halfDepth], [halfWidth, halfHeight, -halfDepth],
        [-halfWidth, -halfHeight, halfDepth], [halfWidth, -halfHeight, halfDepth],
        [-halfWidth, halfHeight, halfDepth], [halfWidth, halfHeight, halfDepth],
      ].map(([x, y, z]) => new THREE.Vector3(center.x + x, center.y + y, center.z + z));
      const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
      edges.forEach(([a, b]) => beam(parent, points[a], points[b], 0.075, brightSteel));
      points.forEach((point) => addNode(parent, point, 0.12));
      return points;
    }

    const rover = new THREE.Group();
    rover.position.set(-0.55, 0, START_Z);
    scene.add(rover);

    // Long, low chassis matching the approved hauler proportions.
    for (const x of [-1.26, 1.26]) {
      beam(rover, new THREE.Vector3(x, 1.38, -3.25), new THREE.Vector3(x, 1.38, 3.2), 0.1, gunmetal, 12);
      beam(rover, new THREE.Vector3(x, 1.76, -3.05), new THREE.Vector3(x, 1.76, 2.95), 0.075, brightSteel);
    }
    for (const z of [-3.05, -2.25, -1.25, -0.2, 0.9, 2.05, 3.0]) {
      beam(rover, new THREE.Vector3(-1.3, 1.42, z), new THREE.Vector3(1.3, 1.42, z), 0.085, gunmetal);
    }
    addBox(rover, [2.7, 0.18, 6.05], armor, [0, 1.45, 0]);
    addBox(rover, [2.35, 0.12, 5.55], armorPanel, [0, 1.62, -0.02]);
    addBox(rover, [3.15, 0.18, 0.28], gunmetal, [0, 1.28, -3.15]);
    addBox(rover, [3.05, 0.14, 0.2], amber, [0, 1.52, -3.24], false);

    // Rear sealed cargo/power module: dense armor, framed corners and service panels.
    const cargoCenter = new THREE.Vector3(0, 2.45, 1.72);
    addBox(rover, [2.92, 1.42, 2.48], armor, [cargoCenter.x, cargoCenter.y, cargoCenter.z]);
    framedModule(rover, cargoCenter, 3.18, 1.68, 2.76);
    for (const side of [-1, 1]) {
      addBox(rover, [0.09, 0.96, 1.85], armorPanel, [side * 1.49, 2.43, 1.73]);
      for (const z of [0.94, 1.72, 2.5]) {
        const serviceNode = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 14)), brightSteel);
        serviceNode.position.set(side * 1.57, 2.48, z);
        serviceNode.rotation.z = Math.PI / 2;
        rover.add(serviceNode);
      }
    }
    addBox(rover, [2.42, 0.82, 0.08], armorPanel, [0, 2.46, 3.0]);
    for (const x of [-1.05, 0, 1.05]) addBox(rover, [0.08, 0.9, 0.1], brightSteel, [x, 2.46, 3.06]);
    for (const z of [0.7, 1.25, 1.8, 2.35, 2.75]) {
      beam(rover, new THREE.Vector3(-1.36, 3.37, z), new THREE.Vector3(1.36, 3.37, z), 0.045, gunmetal);
    }

    // Forward lattice chassis around the energy core.
    const cageCenter = new THREE.Vector3(0, 2.35, -1.38);
    const cagePoints = framedModule(rover, cageCenter, 2.92, 1.72, 3.52);
    for (const side of [-1, 1]) {
      const x = side * 1.46;
      beam(rover, new THREE.Vector3(x, 1.49, -3.14), new THREE.Vector3(x, 3.21, 0.38), 0.075, brightSteel);
      beam(rover, new THREE.Vector3(x, 3.21, -3.14), new THREE.Vector3(x, 1.49, 0.38), 0.075, brightSteel);
      for (const z of [-2.7, -1.82, -0.94, -0.06]) addNode(rover, new THREE.Vector3(x, 2.34, z), 0.11);
    }
    beam(rover, cagePoints[2], cagePoints[5], 0.065, gunmetal);
    beam(rover, cagePoints[3], cagePoints[4], 0.065, gunmetal);
    addBox(rover, [2.45, 1.25, 0.06], cyanGlass, [0, 2.34, -1.38], false);

    const core = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.61, 2)), cyan);
    core.position.set(0, 2.34, -1.38);
    core.castShadow = true;
    rover.add(core);
    for (const rotation of [0, Math.PI / 2]) {
      const ring = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.83, 0.035, 8, 32)), cyan);
      ring.position.copy(core.position);
      ring.rotation.y = rotation;
      rover.add(ring);
    }
    const coreHalo = new THREE.PointLight(0x35dfff, 8, 7, 2);
    coreHalo.position.copy(core.position);
    rover.add(coreHalo);

    // Six independent wheel assemblies with visible arms, dampers and coil springs.
    const wheels: THREE.Group[] = [];
    const wheelStations = [-2.42, -0.2, 2.02];
    const tireGeometry = trackGeometry(new THREE.TorusGeometry(0.66, 0.24, 12, 30));
    const hubGeometry = trackGeometry(new THREE.CylinderGeometry(0.31, 0.31, 0.62, 18));
    const rimGeometry = trackGeometry(new THREE.TorusGeometry(0.38, 0.055, 8, 24));
    const treadGeometry = trackGeometry(new THREE.BoxGeometry(0.6, 0.14, 0.28));
    for (const side of [-1, 1]) {
      for (const z of wheelStations) {
        const x = side * 1.82;
        const pivot = new THREE.Group();
        pivot.position.set(x, WHEEL_CENTER_Y, z);
        const tire = new THREE.Mesh(tireGeometry, rubber);
        tire.rotation.y = Math.PI / 2;
        tire.castShadow = true;
        tire.receiveShadow = true;
        pivot.add(tire);
        const hub = new THREE.Mesh(hubGeometry, gunmetal);
        hub.rotation.z = Math.PI / 2;
        hub.castShadow = true;
        pivot.add(hub);
        const rim = new THREE.Mesh(rimGeometry, brightSteel);
        rim.rotation.y = Math.PI / 2;
        rim.position.x = side * 0.31;
        pivot.add(rim);
        const innerRim = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.23, 0.035, 8, 20)), amber);
        innerRim.rotation.y = Math.PI / 2;
        innerRim.position.x = side * 0.325;
        pivot.add(innerRim);
        for (let treadIndex = 0; treadIndex < 16; treadIndex += 1) {
          const angle = (treadIndex / 16) * Math.PI * 2;
          const tread = new THREE.Mesh(treadGeometry, treadRubber);
          tread.position.set(0, Math.cos(angle) * 0.87, Math.sin(angle) * 0.87);
          tread.rotation.x = angle;
          tread.rotation.z = treadIndex % 2 ? 0.1 : -0.1;
          tread.castShadow = true;
          pivot.add(tread);
        }
        rover.add(pivot);
        wheels.push(pivot);

        const chassisMount = new THREE.Vector3(side * 1.14, 1.9, z + 0.34);
        const hubMount = new THREE.Vector3(x, WHEEL_CENTER_Y, z);
        beam(rover, chassisMount, hubMount, 0.09, gunmetal, 12);
        beam(rover, new THREE.Vector3(side * 1.12, 1.55, z - 0.38), hubMount, 0.075, brightSteel, 12);
        const damperTop = new THREE.Vector3(side * 1.34, 2.23, z + 0.12);
        const damperBottom = new THREE.Vector3(side * 1.67, 1.26, z - 0.06);
        beam(rover, damperTop, damperBottom, 0.08, suspension, 12);

        const springPoints: THREE.Vector3[] = [];
        for (let index = 0; index <= 56; index += 1) {
          const t = index / 56;
          const angle = t * Math.PI * 12;
          springPoints.push(new THREE.Vector3(
            THREE.MathUtils.lerp(damperBottom.x, damperTop.x, t) + Math.sin(angle) * 0.105,
            THREE.MathUtils.lerp(damperBottom.y, damperTop.y, t),
            THREE.MathUtils.lerp(damperBottom.z, damperTop.z, t) + Math.cos(angle) * 0.105,
          ));
        }
        const spring = new THREE.Mesh(
          trackGeometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 64, 0.035, 6, false)),
          suspension,
        );
        spring.castShadow = true;
        rover.add(spring);
      }
    }

    // Practical lights and bumper details.
    for (const x of [-1.05, 1.05]) {
      addBox(rover, [0.34, 0.18, 0.12], redLight, [x, 2.04, 3.16], false);
      addBox(rover, [0.32, 0.2, 0.12], paleLight, [x, 1.85, -3.34], false);
    }
    addBox(rover, [2.6, 0.08, 0.08], amber, [0, 3.38, 2.95], false);

    // The demo uses a production-quality authored presentation asset while the
    // procedural assembly remains available as the structural prototype.
    rover.visible = false;
    const roverTexture = new THREE.TextureLoader().load("./hauler-sprite-v2.png");
    roverTexture.colorSpace = THREE.SRGBColorSpace;
    roverTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(roverTexture);
    const roverSpriteMaterial = trackMaterial(new THREE.SpriteMaterial({
      map: roverTexture,
      transparent: true,
      alphaTest: 0.015,
      depthWrite: false,
      toneMapped: false,
    }));
    const roverSprite = new THREE.Sprite(roverSpriteMaterial);
    roverSprite.scale.set(9, 5.07, 1);
    roverSprite.position.set(-0.55, 2.5, START_Z);
    scene.add(roverSprite);

    const contactShadow = new THREE.Mesh(
      trackGeometry(new THREE.CircleGeometry(1, 48)),
      trackMaterial(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.scale.set(2.9, 4.15, 1);
    contactShadow.position.set(-0.55, 0.16, START_Z + 0.12);
    scene.add(contactShadow);

    const dustCount = 84;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustGeometry = trackGeometry(new THREE.BufferGeometry());
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = trackMaterial(new THREE.PointsMaterial({ color: 0xc88442, size: 0.15, transparent: true, opacity: 0, depthWrite: false }));
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.position.set(-0.55, 0, START_Z);
    scene.add(dust);

    const sparkCount = 58;
    const sparkPositions = new Float32Array(sparkCount * 3);
    for (let index = 0; index < sparkCount; index += 1) {
      sparkPositions[index * 3] = -5.2 + Math.random() * 2.4;
      sparkPositions[index * 3 + 1] = Math.random() * 7;
      sparkPositions[index * 3 + 2] = -14 + Math.random() * 25;
    }
    const sparkGeometry = trackGeometry(new THREE.BufferGeometry());
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = trackMaterial(new THREE.PointsMaterial({ color: 0xffb04b, size: 0.065, transparent: true, opacity: 0.76, depthWrite: false }));
    scene.add(new THREE.Points(sparkGeometry, sparkMaterial));

    scene.add(new THREE.HemisphereLight(0xb8d2d3, 0x3a1706, 1.8));
    scene.add(new THREE.AmbientLight(0x8a918c, 0.36));
    const key = new THREE.DirectionalLight(0xffbe79, 4.4);
    key.position.set(-7, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -6;
    scene.add(key);
    const cyanFill = new THREE.DirectionalLight(0x58dfff, 1.55);
    cyanFill.position.set(6, 6, -4);
    scene.add(cyanFill);
    const rearRim = new THREE.DirectionalLight(0xff6e22, 2.3);
    rearRim.position.set(-4, 6, 10);
    scene.add(rearRim);

    const cameraTarget = new THREE.Vector3();
    let previousTime = performance.now();
    let previousTravel = 0;
    let frame = 0;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const portrait = width / height < 0.72;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, portrait ? 1.35 : 1.75));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = portrait ? 52 : 39;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      const clock = motionRef.current;
      let raw = 0;
      if (clock.replay) raw = ((now - clock.startedAt) % RUN_DURATION) / RUN_DURATION;
      else if (clock.state === "running") raw = Math.min((now - clock.startedAt) / RUN_DURATION, 1);
      else if (clock.state === "complete") raw = 1;

      const travel = raw * raw * (3 - 2 * raw);
      const distance = Math.max(0, travel - previousTravel) * RUN_DISTANCE;
      previousTravel = raw < 0.02 ? 0 : travel;
      const moving = clock.replay || clock.state === "running";
      const portrait = mount.clientWidth / Math.max(mount.clientHeight, 1) < 0.72;
      const laneX = portrait ? THREE.MathUtils.lerp(2.65, 0.45, travel) : -0.55;
      const spriteHeight = portrait ? 4.06 : 5.07;
      const spriteY = portrait ? 2.04 : 2.5;

      rover.position.z = START_Z - travel * RUN_DISTANCE;
      rover.position.x = laneX + Math.sin(raw * Math.PI) * 0.08;
      rover.position.y = moving ? Math.sin(now * 0.012) * 0.018 : 0;
      rover.rotation.y = Math.sin(raw * Math.PI) * -0.018;
      rover.rotation.z = moving ? Math.sin(now * 0.009) * 0.003 : 0;
      wheels.forEach((wheel, index) => {
        wheel.rotation.x -= distance / WHEEL_RADIUS;
        wheel.position.y = WHEEL_CENTER_Y + (moving ? Math.sin(now * 0.014 + index * 0.85) * 0.025 : 0);
      });
      core.rotation.x += delta * 0.9;
      core.rotation.y += delta * 1.45;
      core.scale.setScalar(1 + Math.sin(now * 0.0045) * 0.045);

      roverSprite.position.set(
        rover.position.x,
        spriteY + (moving ? Math.sin(now * 0.012) * 0.022 : 0),
        rover.position.z,
      );
      roverSprite.scale.set(
        portrait ? 7.2 : 9,
        spriteHeight + (moving ? Math.sin(now * 0.012) * 0.012 : 0),
        1,
      );
      contactShadow.scale.set(portrait ? 2.35 : 2.9, portrait ? 3.3 : 4.15, 1);
      contactShadow.position.set(rover.position.x, 0.16, rover.position.z + 0.1);
      dust.position.set(rover.position.x, 0, rover.position.z);

      dust.visible = moving && raw > 0.015 && raw < 0.92;
      for (let index = 0; index < dustCount; index += 1) {
        const phase = (raw * 7 + index / dustCount) % 1;
        dustPositions[index * 3] = ((index * 19) % 29) / 29 * 3.8 - 1.9;
        dustPositions[index * 3 + 1] = 0.18 + phase * 0.65;
        dustPositions[index * 3 + 2] = 2.7 + phase * 2.7;
      }
      dustGeometry.attributes.position.needsUpdate = true;
      dustMaterial.opacity = moving ? 0.12 + Math.sin(now * 0.004) * 0.025 : 0;

      const sparkArray = sparkGeometry.attributes.position.array as Float32Array;
      for (let index = 0; index < sparkCount; index += 1) {
        sparkArray[index * 3 + 1] += delta * (0.45 + (index % 6) * 0.11);
        if (sparkArray[index * 3 + 1] > 8.5) sparkArray[index * 3 + 1] = -0.2;
      }
      sparkGeometry.attributes.position.needsUpdate = true;

      camera.position.set(portrait ? 10.2 : 8.9, portrait ? 7.4 : 6.35, portrait ? 16.9 : 16.3);
      cameraTarget.set(portrait ? -0.15 : -0.35, 1.55, portrait ? -4.25 : -4.55);
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      className="scene-canvas"
      ref={mountRef}
      style={{ backgroundImage: "url(./foundry-background-v2.png)" }}
    >
      <div className="scene-loading"><i /><span>INITIALIZING FOUNDRY SCENE</span></div>
    </div>
  );
}
