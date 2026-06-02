import { NextResponse } from "next/server";
import { importProjectAssets } from "@/lib/studio";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const formData = await request.formData();
    const upload = formData.get("assetArchive") ?? formData.get("assets");

    if (!isFileLike(upload)) {
      return NextResponse.json(
        {
          error: "Unable to import assets.",
          details: ["Upload a .zip asset pack or a single image file."]
        },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await upload.arrayBuffer());
    const workspace = importProjectAssets(projectId, upload.name, bytes);

    return NextResponse.json({ project: workspace });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to import assets.",
        details: [error instanceof Error ? error.message : "Unknown error"]
      },
      { status: 400 }
    );
  }
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value);
}
