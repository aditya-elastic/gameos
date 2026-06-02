import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { AgentDefinition } from "./types";

const agentSchema = z.object({
  role: z.string(),
  title: z.string(),
  mission: z.string(),
  skills: z.array(z.string())
});

const agentsSchema = z.array(agentSchema);

export function loadAgentDefinitions(): AgentDefinition[] {
  const registryPath = findAgentRegistryPath();
  const raw = fs.readFileSync(registryPath, "utf8");
  return agentsSchema.parse(JSON.parse(raw));
}

export function getAgentDefinition(role: string): AgentDefinition {
  const definition = loadAgentDefinitions().find((agent) => agent.role === role);

  if (!definition) {
    throw new Error(`Unknown Game OS agent role: ${role}`);
  }

  return definition;
}

function findAgentRegistryPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const candidates = [
    process.env.GAME_OS_AGENT_REGISTRY_PATH,
    path.join(process.cwd(), "studio-agents", "agents.json"),
    path.join(path.dirname(currentFile), "..", "studio-agents", "agents.json"),
    path.join(path.dirname(currentFile), "..", "..", "studio-agents", "agents.json")
  ].filter(Boolean) as string[];

  const registryPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!registryPath) {
    throw new Error("Unable to find Game OS agent registry. Set GAME_OS_AGENT_REGISTRY_PATH or reinstall the CLI package.");
  }

  return registryPath;
}
