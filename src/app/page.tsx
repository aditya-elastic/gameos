import { GameOsApp } from "@/components/game-os-app";
import { getStudioDashboard } from "@/lib/studio";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<{
    project?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const workspaces = getStudioDashboard();

  return <GameOsApp initialWorkspaces={workspaces} initialSelectedId={params.project} />;
}
