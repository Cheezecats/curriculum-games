import { validateBlueprint, type Blueprint } from './blueprints';

export interface BuilderSnapshot {
  blueprint: Blueprint;
  selected: string | null;
}

function snapshot(value: BuilderSnapshot): BuilderSnapshot {
  const blueprint = validateBlueprint(value.blueprint);
  return {
    blueprint,
    selected:
      value.selected === null || blueprint.parts.some((p) => p.id === value.selected)
        ? value.selected
        : blueprint.parts[0].id,
  };
}

/** Selection travels with each valid aircraft edit; invalid edits never change history. */
export class BuilderHistory {
  private past: BuilderSnapshot[] = [];
  private future: BuilderSnapshot[] = [];
  constructor(private limit = 40) {}
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  record(before: BuilderSnapshot, after: BuilderSnapshot) {
    const next = snapshot(after),
      previous = snapshot(before);
    this.past.push(previous);
    this.past = this.past.slice(-this.limit);
    this.future = [];
    return next;
  }
  undo(current: BuilderSnapshot): BuilderSnapshot | null {
    if (!this.canUndo) return null;
    const value = snapshot(current);
    this.future.push(value);
    return snapshot(this.past.pop()!);
  }
  redo(current: BuilderSnapshot): BuilderSnapshot | null {
    if (!this.canRedo) return null;
    const value = snapshot(current);
    this.past.push(value);
    return snapshot(this.future.pop()!);
  }
}
