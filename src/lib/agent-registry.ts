import fs from "node:fs";
import path from "node:path";
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
  const registryPath = path.join(process.cwd(), "studio-agents", "agents.json");
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
