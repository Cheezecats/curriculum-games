import { expect, it } from 'vitest';
import { augment, dataset } from './datasets';

it('keeps sensor augmentation on the same side of linear and XOR boundaries', () => {
  const linear = dataset('linear', 'train', 72)[0]!;
  for (const variant of augment(linear)) {
    expect(variant.input[0]! * 0.7 + variant.input[1]! * 0.3).toBeLessThanOrEqual(0.5);
  }
  const xor = dataset('xor', 'train', 72)[36]!;
  for (const variant of augment(xor)) {
    expect(variant.input[0]! > 0.5).toBe(false);
    expect(variant.input[1]! > 0.5).toBe(false);
  }
});

it('preserves a deliberately wrong supplied label rather than repairing it during augmentation', () => {
  const original = { ...dataset('linear', 'train', 72)[0]!, label: 1 };
  for (const variant of augment(original)) {
    expect(variant.label).toBe(1);
    expect(variant.family).toBe(original.family);
    expect(variant.id).not.toBe(original.id);
    expect(variant.input[0]! * 0.7 + variant.input[1]! * 0.3).toBeLessThanOrEqual(0.5);
  }
});
