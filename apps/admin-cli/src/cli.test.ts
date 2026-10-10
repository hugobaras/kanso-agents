import { describe, expect, it } from "vitest";
import { requireTenantId } from "@kanso/tenancy";

describe("admin-cli helpers", () => {
  it("accepts slug tenant", () => {
    expect(requireTenantId("cabinet-durand")).toBe("cabinet-durand");
  });
});
