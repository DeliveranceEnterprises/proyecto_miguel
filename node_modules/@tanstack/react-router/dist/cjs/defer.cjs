"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const router = require("./router.cjs");
function defer(_promise, options) {
  const promise = _promise;
  if (!promise.__deferredState) {
    promise.__deferredState = {
      uid: Math.random().toString(36).slice(2),
      status: "pending"
    };
    const state = promise.__deferredState;
    promise.then((data) => {
      state.status = "success";
      state.data = data;
    }).catch((error) => {
      state.status = "error";
      state.error = {
        data: ((options == null ? void 0 : options.serializeError) ?? router.defaultSerializeError)(error),
        __isServerError: true
      };
    });
  }
  return promise;
}
function isDehydratedDeferred(obj) {
  return typeof obj === "object" && obj !== null && !(obj instanceof Promise) && !obj.then && "__deferredState" in obj;
}
exports.defer = defer;
exports.isDehydratedDeferred = isDehydratedDeferred;
//# sourceMappingURL=defer.cjs.map
