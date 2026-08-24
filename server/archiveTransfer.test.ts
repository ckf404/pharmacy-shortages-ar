import { afterEach, describe, expect, it, vi } from "vitest";

const { drizzleMock } = vi.hoisted(() => ({ drizzleMock: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: drizzleMock }));

type TransferMode = "create" | "existing" | "restore";

function selectChain(result: unknown) {
  const limited = vi.fn().mockResolvedValue(result);
  return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: limited })) })) };
}

async function loadTransferService(mode: TransferMode) {
  vi.resetModules();
  process.env.DATABASE_URL = "mysql://test";
  const targetDay = { id: 500, dayKey: "2026-08-24" };
  const source = { id: 321, shortageDayId: 499, productName: "فيتامين ب", dosageForm: "حقن", quantity: 2, priority: "important", status: "received", notes: "أمبول", suggestedSupplierId: null };
  const rows = [
    [targetDay],
    [source],
    mode === "existing" ? [{ id: 701 }] : [],
    mode === "restore" ? [{ id: 702 }] : [],
  ];
  let valueCalls = 0;
  const insert = vi.fn(() => ({ values: vi.fn(() => {
    valueCalls += 1;
    if (valueCalls === 1) return { onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined) };
    if (mode === "create" && valueCalls === 2) return [{ insertId: 703 }];
    return Promise.resolve(undefined);
  }) }));
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const fakeDb = {
    select: vi.fn(() => selectChain(rows.shift() ?? [])),
    insert,
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
  };
  drizzleMock.mockReturnValue(fakeDb);
  const { manuallyAddArchivedShortage } = await import("./db");
  return { manuallyAddArchivedShortage, fakeDb, updateWhere };
}

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.clearAllMocks();
});

describe("manual archived-item transfer", () => {
  it("creates a new current-day item while preserving archived dosage form and quantity", async () => {
    const { manuallyAddArchivedShortage, fakeDb } = await loadTransferService("create");
    await expect(manuallyAddArchivedShortage(321, 9)).resolves.toEqual({ added: true, itemId: 703, restored: false });
    expect(fakeDb.insert).toHaveBeenCalledTimes(3);
  });

  it("does not create a duplicate when the matching item is already active today", async () => {
    const { manuallyAddArchivedShortage, fakeDb } = await loadTransferService("existing");
    await expect(manuallyAddArchivedShortage(321, 9)).resolves.toEqual({ added: false, itemId: 701, restored: false });
    expect(fakeDb.insert).toHaveBeenCalledTimes(1);
  });

  it("restores a prior soft-deleted copy rather than inserting the same archived source again", async () => {
    const { manuallyAddArchivedShortage, fakeDb, updateWhere } = await loadTransferService("restore");
    await expect(manuallyAddArchivedShortage(321, 9)).resolves.toEqual({ added: true, itemId: 702, restored: true });
    expect(updateWhere).toHaveBeenCalledTimes(1);
    expect(fakeDb.insert).toHaveBeenCalledTimes(2);
  });
});
