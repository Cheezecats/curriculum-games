/** Invalidates deferred storage work on hide, reset, explicit recovery and disposal. */
export class StartupGate {
  private generation = 0;
  private disposed = false;
  constructor(private visible: () => boolean) {}
  invalidate() {
    this.generation++;
  }
  dispose() {
    this.disposed = true;
    this.invalidate();
  }
  async start<T>(read: () => Promise<T>, apply: (value: T) => void, fallback: () => void) {
    if (this.disposed || !this.visible()) return;
    const generation = ++this.generation;
    const current = () => !this.disposed && generation === this.generation && this.visible();
    try {
      const saved = await read();
      if (current()) apply(saved);
    } catch {
      if (current()) fallback();
    }
  }
}
