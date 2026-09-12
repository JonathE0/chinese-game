// Every fetch or Audio src for a file under public/ must resolve against Vite's base, so the
// game works both at the site root (dev server) and under a sub-path (e.g. GitHub Pages).
// Vite guarantees BASE_URL ends with a trailing slash, so strip any leading slash from the path.
export function assetUrl(path){
  return import.meta.env.BASE_URL+String(path).replace(/^\/+/,'');
}
