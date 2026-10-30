import * as fs from 'fs';
import * as path from 'path';

/** 每张参考图都必须来自专用 Worker 素材根目录，顺序由调用方保留。 */
export function validateWorkerImages(root: string | undefined, images: unknown): void {
  if (!root || !Array.isArray(images) || images.length === 0) throw new Error('WORKER_ASSET_ROOT_REQUIRED');
  const resolvedRoot = fs.realpathSync(root);
  for (const imagePath of images) {
    if (typeof imagePath !== 'string' || !imagePath.trim()) throw new Error('WORKER_IMAGE_INVALID');
    const image = fs.realpathSync(imagePath);
    const relative = path.relative(resolvedRoot, image);
    const stat = fs.statSync(image);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !stat.isFile() || stat.size > 16 * 1024 * 1024 || stat.size <= 0) throw new Error('WORKER_IMAGE_INVALID');
  }
}
