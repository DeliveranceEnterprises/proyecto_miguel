import * as React from "react";
function isModuleNotFoundError(error) {
  return typeof (error == null ? void 0 : error.message) === "string" && /Failed to fetch dynamically imported module/.test(error.message);
}
function lazyRouteComponent(importer, exportName) {
  let loadPromise;
  const load = () => {
    if (!loadPromise) {
      loadPromise = importer().catch((error) => {
        if (isModuleNotFoundError(error)) {
          loadPromise.moduleNotFoundError = error;
          return null;
        }
        throw error;
      });
    }
    return loadPromise;
  };
  const lazyComp = React.lazy(async () => {
    try {
      const promise = load();
      if (promise.moduleNotFoundError) {
        throw promise.moduleNotFoundError;
      }
      const moduleExports = await promise;
      const comp = moduleExports[exportName ?? "default"];
      return {
        default: comp
      };
    } catch (error) {
      if (error instanceof Error && isModuleNotFoundError(error) && typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
        const storageKey = `tanstack_router_reload:${error.message}`;
        if (!sessionStorage.getItem(storageKey)) {
          sessionStorage.setItem(storageKey, "1");
          window.location.reload();
          return {
            default: () => null
          };
        }
      }
      throw error;
    }
  });
  lazyComp.preload = load;
  return lazyComp;
}
export {
  lazyRouteComponent
};
//# sourceMappingURL=lazyRouteComponent.js.map
