import * as T from 'three';
import { PARTS, massProperties, type Blueprint } from './blueprints';
import type { FlightEngine } from './engine';
import { DELIVERY_GATE } from './gate';
import {
  aircraftFocus,
  chaseOffset,
  followCamera,
  OrbitGesture,
  type ChaseHeading,
} from './camera';
export class FlightScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(48, 1, 0.1, 1500);
  craft = new T.Group();
  overlay = new T.Group();
  com = new T.Mesh(
    new T.SphereGeometry(0.15, 12, 8),
    new T.MeshBasicMaterial({ color: 0xef2b12, depthTest: false }),
  );
  yaw = 0.65;
  elevation = 0.43;
  zoom = 16;
  drag = false;
  last = { x: 0, y: 0 };
  private gesture = new OrbitGesture();
  private suppressClick = false;
  private building = true;
  private chaseInitialized = false;
  private chaseHeading: ChaseHeading = { angle: null };
  observer: ResizeObserver;
  ground: T.Mesh;
  constructor(
    public host: HTMLDivElement,
    public onSelect: (id: string | null) => void,
  ) {
    this.renderer = new T.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0xc7d7e5);
    // Keep the workshop inexpensive: no shadow-map passes or postprocessing.
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.scene.fog = new T.Fog(0xc7d7e5, 130, 700);
    this.scene.add(new T.HemisphereLight(0xeaf2ff, 0x555b63, 1.7));
    const sun = new T.DirectionalLight(0xffffff, 2.7);
    sun.position.set(30, 80, 35);
    this.scene.add(sun);
    this.scene.add(this.craft, this.overlay);
    this.craft.add(this.com);
    this.ground = this.box(1200, 2, 360, 0x717b82, 250, -1, 0);
    this.scene.add(this.ground);
    this.scene.add(this.box(24, 32, 24, 0x70757a, -8, 16, 0));
    this.scene.add(this.box(24, 0.15, 24, 0xbabdbd, -8, 32.1, 0));
    this.scene.add(this.box(80, 0.1, 16, 0x373d43, 150, 0.1, 0));
    for (let x = 120; x < 190; x += 10) this.scene.add(this.box(4, 0.12, 0.3, 0xffffff, x, 0.2, 0));
    const grid = new T.GridHelper(36, 36, 0x737a80, 0xa2a8ad);
    grid.position.y = 32.2;
    this.scene.add(grid);
    // A light industrial service frame sits at the rear of the launch field.
    // All new details are outside the launch corridor and purely decorative.
    // Instancing keeps the steelwork to a single draw call.
    const beams = [
      [0.24, 9, 0.24, -18, 36.7, -10],
      [0.24, 9, 0.24, -18, 36.7, 10],
      [0.24, 9, 0.24, -10, 36.7, -10],
      [0.24, 9, 0.24, -10, 36.7, 10],
      [0.24, 0.3, 20.4, -18, 41.1, 0],
      [0.24, 0.3, 20.4, -10, 41.1, 0],
      [8.2, 0.3, 0.24, -14, 41.1, -10],
      [8.2, 0.3, 0.24, -14, 41.1, 10],
      [0.18, 0.18, 20, -18, 38, 0],
      [8, 0.18, 0.18, -14, 35.5, -10],
    ];
    const steelwork: T.InstancedMesh = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshStandardMaterial({ color: 0x343a40, roughness: 0.65, metalness: 0.25 }),
      beams.length,
    );
    const detail = new T.Object3D();
    beams.forEach(([w, h, d, x, y, z], i) => {
      detail.position.set(x, y, z);
      detail.scale.set(w, h, d);
      detail.updateMatrix();
      steelwork.setMatrixAt(i, detail.matrix);
    });
    this.scene.add(steelwork);
    // Flush paint identifies the pad edge and forward direction without adding obstacles.
    const paint: T.InstancedMesh = new T.InstancedMesh(
      new T.BoxGeometry(1, 0.02, 1),
      new T.MeshBasicMaterial({ color: 0xef2b12 }),
      12,
    );
    for (let i = 0; i < 12; i++) {
      detail.position.set(3.5, 32.2, -10.5 + i * 1.9);
      detail.scale.set(0.5, 1, 0.8);
      detail.updateMatrix();
      paint.setMatrixAt(i, detail.matrix);
    }
    this.scene.add(paint);
    for (let i = 0; i < 24; i++) {
      const x = 40 + i * 20,
        z = (i % 2 ? -1 : 1) * (35 + ((i * 17) % 60));
      const rock = new T.Mesh(
        new T.ConeGeometry(13 + (i % 4) * 5, 18 + (i % 5) * 6, 5),
        new T.MeshStandardMaterial({ color: i % 2 ? 0x959da4 : 0x757e88, flatShading: true }),
      );
      rock.position.set(x, 4, z);
      this.scene.add(rock);
    }
    const ring = new T.Mesh(
      new T.TorusGeometry(DELIVERY_GATE.radius, DELIVERY_GATE.tube, 8, 40),
      new T.MeshStandardMaterial({ color: 0xef2b12, emissive: 0x3d0600 }),
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(DELIVERY_GATE.x, DELIVERY_GATE.y, DELIVERY_GATE.z);
    this.scene.add(ring);
    this.observer = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.observer.observe(host);
    this.renderer.domElement.addEventListener('pointerdown', this.down);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointermove', this.move);
    this.renderer.domElement.addEventListener('wheel', this.wheel, { passive: false });
    this.renderer.domElement.addEventListener('click', this.click);
  }
  private box(w: number, h: number, d: number, c: number, x: number, y: number, z: number) {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.12 }),
    );
    m.position.set(x, y, z);
    return m;
  }
  down = (e: PointerEvent) => {
    if (!this.building || e.button !== 0) return;
    this.drag = true;
    this.suppressClick = false;
    this.gesture.begin(e.clientX, e.clientY);
    this.last = { x: e.clientX, y: e.clientY };
  };
  up = () => {
    if (!this.drag) return;
    this.suppressClick = !this.gesture.end();
    this.drag = false;
  };
  move = (e: PointerEvent) => {
    if (!this.drag) return;
    this.gesture.move(e.clientX, e.clientY);
    this.yaw -= (e.clientX - this.last.x) * 0.008;
    this.elevation = Math.max(
      0.08,
      Math.min(1.35, this.elevation + (e.clientY - this.last.y) * 0.006),
    );
    this.last = { x: e.clientX, y: e.clientY };
  };
  wheel = (e: WheelEvent) => {
    if (!this.building) return;
    e.preventDefault();
    this.zoom = Math.max(7, Math.min(40, this.zoom + e.deltaY * 0.015));
  };
  click = (e: MouseEvent) => {
    if (!this.building || this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const r = this.renderer.domElement.getBoundingClientRect(),
      ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = ray.intersectObjects(this.craft.children).find((h) => h.object.userData.part);
    this.onSelect(hit?.object.userData.part ?? null);
  };
  blueprint(b: Blueprint, selected: string | null) {
    this.chaseInitialized = false;
    this.chaseHeading.angle = null;
    for (const child of [...this.craft.children])
      if (child !== this.com) {
        this.craft.remove(child);
        child.traverse((object) => {
          if (object instanceof T.Mesh || object instanceof T.Line) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) material.dispose();
          }
        });
      }
    for (const p of b.parts) {
      const thin = p.kind === 'wing' || p.kind === 'control';
      const m = this.box(
        0.94,
        thin ? 0.16 : p.kind === 'skid' ? 0.25 : 0.85,
        0.94,
        p.id === selected ? 0xffbc32 : PARTS[p.kind].color,
        p.x,
        p.y,
        p.z,
      );
      if (thin && p.rotation % 2) m.rotation.x = Math.PI / 2;
      if (p.id === selected) {
        const outline = new T.LineSegments(
          new T.EdgesGeometry(m.geometry),
          new T.LineBasicMaterial({ color: 0x111111 }),
        );
        outline.scale.setScalar(1.02);
        m.add(outline);
      }
      m.userData.part = p.id;
      this.craft.add(m);
    }
    const c = massProperties(b).com;
    this.com.position.set(c.x, c.y, c.z);
    this.craft.position.set(0, 36, 0);
    this.craft.quaternion.identity();
  }
  resetView() {
    this.yaw = 0.65;
    this.elevation = 0.43;
    this.zoom = 16;
    this.chaseInitialized = false;
  }
  render(
    engine: FlightEngine | null,
    showForces: boolean,
    showCom: boolean,
    dt = 1 / 60,
    reducedMotion = false,
  ) {
    this.building = !engine;
    if (engine) {
      const p = engine.body.translation(),
        q = engine.body.rotation();
      this.craft.position.set(p.x, p.y, p.z);
      this.craft.quaternion.set(q.x, q.y, q.z, q.w);
      this.com.position.set(engine.mass.com.x, engine.mass.com.y, engine.mass.com.z);
    }
    const target = engine
      ? new T.Vector3().copy(engine.body.worldCom())
      : aircraftFocus(this.com.position, this.craft.position, this.craft.quaternion);
    this.com.visible = showCom;
    for (const c of [...this.overlay.children]) {
      this.overlay.remove(c);
      if (c instanceof T.ArrowHelper) {
        c.line.geometry.dispose();
        c.cone.geometry.dispose();
        (c.line.material as T.Material).dispose();
        (c.cone.material as T.Material).dispose();
      }
    }
    if (engine && showForces)
      for (const f of engine.forces) {
        const len = f.force.length();
        if (len > 1)
          this.overlay.add(
            new T.ArrowHelper(
              f.force.clone().normalize(),
              f.position,
              Math.min(5, len * 0.035),
              f.kind === 'engine' ? 0xef2b12 : 0x30343a,
            ),
          );
      }
    const offset = engine
      ? chaseOffset(engine.body.rotation(), this.chaseHeading, dt)
      : new T.Vector3(
          Math.cos(this.yaw) * this.zoom,
          Math.sin(this.elevation) * this.zoom,
          Math.sin(this.yaw) * this.zoom,
        );
    const destination = target.clone().add(offset);
    if (engine && this.chaseInitialized)
      followCamera(this.camera.position, destination, dt, reducedMotion);
    else this.camera.position.copy(destination);
    this.chaseInitialized = !!engine;
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.down);
    this.renderer.domElement.removeEventListener('click', this.click);
    this.renderer.domElement.removeEventListener('wheel', this.wheel);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointermove', this.move);
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line) {
        if (o instanceof T.InstancedMesh) o.dispose();
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) m.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
