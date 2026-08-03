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
    scene.background = new THREE.Color(0x050606);
    scene.fog = new THREE.FogExp2(0x0b0a08, 0.025);

    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
    camera.position.set(10.5, 7.2, 16.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Real-time 3D rover driving through an industrial foundry");
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
      geometries.push(geometry);
      return geometry;
    };
    const trackMaterial = <T extends THREE.Material>(material: T): T => {
      materials.push(material);
      return material;
    };

    const steel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x252827, roughness: 0.62, metalness: 0.82 }));
    const darkSteel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x101313, roughness: 0.54, metalness: 0.9 }));
    const edgeSteel = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x4a4031, roughness: 0.7, metalness: 0.72 }));
    const rubber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x090a09, roughness: 0.92, metalness: 0.08 }));
    const amber = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x9f5a0a, emissive: 0x341500, roughness: 0.35, metalness: 0.65 }));
    const cyan = trackMaterial(new THREE.MeshStandardMaterial({ color: 0x4adfff, emissive: 0x0bbce8, emissiveIntensity: 4.2, roughness: 0.18, metalness: 0.22 }));
    const furnace = trackMaterial(new THREE.MeshStandardMaterial({ color: 0xff8a23, emissive: 0xff4f08, emissiveIntensity: 5.2, roughness: 0.5 }));
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

    // Rover: every visible part is 3D geometry and moves in the scene.
    const rover = new THREE.Group();
    rover.position.set(0, 0.05, 5.1);
    scene.add(rover);

    const lowerFrame = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(3.55, 0.34, 4.55)), darkSteel);
    lowerFrame.position.y = 1.05;
    lowerFrame.castShadow = true;
    rover.add(lowerFrame);
    const cargo = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(3.25, 1.55, 2.25)), steel);
    cargo.position.set(0, 2.05, 0.95);
    cargo.castShadow = true;
    rover.add(cargo);
    const cargoInset = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(2.7, 1.05, 0.12)), darkSteel);
    cargoInset.position.set(0, 2.05, 2.09);
    rover.add(cargoInset);

    const core = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.62, 1)), cyan);
    core.position.set(0, 1.95, -1.12);
    core.castShadow = true;
    rover.add(core);
    const coreHalo = new THREE.PointLight(0x35dfff, 7.5, 7, 2);
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
        rover.add(pivot);
        wheels.push(pivot);
        beam(rover, new THREE.Vector3(x * 0.7, 1.3, z), new THREE.Vector3(x, 0.9, z), 0.08, amber);
      }
    }

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

    scene.add(new THREE.HemisphereLight(0x516878, 0x140b05, 1.4));
    const key = new THREE.DirectionalLight(0xffd0a0, 3.2);
    key.position.set(-6, 12, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    scene.add(key);
    const furnaceLight = new THREE.PointLight(0xff6417, 13, 20, 2);
    furnaceLight.position.set(-6.3, 3.3, -1);
    scene.add(furnaceLight);
    const platformLight = new THREE.PointLight(0xff9b37, 8, 13, 2);
    platformLight.position.set(1.5, 3.2, -14);
    scene.add(platformLight);
    const rim = new THREE.SpotLight(0x5bdcff, 8, 30, Math.PI / 5, 0.6, 1.5);
    rim.position.set(7, 10, 2);
    rim.target = rover;
    scene.add(rim);

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
      rover.position.x = Math.sin(raw * Math.PI) * 0.22;
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
      const cameraTravel = travel * (portrait ? 2.5 : 5.2);
      camera.position.set(
        portrait ? 10.8 : 10.5 - travel * 1.8,
        portrait ? 8.7 : 7.2 - travel * 0.8,
        (portrait ? 19.8 : 16.5) - cameraTravel,
      );
      cameraTarget.set(0, 1.15, -4.2 - travel * (portrait ? 4.8 : 5.5));
      camera.lookAt(cameraTarget);
      furnaceLight.intensity = 12.5 + Math.sin(now * 0.006) * 1.4;
      platformLight.intensity = 7.4 + Math.sin(now * 0.004 + 1) * 0.8;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
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
