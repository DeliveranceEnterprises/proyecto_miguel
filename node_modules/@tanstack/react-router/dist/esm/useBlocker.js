import * as React from "react";
import { useRouter } from "./useRouter.js";
function useBlocker(blockerFn, condition = true) {
  const { history } = useRouter();
  React.useEffect(() => {
    if (!condition)
      return;
    return history.block(blockerFn);
  });
}
function Block({ blocker, condition, children }) {
  useBlocker(blocker, condition);
  return children ?? null;
}
export {
  Block,
  useBlocker
};
//# sourceMappingURL=useBlocker.js.map
