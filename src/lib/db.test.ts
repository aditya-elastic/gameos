import { describe, expect, it } from "vitest";
import { isSqliteBusyError, withDatabaseRetry } from "./db";

describe("database busy handling", () => {
  it("recognizes SQLite lock errors", () => {
    expect(isSqliteBusyError(new Error("database is locked"))).toBe(true);
    expect(isSqliteBusyError(new Error("SQLITE_BUSY: database is busy"))).toBe(true);
    expect(isSqliteBusyError(new Error("different failure"))).toBe(false);
  });

  it("retries transient lock errors before succeeding", () => {
    let attempts = 0;
    const result = withDatabaseRetry(
      () => {
        attempts += 1;
        if (attempts < 3) throw new Error("database is locked");
        return "ok";
      },
      { retries: 3, baseDelayMs: 1 }
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});
