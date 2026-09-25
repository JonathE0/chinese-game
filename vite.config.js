// Each checkout keeps its own dependency cache: the admin and development servers share one
// node_modules through a link, and a shared node_modules/.vite made one re-optimise (and reload) the other.
export default {cacheDir:'.vite'};
