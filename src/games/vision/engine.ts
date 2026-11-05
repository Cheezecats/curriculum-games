import * as tf from '@tensorflow/tfjs';
import { dataset } from './datasets';
import type { DataKind, Sample } from './datasets';
import { validProvenance } from './provenance';
import type { TrainingProvenance } from './provenance';
export type Preset = 'perceptron' | 'mlp' | 'cnn';
export interface Snapshot {
  version: 1;
  kind: DataKind;
  preset: Preset;
  units: number;
  weights: { shape: number[]; values: number[] }[];
  provenance?: TrainingProvenance;
}
export interface Epoch {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number;
  valAccuracy: number;
}
export interface Inspection {
  weights: Snapshot['weights'];
  activations: number[];
  activationShape: number[];
  boundary: number[];
  parameters: number;
}
export class VisionEngine {
  model: tf.Sequential | null = null;
  kind: DataKind = 'linear';
  preset: Preset = 'perceptron';
  units = 8;
  private provenance: TrainingProvenance = { status: 'unknown' };
  private stopped = false;
  private optimizer: tf.Optimizer | null = null;
  async init(kind: DataKind, preset: Preset, units = 8) {
    this.dispose();
    this.provenance = { status: 'unknown' };
    await tf.setBackend('cpu');
    await tf.ready();
    this.kind = kind;
    this.preset = preset;
    this.units = Math.max(4, Math.min(16, Math.round(units)));
    this.model = tf.sequential();
    let seed = 81;
    const initializer = () => tf.initializers.glorotUniform({ seed: seed++ });
    if (kind === 'image' && preset === 'cnn') {
      this.model.add(
        tf.layers.conv2d({
          inputShape: [16, 16, 1],
          filters: 4,
          kernelSize: 3,
          activation: 'relu',
          kernelInitializer: initializer(),
        }),
      );
      this.model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));
      this.model.add(tf.layers.flatten());
    } else {
      if (kind === 'image') this.model.add(tf.layers.flatten({ inputShape: [16, 16, 1] }));
      if (preset !== 'perceptron')
        this.model.add(
          tf.layers.dense({
            ...(kind !== 'image' ? { inputShape: [2] } : {}),
            units: this.units,
            activation: 'tanh',
            kernelInitializer: initializer(),
          }),
        );
    }
    this.model.add(
      tf.layers.dense({
        ...(kind !== 'image' && preset === 'perceptron' ? { inputShape: [2] } : {}),
        units: kind === 'image' ? 3 : 2,
        activation: 'softmax',
        kernelInitializer: initializer(),
      }),
    );
  }
  private inputs(rows: number[][]) {
    return this.kind === 'image'
      ? tf.tensor4d(rows.flat(), [rows.length, 16, 16, 1])
      : tf.tensor2d(rows);
  }
  predict(inputs: number[][]): number[][] {
    if (!this.model || !inputs.length) return [];
    return tf.tidy(() => {
      const prediction = this.model!.predict(this.inputs(inputs)) as tf.Tensor;
      return prediction.arraySync() as number[][];
    });
  }
  evaluate(samples: Sample[]) {
    const probabilities = this.predict(samples.map((s) => s.input));
    return {
      accuracy:
        probabilities.reduce(
          (n, p, i) => n + Number(p.indexOf(Math.max(...p)) === samples[i]!.label),
          0,
        ) / samples.length,
      loss:
        probabilities.reduce((n, p, i) => n - Math.log(Math.max(1e-7, p[samples[i]!.label]!)), 0) /
        samples.length,
    };
  }
  async train(
    train: Sample[],
    validation: Sample[],
    epochs: number,
    rate: number,
    onEpoch: (e: Epoch) => void,
    context: { auditRepairedLabels?: boolean } = {},
  ) {
    if (!this.model) throw Error('Prepare a model first');
    if (train.length < 6) throw Error('Select at least six training examples');
    if (new Set(train.map((s) => s.label)).size < 2)
      throw Error('Training needs at least two labels');
    this.stopped = false;
    this.optimizer?.dispose();
    this.optimizer = tf.train.adam(Math.max(0.001, Math.min(0.1, rate)));
    this.model.compile({
      optimizer: this.optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
    this.model.stopTraining = false;
    const x = this.inputs(train.map((s) => s.input));
    const y = tf.tidy(() =>
      tf.oneHot(
        tf.tensor1d(
          train.map((s) => s.label),
          'int32',
        ),
        this.kind === 'image' ? 3 : 2,
      ),
    );
    const vx = this.inputs(validation.map((s) => s.input));
    const vy = tf.tidy(() =>
      tf.oneHot(
        tf.tensor1d(
          validation.map((s) => s.label),
          'int32',
        ),
        this.kind === 'image' ? 3 : 2,
      ),
    );
    const started = performance.now();
    let completedEpochs = 0;
    this.provenance = { status: 'unknown' };
    try {
      await this.model.fit(x, y, {
        epochs: Math.max(1, Math.min(60, epochs)),
        batchSize: 24,
        shuffle: false,
        validationData: [vx, vy],
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            completedEpochs = epoch + 1;
            onEpoch({
              epoch: epoch + 1,
              loss: Number(logs?.loss),
              accuracy: Number(logs?.acc),
              valLoss: Number(logs?.val_loss),
              valAccuracy: Number(logs?.val_acc),
            });
            if (this.stopped) this.model!.stopTraining = true;
            await new Promise((r) => setTimeout(r, 0));
          },
        },
      });
      const audited =
        context.auditRepairedLabels && this.kind === 'linear'
          ? dataset('linear', 'train', 72).slice(0, 9)
          : [];
      this.provenance = {
        status: 'known',
        augmented: train.some((s) => s.id !== s.family),
        repairs: audited.filter((original) =>
          train.some((s) => s.id === original.id && s.label === original.label),
        ).length,
        epochs: completedEpochs,
        trainingMs: performance.now() - started,
      };
    } finally {
      x.dispose();
      y.dispose();
      vx.dispose();
      vy.dispose();
    }
  }
  snapshot(): Snapshot {
    if (!this.model) throw Error('No model');
    return {
      version: 1,
      kind: this.kind,
      preset: this.preset,
      units: this.units,
      provenance: { ...this.provenance },
      weights: this.model
        .getWeights()
        .map((t) => ({ shape: t.shape, values: Array.from(t.dataSync()) })),
    };
  }
  async restore(saved: Snapshot) {
    if (
      !saved ||
      (saved.provenance !== undefined && !validProvenance(saved.provenance)) ||
      saved.version !== 1 ||
      !['linear', 'xor', 'image'].includes(saved.kind) ||
      !['perceptron', 'mlp', 'cnn'].includes(saved.preset) ||
      !Number.isInteger(saved.units) ||
      saved.units < 4 ||
      saved.units > 16 ||
      (saved.preset === 'cnn' && saved.kind !== 'image') ||
      !Array.isArray(saved.weights)
    )
      throw Error('Invalid saved model');
    const inputs = saved.kind === 'image' ? 256 : 2,
      classes = saved.kind === 'image' ? 3 : 2;
    const shapes =
      saved.preset === 'cnn'
        ? [[3, 3, 1, 4], [4], [196, 3], [3]]
        : saved.preset === 'mlp'
          ? [[inputs, saved.units], [saved.units], [saved.units, classes], [classes]]
          : [[inputs, classes], [classes]];
    if (
      saved.weights.length !== shapes.length ||
      saved.weights.some(
        (w, i) =>
          !w ||
          !Array.isArray(w.shape) ||
          !Array.isArray(w.values) ||
          JSON.stringify(w.shape) !== JSON.stringify(shapes[i]) ||
          w.values.length !== shapes[i]!.reduce((a, b) => a * b, 1) ||
          w.values.some((v) => !Number.isFinite(v)),
      )
    )
      throw Error('Invalid saved model');
    await this.init(saved.kind, saved.preset, saved.units);
    const tensors = saved.weights.map((w) => tf.tensor(w.values, w.shape));
    try {
      this.model!.setWeights(tensors);
      this.provenance = saved.provenance ? { ...saved.provenance } : { status: 'unknown' };
    } finally {
      tensors.forEach((t) => t.dispose());
    }
  }
  inspect(input: number[]): Inspection {
    if (!this.model) throw Error('No model');
    let activations: number[] = [],
      activationShape: number[] = [];
    if (this.kind === 'image' && this.preset === 'cnn') {
      tf.tidy(() => {
        const layer = this.model!.layers[0]!;
        const tensor = layer.apply(this.inputs([input])) as tf.Tensor;
        activations = Array.from(tensor.dataSync());
        activationShape = tensor.shape;
      });
    }
    const grid = Array.from({ length: 225 }, (_, i) => [(i % 15) / 14, Math.floor(i / 15) / 14]);
    return {
      weights: this.snapshot().weights,
      activations,
      activationShape,
      boundary: this.kind !== 'image' ? this.predict(grid).map((p) => p[1]!) : [],
      parameters: this.model.countParams(),
    };
  }
  cancel() {
    this.stopped = true;
  }
  dispose() {
    this.cancel();
    this.model?.dispose();
    this.model = null;
    this.optimizer?.dispose();
    this.optimizer = null;
  }
}
