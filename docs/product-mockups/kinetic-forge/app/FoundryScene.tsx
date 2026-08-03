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
    scene.background = new THREE.Color(0x171511);
    scene.fog = new THREE.FogExp2(0x28221b, 0.0175);

    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
    camera.position.set(6.4, 6.4, 17.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Real-time 3D rover driving through an industrial foundry");
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

    const noiseSize = 96;
    const noiseData = new Uint8Array(noiseSize * noiseSize * 4);
    for (let index = 0; index < noiseSize * noiseSize; index += 1) {
      const value = 95 + Math.floor(Math.random() * 125);
      noiseData[index * 4] = value;
      noiseData[index * 4 + 1] = value;
      noiseData[index * 4 + 2] = value;
      noiseData[index * 4 + 3] = 255;
    }
    const metalNoise = new THREE.DataTexture(noiseData, noiseSize, noiseSize, THREE.RGBAFormat);
    metalNoise.wrapS = THREE.RepeatWrapping;
    metalNoise.wrapT = THREE.RepeatWrapping;
    metalNoise.repeat.set(4, 4);
    metalNoise.needsUpdate = true;
    textures.push(metalNoise);

    const steel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x3d4542, roughness: 0.58, roughnessMap: metalNoise, metalness: 0.68 }));
    const darkSteel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x252a27, roughness: 0.56, roughnessMap: metalNoise, metalness: 0.7 }));
    const edgeSteel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x4b4740, roughness: 0.64, roughnessMap: metalNoise, metalness: 0.62 }));
    const paintedSteel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x22312f, roughness: 0.46, roughnessMap: metalNoise, metalness: 0.65 }));
    const rubber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x1b1d1c, roughness: 0.86, metalness: 0.05 }));
    const amber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xe18b1a, emissive: 0x7b3205, emissiveIntensity: 1.7, roughness: 0.32, metalness: 0.58 }));
    const cyan = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x8aeeff, emissive: 0x13c8ed, emissiveIntensity: 5.4, roughness: 0.14, metalness: 0.18 }));
    const furnace = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xffad42, emissive: 0xff5b0b, emissiveIntensity: 7.2, roughness: 0.38 }));
    const redLight = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xff3426, emissive: 0xff170d, emissiveIntensity: 5 }));
    const paleLight = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xffe2a1, emissive: 0xffa52f, emissiveIntensity: 4 }));

    function box(
      width: number,
      height: number,
      depth: number,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      castShadow = true,
    ) {
      const mesh = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(width, height, depth)), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }

    function beam(
      parent: THREE.Object3D,
      start: THREE.Vector3,
      end: THREE.Vector3,
      radius: number,
      material: THREE.Material,
    ) {
      const direction = new THREE.Vector3().subVectors(end, start);
      const mesh = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(radius, radius, direction.length(), 10)), material);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    }

    // Service bridge and raised delivery platform.
    for (let index = 0; index < 16; index += 1) {
      const z = 6.8 - index * 1.28;
      const slab = box(7.25, 0.28, 1.14, index % 3 === 0 ? edgeSteel : steel, 0, 0, z);
      slab.rotation.y = index % 2 === 0 ? 0.002 : -0.002;
      box(0.22, 0.25, 1.18, darkSteel, -3.72, -0.02, z);
      box(0.22, 0.25, 1.18, darkSteel, 3.72, -0.02, z);
      if (index % 2 === 0) {
        box(0.18, 0.11, 0.48, amber, -3.42, 0.19, z, false);
        box(0.18, 0.11, 0.48, amber, 3.42, 0.19, z, false);
      }
      if (index % 4 === 1) box(1.4, 0.035, 0.08, amber, 0, 0.17, z + 0.4, false);
      for (const x of [-2.75, 2.75]) {
        const bolt = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 8)), edgeSteel);
        bolt.position.set(x, 0.16, z + 0.35);
        scene.add(bolt);
      }
    }

    const platform = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(4.7, 4.7, 0.58, 48)), steel);
    platform.position.set(0, -0.04, -14.15);
    platform.receiveShadow = true;
    scene.add(platform);
    const platformRing = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(3.2, 0.11, 12, 64)), amber);
    platformRing.position.set(0, 0.3, -14.15);
    platformRing.rotation.x = Math.PI / 2;
    scene.add(platformRing);
    for (const zOffset of [-0.65, 0.65]) box(4.2, 0.035, 0.16, amber, 0, 0.3, -14.15 + zOffset, false);

    // Bridge guard structure.
    for (const side of [-1, 1]) {
      for (let index = 0; index < 9; index += 1) {
        const z = 6.2 - index * 2.35;
        box(0.13, 1.7, 0.13, edgeSteel, side * 3.9, 0.82, z);
      }
      beam(scene, new THREE.Vector3(side * 3.9, 1.55, 6.2), new THREE.Vector3(side * 3.9, 1.55, -12.6), 0.09, edgeSteel);
      beam(scene, new THREE.Vector3(side * 3.9, 0.78, 6.2), new THREE.Vector3(side * 3.9, 0.78, -12.6), 0.065, darkSteel);
    }

    // Foundry massing, pipes, furnaces and overhead gantries.
    for (const side of [-1, 1]) {
      const x = side * 8.5;
      for (let index = 0; index < 6; index += 1) {
        const z = 8 - index * 5.4;
        box(2.7 + (index % 2), 6 + (index % 3) * 1.5, 3.2, darkSteel, x + side * (index % 2), 2.4, z);
        box(0.42, 10, 0.42, edgeSteel, x - side * 2.1, 4.5, z - 1.2);
      }
      const pipeMaterial = side < 0 ? edgeSteel : steel;
      for (let index = 0; index < 3; index += 1) {
        const pipe = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.32 + index * 0.09, 0.32 + index * 0.09, 18, 14)), pipeMaterial);
        pipe.position.set(x + side * (2.1 + index * 0.8), 4.2, -4 + index * 3.1);
        pipe.rotation.x = Math.PI / 2;
        pipe.castShadow = true;
        scene.add(pipe);
      }
    }

    box(5.8, 4.6, 0.5, darkSteel, -7.1, 2.2, -1.5);
    box(2.2, 2.5, 0.18, furnace, -7.08, 1.65, -1.18, false);
    box(5.4, 4.2, 0.5, darkSteel, 7.5, 2.1, -9.2);
    box(1.65, 1.8, 0.18, furnace, 7.48, 1.25, -8.91, false);
    box(20, 0.35, 0.45, edgeSteel, 0, 8.2, -5.5);
    for (const x of [-7, -3.5, 0, 3.5, 7]) box(0.24, 8.1, 0.24, darkSteel, x, 4.1, -5.5);
    for (const z of [-2.5, -8.5]) {
      box(15.5, 0.18, 1.2, darkSteel, 0, 6.75, z);
      for (const x of [-6.8, -3.4, 0, 3.4, 6.8]) box(0.12, 1.4, 0.12, edgeSteel, x, 7.45, z);
      box(15.5, 0.08, 0.12, amber, 0, 6.95, z + 0.46, false);
    }
    box(34, 0.3, 48, darkSteel, 0, -3.2, -6, false);
    box(3.8, 0.08, 34, furnace, -7.2, -2.95, -5.5, false);
    box(3.2, 0.08, 31, furnace, 7.6, -2.94, -7, false);
    for (const side of [-1, 1]) {
      for (let index = 0; index < 5; index += 1) {
        box(1.6, 0.12, 0.24, amber, side * 6.2, 5.4 + (index % 2) * 1.2, 5 - index * 5.5, false);
      }
    }

    // Rover: every visible part is 3D geometry and moves in the scene.
    const rover = new THREE.Group();
    rover.position.set(0, 0.05, 5.1);
    scene.add(rover);

    const lowerFrame = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(3.55, 0.34, 4.55)), paintedSteel);
    lowerFrame.position.y = 1.05;
    lowerFrame.castShadow = true;
    rover.add(lowerFrame);
    const cargo = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(3.25, 1.55, 2.25)), paintedSteel);
    cargo.position.set(0, 2.05, 0.95);
    cargo.castShadow = true;
    rover.add(cargo);
    const cargoInset = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(2.7, 1.05, 0.12)), darkSteel);
    cargoInset.position.set(0, 2.05, 2.09);
    rover.add(cargoInset);
    const cargoBand = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(3.38, 0.12, 2.38)), amber);
    cargoBand.position.set(0, 1.45, 0.95);
    rover.add(cargoBand);
    const cargoFramePoints = [
      [-1.72, 1.3, -0.2], [1.72, 1.3, -0.2], [-1.72, 2.88, -0.2], [1.72, 2.88, -0.2],
      [-1.72, 1.3, 2.15], [1.72, 1.3, 2.15], [-1.72, 2.88, 2.15], [1.72, 2.88, 2.15],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const cargoFrameEdges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7],[4,7],[5,6]];
    cargoFrameEdges.forEach(([a, b]) => beam(rover, cargoFramePoints[a], cargoFramePoints[b], 0.065, edgeSteel));
    for (const y of [1.7, 2.1, 2.5]) {
      beam(rover, new THREE.Vector3(-1.58, y, 2.17), new THREE.Vector3(1.58, y, 2.17), 0.038, edgeSteel);
    }
    for (const x of [-1.48, 1.48]) {
      beam(rover, new THREE.Vector3(x, 1.35, -2), new THREE.Vector3(x, 2.72, -0.28), 0.06, amber);
      const coreRail = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(0.08, 0.3, 1.45)), cyan);
      coreRail.position.set(x > 0 ? 1.61 : -1.61, 2.05, -1.05);
      rover.add(coreRail);
    }

    const core = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.62, 1)), cyan);
    core.position.set(0, 1.95, -1.12);
    core.castShadow = true;
    rover.add(core);
    const coreHalo = new THREE.PointLight(0x35dfff, 11, 9, 2);
    coreHalo.position.copy(core.position);
    rover.add(coreHalo);

    const cagePoints = [
      [-1.55, 1.25, -2.05], [1.55, 1.25, -2.05], [-1.55, 2.75, -2.05], [1.55, 2.75, -2.05],
      [-1.55, 1.25, -0.25], [1.55, 1.25, -0.25], [-1.55, 2.75, -0.25], [1.55, 2.75, -0.25],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const cageEdges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7],[0,7],[1,6]];
    cageEdges.forEach(([a, b]) => beam(rover, cagePoints[a], cagePoints[b], 0.075, edgeSteel));

    const wheels: THREE.Group[] = [];
    const wheelGeometry = trackGeometry(new THREE.CylinderGeometry(0.77, 0.77, 0.48, 20, 1));
    const hubGeometry = trackGeometry(new THREE.CylinderGeometry(0.28, 0.28, 0.52, 16));
    const treadGeometry = trackGeometry(new THREE.BoxGeometry(0.56, 0.13, 0.25));
    for (const x of [-1.93, 1.93]) {
      for (const z of [-1.65, 0, 1.65]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.78, z);
        const tire = new THREE.Mesh(wheelGeometry, rubber);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        tire.receiveShadow = true;
        pivot.add(tire);
        const hub = new THREE.Mesh(hubGeometry, edgeSteel);
        hub.rotation.z = Math.PI / 2;
        pivot.add(hub);
        const rimRing = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.49, 0.055, 8, 20)), amber);
        rimRing.rotation.y = Math.PI / 2;
        rimRing.position.x = x < 0 ? -0.255 : 0.255;
        pivot.add(rimRing);
        for (let treadIndex = 0; treadIndex < 12; treadIndex += 1) {
          const angle = (treadIndex / 12) * Math.PI * 2;
          const tread = new THREE.Mesh(treadGeometry, rubber);
          tread.position.set(0, Math.cos(angle) * 0.77, Math.sin(angle) * 0.77);
          tread.rotation.x = angle;
          tread.castShadow = true;
          pivot.add(tread);
        }
        rover.add(pivot);
        wheels.push(pivot);
        beam(rover, new THREE.Vector3(x * 0.7, 1.3, z), new THREE.Vector3(x, 0.9, z), 0.08, amber);
      }
    }

    const contactShadowMaterial = trackMaterial(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false }));
    const contactShadow = new THREE.Mesh(trackGeometry(new THREE.CircleGeometry(2.55, 32)), contactShadowMaterial);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.scale.set(1, 1.65, 1);
    contactShadow.position.set(0, 0.12, 0.15);
    rover.add(contactShadow);

    for (const x of [-1.25, 1.25]) {
      const rear = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(0.34, 0.22, 0.12)), redLight);
      rear.position.set(x, 1.65, 2.11);
      rover.add(rear);
      const front = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(0.28, 0.18, 0.12)), paleLight);
      front.position.set(x, 1.48, -2.31);
      rover.add(front);
    }

    const dustCount = 72;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustGeometry = trackGeometry(new THREE.BufferGeometry());
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = trackMaterial(new THREE.PointsMaterial({ color: 0xb56a2c, size: 0.18, transparent: true, opacity: 0.24, depthWrite: false }));
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    rover.add(dust);

    const sparkCount = 90;
    const sparkPositions = new Float32Array(sparkCount * 3);
    for (let index = 0; index < sparkCount; index += 1) {
      sparkPositions[index * 3] = (index % 2 ? 1 : -1) * (5.2 + Math.random() * 4.2);
      sparkPositions[index * 3 + 1] = Math.random() * 8;
      sparkPositions[index * 3 + 2] = -18 + Math.random() * 30;
    }
    const sparkGeometry = trackGeometry(new THREE.BufferGeometry());
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = trackMaterial(new THREE.PointsMaterial({ color: 0xff9a35, size: 0.075, transparent: true, opacity: 0.72, depthWrite: false }));
    const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparks);

    scene.add(new THREE.HemisphereLight(0xa9c8cd, 0x4d2109, 1.5));
    scene.add(new THREE.AmbientLight(0x789293, 0.28));
    const key = new THREE.DirectionalLight(0xffd6a3, 2.85);
    key.position.set(-7, 13, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x76d8ff, 1.4);
    fill.position.set(8, 7, 13);
    scene.add(fill);
    const rearRim = new THREE.DirectionalLight(0xff8c38, 1.9);
    rearRim.position.set(-4, 9, -12);
    scene.add(rearRim);
    const furnaceLight = new THREE.PointLight(0xff7022, 11.5, 25, 1.7);
    furnaceLight.position.set(-6.3, 3.3, -1);
    scene.add(furnaceLight);
    const platformLight = new THREE.PointLight(0xffb44f, 9, 17, 1.7);
    platformLight.position.set(1.5, 3.2, -14);
    scene.add(platformLight);
    const rim = new THREE.SpotLight(0x6de5ff, 11, 34, Math.PI / 4.5, 0.55, 1.3);
    rim.position.set(6, 11, 5);
    rim.target = rover;
    scene.add(rim);
    for (const [x, z, color] of [[-3.25, 4.8, 0xff9b35], [3.25, 0, 0x6de5ff], [-3.25, -5.3, 0xff9b35], [3.25, -10.2, 0x6de5ff]] as const) {
      const routeLight = new THREE.PointLight(color, 2.2, 7.5, 2);
      routeLight.position.set(x, 1.15, z);
      scene.add(routeLight);
    }

    const cameraTarget = new THREE.Vector3();
    let previousTime = performance.now();
    let previousTravel = 0;
    let frame = 0;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const portrait = width / height < 0.72;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, portrait ? 1.45 : 1.8));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = portrait ? 58 : 43;
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
      const distance = Math.max(0, travel - previousTravel) * 18.2;
      previousTravel = raw < 0.02 ? 0 : travel;
      const moving = clock.replay || clock.state === "running";

      rover.position.z = 5.1 - travel * 18.2;
      rover.position.x = 0.72 * (1 - travel) + Math.sin(raw * Math.PI) * 0.16;
      rover.position.y = 0.05 + (moving ? Math.sin(now * 0.012) * 0.025 + Math.sin(now * 0.019) * 0.012 : 0);
      rover.rotation.y = Math.sin(raw * Math.PI * 2) * 0.012;
      rover.rotation.z = moving ? Math.sin(now * 0.01) * 0.004 : 0;
      wheels.forEach((wheel, index) => {
        wheel.rotation.x -= distance / 0.77;
        wheel.position.y = 0.78 + (moving ? Math.sin(now * 0.014 + index * 1.17) * 0.035 : 0);
      });
      core.rotation.x += delta * 1.1;
      core.rotation.y += delta * 1.55;
      core.scale.setScalar(1 + Math.sin(now * 0.005) * 0.055);

      dust.visible = moving && raw > 0.015 && raw < 0.94;
      for (let index = 0; index < dustCount; index += 1) {
        const phase = (raw * 8 + index / dustCount) % 1;
        dustPositions[index * 3] = ((index * 17) % 23) / 23 * 3.6 - 1.8;
        dustPositions[index * 3 + 1] = 0.05 + phase * 0.7;
        dustPositions[index * 3 + 2] = 2.25 + phase * 3.2;
      }
      dustGeometry.attributes.position.needsUpdate = true;
      dustMaterial.opacity = moving ? 0.18 + Math.sin(now * 0.004) * 0.04 : 0;

      const sparkArray = sparkGeometry.attributes.position.array as Float32Array;
      for (let index = 0; index < sparkCount; index += 1) {
        sparkArray[index * 3 + 1] += delta * (0.55 + (index % 7) * 0.12);
        if (sparkArray[index * 3 + 1] > 9) sparkArray[index * 3 + 1] = -0.4;
      }
      sparkGeometry.attributes.position.needsUpdate = true;

      const portrait = mount.clientWidth / Math.max(mount.clientHeight, 1) < 0.72;
      const cameraTravel = travel * (portrait ? 2.7 : 4.8);
      camera.position.set(
        portrait ? 8.8 : 6.4 - travel * 1.1,
        portrait ? 8.2 : 6.4 - travel * 0.65,
        (portrait ? 20.5 : 17.2) - cameraTravel,
      );
      cameraTarget.set(0.35 * (1 - travel), 1.2, -3.4 - travel * (portrait ? 5 : 5.8));
      camera.lookAt(cameraTarget);
      furnaceLight.intensity = 11 + Math.sin(now * 0.006) * 1.25;
      platformLight.intensity = 8.5 + Math.sin(now * 0.004 + 1) * 0.8;
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
    <div className="scene-canvas" ref={mountRef}>
      <div className="scene-loading"><i /><span>INITIALIZING FOUNDRY SCENE</span></div>
    </div>
  );
}
