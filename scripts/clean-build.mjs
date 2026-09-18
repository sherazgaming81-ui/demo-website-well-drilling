import { rmSync, existsSync } from "node:fs";

// Turbopack can hand back a cached stylesheet when Vercel restores its build
// cache, and the deployed HTML then references an old CSS chunk — the page ships
// new markup with old styles. Deleting the cache before every build makes the
// emitted CSS match the CSS in git. Cheap insurance for a site this small.
for (const dir of [".next", ".swc", "node_modules/.cache"]) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`cleaned ${dir}`);
  }
}
