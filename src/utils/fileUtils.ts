import * as fs from 'fs';

export function removeFilesIfExists(paths: string[]) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    } catch (err) {
      // swallow — best-effort cleanup
      console.error('Failed to delete file', p, err);
    }
  }
}
