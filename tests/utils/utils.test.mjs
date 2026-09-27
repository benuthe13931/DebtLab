import assert from "node:assert/strict";
import test from "node:test";
import { cn } from "../../src/lib/utils.ts";

test("cn combines conditional classes and resolves Tailwind conflicts", () => {
  assert.equal(cn("px-2", false && "hidden", "px-4", "font-bold"), "px-4 font-bold");
  assert.equal(cn("text-sm", ["leading-5", { "text-red-500": true }]), "text-sm leading-5 text-red-500");
});
