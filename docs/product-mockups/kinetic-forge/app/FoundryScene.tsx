"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
const RUN_DISTANCE = 17.8;
const START_Z = 4.7;
const WHEEL_RADIUS = 0.92;
const WHEEL_CENTER_Y = 1.19;
const DECK_TOP_Y = 0.18;
const RAIL_X = 4.72;
const VEHICLE_HALF_WIDTH = 2.42;

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
    scene.background = new THREE.Color(0x1f1b17);
    scene.fog = new THREE.FogExp2(0x342b22, 0.0135);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 140);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute(
      "aria-label",
      "Real-time three-dimensional industrial hauler crossing a collision-clear foundry bridge",
    );
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);

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

    const noiseSize = 96;
    const noiseData = new Uint8Array(noiseSize * noiseSize * 4);
    for (let index = 0; index < noiseSize * noiseSize; index += 1) {
      const value = 82 + Math.floor(Math.random() * 145);
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

    const deckSteel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x4d504b,
      roughness: 0.61,
      roughnessMap: metalNoise,
      metalness: 0.72,
    }));
    const darkSteel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x242725,
      roughness: 0.52,
      roughnessMap: metalNoise,
      metalness: 0.78,
    }));
    const edgeSteel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x67675f,
      roughness: 0.42,
      roughnessMap: metalNoise,
      metalness: 0.86,
    }));
    const armor = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x171b1a,
      roughness: 0.34,
      metalness: 0.88,
    }));
    const armorPanel = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x303533,
      roughness: 0.48,
      metalness: 0.78,
    }));
    const donorMetal = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x2e3432,
      roughness: 0.4,
      metalness: 0.84,
    }));
    const donorDetail = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x77736a,
      roughness: 0.36,
      metalness: 0.9,
    }));
    const suspensionMetal = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x9d5c16,
      roughness: 0.33,
      metalness: 0.8,
    }));
    const rubber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x111313, roughness: 0.96, metalness: 0.01 }));
    const treadRubber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x242625, roughness: 0.92, metalness: 0.02 }));
    const amber = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0xf0a429,
      emissive: 0x793304,
      emissiveIntensity: 1.8,
      roughness: 0.3,
      metalness: 0.62,
    }));
    const cyan = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x1a91aa,
      emissive: 0x07566c,
      emissiveIntensity: 1.5,
      roughness: 0.12,
      metalness: 0.22,
    }));
    const cyanGlass = trackMaterial(new THREE.MeshBasicMaterial({
      color: 0x29c9e5,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    const furnace = trackMaterial(new THREE.MeshStandardMaterial({
      color: 0xc8641d,
      emissive: 0xff4c08,
      emissiveIntensity: 3.4,
      roughness: 0.4,
    }));
    const redLight = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xff3829, emissive: 0xff160d, emissiveIntensity: 5.2 }));
    const paleLight = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xffe5ae, emissive: 0xffa936, emissiveIntensity: 4.6 }));

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
    ) {
      const w = width / 2;
      const h = height / 2;
      const d = depth / 2;
      const points = [
        [-w, -h, -d], [w, -h, -d], [-w, h, -d], [w, h, -d],
        [-w, -h, d], [w, -h, d], [-w, h, d], [w, h, d],
      ].map(([x, y, z]) => new THREE.Vector3(center.x + x, center.y + y, center.z + z));
      const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
      edges.forEach(([a, b]) => addBeam(parent, points[a], points[b], 0.075, material, 12));
      return points;
    }

    // A wide, uninterrupted route. All posts and rails remain outside the measured vehicle envelope.
    if (RAIL_X - VEHICLE_HALF_WIDTH < 1.8) throw new Error("Foundry route clearance invariant failed");
    for (let index = 0; index < 23; index += 1) {
      const z = 8.4 - index * 1.28;
      const slab = addBox(scene, [8.9, 0.28, 1.14], index % 3 === 0 ? edgeSteel : deckSteel, [0, 0.04, z]);
      slab.rotation.y = index % 2 === 0 ? 0.0015 : -0.0015;
      addBox(scene, [0.24, 0.34, 1.18], darkSteel, [-4.52, 0.02, z]);
      addBox(scene, [0.24, 0.34, 1.18], darkSteel, [4.52, 0.02, z]);
      if (index % 2 === 0) {
        addBox(scene, [0.2, 0.09, 0.5], amber, [-4.18, 0.23, z], false);
        addBox(scene, [0.2, 0.09, 0.5], amber, [4.18, 0.23, z], false);
      }
      if (index % 4 === 1) addBox(scene, [1.8, 0.035, 0.08], amber, [0, 0.205, z + 0.38], false);
    }

    const platform = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(5.6, 5.6, 0.62, 48)), deckSteel);
    platform.position.set(0, -0.06, -17.25);
    platform.receiveShadow = true;
    scene.add(platform);
    const platformRing = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(3.65, 0.1, 12, 64)), amber);
    platformRing.position.set(0, 0.26, -17.25);
    platformRing.rotation.x = Math.PI / 2;
    scene.add(platformRing);

    for (const side of [-1, 1]) {
      for (let index = 0; index < 11; index += 1) {
        const z = 7.6 - index * 2.55;
        addBox(scene, [0.15, 1.86, 0.15], edgeSteel, [side * RAIL_X, 0.99, z]);
      }
      addBeam(scene, new THREE.Vector3(side * RAIL_X, 1.83, 7.6), new THREE.Vector3(side * RAIL_X, 1.83, -17.9), 0.1, edgeSteel, 12);
      addBeam(scene, new THREE.Vector3(side * RAIL_X, 0.95, 7.6), new THREE.Vector3(side * RAIL_X, 0.95, -17.9), 0.07, darkSteel, 10);
    }

    // Dense foundry architecture, kept beyond the clear drive envelope.
    for (const side of [-1, 1]) {
      const baseX = side * 13;
      for (let index = 0; index < 7; index += 1) {
        const z = 10 - index * 5.2;
        addBox(scene, [3 + (index % 2) * 1.2, 6.5 + (index % 3) * 1.5, 3.4], darkSteel, [baseX + side * (index % 2), 2.6, z]);
        addBox(scene, [0.46, 11, 0.46], edgeSteel, [baseX - side * 2.2, 4.8, z - 1.1]);
      }
      for (let index = 0; index < 4; index += 1) {
        const pipe = new THREE.Mesh(
          trackGeometry(new THREE.CylinderGeometry(0.26 + index * 0.08, 0.26 + index * 0.08, 23, 14)),
          index % 2 ? edgeSteel : deckSteel,
        );
        pipe.position.set(baseX + side * (2.1 + index * 0.62), 4.5 + index * 0.5, -5 + index * 2.8);
        pipe.rotation.x = Math.PI / 2;
        pipe.castShadow = true;
        scene.add(pipe);
      }
    }
    addBox(scene, [6.2, 5, 0.56], darkSteel, [-12.2, 2.4, -1.8]);
    addBox(scene, [2.6, 2.8, 0.18], furnace, [-12.18, 1.7, -1.49], false);
    addBox(scene, [5.8, 4.6, 0.56], darkSteel, [12.4, 2.25, -10.1]);
    addBox(scene, [2.1, 2.1, 0.18], furnace, [12.38, 1.45, -9.79], false);
    addBox(scene, [22, 0.38, 0.5], edgeSteel, [0, 8.7, -6.2]);
    const gantrySupportStations = [-9.5, 9.5];
    if (gantrySupportStations.some((x) => Math.abs(x) < RAIL_X + 1.5)) {
      throw new Error("Gantry support entered the drive corridor");
    }
    for (const x of gantrySupportStations) addBox(scene, [0.3, 8.5, 0.3], darkSteel, [x, 4.35, -6.2]);
    for (const z of [-3.2, -10.8]) {
      addBox(scene, [17, 0.2, 1.25], darkSteel, [0, 7.15, z]);
      for (const x of [-7.4, -3.7, 0, 3.7, 7.4]) addBox(scene, [0.13, 1.45, 0.13], edgeSteel, [x, 7.88, z]);
      addBox(scene, [17, 0.08, 0.12], amber, [0, 7.35, z + 0.48], false);
    }
    addBox(scene, [38, 0.3, 56], darkSteel, [0, -3.25, -8], false);
    addBox(scene, [4.2, 0.08, 38], furnace, [-11, -3.04, -6], false);
    addBox(scene, [3.6, 0.08, 35], furnace, [11.2, -3.03, -8], false);

    const rover = new THREE.Group();
    rover.position.set(0.25, 0, START_Z);
    rover.userData.collisionEnvelope = {
      halfWidth: VEHICLE_HALF_WIDTH,
      minY: DECK_TOP_Y,
      routeRailX: RAIL_X,
    };
    scene.add(rover);

    // The NASA/JPL chassis is a genuine detailed GLB donor, not a presentation image.
    const donorRoot = new THREE.Group();
    donorRoot.scale.set(1.66, 1.58, 2.28);
    donorRoot.position.set(0, 0.34, 0.1);
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

    // Kinetic Forge bodywork: authored cargo enclosure and live containment cage.
    addBox(rover, [3.45, 0.24, 6.25], armor, [0, 1.48, 0.05]);
    addBox(rover, [3.1, 0.12, 5.8], armorPanel, [0, 1.66, 0.03]);
    for (const x of [-1.52, 1.52]) {
      addBeam(rover, new THREE.Vector3(x, 1.42, -3.05), new THREE.Vector3(x, 1.42, 3.02), 0.1, donorMetal, 12);
    }

    const cargoCenter = new THREE.Vector3(0, 2.72, 1.72);
    addBox(rover, [3.42, 1.8, 2.45], armor, [cargoCenter.x, cargoCenter.y, cargoCenter.z]);
    addBox(rover, [2.95, 1.28, 0.1], armorPanel, [0, 2.72, 2.98]);
    addFramedModule(rover, cargoCenter, 3.68, 2.04, 2.76, donorDetail);
    for (const x of [-1.18, -0.58, 0, 0.58, 1.18]) addBox(rover, [0.075, 1.24, 0.12], donorDetail, [x, 2.72, 3.05]);
    for (const y of [2.04, 2.72, 3.4]) addBox(rover, [3.02, 0.07, 0.12], donorDetail, [0, y, 3.05]);
    addBox(rover, [3.58, 0.12, 0.18], amber, [0, 1.92, 2.93], false);
    for (const side of [-1, 1]) {
      for (const z of [0.92, 1.72, 2.52]) {
        addBox(rover, [0.1, 1.24, 0.58], armorPanel, [side * 1.75, 2.72, z]);
        const serviceCap = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.11, 0.11, 0.13, 14)), donorDetail);
        serviceCap.position.set(side * 1.82, 2.72, z);
        serviceCap.rotation.z = Math.PI / 2;
        rover.add(serviceCap);
      }
      addBeam(rover, new THREE.Vector3(side * 1.83, 1.92, 0.46), new THREE.Vector3(side * 1.83, 3.52, 2.96), 0.055, donorDetail, 10);
    }

    const cageCenter = new THREE.Vector3(0, 2.55, -1.55);
    const cagePoints = addFramedModule(rover, cageCenter, 3.48, 2.08, 2.72, donorDetail);
    addBeam(rover, cagePoints[0], cagePoints[7], 0.068, donorDetail, 12);
    addBeam(rover, cagePoints[1], cagePoints[6], 0.068, donorDetail, 12);
    addBeam(rover, cagePoints[2], cagePoints[5], 0.068, donorDetail, 12);
    addBeam(rover, cagePoints[3], cagePoints[4], 0.068, donorDetail, 12);
    addBox(rover, [2.95, 1.52, 0.06], cyanGlass, [0, 2.55, -1.55], false);

    const core = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.68, 3)), cyan);
    core.position.copy(cageCenter);
    core.castShadow = true;
    rover.add(core);
    const coreRings: THREE.Mesh[] = [];
    for (const rotation of [[0, 0, 0], [0, Math.PI / 2, 0], [Math.PI / 2, 0, 0]] as const) {
      const ring = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.92, 0.035, 10, 42)), cyan);
      ring.position.copy(cageCenter);
      ring.rotation.set(...rotation);
      rover.add(ring);
      coreRings.push(ring);
    }
    const coreHalo = new THREE.PointLight(0x35dfff, 4.8, 8, 2);
    coreHalo.position.copy(cageCenter);
    rover.add(coreHalo);

    // Six independently rotating wheel assemblies; the tread envelope clears the deck by 3 cm.
    const wheels: THREE.Group[] = [];
    const wheelStations = [-2.62, -0.22, 2.25];
    const tireGeometry = trackGeometry(new THREE.TorusGeometry(0.68, 0.24, 16, 36));
    const hubGeometry = trackGeometry(new THREE.CylinderGeometry(0.34, 0.34, 0.7, 22));
    const rimGeometry = trackGeometry(new THREE.TorusGeometry(0.39, 0.055, 10, 28));
    const treadGeometry = trackGeometry(new THREE.BoxGeometry(0.58, 0.075, 0.16));
    for (const side of [-1, 1]) {
      for (let stationIndex = 0; stationIndex < wheelStations.length; stationIndex += 1) {
        const z = wheelStations[stationIndex];
        const x = side * 2.06;
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
        const rim = new THREE.Mesh(rimGeometry, edgeSteel);
        rim.rotation.y = Math.PI / 2;
        rim.position.x = side * 0.36;
        pivot.add(rim);
        const brake = new THREE.Mesh(trackGeometry(new THREE.CylinderGeometry(0.22, 0.22, 0.73, 18)), suspensionMetal);
        brake.rotation.z = Math.PI / 2;
        pivot.add(brake);
        for (let treadIndex = 0; treadIndex < 26; treadIndex += 1) {
          const angle = (treadIndex / 26) * Math.PI * 2;
          const tread = new THREE.Mesh(treadGeometry, treadRubber);
          tread.position.set(0, Math.cos(angle) * 0.9, Math.sin(angle) * 0.9);
          tread.rotation.x = angle;
          tread.rotation.z = treadIndex % 2 ? 0.11 : -0.11;
          tread.castShadow = true;
          pivot.add(tread);
        }
        rover.add(pivot);
        wheels.push(pivot);

        const chassisMount = new THREE.Vector3(side * 1.28, 1.85, z + 0.32);
        const wheelMount = new THREE.Vector3(x, WHEEL_CENTER_Y, z);
        addBeam(rover, chassisMount, wheelMount, 0.105, donorMetal, 12);
        addBeam(rover, new THREE.Vector3(side * 1.3, 1.58, z - 0.42), wheelMount, 0.08, donorDetail, 12);
        addBeam(rover, new THREE.Vector3(side * 1.47, 2.2, z + 0.15), new THREE.Vector3(side * 1.83, 1.35, z - 0.05), 0.09, suspensionMetal, 12);
      }
    }

    addBox(rover, [4.3, 0.2, 0.3], donorMetal, [0, 1.3, -3.22]);
    addBox(rover, [4.12, 0.12, 0.18], amber, [0, 1.52, -3.3], false);
    for (const x of [-1.36, 1.36]) {
      addBox(rover, [0.38, 0.22, 0.13], paleLight, [x, 1.83, -3.31], false);
      addBox(rover, [0.38, 0.22, 0.13], redLight, [x, 2.12, 3.05], false);
    }

    const contactShadow = new THREE.Mesh(
      trackGeometry(new THREE.CircleGeometry(1, 48)),
      trackMaterial(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.scale.set(2.3, 3.65, 1);
    contactShadow.position.set(0, DECK_TOP_Y + 0.012, 0);
    rover.add(contactShadow);

    const dustCount = 76;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustGeometry = trackGeometry(new THREE.BufferGeometry());
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = trackMaterial(new THREE.PointsMaterial({
      color: 0xb66e32,
      size: 0.16,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }));
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    rover.add(dust);

    const sparkCount = 96;
    const sparkPositions = new Float32Array(sparkCount * 3);
    for (let index = 0; index < sparkCount; index += 1) {
      sparkPositions[index * 3] = (index % 2 ? 1 : -1) * (5.8 + Math.random() * 4.6);
      sparkPositions[index * 3 + 1] = Math.random() * 8.5;
      sparkPositions[index * 3 + 2] = -21 + Math.random() * 34;
    }
    const sparkGeometry = trackGeometry(new THREE.BufferGeometry());
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = trackMaterial(new THREE.PointsMaterial({ color: 0xffa041, size: 0.075, transparent: true, opacity: 0.74, depthWrite: false }));
    scene.add(new THREE.Points(sparkGeometry, sparkMaterial));

    scene.add(new THREE.HemisphereLight(0xc7e4e6, 0x4c210d, 2.1));
    scene.add(new THREE.AmbientLight(0xa0aaa3, 0.42));
    const key = new THREE.DirectionalLight(0xffd4a0, 4.2);
    key.position.set(-8, 14, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -8;
    scene.add(key);
    const cyanFill = new THREE.DirectionalLight(0x78ddff, 2.1);
    cyanFill.position.set(8, 7, 8);
    scene.add(cyanFill);
    const orangeRim = new THREE.DirectionalLight(0xff8c39, 2.8);
    orangeRim.position.set(-5, 7, -10);
    scene.add(orangeRim);
    const furnaceLight = new THREE.PointLight(0xff7022, 14, 28, 1.7);
    furnaceLight.position.set(-11.7, 3.4, -1.6);
    scene.add(furnaceLight);
    const platformLight = new THREE.PointLight(0xffb44f, 11, 20, 1.7);
    platformLight.position.set(1, 3.4, -16.8);
    scene.add(platformLight);
    const roverRim = new THREE.SpotLight(0x72e7ff, 16, 34, Math.PI / 4.2, 0.52, 1.2);
    roverRim.position.set(7, 11, 7);
    roverRim.target = rover;
    scene.add(roverRim);

    const cameraTarget = new THREE.Vector3();
    let previousTime = performance.now();
    let frame = 0;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const portrait = width / height < 0.72;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, portrait ? 1.35 : 1.72));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = portrait ? 54 : 40;
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
      const moving = clock.replay || clock.state === "running";
      rover.position.z = START_Z - travel * RUN_DISTANCE;
      rover.position.x = 0.25 + Math.sin(raw * Math.PI) * 0.08;
      rover.position.y = moving ? Math.sin(now * 0.012) * 0.014 : 0;
      rover.rotation.y = Math.sin(raw * Math.PI * 2) * 0.01;
      rover.rotation.z = moving ? Math.sin(now * 0.009) * 0.0025 : 0;
      const wheelTurn = -(travel * RUN_DISTANCE) / WHEEL_RADIUS;
      wheels.forEach((wheel, index) => {
        wheel.rotation.x = wheelTurn;
        wheel.position.y = wheel.userData.baseY + (moving ? Math.sin(now * 0.014 + index * 0.86) * 0.014 : 0);
      });
      core.rotation.x += delta * 0.85;
      core.rotation.y += delta * 1.35;
      core.scale.setScalar(1 + Math.sin(now * 0.0045) * 0.045);
      coreRings[0].rotation.z += delta * 0.4;
      coreRings[1].rotation.x += delta * 0.34;
      coreRings[2].rotation.y += delta * 0.3;

      dust.visible = moving && raw > 0.015 && raw < 0.94;
      for (let index = 0; index < dustCount; index += 1) {
        const phase = (raw * 8 + index / dustCount) % 1;
        dustPositions[index * 3] = ((index * 19) % 29) / 29 * 4.1 - 2.05;
        dustPositions[index * 3 + 1] = 0.16 + phase * 0.58;
        dustPositions[index * 3 + 2] = 2.7 + phase * 2.9;
      }
      dustGeometry.attributes.position.needsUpdate = true;
      dustMaterial.opacity = moving ? 0.13 + Math.sin(now * 0.004) * 0.025 : 0;

      const sparkArray = sparkGeometry.attributes.position.array as Float32Array;
      for (let index = 0; index < sparkCount; index += 1) {
        sparkArray[index * 3 + 1] += delta * (0.5 + (index % 7) * 0.12);
        if (sparkArray[index * 3 + 1] > 9.5) sparkArray[index * 3 + 1] = -0.4;
      }
      sparkGeometry.attributes.position.needsUpdate = true;

      const portrait = mount.clientWidth / Math.max(mount.clientHeight, 1) < 0.72;
      const vehicleZ = rover.position.z;
      camera.position.set(
        portrait ? 8.9 : 8.8 - travel * 0.55,
        portrait ? 7.4 : 6.15 - travel * 0.4,
        vehicleZ - (portrait ? 14.8 : 8.7),
      );
      cameraTarget.set(0, portrait ? 1.72 : 1.68, vehicleZ + (portrait ? 1.2 : 0.45));
      camera.lookAt(cameraTarget);
      furnaceLight.intensity = 13.4 + Math.sin(now * 0.006) * 1.4;
      platformLight.intensity = 10.6 + Math.sin(now * 0.004 + 1) * 0.9;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      dracoLoader.dispose();
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
