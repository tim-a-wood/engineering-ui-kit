"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export type MissionPhase = "ready" | "transit" | "blocked" | "winching" | "crossing" | "dock_ready" | "docking" | "complete";

type FoundrySceneProps = {
  phase: MissionPhase;
  replayMode: boolean;
  replayPlaying: boolean;
  replayProgress: number;
};

type MissionClock = {
  phase: MissionPhase;
  replayMode: boolean;
  replay: boolean;
  replayProgress: number;
  startedAt: number;
};

const START_Z = 5.2;
const WHEEL_RADIUS = 0.93;
const WHEEL_CENTER_Y = 1.19;
const DECK_TOP_Y = 0.18;
const RAIL_X = 5.18;
const VEHICLE_HALF_WIDTH = 2.5;

const PHASE_DURATION: Partial<Record<MissionPhase, number>> = {
  transit: 6_000,
  winching: 4_600,
  crossing: 8_500,
  docking: 8_800,
};

function ease(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function replayPhase(progress: number): { phase: MissionPhase; local: number } {
  const seconds = THREE.MathUtils.clamp(progress, 0, 100) * 0.36;
  if (seconds < 1.2) return { phase: "ready", local: seconds / 1.2 };
  if (seconds < 7.2) return { phase: "transit", local: (seconds - 1.2) / 6 };
  if (seconds < 8.7) return { phase: "blocked", local: (seconds - 7.2) / 1.5 };
  if (seconds < 13.3) return { phase: "winching", local: (seconds - 8.7) / 4.6 };
  if (seconds < 21.8) return { phase: "crossing", local: (seconds - 13.3) / 8.5 };
  if (seconds < 23.3) return { phase: "dock_ready", local: (seconds - 21.8) / 1.5 };
  if (seconds < 32.1) return { phase: "docking", local: (seconds - 23.3) / 8.8 };
  return { phase: "complete", local: (seconds - 32.1) / 3.9 };
}

export default function FoundryScene({ phase, replayMode, replayPlaying, replayProgress }: FoundrySceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<MissionClock>({ phase, replayMode, replay: replayPlaying, replayProgress, startedAt: 0 });

  useEffect(() => {
    const prior = motionRef.current;
    motionRef.current = {
      phase,
      replayMode,
      replay: replayPlaying,
      replayProgress,
      startedAt: prior.phase === phase && prior.replayMode === replayMode ? prior.startedAt : performance.now(),
    };
  }, [phase, replayMode, replayPlaying, replayProgress]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030505);
    scene.fog = new THREE.FogExp2(0x080b0b, 0.016);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 150);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute(
      "aria-label",
      "Real-time three-dimensional recovery rover clearing a collapsed gantry and restarting a foundry",
    );
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.3, 1.08);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const importedMaterials = new Set<THREE.Material>();
    const importedTextures = new Set<THREE.Texture>();
    const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
      geometries.push(geometry);
      return geometry;
    };
    const trackMaterial = <T extends THREE.Material>(material: T): T => {
      materials.push(material);
      return material;
    };

    function makeSurfaceTexture(base: string, repeatX: number, repeatY: number) {
      const canvas = document.createElement("canvas");
      canvas.width = 384;
      canvas.height = 384;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas texture context unavailable");
      context.fillStyle = base;
      context.fillRect(0, 0, 384, 384);
      const gradient = context.createLinearGradient(0, 0, 384, 384);
      gradient.addColorStop(0, "rgba(255,255,255,.1)");
      gradient.addColorStop(0.42, "rgba(0,0,0,.08)");
      gradient.addColorStop(1, "rgba(0,0,0,.25)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 384, 384);
      for (let index = 0; index < 520; index += 1) {
        const x = (index * 83) % 384;
        const y = (index * 137) % 384;
        const length = 4 + ((index * 19) % 36);
        context.strokeStyle = index % 5 === 0 ? "rgba(188,94,38,.16)" : "rgba(255,255,255,.055)";
        context.lineWidth = index % 7 === 0 ? 1.4 : 0.55;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(Math.min(384, x + length), y + (index % 3) - 1);
        context.stroke();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.push(texture);
      return texture;
    }

    const metalNoiseSize = 128;
    const noiseData = new Uint8Array(metalNoiseSize * metalNoiseSize * 4);
    for (let index = 0; index < metalNoiseSize * metalNoiseSize; index += 1) {
      const grain = 70 + ((index * 47 + (index % 23) * 17) % 166);
      noiseData[index * 4] = grain;
      noiseData[index * 4 + 1] = grain;
      noiseData[index * 4 + 2] = grain;
      noiseData[index * 4 + 3] = 255;
    }
    const metalNoise = new THREE.DataTexture(noiseData, metalNoiseSize, metalNoiseSize, THREE.RGBAFormat);
    metalNoise.wrapS = THREE.RepeatWrapping;
    metalNoise.wrapT = THREE.RepeatWrapping;
    metalNoise.repeat.set(5, 5);
    metalNoise.needsUpdate = true;
    textures.push(metalNoise);

    const deckMap = makeSurfaceTexture("#44443f", 2.5, 1.5);
    const armorMap = makeSurfaceTexture("#242824", 1.4, 1.4);
    const deckSteel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x595b55,
      map: deckMap,
      roughness: 0.68,
      roughnessMap: metalNoise,
      metalness: 0.76,
    }));
    const darkSteel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x1d211f,
      roughness: 0.58,
      roughnessMap: metalNoise,
      metalness: 0.84,
    }));
    const blackSteel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x101312,
      roughness: 0.47,
      metalness: 0.9,
    }));
    const edgeSteel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x696a63,
      roughness: 0.4,
      roughnessMap: metalNoise,
      metalness: 0.92,
    }));
    const rustSteel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x63371f,
      roughness: 0.82,
      roughnessMap: metalNoise,
      metalness: 0.58,
    }));
    const armor = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x171b19,
      map: armorMap,
      roughness: 0.4,
      roughnessMap: metalNoise,
      metalness: 0.9,
    }));
    const armorPanel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x373c38,
      roughness: 0.48,
      roughnessMap: metalNoise,
      metalness: 0.82,
    }));
    const donorMetal = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x343a36,
      roughness: 0.4,
      roughnessMap: metalNoise,
      metalness: 0.9,
    }));
    const donorDetail = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x777870,
      roughness: 0.34,
      metalness: 0.94,
    }));
    const suspensionMetal = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0xb36e21,
      roughness: 0.38,
      metalness: 0.82,
    }));
    const brass = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xb48b52, roughness: 0.32, metalness: 0.91 }));
    const rubber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x0a0c0b, roughness: 0.98, metalness: 0.01 }));
    const treadRubber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x1c1f1d, roughness: 0.93, metalness: 0.02 }));
    const amber = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0xf2a32c,
      emissive: 0x9a3b05,
      emissiveIntensity: 1.9,
      roughness: 0.3,
      metalness: 0.55,
    }));
    const cyan = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x2da8c1,
      emissive: 0x02647c,
      emissiveIntensity: 1.65,
      roughness: 0.08,
      metalness: 0.12,
    }));
    const coreShell = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x35c2da,
      emissive: 0x005c70,
      emissiveIntensity: 1.55,
      metalness: 0.3,
      roughness: 0.16,
      wireframe: true,
    }));
    const coreEnergy = trackMaterial(new THREE.MeshBasicMaterial({
      color: 0x3bcbe5,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const coreWhite = trackMaterial(new THREE.MeshBasicMaterial({ color: 0xd9fbff }));
    const reactorEnergy = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x214247,
      emissive: 0x2bd9f2,
      emissiveIntensity: 0.04,
      roughness: 0.22,
      metalness: 0.68,
    }));
    const arcMaterial = trackMaterial(new THREE.LineBasicMaterial({
      color: 0x8cf0ff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const furnace = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0xff9b37,
      emissive: 0xff4d08,
      emissiveIntensity: 4.6,
      roughness: 0.28,
    }));
    const furnaceWhite = trackMaterial(new THREE.MeshBasicMaterial({ color: 0xffd38c }));
    const redLight = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xff4937, emissive: 0xff170e, emissiveIntensity: 4.8 }));
    const paleLight = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xffe8bc, emissive: 0xffa62b, emissiveIntensity: 3.6 }));
    const hazeMaterial = trackMaterial(new THREE.MeshBasicMaterial({ color: 0xd36c2d, transparent: true, opacity: 0.04, depthWrite: false, side: THREE.DoubleSide }));

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

    function addRoundedBox(
      parent: THREE.Object3D,
      size: [number, number, number],
      radius: number,
      material: THREE.Material,
      position: [number, number, number],
      castShadow = true,
    ) {
      const mesh = new THREE.Mesh(trackGeometry(new RoundedBoxGeometry(...size, 4, radius)), material);
      mesh.position.set(...position);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addBeam(
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
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addTube(
      parent: THREE.Object3D,
      points: THREE.Vector3[],
      radius: number,
      material: THREE.Material,
      tubularSegments = 36,
    ) {
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.45);
      const mesh = new THREE.Mesh(trackGeometry(new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false)), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addFramedModule(
      parent: THREE.Object3D,
      center: THREE.Vector3,
      width: number,
      height: number,
      depth: number,
      material: THREE.Material,
      radius = 0.065,
    ) {
      const w = width / 2;
      const h = height / 2;
      const d = depth / 2;
      const points = [
        [-w, -h, -d], [w, -h, -d], [-w, h, -d], [w, h, -d],
        [-w, -h, d], [w, -h, d], [-w, h, d], [w, h, d],
      ].map(([x, y, z]) => new THREE.Vector3(center.x + x, center.y + y, center.z + z));
      const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
      edges.forEach(([a, b]) => addBeam(parent, points[a], points[b], radius, material, 12));
      return points;
    }

    function addCoilSpring(parent: THREE.Object3D, position: THREE.Vector3, height: number) {
      const points: THREE.Vector3[] = [];
      const turns = 8;
      for (let index = 0; index <= 64; index += 1) {
        const fraction = index / 64;
        const angle = fraction * Math.PI * 2 * turns;
        points.push(new THREE.Vector3(
          position.x + Math.cos(angle) * 0.13,
          position.y - fraction * height,
          position.z + Math.sin(angle) * 0.13,
        ));
      }
      addTube(parent, points, 0.033, suspensionMetal, 64);
      addBeam(parent, new THREE.Vector3(position.x, position.y + 0.06, position.z), new THREE.Vector3(position.x, position.y - height - 0.06, position.z), 0.045, donorDetail, 10);
    }

    // Wide service bridge with a measured, uninterrupted collision corridor.
    if (RAIL_X - VEHICLE_HALF_WIDTH < 2.2) throw new Error("Foundry route clearance invariant failed");
    const bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);
    for (let index = 0; index < 25; index += 1) {
      const z = 9.1 - index * 1.25;
      const slab = addRoundedBox(bridgeGroup, [9.75, 0.3, 1.16], 0.045, index % 4 === 0 ? edgeSteel : deckSteel, [0, 0.02, z]);
      slab.rotation.y = index % 2 === 0 ? 0.002 : -0.002;
      addBox(bridgeGroup, [0.22, 0.38, 1.18], darkSteel, [-4.88, 0.03, z]);
      addBox(bridgeGroup, [0.22, 0.38, 1.18], darkSteel, [4.88, 0.03, z]);
      if (index % 2 === 0) {
        for (const x of [-4.51, 4.51]) addRoundedBox(bridgeGroup, [0.22, 0.08, 0.62], 0.025, amber, [x, 0.215, z], false);
      }
      if (index % 5 === 2) {
        for (const x of [-2.65, 2.65]) addBox(bridgeGroup, [1.1, 0.035, 0.07], rustSteel, [x, 0.19, z + 0.37], false);
      }
    }

    const boltGeometry = trackGeometry(new THREE.CylinderGeometry(0.055, 0.055, 0.055, 8));
    const bridgeBolts = new THREE.InstancedMesh(boltGeometry, donorDetail, 200);
    const boltMatrix = new THREE.Matrix4();
    let boltIndex = 0;
    for (let plate = 0; plate < 25; plate += 1) {
      const z = 9.1 - plate * 1.25;
      for (const x of [-4.52, -3.2, 3.2, 4.52]) {
        for (const dz of [-0.42, 0.42]) {
          boltMatrix.makeTranslation(x, 0.225, z + dz);
          bridgeBolts.setMatrixAt(boltIndex, boltMatrix);
          boltIndex += 1;
        }
      }
    }
    bridgeBolts.castShadow = true;
    bridgeBolts.receiveShadow = true;
    bridgeGroup.add(bridgeBolts);

    const turntable = new THREE.Group();
    turntable.position.set(0, 0, -10.4);
    scene.add(turntable);
    const platform = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(5.8, 5.8, 0.68, 64)), deckSteel);
    platform.position.set(0, -0.08, 0);
    platform.receiveShadow = true;
    turntable.add(platform);
    for (const radius of [3.7, 4.65]) {
      const ring = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(radius, radius === 3.7 ? 0.105 : 0.045, 12, 96)), radius === 3.7 ? amber : edgeSteel);
      ring.position.set(0, 0.27, 0);
      ring.rotation.x = Math.PI / 2;
      turntable.add(ring);
    }
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      const marker = addRoundedBox(turntable, [0.18, 0.055, 0.86], 0.02, amber, [Math.sin(angle) * 4.15, 0.285, Math.cos(angle) * 4.15], false);
      marker.rotation.y = angle;
    }

    // The incident is real scene geometry: it drops into the collision corridor and is winched clear.
    const obstruction = new THREE.Group();
    scene.add(obstruction);
    addRoundedBox(obstruction, [9.1, 0.62, 0.78], 0.08, rustSteel, [0, 0, 0]);
    addBox(obstruction, [8.35, 0.18, 0.84], edgeSteel, [0, 0.41, 0]);
    for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) addBox(obstruction, [0.14, 1.35, 0.92], darkSteel, [x, -0.18, 0]);
    obstruction.position.set(0, 7.3, -1.3);

    const cableMaterial = trackMaterial(new THREE.LineBasicMaterial({ color: 0xe8ece8, transparent: true, opacity: 0.9 }));
    const cableGeometry = trackGeometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
    const winchCable = new THREE.Line(cableGeometry, cableMaterial);
    winchCable.visible = false;
    scene.add(winchCable);

    // Guard rails and under-deck bracing stay outside the vehicle envelope.
    for (const side of [-1, 1]) {
      for (let index = 0; index < 12; index += 1) {
        const z = 8.7 - index * 2.55;
        addBeam(scene, new THREE.Vector3(side * RAIL_X, 0.16, z), new THREE.Vector3(side * RAIL_X, 1.34, z), 0.09, edgeSteel, 12);
        addBeam(scene, new THREE.Vector3(side * RAIL_X, 0.56, z), new THREE.Vector3(side * (RAIL_X + 0.54), -1.15, z), 0.11, rustSteel, 12);
      }
      addBeam(scene, new THREE.Vector3(side * RAIL_X, 1.33, 8.7), new THREE.Vector3(side * RAIL_X, 1.33, -18.6), 0.09, edgeSteel, 12);
      addBeam(scene, new THREE.Vector3(side * RAIL_X, 0.7, 8.7), new THREE.Vector3(side * RAIL_X, 0.7, -18.6), 0.058, donorDetail, 10);
      addBeam(scene, new THREE.Vector3(side * (RAIL_X + 0.55), -1.16, 8.7), new THREE.Vector3(side * (RAIL_X + 0.55), -1.16, -18.6), 0.12, darkSteel, 12);
    }

    // Layered industrial architecture. Every low support remains well outside the route.
    const gantrySupportStations = [-10.2, 10.2];
    if (gantrySupportStations.some((x) => Math.abs(x) < RAIL_X + 2.5)) {
      throw new Error("Gantry support entered the drive corridor");
    }

    function addFoundryTower(side: number, z: number, variant: number) {
      const tower = new THREE.Group();
      tower.position.set(side * (11.8 + variant * 0.55), 0, z);
      scene.add(tower);
      const width = 4.7 + variant * 0.55;
      const height = 6.8 + variant * 1.15;
      addRoundedBox(tower, [width, height, 3.5], 0.12, darkSteel, [0, height / 2 - 1.1, 0]);
      addBox(tower, [width + 0.24, 0.24, 3.72], edgeSteel, [0, height - 2.12, 0]);
      for (const x of [-width / 2 - 0.08, width / 2 + 0.08]) {
        addBox(tower, [0.28, height + 1.6, 0.3], rustSteel, [x, height / 2 - 0.65, 0]);
      }
      for (let level = 0; level < 3; level += 1) {
        const y = 1.2 + level * 1.65;
        addBox(tower, [width + 0.5, 0.13, 3.9], donorDetail, [0, y, 0]);
        for (const x of [-width / 2 - 0.22, width / 2 + 0.22]) {
          addBeam(tower, new THREE.Vector3(x, y, -1.7), new THREE.Vector3(x, y + 1.35, 1.7), 0.055, edgeSteel, 8);
        }
      }
      const opening = addRoundedBox(tower, [2.4, 2.35, 0.08], 0.08, furnace, [0, 1.3, side < 0 ? 1.79 : -1.79], false);
      const hotCore = addRoundedBox(tower, [1.25, 1.3, 0.04], 0.05, furnaceWhite, [0, 1.3, side < 0 ? 1.84 : -1.84], false);
      opening.rotation.y = side < 0 ? 0 : Math.PI;
      hotCore.rotation.y = opening.rotation.y;
      for (let pipe = 0; pipe < 3; pipe += 1) {
        const x = side * (0.65 + pipe * 0.54);
        addBeam(tower, new THREE.Vector3(x, height - 1.9, -1.1), new THREE.Vector3(x, height + 4.2 + pipe * 0.5, -1.1), 0.22 + pipe * 0.045, pipe % 2 ? edgeSteel : rustSteel, 14);
        const cap = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.36 + pipe * 0.05, 0.28 + pipe * 0.04, 0.32, 14)), blackSteel);
        cap.position.set(x, height + 4.35 + pipe * 0.5, -1.1);
        tower.add(cap);
      }
    }

    for (const side of [-1, 1]) {
      [-14.8, -5, 5.8].forEach((z, index) => addFoundryTower(side, z, index % 3));
      addTube(scene, [
        new THREE.Vector3(side * 8.1, 1.1, 10),
        new THREE.Vector3(side * 8.6, 4.8, 7),
        new THREE.Vector3(side * 9.2, 6.7, 1),
        new THREE.Vector3(side * 9.1, 6.5, -8),
        new THREE.Vector3(side * 8.4, 4.6, -14.5),
      ], 0.28, side < 0 ? rustSteel : edgeSteel, 70);
      addTube(scene, [
        new THREE.Vector3(side * 9.25, 0.7, 9),
        new THREE.Vector3(side * 9.7, 3.8, 4.5),
        new THREE.Vector3(side * 9.8, 4.1, -5.5),
        new THREE.Vector3(side * 9.4, 2.8, -14),
      ], 0.14, donorDetail, 60);
      for (const z of [7, 1, -6, -13]) {
        const catwalk = addBox(scene, [5.7, 0.16, 1.08], darkSteel, [side * 10.9, 5.35, z]);
        catwalk.castShadow = true;
        for (const dz of [-0.48, 0.48]) {
          addBeam(scene, new THREE.Vector3(side * 8.1, 5.45, z + dz), new THREE.Vector3(side * 13.7, 5.45, z + dz), 0.05, edgeSteel, 8);
          for (let index = 0; index < 7; index += 1) {
            const x = side * (8.1 + index * 0.92);
            addBeam(scene, new THREE.Vector3(x, 5.42, z + dz), new THREE.Vector3(x, 6.15, z + dz), 0.042, donorDetail, 8);
          }
          addBeam(scene, new THREE.Vector3(side * 8.1, 6.15, z + dz), new THREE.Vector3(side * 13.7, 6.15, z + dz), 0.052, edgeSteel, 8);
        }
      }
    }

    for (const z of [-3.7, -11.3]) {
      addBox(scene, [20.5, 0.25, 1.35], blackSteel, [0, 8.4, z]);
      addBox(scene, [20.8, 0.1, 0.13], amber, [0, 8.57, z + 0.55], false);
      for (const x of [-9.6, -6.4, -3.2, 0, 3.2, 6.4, 9.6]) {
        addBeam(scene, new THREE.Vector3(x - 1.2, 8.28, z - 0.55), new THREE.Vector3(x + 1.2, 9.7, z + 0.55), 0.07, rustSteel, 8);
      }
      for (const x of gantrySupportStations) {
        addBox(scene, [0.34, 9, 0.34], darkSteel, [x, 4.4, z]);
        addBox(scene, [0.6, 0.22, 0.7], edgeSteel, [x, 8.58, z]);
      }
    }

    // Deep floor, molten channels and translucent heat layers establish scale without fake backdrops.
    addBox(scene, [42, 0.45, 60], blackSteel, [0, -3.42, -7.5], false);
    for (const x of [-12.7, -8.4, 8.7, 12.4]) {
      addBox(scene, [2.55, 0.08, 48], furnace, [x, -3.16, -7], false);
      addBox(scene, [0.72, 0.035, 48], furnaceWhite, [x + 0.15, -3.105, -7], false);
    }
    for (let index = 0; index < 7; index += 1) {
      const haze = new THREE.Mesh(trackGeometry(new THREE.PlaneGeometry(14 + index * 2, 4.5)), hazeMaterial);
      haze.position.set(index % 2 ? 9.5 : -9.5, 1.2 + index * 0.55, -19 + index * 6.4);
      haze.rotation.y = (index % 2 ? -1 : 1) * 0.35;
      scene.add(haze);
    }

    // Node 7 reactor cradle provides a clear physical destination and a large restoration payoff.
    const reactor = new THREE.Group();
    reactor.position.set(0, 0, -20.4);
    scene.add(reactor);
    addRoundedBox(reactor, [8.6, 0.72, 3.5], 0.12, blackSteel, [0, 0.12, -0.85]);
    addRoundedBox(reactor, [4.8, 2.35, 1.8], 0.16, armorPanel, [0, 1.3, -1.22]);
    for (const side of [-1, 1]) {
      addRoundedBox(reactor, [0.62, 7.4, 0.76], 0.1, edgeSteel, [side * 3.05, 3.48, -0.35]);
      addBeam(reactor, new THREE.Vector3(side * 3.05, 6.85, -0.32), new THREE.Vector3(side * 1.35, 5.25, 0.24), 0.15, rustSteel, 14);
      addBox(reactor, [0.13, 4.9, 0.16], reactorEnergy, [side * 2.08, 3.5, -0.12], false);
      for (let y = 1.3; y < 6.1; y += 0.72) addBox(reactor, [0.5, 0.08, 0.18], reactorEnergy, [side * 2.08, y, -0.08], false);
    }
    const socketRings: THREE.Mesh[] = [];
    for (let index = 0; index < 4; index += 1) {
      const ring = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(1.02 + index * 0.17, 0.075, 12, 72)), reactorEnergy);
      ring.position.set(0, 3.52, 0.08 - index * 0.14);
      ring.rotation.x = Math.PI / 2;
      reactor.add(ring);
      socketRings.push(ring);
    }

    const socketLocks: { group: THREE.Group; direction: THREE.Vector3 }[] = [];
    for (let index = 0; index < 4; index += 1) {
      const angle = index / 4 * Math.PI * 2;
      const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const group = new THREE.Group();
      group.position.copy(direction).multiplyScalar(1.62).add(new THREE.Vector3(0, 3.52, 0));
      group.rotation.y = angle;
      reactor.add(group);
      addRoundedBox(group, [0.42, 0.34, 0.78], 0.08, darkSteel, [0, 0, 0]);
      addRoundedBox(group, [0.18, 0.12, 0.34], 0.04, amber, [0, 0.12, -0.32], false);
      socketLocks.push({ group, direction });
    }

    // A real overhead handling system owns the entire core transfer. The trolley,
    // hoist lines, capture head and socket locks remain visible throughout the handoff.
    const craneBridge = new THREE.Group();
    scene.add(craneBridge);
    for (const x of [-1.72, 1.72]) {
      addRoundedBox(craneBridge, [0.34, 0.42, 9.2], 0.06, edgeSteel, [x, 8.18, -18.05]);
      addBox(craneBridge, [0.08, 0.08, 8.86], amber, [x, 7.95, -18.05], false);
    }
    for (const z of [-22.3, -20.1, -17.9, -15.7, -13.7]) {
      addBeam(craneBridge, new THREE.Vector3(-1.72, 8.18, z), new THREE.Vector3(1.72, 8.18, z), 0.075, rustSteel, 10);
    }

    const craneTrolley = new THREE.Group();
    craneTrolley.position.set(0, 7.78, -20.32);
    scene.add(craneTrolley);
    addRoundedBox(craneTrolley, [3.46, 0.46, 1.18], 0.1, darkSteel, [0, 0, 0]);
    addRoundedBox(craneTrolley, [1.42, 0.4, 0.76], 0.08, armorPanel, [0, -0.37, 0]);
    const craneDrum = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.28, 0.28, 1.3, 24)), donorDetail);
    craneDrum.rotation.z = Math.PI / 2;
    craneDrum.position.y = -0.48;
    craneTrolley.add(craneDrum);
    for (const x of [-1.48, 1.48]) {
      for (const z of [-0.38, 0.38]) {
        const wheel = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.17, 0.17, 0.18, 18)), blackSteel);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.14, z);
        craneTrolley.add(wheel);
      }
      addRoundedBox(craneTrolley, [0.22, 0.12, 0.18], 0.035, amber, [x, -0.31, -0.52], false);
    }

    const rover = new THREE.Group();
    rover.position.set(0.2, 0, START_Z);
    rover.userData.collisionEnvelope = {
      halfWidth: VEHICLE_HALF_WIDTH,
      minY: DECK_TOP_Y,
      routeRailX: RAIL_X,
    };
    scene.add(rover);

    // Detailed NASA/JPL mesh supplies authentic mechanical complexity below the authored hauler body.
    const donorRoot = new THREE.Group();
    donorRoot.scale.set(1.55, 1.42, 2.18);
    donorRoot.position.set(0, 0.32, 0.06);
    rover.add(donorRoot);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("./draco/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    let alive = true;
    gltfLoader.load(
      "./models/perseverance-rover.glb",
      (gltf) => {
        if (!alive) return;
        const donor = gltf.scene;
        const hiddenAssemblies = [
          "Wheels_objs", "Cylinder", "Armature", "arm.003", "arm_01_joint", "arm_02_joint",
          "antenna_uhf", "antenna_hg", "antenna_lg", "Name_Chips", "lab", "rtg",
        ];
        hiddenAssemblies.forEach((name) => {
          const assembly = donor.getObjectByName(name);
          if (assembly) assembly.visible = false;
        });
        donor.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
          sourceMaterials.forEach((material) => {
            importedMaterials.add(material);
            Object.values(material).forEach((value) => {
              if (value instanceof THREE.Texture) importedTextures.add(value);
            });
          });
          const detailName = `${child.name} ${child.parent?.name ?? ""}`.toLowerCase();
          child.material = detailName.includes("suspension") || detailName.includes("swingarm")
            ? suspensionMetal
            : detailName.includes("body") || detailName.includes("parts")
              ? donorMetal
              : donorDetail;
          child.castShadow = true;
          child.receiveShadow = true;
        });
        donorRoot.add(donor);
        mount.dataset.vehicleLoaded = "true";
      },
      undefined,
      () => {
        mount.dataset.vehicleLoaded = "error";
      },
    );

    // Kinetic Forge RF-06 body: low armored cargo hauler with a live containment core.
    addRoundedBox(rover, [3.64, 0.38, 6.7], 0.13, armor, [0, 1.5, 0.05]);
    addRoundedBox(rover, [2.86, 0.42, 6.12], 0.12, blackSteel, [0, 1.25, 0.08]);
    addBox(rover, [3.28, 0.1, 5.96], armorPanel, [0, 1.72, 0.03]);
    for (const side of [-1, 1]) {
      addBeam(rover, new THREE.Vector3(side * 1.62, 1.36, -3.18), new THREE.Vector3(side * 1.62, 1.36, 3.2), 0.1, donorMetal, 12);
      addBeam(rover, new THREE.Vector3(side * 1.77, 1.68, -3.04), new THREE.Vector3(side * 1.77, 1.68, 3.08), 0.075, donorDetail, 10);
    }

    const cargoCenter = new THREE.Vector3(0, 2.76, 1.92);
    addRoundedBox(rover, [3.42, 1.82, 2.38], 0.18, armor, [cargoCenter.x, cargoCenter.y, cargoCenter.z]);
    addRoundedBox(rover, [3.05, 1.38, 0.12], 0.04, armorPanel, [0, 2.76, 3.13]);
    addRoundedBox(rover, [2.92, 0.12, 2.05], 0.04, armorPanel, [0, 3.69, 1.91]);
    addFramedModule(rover, cargoCenter, 3.67, 2.08, 2.62, donorDetail, 0.07);
    for (const x of [-1.22, -0.62, 0, 0.62, 1.22]) addBox(rover, [0.07, 1.28, 0.1], donorDetail, [x, 2.74, 3.18]);
    for (const y of [2.16, 2.76, 3.36]) addBox(rover, [3.04, 0.065, 0.11], donorDetail, [0, y, 3.18]);
    addRoundedBox(rover, [3.54, 0.12, 0.18], 0.03, amber, [0, 1.94, 3.12], false);
    for (const side of [-1, 1]) {
      for (const z of [1.24, 1.92, 2.6]) {
        addRoundedBox(rover, [0.1, 1.28, 0.52], 0.035, armorPanel, [side * 1.76, 2.75, z]);
        const cap = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 18)), brass);
        cap.position.set(side * 1.825, 2.75, z);
        cap.rotation.z = Math.PI / 2;
        rover.add(cap);
        const capInner = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.055, 0.055, 0.13, 12)), blackSteel);
        capInner.position.set(side * 1.835, 2.75, z);
        capInner.rotation.z = Math.PI / 2;
        rover.add(capInner);
      }
      addBeam(rover, new THREE.Vector3(side * 1.84, 1.94, 0.7), new THREE.Vector3(side * 1.84, 3.57, 3.05), 0.05, donorDetail, 10);
    }

    const cageCenter = new THREE.Vector3(0, 2.4, -1.02);
    const cagePoints = addFramedModule(rover, cageCenter, 3.48, 1.82, 2.35, donorDetail, 0.074);
    addBeam(rover, cagePoints[0], cagePoints[7], 0.061, donorDetail, 12);
    addBeam(rover, cagePoints[1], cagePoints[6], 0.061, donorDetail, 12);
    const cageLatches: { group: THREE.Group; base: THREE.Vector3; direction: THREE.Vector3; angle: number }[] = [];
    for (let index = 0; index < 4; index += 1) {
      const angle = index / 4 * Math.PI * 2;
      const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const base = cageCenter.clone().addScaledVector(direction, 1.18);
      const group = new THREE.Group();
      group.position.copy(base);
      group.rotation.y = angle;
      rover.add(group);
      addRoundedBox(group, [0.3, 0.62, 0.52], 0.06, darkSteel, [0, 0.24, 0]);
      addRoundedBox(group, [0.17, 0.18, 0.38], 0.045, amber, [0, 0.2, -0.3], false);
      addBeam(group, new THREE.Vector3(0, -0.15, 0.1), new THREE.Vector3(0, -0.48, 0.48), 0.06, donorDetail, 10);
      cageLatches.push({ group, base, direction, angle });
    }
    const coreAssembly = new THREE.Group();
    coreAssembly.position.copy(cageCenter);
    rover.add(coreAssembly);

    const pedestal = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.5, 0.62, 0.18, 24)), blackSteel);
    pedestal.position.y = -0.82;
    pedestal.castShadow = true;
    coreAssembly.add(pedestal);
    const pedestalRing = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.48, 0.035, 10, 48)), cyan);
    pedestalRing.position.y = -0.71;
    pedestalRing.rotation.x = Math.PI / 2;
    coreAssembly.add(pedestalRing);

    const core = new THREE.Mesh(trackGeometry(new THREE.DodecahedronGeometry(0.53, 0)), coreShell);
    core.scale.set(0.74, 1.1, 0.74);
    core.castShadow = true;
    coreAssembly.add(core);
    const coreInner = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.19, 3)), coreEnergy);
    coreAssembly.add(coreInner);
    const coreHot = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.06, 2)), coreWhite);
    coreAssembly.add(coreHot);

    const coreRings: THREE.Group[] = [];
    for (const rotation of [[0, 0, 0], [0, Math.PI / 2, 0], [Math.PI / 2, 0, 0]] as const) {
      const ringGroup = new THREE.Group();
      ringGroup.rotation.set(...rotation);
      const frameRing = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.94, 0.052, 12, 80)), donorDetail);
      frameRing.castShadow = true;
      ringGroup.add(frameRing);
      ringGroup.add(new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.94, 0.012, 8, 80)), coreEnergy));
      for (let nodeIndex = 0; nodeIndex < 6; nodeIndex += 1) {
        const angle = nodeIndex / 6 * Math.PI * 2;
        const node = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.052, 1)), nodeIndex % 2 ? cyan : brass);
        node.position.set(Math.cos(angle) * 0.94, Math.sin(angle) * 0.94, 0);
        ringGroup.add(node);
      }
      coreAssembly.add(ringGroup);
      coreRings.push(ringGroup);
    }

    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      const electrode = addRoundedBox(coreAssembly, [0.15, 0.15, 0.46], 0.04, donorDetail, [Math.sin(angle) * 1.18, Math.cos(angle) * 0.72, 0]);
      electrode.rotation.z = -angle;
      const tip = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.07, 1)), cyan);
      tip.position.set(Math.sin(angle) * 0.84, Math.cos(angle) * 0.51, 0);
      coreAssembly.add(tip);
      addBeam(coreAssembly, new THREE.Vector3(Math.sin(angle) * 1.1, Math.cos(angle) * 0.67, 0), new THREE.Vector3(Math.sin(angle) * 0.82, Math.cos(angle) * 0.5, 0), 0.028, donorDetail, 8);
    }

    const arcLines: { line: THREE.Line; positions: Float32Array; phase: number }[] = [];
    for (let arcIndex = 0; arcIndex < 4; arcIndex += 1) {
      const positions = new Float32Array(22 * 3);
      const geometry = trackGeometry(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geometry, arcMaterial);
      line.frustumCulled = false;
      coreAssembly.add(line);
      arcLines.push({ line, positions, phase: arcIndex / 4 * Math.PI * 2 });
    }

    const coreHalo = new THREE.PointLight(0x39dfff, 7, 6.5, 2);
    coreAssembly.add(coreHalo);

    const clampRig = new THREE.Group();
    clampRig.visible = false;
    scene.add(clampRig);
    const clampRing = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(1.38, 0.11, 14, 72)), donorMetal);
    clampRing.rotation.x = Math.PI / 2;
    clampRing.castShadow = true;
    clampRig.add(clampRing);
    const clampSignalRing = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(1.38, 0.025, 8, 72)), amber);
    clampSignalRing.rotation.x = Math.PI / 2;
    clampSignalRing.position.y = -0.03;
    clampRig.add(clampSignalRing);
    addRoundedBox(clampRig, [1.42, 0.28, 0.84], 0.07, armorPanel, [0, 0.34, 0]);
    addBeam(clampRig, new THREE.Vector3(-1.25, 0.02, 0), new THREE.Vector3(1.25, 0.02, 0), 0.065, donorDetail, 10);
    addBeam(clampRig, new THREE.Vector3(0, 0.02, -1.25), new THREE.Vector3(0, 0.02, 1.25), 0.065, donorDetail, 10);
    const clampJaws: THREE.Group[] = [];
    for (let index = 0; index < 4; index += 1) {
      const angle = index / 4 * Math.PI * 2;
      const jaw = new THREE.Group();
      jaw.rotation.y = angle;
      clampRig.add(jaw);
      addRoundedBox(jaw, [0.28, 1.38, 0.3], 0.065, edgeSteel, [0, -0.68, 0]);
      addRoundedBox(jaw, [0.46, 0.3, 0.46], 0.07, amber, [0, -1.31, -0.08], false);
      addBeam(jaw, new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, -0.72, -0.18), 0.065, suspensionMetal, 10);
      clampJaws.push(jaw);
    }
    const clampBeacon = new THREE.PointLight(0xffa12b, 0, 5.5, 2);
    clampBeacon.position.y = -0.55;
    clampRig.add(clampBeacon);

    const craneCables: {
      line: THREE.Line;
      geometry: THREE.BufferGeometry;
      trolleyAnchor: THREE.Vector3;
      clampAnchor: THREE.Vector3;
    }[] = [];
    for (const [x, z] of [[-0.72, -0.36], [0.72, -0.36], [-0.72, 0.36], [0.72, 0.36]] as const) {
      const geometry = trackGeometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
      const line = new THREE.Line(geometry, cableMaterial);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      craneCables.push({
        line,
        geometry,
        trolleyAnchor: new THREE.Vector3(x, -0.58, z),
        clampAnchor: new THREE.Vector3(x * 0.9, 0.37, z * 0.9),
      });
    }
    addTube(rover, [new THREE.Vector3(-1.42, 1.8, -1.9), new THREE.Vector3(-1.52, 2.05, -0.2), new THREE.Vector3(-1.55, 2.1, 1.08)], 0.055, cyan, 32);
    addTube(rover, [new THREE.Vector3(1.42, 1.8, -1.9), new THREE.Vector3(1.52, 2.05, -0.2), new THREE.Vector3(1.55, 2.1, 1.08)], 0.055, cyan, 32);

    const nose = addRoundedBox(rover, [3.28, 0.94, 1.1], 0.17, armor, [0, 2.06, -2.82]);
    nose.rotation.x = -0.07;
    addRoundedBox(rover, [2.56, 0.18, 1.25], 0.05, armorPanel, [0, 2.52, -2.7]);
    addBox(rover, [4.28, 0.22, 0.28], donorMetal, [0, 1.31, -3.35]);
    addRoundedBox(rover, [4.08, 0.12, 0.16], 0.03, amber, [0, 1.54, -3.43], false);
    const winchDrum = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.3, 0.3, 1.18, 24)), donorDetail);
    winchDrum.position.set(0, 1.16, -3.42);
    winchDrum.rotation.z = Math.PI / 2;
    rover.add(winchDrum);
    const winchHook = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.17, 0.05, 10, 24, Math.PI * 1.5)), amber);
    winchHook.position.set(0, 1.14, -3.68);
    winchHook.rotation.y = Math.PI / 2;
    rover.add(winchHook);
    for (const x of [-1.37, 1.37]) {
      addRoundedBox(rover, [0.44, 0.24, 0.13], 0.05, paleLight, [x, 1.98, -3.36], false);
      addRoundedBox(rover, [0.4, 0.24, 0.13], 0.05, redLight, [x, 2.2, 3.16], false);
      const headLight = new THREE.SpotLight(0xffd8a0, 2.8, 12, Math.PI / 7, 0.55, 1.4);
      headLight.position.set(x, 1.98, -3.42);
      headLight.target.position.set(x * 0.8, 0.2, -10);
      rover.add(headLight, headLight.target);
    }

    // Six high-detail wheel assemblies. Their 8 cm clearance is explicit and animation-safe.
    const wheels: THREE.Group[] = [];
    const wheelStations = [-2.48, -0.05, 2.34];
    const tireGeometry = trackGeometry(new THREE.TorusGeometry(0.68, 0.25, 24, 64));
    const hubGeometry = trackGeometry(new THREE.CylinderGeometry(0.36, 0.36, 0.72, 32));
    const brakeGeometry = trackGeometry(new THREE.CylinderGeometry(0.285, 0.285, 0.75, 32));
    const rimGeometry = trackGeometry(new THREE.TorusGeometry(0.41, 0.052, 12, 48));
    const rimInnerGeometry = trackGeometry(new THREE.TorusGeometry(0.29, 0.032, 10, 42));
    const treadGeometry = trackGeometry(new RoundedBoxGeometry(0.62, 0.09, 0.17, 2, 0.025));
    const lugGeometry = trackGeometry(new THREE.CylinderGeometry(0.038, 0.038, 0.1, 8));
    const instanceMatrix = new THREE.Matrix4();
    const instancePosition = new THREE.Vector3();
    const instanceQuaternion = new THREE.Quaternion();
    const instanceScale = new THREE.Vector3(1, 1, 1);
    const instanceEuler = new THREE.Euler();

    for (const side of [-1, 1]) {
      for (let stationIndex = 0; stationIndex < wheelStations.length; stationIndex += 1) {
        const z = wheelStations[stationIndex];
        const x = side * 2.08;
        const pivot = new THREE.Group();
        pivot.position.set(x, WHEEL_CENTER_Y, z);
        pivot.userData.baseY = WHEEL_CENTER_Y;

        const tire = new THREE.Mesh(tireGeometry, rubber);
        tire.rotation.y = Math.PI / 2;
        tire.castShadow = true;
        tire.receiveShadow = true;
        pivot.add(tire);
        const hub = new THREE.Mesh(hubGeometry, donorMetal);
        hub.rotation.z = Math.PI / 2;
        hub.castShadow = true;
        pivot.add(hub);
        const brake = new THREE.Mesh(brakeGeometry, suspensionMetal);
        brake.rotation.z = Math.PI / 2;
        pivot.add(brake);
        for (const face of [-1, 1]) {
          const rim = new THREE.Mesh(rimGeometry, edgeSteel);
          rim.rotation.y = Math.PI / 2;
          rim.position.x = face * 0.36;
          pivot.add(rim);
          const rimInner = new THREE.Mesh(rimInnerGeometry, blackSteel);
          rimInner.rotation.y = Math.PI / 2;
          rimInner.position.x = face * 0.372;
          pivot.add(rimInner);
        }

        const treads = new THREE.InstancedMesh(treadGeometry, treadRubber, 34);
        for (let treadIndex = 0; treadIndex < 34; treadIndex += 1) {
          const angle = treadIndex / 34 * Math.PI * 2;
          instancePosition.set(0, Math.cos(angle) * 0.91, Math.sin(angle) * 0.91);
          instanceEuler.set(angle, 0, treadIndex % 2 ? 0.11 : -0.11);
          instanceQuaternion.setFromEuler(instanceEuler);
          instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale);
          treads.setMatrixAt(treadIndex, instanceMatrix);
        }
        treads.castShadow = true;
        treads.receiveShadow = true;
        pivot.add(treads);

        const lugs = new THREE.InstancedMesh(lugGeometry, brass, 8);
        for (let lugIndex = 0; lugIndex < 8; lugIndex += 1) {
          const angle = lugIndex / 8 * Math.PI * 2;
          instancePosition.set(side * 0.405, Math.cos(angle) * 0.19, Math.sin(angle) * 0.19);
          instanceEuler.set(0, 0, Math.PI / 2);
          instanceQuaternion.setFromEuler(instanceEuler);
          instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale);
          lugs.setMatrixAt(lugIndex, instanceMatrix);
        }
        pivot.add(lugs);
        rover.add(pivot);
        wheels.push(pivot);

        const wheelMount = new THREE.Vector3(x, WHEEL_CENTER_Y, z);
        addBeam(rover, new THREE.Vector3(side * 1.25, 1.92, z + 0.36), wheelMount, 0.12, donorMetal, 12);
        addBeam(rover, new THREE.Vector3(side * 1.28, 1.55, z - 0.46), wheelMount, 0.085, donorDetail, 12);
        addBeam(rover, new THREE.Vector3(side * 1.48, 2.15, z + 0.19), new THREE.Vector3(side * 1.85, 1.32, z - 0.03), 0.095, suspensionMetal, 12);
        addCoilSpring(rover, new THREE.Vector3(side * 1.72, 2.3, z + 0.02), 0.72);
        const fender = addRoundedBox(rover, [0.15, 0.3, 1.62], 0.08, armorPanel, [side * 2.01, 2.07, z]);
        fender.rotation.z = side * -0.025;
      }
    }

    const contactShadow = new THREE.Mesh(
      trackGeometry(new THREE.CircleGeometry(1, 64)),
      trackMaterial(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.scale.set(2.5, 3.85, 1);
    contactShadow.position.set(0, DECK_TOP_Y + 0.012, 0);
    rover.add(contactShadow);

    const dustCount = 86;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustGeometry = trackGeometry(new THREE.BufferGeometry());
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const softParticleVertex = `
      uniform float uSize;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(uSize * (270.0 / max(1.0, -viewPosition.z)), 1.0, 8.0);
        gl_Position = projectionMatrix * viewPosition;
      }
    `;
    const softParticleFragment = `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float radius = distance(gl_PointCoord, vec2(0.5));
        float alpha = smoothstep(0.5, 0.08, radius) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `;
    const dustMaterial = trackMaterial(new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xb87543) },
        uOpacity: { value: 0 },
        uSize: { value: 0.12 },
      },
      vertexShader: softParticleVertex,
      fragmentShader: softParticleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    }));
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    rover.add(dust);

    const moteCount = 150;
    const motePositions = new Float32Array(moteCount * 3);
    for (let index = 0; index < moteCount; index += 1) {
      motePositions[index * 3] = -14 + ((index * 47) % 280) / 10;
      motePositions[index * 3 + 1] = 0.2 + ((index * 29) % 88) / 10;
      motePositions[index * 3 + 2] = -24 + ((index * 73) % 360) / 10;
    }
    const moteGeometry = trackGeometry(new THREE.BufferGeometry());
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
    const moteMaterial = trackMaterial(new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xd98a45) },
        uOpacity: { value: 0.17 },
        uSize: { value: 0.075 },
      },
      vertexShader: softParticleVertex,
      fragmentShader: softParticleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    scene.add(new THREE.Points(moteGeometry, moteMaterial));

    const sparkCount = 88;
    const sparkGeometry = trackGeometry(new RoundedBoxGeometry(0.017, 0.13, 0.017, 2, 0.006));
    const sparkMaterial = trackMaterial(new THREE.MeshBasicMaterial({ color: 0xff8c27, toneMapped: false }));
    const sparks = new THREE.InstancedMesh(sparkGeometry, sparkMaterial, sparkCount);
    sparks.frustumCulled = false;
    scene.add(sparks);
    const sparkEmitters = [
      new THREE.Vector3(6.15, 0.82, 2.15),
      new THREE.Vector3(-8.25, 1.45, -1.9),
      new THREE.Vector3(7.65, 1.05, -9.7),
      new THREE.Vector3(0, 0.52, -1.3),
    ];
    const sparkStates = Array.from({ length: sparkCount }, () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
    }));
    const sparkMatrix = new THREE.Matrix4();
    const sparkQuaternion = new THREE.Quaternion();
    const sparkScale = new THREE.Vector3();
    const sparkDirection = new THREE.Vector3();
    const sparkUp = new THREE.Vector3(0, 1, 0);
    const resetSpark = (index: number, prewarm = false) => {
      const state = sparkStates[index];
      const emitter = sparkEmitters[index % sparkEmitters.length];
      const angle = ((index * 2.399) % (Math.PI * 2)) + Math.random() * 0.35;
      const speed = 1.6 + Math.random() * 2.8;
      state.position.copy(emitter).add(new THREE.Vector3((Math.random() - 0.5) * 0.28, Math.random() * 0.2, (Math.random() - 0.5) * 0.34));
      state.velocity.set(Math.cos(angle) * speed * 0.42, speed, Math.sin(angle) * speed * 0.55);
      state.maxLife = 0.48 + Math.random() * 0.62;
      state.life = prewarm ? Math.random() * state.maxLife : state.maxLife;
      if (prewarm) {
        const age = state.maxLife - state.life;
        state.position.addScaledVector(state.velocity, age);
        state.position.y -= 2.2 * age * age;
      }
    };
    sparkStates.forEach((_, index) => resetSpark(index, true));

    scene.add(new THREE.HemisphereLight(0x57767b, 0x120603, 0.54));
    scene.add(new THREE.AmbientLight(0x647572, 0.095));
    const key = new THREE.DirectionalLight(0xc5d7d4, 2.25);
    key.position.set(-7, 13, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 13;
    key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.00025;
    scene.add(key);
    const cyanFill = new THREE.DirectionalLight(0x4dcce8, 0.72);
    cyanFill.position.set(9, 7, 8);
    scene.add(cyanFill);
    const orangeRim = new THREE.DirectionalLight(0xff6c1e, 1.15);
    orangeRim.position.set(-5, 7, -11);
    scene.add(orangeRim);
    const furnaceLight = new THREE.PointLight(0xff5817, 14, 18, 1.7);
    furnaceLight.position.set(-10.8, 2.8, -1.4);
    scene.add(furnaceLight);
    const oppositeFurnaceLight = new THREE.PointLight(0xff7623, 10, 16, 1.8);
    oppositeFurnaceLight.position.set(11.2, 2.3, -10.2);
    scene.add(oppositeFurnaceLight);
    const platformLight = new THREE.PointLight(0xffa43a, 11, 14, 1.85);
    platformLight.position.set(0, 3.2, -17.4);
    scene.add(platformLight);
    const roverRim = new THREE.SpotLight(0x5edfff, 7.2, 30, Math.PI / 4.8, 0.58, 1.35);
    roverRim.position.set(7, 10, 7);
    roverRim.target = rover;
    scene.add(roverRim);
    const roverKey = new THREE.SpotLight(0xffa461, 3.8, 24, Math.PI / 4.7, 0.62, 1.25);
    roverKey.position.set(-7, 7, -6);
    roverKey.target = rover;
    roverKey.castShadow = true;
    roverKey.shadow.mapSize.set(1024, 1024);
    scene.add(roverKey);
    const cameraKey = new THREE.SpotLight(0xc8e1df, 10.5, 32, Math.PI / 4.0, 0.7, 1.15);
    cameraKey.position.set(10, 8, 8);
    cameraKey.target = rover;
    scene.add(cameraKey);

    const cameraTarget = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();
    const desiredTarget = new THREE.Vector3();
    const cableStart = new THREE.Vector3();
    const cableEnd = new THREE.Vector3();
    const coreDockPosition = new THREE.Vector3(-0.2, 3.52, -5.3);
    const coreSocketWorld = new THREE.Vector3(0, 3.52, -20.5);
    const finalCageWorld = new THREE.Vector3(0.2, 2.4, -16.22);
    const coreCageWorld = new THREE.Vector3();
    const coreWorld = new THREE.Vector3();
    const trolleyCableWorld = new THREE.Vector3();
    const clampCableWorld = new THREE.Vector3();
    const CLAMP_PARK_Y = 6.68;
    const CLAMP_OFFSET_Y = 1.35;
    const CORE_LIFT_Y = 5.55;
    const coldBackground = new THREE.Color(0x030505);
    const poweredBackground = new THREE.Color(0x17100a);
    const coldFurnace = new THREE.Color(0x4a160c);
    const hotFurnace = new THREE.Color(0xffd38c);
    let previousTime = performance.now();
    let previousRoverZ = START_Z;
    let wheelTurn = 0;
    let currentPower = 0;
    let frame = 0;
    let firstFrame = true;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const portrait = width / height < 0.72;
      const pixelRatio = Math.min(window.devicePixelRatio, portrait ? 1.22 : 1.58);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      bloomPass.strength = portrait ? 0.38 : 0.48;
      camera.aspect = width / height;
      camera.fov = portrait ? 48 : 35;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    function resolveMission(now: number) {
      const clock = motionRef.current;
      if (clock.replayMode) return replayPhase(clock.replayProgress);
      const duration = PHASE_DURATION[clock.phase];
      const local = duration ? THREE.MathUtils.clamp((now - clock.startedAt) / duration, 0, 1) : clock.phase === "complete" ? 1 : 0;
      return { phase: clock.phase, local };
    }

    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      const mission = resolveMission(now);
      const local = ease(mission.local);
      let roverZ = START_Z;
      let roverX = 0.2;
      if (mission.phase === "transit") roverZ = THREE.MathUtils.lerp(START_Z, 2.3, local);
      else if (mission.phase === "blocked") roverZ = 2.3;
      else if (mission.phase === "winching") roverZ = THREE.MathUtils.lerp(2.3, 2.55, local);
      else if (mission.phase === "crossing") {
        const crossingTravel = THREE.MathUtils.smoothstep(mission.local, 0.17, 0.98);
        roverZ = THREE.MathUtils.lerp(2.55, -15.2, ease(crossingTravel));
        roverX += Math.sin(ease(crossingTravel) * Math.PI) * 0.12;
      } else if (["dock_ready", "docking", "complete"].includes(mission.phase)) roverZ = -15.2;

      const moving = mission.phase === "transit" || mission.phase === "crossing";
      const winchLoad = mission.phase === "winching" ? Math.sin(Math.min(mission.local * 1.3, 1) * Math.PI) : 0;
      rover.position.z = roverZ;
      rover.position.x = roverX;
      rover.position.y = moving ? Math.sin(now * 0.011) * 0.012 : 0;
      rover.rotation.y = moving ? Math.sin(now * 0.0015) * 0.009 : winchLoad * -0.008;
      rover.rotation.z = moving ? Math.sin(now * 0.008) * 0.0023 : winchLoad * 0.006;
      wheelTurn += (roverZ - previousRoverZ) / WHEEL_RADIUS;
      previousRoverZ = roverZ;
      wheels.forEach((wheel, index) => {
        wheel.rotation.x = wheelTurn;
        wheel.position.y = wheel.userData.baseY + (moving ? Math.sin(now * 0.013 + index * 0.86) * 0.012 : 0) - winchLoad * (index % 3 === 0 ? 0.012 : -0.006);
      });
      winchDrum.rotation.x += mission.phase === "winching" ? delta * 5.4 : 0;

      let beamFall = 0;
      if (mission.phase === "transit") beamFall = THREE.MathUtils.smoothstep(mission.local, 0.4, 0.78);
      else if (mission.phase !== "ready") beamFall = 1;
      const beamPull = mission.phase === "winching" ? ease(mission.local) : ["crossing", "dock_ready", "docking", "complete"].includes(mission.phase) ? 1 : 0;
      obstruction.position.set(
        THREE.MathUtils.lerp(0, 6.9, beamPull),
        THREE.MathUtils.lerp(7.3, 0.86, ease(beamFall)),
        THREE.MathUtils.lerp(-1.3, -0.1, beamPull),
      );
      obstruction.rotation.set(
        THREE.MathUtils.lerp(0, 0.07, beamFall),
        THREE.MathUtils.lerp(0.025, 0.68, beamPull),
        THREE.MathUtils.lerp(0, -0.13, beamFall) + beamPull * 0.07,
      );

      winchCable.visible = mission.phase === "winching";
      if (winchCable.visible) {
        rover.updateMatrixWorld();
        obstruction.updateMatrixWorld();
        cableStart.set(0, 1.14, -3.67).applyMatrix4(rover.matrixWorld);
        cableEnd.set(-3.45, 0.04, 0).applyMatrix4(obstruction.matrixWorld);
        const cablePositions = cableGeometry.attributes.position.array as Float32Array;
        cablePositions.set([cableStart.x, cableStart.y, cableStart.z, cableEnd.x, cableEnd.y, cableEnd.z]);
        cableGeometry.attributes.position.needsUpdate = true;
        cableGeometry.computeBoundingSphere();
      }

      const tableAlignment = mission.phase === "crossing" ? THREE.MathUtils.smoothstep(mission.local, 0.02, 0.3) : ["dock_ready", "docking", "complete"].includes(mission.phase) ? 1 : 0;
      turntable.rotation.y = THREE.MathUtils.lerp(0.47, 0, tableAlignment);

      rover.updateMatrixWorld(true);
      coreCageWorld.copy(cageCenter).applyMatrix4(rover.matrixWorld);
      coreWorld.copy(coreCageWorld);

      const craneArriving = mission.phase === "crossing"
        ? ease(THREE.MathUtils.smoothstep(mission.local, 0.66, 0.96))
        : ["dock_ready", "docking", "complete"].includes(mission.phase) ? 1 : 0;
      const craneActive = craneArriving > 0.01;
      let clampGrip = 0;
      let cageRelease = mission.phase === "complete" ? 1 : 0;
      let socketLock = mission.phase === "complete" ? 1 : 0;
      let hoistMoving = false;

      craneTrolley.position.x = 0;
      craneTrolley.position.z = THREE.MathUtils.lerp(coreSocketWorld.z, finalCageWorld.z, craneArriving);
      clampRig.position.set(craneTrolley.position.x, CLAMP_PARK_Y, craneTrolley.position.z);

      if (mission.phase === "docking") {
        const capture = ease(THREE.MathUtils.smoothstep(mission.local, 0.04, 0.2));
        const gripIn = ease(THREE.MathUtils.smoothstep(mission.local, 0.16, 0.27));
        const lift = ease(THREE.MathUtils.smoothstep(mission.local, 0.27, 0.45));
        const transfer = ease(THREE.MathUtils.smoothstep(mission.local, 0.45, 0.68));
        const lower = ease(THREE.MathUtils.smoothstep(mission.local, 0.68, 0.84));
        const release = ease(THREE.MathUtils.smoothstep(mission.local, 0.84, 0.92));
        const retract = ease(THREE.MathUtils.smoothstep(mission.local, 0.92, 1));

        clampGrip = gripIn * (1 - release);
        cageRelease = gripIn;
        socketLock = ease(THREE.MathUtils.smoothstep(mission.local, 0.84, 0.96));
        hoistMoving = (mission.local > 0.04 && mission.local < 0.45)
          || (mission.local > 0.68 && mission.local < 0.84)
          || mission.local > 0.92;

        coreWorld.y = THREE.MathUtils.lerp(coreCageWorld.y, CORE_LIFT_Y, lift);
        coreWorld.x = THREE.MathUtils.lerp(coreCageWorld.x, coreSocketWorld.x, transfer);
        coreWorld.z = THREE.MathUtils.lerp(coreCageWorld.z, coreSocketWorld.z, transfer);
        coreWorld.y = THREE.MathUtils.lerp(coreWorld.y, coreSocketWorld.y, lower);
        coreAssembly.position.copy(coreWorld);
        rover.worldToLocal(coreAssembly.position);

        craneTrolley.position.x = coreWorld.x;
        craneTrolley.position.z = coreWorld.z;
        const attachedClampY = coreWorld.y + CLAMP_OFFSET_Y;
        clampRig.position.set(
          coreWorld.x,
          THREE.MathUtils.lerp(THREE.MathUtils.lerp(CLAMP_PARK_Y, attachedClampY, capture), CLAMP_PARK_Y, retract),
          coreWorld.z,
        );
      } else if (mission.phase === "complete") {
        coreAssembly.position.copy(coreDockPosition);
        craneTrolley.position.set(coreSocketWorld.x, 7.78, coreSocketWorld.z);
        clampRig.position.set(coreSocketWorld.x, CLAMP_PARK_Y, coreSocketWorld.z);
      } else {
        coreAssembly.position.copy(cageCenter);
      }

      clampRig.visible = craneActive;
      clampSignalRing.rotation.z += delta * (0.5 + clampGrip * 1.7);
      clampBeacon.intensity = craneActive ? 2.3 + clampGrip * 4.2 : 0;
      craneDrum.rotation.x += hoistMoving ? delta * 5.2 : 0;
      clampJaws.forEach((jaw, index) => {
        const angle = index / 4 * Math.PI * 2;
        const radius = THREE.MathUtils.lerp(1.52, 1.08, clampGrip);
        jaw.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
      });
      cageLatches.forEach(({ group, base, direction, angle }, index) => {
        group.position.copy(base).addScaledVector(direction, cageRelease * 0.46);
        group.rotation.y = angle;
        group.rotation.z = (index % 2 ? 1 : -1) * cageRelease * 0.34;
      });
      socketLocks.forEach(({ group, direction }, index) => {
        group.position.copy(direction).multiplyScalar(THREE.MathUtils.lerp(1.62, 1.26, socketLock));
        group.position.y = 3.52;
        group.rotation.y = index / 4 * Math.PI * 2;
      });
      craneTrolley.updateMatrixWorld(true);
      clampRig.updateMatrixWorld(true);
      craneCables.forEach(({ line, geometry, trolleyAnchor, clampAnchor }) => {
        line.visible = craneActive;
        trolleyCableWorld.copy(trolleyAnchor).applyMatrix4(craneTrolley.matrixWorld);
        clampCableWorld.copy(clampAnchor).applyMatrix4(clampRig.matrixWorld);
        const positions = geometry.attributes.position.array as Float32Array;
        positions.set([
          trolleyCableWorld.x, trolleyCableWorld.y, trolleyCableWorld.z,
          clampCableWorld.x, clampCableWorld.y, clampCableWorld.z,
        ]);
        geometry.attributes.position.needsUpdate = true;
      });
      core.rotation.x += delta * 0.72;
      core.rotation.y += delta * 1.05;
      const corePulse = 1 + Math.sin(now * 0.0042) * 0.045;
      core.scale.set(0.74 * corePulse, 1.1 * corePulse, 0.74 * corePulse);
      coreInner.rotation.x -= delta * 1.15;
      coreInner.rotation.y += delta * 1.65;
      coreInner.scale.setScalar(0.96 + Math.sin(now * 0.006) * 0.11);
      coreHot.scale.setScalar(0.9 + Math.sin(now * 0.009) * 0.24);
      coreRings[0].rotation.z += delta * 0.31;
      coreRings[1].rotation.x += delta * 0.25;
      coreRings[2].rotation.y += delta * 0.2;
      arcLines.forEach(({ line, positions, phase }, arcIndex) => {
        const angle = phase + now * 0.00024 * (arcIndex % 2 ? -1 : 1);
        const start = new THREE.Vector3(Math.sin(angle) * 0.84, Math.cos(angle) * 0.51, Math.sin(angle * 1.7) * 0.08);
        const end = new THREE.Vector3(Math.sin(angle + 0.52) * 0.34, Math.cos(angle + 0.52) * 0.45, Math.cos(angle * 1.3) * 0.2);
        for (let pointIndex = 0; pointIndex < 22; pointIndex += 1) {
          const fraction = pointIndex / 21;
          const turbulence = Math.sin(fraction * Math.PI) * (0.08 + arcIndex * 0.012);
          const index = pointIndex * 3;
          positions[index] = THREE.MathUtils.lerp(start.x, end.x, fraction)
            + Math.sin(fraction * 17 + now * 0.012 + phase) * turbulence;
          positions[index + 1] = THREE.MathUtils.lerp(start.y, end.y, fraction)
            + Math.cos(fraction * 13 - now * 0.01 + phase) * turbulence;
          positions[index + 2] = THREE.MathUtils.lerp(start.z, end.z, fraction)
            + Math.sin(fraction * 19 + now * 0.008 + phase) * turbulence * 1.4;
        }
        line.geometry.attributes.position.needsUpdate = true;
        line.visible = Math.sin(now * 0.012 + phase) > -0.72;
      });

      const targetPower = mission.phase === "docking"
        ? THREE.MathUtils.smoothstep(mission.local, 0.9, 1)
        : mission.phase === "complete" ? 1 : 0;
      currentPower = THREE.MathUtils.lerp(currentPower, targetPower, 1 - Math.pow(0.001, delta));
      renderer.toneMappingExposure = 0.88 + currentPower * 0.22;
      (scene.background as THREE.Color).copy(coldBackground).lerp(poweredBackground, currentPower * 0.68);
      furnace.emissiveIntensity = 0.16 + currentPower * 4.45;
      furnaceWhite.color.copy(coldFurnace).lerp(hotFurnace, currentPower);
      reactorEnergy.emissiveIntensity = 0.04 + currentPower * 4.7;
      socketRings.forEach((ring, index) => {
        ring.rotation.z += delta * (0.3 + index * 0.17) * (index % 2 ? -1 : 1);
      });

      dust.visible = moving && mission.local > 0.015 && mission.local < 0.98;
      for (let index = 0; index < dustCount; index += 1) {
        const phase = (mission.local * 8 + index / dustCount) % 1;
        dustPositions[index * 3] = ((index * 19) % 31) / 31 * 4.25 - 2.125;
        dustPositions[index * 3 + 1] = 0.2 + phase * 0.52;
        dustPositions[index * 3 + 2] = 2.75 + phase * 3.1;
      }
      dustGeometry.attributes.position.needsUpdate = true;
      dustMaterial.uniforms.uOpacity.value = moving ? 0.2 + Math.sin(now * 0.004) * 0.035 : 0;

      const moteArray = moteGeometry.attributes.position.array as Float32Array;
      for (let index = 0; index < moteCount; index += 1) {
        moteArray[index * 3 + 1] += delta * (0.045 + (index % 5) * 0.014);
        moteArray[index * 3] += Math.sin(now * 0.0003 + index) * delta * 0.018;
        if (moteArray[index * 3 + 1] > 9.2) moteArray[index * 3 + 1] = 0.12;
      }
      moteGeometry.attributes.position.needsUpdate = true;

      sparkStates.forEach((state, index) => {
        state.life -= delta;
        if (state.life <= 0 || state.position.y < -0.2) resetSpark(index);
        state.velocity.y -= delta * 4.8;
        state.position.addScaledVector(state.velocity, delta);
        const fade = THREE.MathUtils.clamp(state.life / state.maxLife, 0, 1);
        sparkDirection.copy(state.velocity).normalize();
        sparkQuaternion.setFromUnitVectors(sparkUp, sparkDirection);
        sparkScale.set(0.42 + fade * 0.35, 0.48 + state.velocity.length() * 0.09, 0.42 + fade * 0.35);
        const incidentSparks = mission.phase === "winching" || (mission.phase === "transit" && mission.local > 0.52);
        if (index % sparkEmitters.length === 3 && !incidentSparks) sparkScale.setScalar(0);
        sparkMatrix.compose(state.position, sparkQuaternion, sparkScale);
        sparks.setMatrixAt(index, sparkMatrix);
      });
      sparks.instanceMatrix.needsUpdate = true;

      const portrait = mount.clientWidth / Math.max(mount.clientHeight, 1) < 0.72;
      const vehicleZ = rover.position.z;
      const cameraBreath = moving ? Math.sin(now * 0.01) * 0.026 : Math.sin(now * 0.00045) * 0.045;
      if (mission.phase === "ready") {
        desiredCamera.set(8.35 + cameraBreath, 4.35, -2.65);
        desiredTarget.set(0, 2.05, 3.95);
      } else if (mission.phase === "transit") {
        desiredCamera.set(8.25, 4.15, vehicleZ - 7.7);
        desiredTarget.set(0, 2.0, vehicleZ + 0.3);
        if (mission.local > 0.4) {
          desiredCamera.set(8.7, 4.35, 5.6);
          desiredTarget.set(0, 1.25, -1.25);
        }
      } else if (mission.phase === "blocked") {
        desiredCamera.set(8.8, 4.35, 5.3);
        desiredTarget.set(0, 1.25, -1.1);
      } else if (mission.phase === "winching") {
        desiredCamera.set(9.4 - local * 1.9, 3.9 + local * 0.45, 4.6 - local * 1.1);
        desiredTarget.set(1.3 + local * 2.2, 1.05, -0.65);
      } else if (mission.phase === "crossing") {
        desiredCamera.set(-9.2 + local * 1.4, 6.6 - local * 0.8, -3.4 - local * 5.6);
        desiredTarget.set(rover.position.x, 1.85, vehicleZ - 1.4);
      } else if (mission.phase === "dock_ready") {
        desiredCamera.set(8.25, 4.95, -9.6);
        desiredTarget.set(0, 2.6, -18.25);
      } else if (mission.phase === "docking") {
        desiredCamera.set(8.6 - local * 1.8, 6.1 + local * 0.8, -10.5 - local * 2.2);
        desiredTarget.set(0, 4.15 - local * 0.38, -17.1 - local * 2.45);
      } else {
        desiredCamera.set(10.7, 7.7, -8.2);
        desiredTarget.set(0, 2.75, -18.1);
      }
      if (portrait) {
        desiredCamera.x *= 1.08;
        desiredCamera.y += 1.45;
        desiredCamera.z += 2.6;
      }
      const impactShake = mission.phase === "transit" ? Math.max(0, 1 - Math.abs(mission.local - 0.78) * 10) * 0.1 : 0;
      desiredCamera.x += Math.sin(now * 0.16) * impactShake;
      desiredCamera.y += Math.cos(now * 0.21) * impactShake;
      if (firstFrame) {
        camera.position.copy(desiredCamera);
        cameraTarget.copy(desiredTarget);
      } else {
        camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 3.8));
        cameraTarget.lerp(desiredTarget, 1 - Math.exp(-delta * 4.5));
      }
      camera.lookAt(cameraTarget);
      const tableActive = mission.phase === "crossing" ? 1 : 0;
      furnaceLight.intensity = 0.45 + currentPower * (13 + Math.sin(now * 0.006) * 2.2);
      oppositeFurnaceLight.intensity = 0.35 + currentPower * (9.2 + Math.sin(now * 0.005 + 1.4) * 1.5);
      platformLight.position.z = -10.4;
      platformLight.intensity = 0.6 + tableActive * 7.8 + currentPower * 5.4;
      coreHalo.intensity = 6.5 + Math.sin(now * 0.005) * 1.1 + currentPower * 3.5;
      bloomPass.strength = (portrait ? 0.36 : 0.46) + currentPower * 0.12;
      composer.render(delta);
      if (firstFrame) {
        firstFrame = false;
        mount.dataset.sceneReady = "true";
      }
    };
    frame = requestAnimationFrame(animate);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      dracoLoader.dispose();
      composer.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      importedMaterials.forEach((material) => material.dispose());
      importedTextures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      className="scene-canvas"
      ref={mountRef}
      data-renderer="threejs-real-geometry"
      data-vehicle-source="nasa-jpl-glb-mechanical-donor"
    >
      <div className="scene-loading"><i /><span>LOADING LIVE 3D ASSEMBLY</span></div>
    </div>
  );
}
