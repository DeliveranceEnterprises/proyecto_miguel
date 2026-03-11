"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const React = require("react");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const React__namespace = /* @__PURE__ */ _interopNamespaceDefault(React);
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
  const lazyComp = React__namespace.lazy(async () => {
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
exports.lazyRouteComponent = lazyRouteComponent;
//# sourceMappingURL=lazyRouteComponent.cjs.map
