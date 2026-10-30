import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { it, expect } from 'vitest';
import { validateWorkerImages } from '../../main/utils/workerImages';

it('validates every image including outside-root and symlink escapes in later slots', (): void => {
  const dir = mkdtempSync(join(tmpdir(), 'worker-images-'));
  try {
    const root = join(dir, 'inputs'); mkdirSync(root);
    const first = join(root, 'first.png'); const second = join(root, 'second.png');
    const outside = join(dir, 'outside.png');
    for (const file of [first, second, outside]) writeFileSync(file, 'image');
    expect(() => validateWorkerImages(root, [first, second])).not.toThrow();
    expect(() => validateWorkerImages(root, [first, outside])).toThrow('WORKER_IMAGE_INVALID');
    const escape = join(root, 'escape.png'); symlinkSync(outside, escape);
    expect(() => validateWorkerImages(root, [first, escape])).toThrow('WORKER_IMAGE_INVALID');
    writeFileSync(second, '');
    expect(() => validateWorkerImages(root, [first, second])).toThrow('WORKER_IMAGE_INVALID');
    expect(() => validateWorkerImages(root, [])).toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
