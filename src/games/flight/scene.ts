import * as T from 'three';
import { PARTS, massProperties, type Blueprint } from './blueprints';
import type { FlightEngine } from './engine';
export class FlightScene {
    renderer: T.WebGLRenderer;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(48, 1, .1, 1500);
    craft = new T.Group();
    overlay = new T.Group();
    com = new T.Mesh(new T.SphereGeometry(.15, 12, 8), new T.MeshBasicMaterial({ color: 0xf26b48, depthTest: false }));
    yaw = .65;
    elevation = .43;
    zoom = 16;
    drag = false;
    last = { x: 0, y: 0 };
    observer: ResizeObserver;
    ground: T.Mesh;
    constructor(public host: HTMLDivElement, public onSelect: (id: string | null) => void) {
        this.renderer = new T.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setClearColor(0xdce9df);
        this.renderer.shadowMap.enabled = true;
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        host.appendChild(this.renderer.domElement);
        this.scene.fog = new T.Fog(0xdce9df, 130, 700);
        this.scene.add(new T.HemisphereLight(0xfff9dc, 0x68887d, 2.3));
        const sun = new T.DirectionalLight(0xfff5df, 3);
        sun.position.set(30, 80, 35);
        this.scene.add(sun);
        this.scene.add(this.craft, this.overlay);
        this.craft.add(this.com);
        this.ground = this.box(1200, 2, 360, 0x83a99a, 250, -2, 0);
        this.scene.add(this.ground);
        this.scene.add(this.box(24, 32, 24, 0xa5b7a2, -8, 16, 0));
        this.scene.add(this.box(24, .15, 24, 0xd8cfaf, -8, 32.1, 0));
        this.scene.add(this.box(80, .1, 16, 0xede7c9, 150, .1, 0));
        for (let x = 120; x < 190; x += 10)
            this.scene.add(this.box(4, .12, .3, 0xffffff, x, .2, 0));
        const grid = new T.GridHelper(36, 36, 0xc4cab8, 0xd9decd);
        grid.position.y = 33;
        this.scene.add(grid);
        for (let i = 0; i < 24; i++) {
            const x = 40 + i * 20, z = (i % 2 ? -1 : 1) * (35 + (i * 17) % 60);
            const rock = new T.Mesh(new T.ConeGeometry(13 + (i % 4) * 5, 18 + (i % 5) * 6, 5), new T.MeshStandardMaterial({ color: i % 2 ? 0xa7b897 : 0x72988b, flatShading: true }));
            rock.position.set(x, 4, z);
            this.scene.add(rock);
        }
        const ring = new T.Mesh(new T.TorusGeometry(10, .3, 8, 40), new T.MeshStandardMaterial({ color: 0xf1a078, emissive: 0x42200e }));
        ring.rotation.y = Math.PI / 2;
        ring.position.set(65, 37, 0);
        this.scene.add(ring);
        this.observer = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); });
        this.observer.observe(host);
        this.renderer.domElement.addEventListener('pointerdown', this.down);
        window.addEventListener('pointerup', this.up);
        window.addEventListener('pointermove', this.move);
        this.renderer.domElement.addEventListener('wheel', this.wheel, { passive: false });
        this.renderer.domElement.addEventListener('click', this.click);
    }
    private box(w: number, h: number, d: number, c: number, x: number, y: number, z: number) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color: c, roughness: .8 })); m.position.set(x, y, z); return m; }
    down = (e: PointerEvent) => { this.drag = true; this.last = { x: e.clientX, y: e.clientY }; };
    up = () => { this.drag = false; };
    move = (e: PointerEvent) => { if (!this.drag)
        return; this.yaw -= (e.clientX - this.last.x) * .008; this.elevation = Math.max(.08, Math.min(1.35, this.elevation + (e.clientY - this.last.y) * .006)); this.last = { x: e.clientX, y: e.clientY }; };
    wheel = (e: WheelEvent) => { e.preventDefault(); this.zoom = Math.max(7, Math.min(40, this.zoom + e.deltaY * .015)); };
    click = (e: MouseEvent) => { const r = this.renderer.domElement.getBoundingClientRect(), ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera); const hit = ray.intersectObjects(this.craft.children).find(h => h.object.userData.part); this.onSelect(hit?.object.userData.part ?? null); };
    blueprint(b: Blueprint, selected: string | null) { for (const child of [...this.craft.children])
        if (child !== this.com) {
            this.craft.remove(child);
            if (child instanceof T.Mesh) {
                child.geometry.dispose();
                (child.material as T.Material).dispose();
            }
        } for (const p of b.parts) {
        const thin = p.kind === 'wing' || p.kind === 'control';
        const m = this.box(.94, thin ? .16 : p.kind === 'skid' ? .25 : .85, .94, p.id === selected ? 0xffffff : PARTS[p.kind].color, p.x, p.y, p.z);
        if (thin && p.rotation % 2)
            m.rotation.x = Math.PI / 2;
        m.userData.part = p.id;
        this.craft.add(m);
    } const c = massProperties(b).com; this.com.position.set(c.x, c.y, c.z); this.craft.position.set(0, 36, 0); this.craft.quaternion.identity(); }
    render(engine: FlightEngine | null, showForces: boolean, showCom: boolean) {
        const target = new T.Vector3(0, 36, 0);
        if (engine) {
            const p = engine.body.translation(), q = engine.body.rotation();
            this.craft.position.set(p.x, p.y, p.z);
            this.craft.quaternion.set(q.x, q.y, q.z, q.w);
            target.copy(this.craft.position);
            this.com.position.set(engine.mass.com.x, engine.mass.com.y, engine.mass.com.z);
        }
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
                    this.overlay.add(new T.ArrowHelper(f.force.clone().normalize(), f.position, Math.min(5, len * .035), f.kind === 'engine' ? 0xf1a078 : 0x1e6a61));
            }
        const offset = engine ? new T.Vector3(-14, 7, 15) : new T.Vector3(Math.cos(this.yaw) * this.zoom, Math.sin(this.elevation) * this.zoom, Math.sin(this.yaw) * this.zoom);
        this.camera.position.copy(target).add(offset);
        this.camera.lookAt(target);
        this.renderer.render(this.scene, this.camera);
    }
    dispose() { this.observer.disconnect(); this.renderer.domElement.removeEventListener('pointerdown', this.down); this.renderer.domElement.removeEventListener('click', this.click); this.renderer.domElement.removeEventListener('wheel', this.wheel); window.removeEventListener('pointerup', this.up); window.removeEventListener('pointermove', this.move); this.scene.traverse(o => { if (o instanceof T.Mesh || o instanceof T.Line) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials)
            m.dispose();
    } }); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
