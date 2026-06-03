import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("web adapter presentation", () => {
  it("keeps visible GameOS watermarks padded away from the canvas edge", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/web-adapter.ts"), "utf8");

    expect(source).toContain("right: clamp(20px, 2.4vw, 30px);");
    expect(source).toContain("bottom: clamp(20px, 2.4vw, 30px);");
    expect(source).toContain('context.fillText("Made with GameOS", canvas.width - 32, canvas.height - 30);');
    expect(source).not.toContain('context.fillText("Made with GameOS", canvas.width - 24, canvas.height - 22);');
  });
});
