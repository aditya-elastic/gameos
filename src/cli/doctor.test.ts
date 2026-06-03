import { describe, expect, it } from "vitest";
import { detectInstallShadow, renderDoctorReportText, type DoctorReport } from "./doctor";

describe("gameos doctor", () => {
  it("detects npm and Homebrew binary shadowing", () => {
    const install = detectInstallShadow([
      "/Users/aditya/.nvm/versions/node/v24.14.1/bin/gameos",
      "/opt/homebrew/bin/gameos"
    ]);

    expect(install.npmGlobalFound).toBe(true);
    expect(install.homebrewFound).toBe(true);
    expect(install.shadowed).toBe(true);
    expect(install.warning).toContain("Both npm and Homebrew");
  });

  it("renders a friendly Chrome browser QA hint", () => {
    const report: DoctorReport = {
      ok: true,
      version: "0.4.1",
      node: "v24.0.0",
      dataRoot: "/tmp/gameos",
      install: {
        activeBinary: "/tmp/gameos",
        firstOnPath: "/tmp/gameos",
        pathMatches: ["/tmp/gameos"],
        npmGlobalFound: true,
        homebrewFound: false,
        shadowed: false,
        warning: null
      },
      commands: {
        chrome: false,
        chromePath: "",
        godot: false,
        godotPath: "",
        unity: false,
        unityPath: ""
      },
      privacy: {
        telemetry: false,
        cloudCalls: false,
        hiddenNetwork: false
      }
    };

    expect(renderDoctorReportText(report)).toContain("install Google Chrome or set CHROME_PATH");
  });
});
