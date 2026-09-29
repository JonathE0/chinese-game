// Each checkout keeps its own dependency cache: the admin and development servers share one
// node_modules through a link, and a shared node_modules/.vite made one re-optimise (and reload) the other.
// No hot reload on this checkout: agents edit it while the player plays and tests run, and every save
// reloaded their pages. Refresh the page to pick up changes.
export default {cacheDir:'.vite',server:{hmr:false}};
