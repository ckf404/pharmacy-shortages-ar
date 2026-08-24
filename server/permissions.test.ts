import { describe, expect, it } from "vitest";
import { canUsePermission, defaultPermissions, parsePermissions, serializePermissions } from "./permissions";

describe("granular permissions", () => {
  it("grants every operation to an administrator", () => {
    expect(canUsePermission({ role: "admin", permissions: null }, "users_manage")).toBe(true);
    expect(defaultPermissions("admin").settings_manage).toBe(true);
  });

  it("keeps normal-user defaults focused on daily shortages", () => {
    const permissions = defaultPermissions("user");
    expect(permissions.shortages_create).toBe(true);
    expect(permissions.suppliers_manage).toBe(false);
    expect(permissions.users_manage).toBe(false);
  });

  it("reads a manager-selected list and ignores unknown keys", () => {
    const raw = serializePermissions(["suppliers_manage", "messages_manage"]);
    const parsed = parsePermissions(raw, "user");
    expect(parsed.suppliers_manage).toBe(true);
    expect(parsed.messages_manage).toBe(true);
    expect(parsed.rollover_manage).toBe(false);
  });

  it("allows shortage editing only when a normal user has the explicit editing permission", () => {
    expect(canUsePermission({ role: "user", permissions: serializePermissions(["shortages_create"]) }, "shortages_update")).toBe(false);
    expect(canUsePermission({ role: "user", permissions: serializePermissions(["shortages_update"]) }, "shortages_update")).toBe(true);
  });

  it("gives supervisors complete control even if an older saved permission list is incomplete", () => {
    const supervisor = { role: "supervisor" as const, permissions: serializePermissions(["activity_view"]) };
    expect(canUsePermission(supervisor, "users_manage")).toBe(true);
    expect(canUsePermission(supervisor, "settings_manage")).toBe(true);
  });
});
