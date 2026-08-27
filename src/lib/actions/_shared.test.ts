import test from "node:test";
import assert from "node:assert/strict";

import { resolveBranchFallback } from "./_shared.ts";

test("uses session branch when present", () => {
  const result = resolveBranchFallback({
    sessionBranchId: "branch-from-user",
    activeBranch: { id: "branch-active", name: "Active" },
    firstBranch: { id: "branch-first", name: "First" },
  });

  assert.equal(result?.id, "branch-active");
});

test("returns null when no branch exists", () => {
  const result = resolveBranchFallback({
    sessionBranchId: null,
    activeBranch: null,
    firstBranch: null,
  });

  assert.equal(result, null);
});
