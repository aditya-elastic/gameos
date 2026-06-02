import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getProjectArtifactRoot } from "@/lib/artifacts";
import { importProjectAssetsFromStoredFile } from "@/lib/studio";

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
    const chunk = formData.get("chunk");
    const uploadId = safeSegment(String(formData.get("uploadId") ?? ""));
    const fileName = safeFileName(String(formData.get("fileName") ?? "uploaded-assets.bin"));
    const chunkIndex = Number(formData.get("chunkIndex"));
    const totalChunks = Number(formData.get("totalChunks"));

    if (!isFileLike(chunk) || !uploadId || !Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 1) {
      return NextResponse.json(
        {
          error: "Unable to import asset chunk.",
          details: ["Chunk upload requires uploadId, fileName, chunkIndex, totalChunks, and a chunk file."]
        },
        { status: 400 }
      );
    }

    const root = path.join(getProjectArtifactRoot(projectId), "chunk-uploads", uploadId);
    const chunkRoot = path.join(root, "chunks");
    fs.mkdirSync(chunkRoot, { recursive: true });
    fs.writeFileSync(path.join(chunkRoot, `${String(chunkIndex).padStart(6, "0")}.part`), Buffer.from(await chunk.arrayBuffer()));

    const receivedChunks = fs.readdirSync(chunkRoot).filter((name) => name.endsWith(".part")).length;
    if (receivedChunks < totalChunks) {
      return NextResponse.json({
        complete: false,
        receivedChunks,
        totalChunks
      });
    }

    const assembledRoot = path.join(root, "assembled");
    const assembledPath = path.join(assembledRoot, fileName);
    fs.mkdirSync(assembledRoot, { recursive: true });
    fs.rmSync(assembledPath, { force: true });

    for (let index = 0; index < totalChunks; index += 1) {
      const chunkPath = path.join(chunkRoot, `${String(index).padStart(6, "0")}.part`);
      if (!fs.existsSync(chunkPath)) {
        return NextResponse.json(
          {
            error: "Unable to import asset chunk.",
            details: [`Missing chunk ${index}.`]
          },
          { status: 400 }
        );
      }
      fs.appendFileSync(assembledPath, fs.readFileSync(chunkPath));
    }

    const workspace = importProjectAssetsFromStoredFile(projectId, fileName, assembledPath);
    fs.rmSync(root, { recursive: true, force: true });

    return NextResponse.json({
      complete: true,
      receivedChunks,
      totalChunks,
      project: workspace
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to import asset chunk.",
        details: [error instanceof Error ? error.message : "Unknown error"]
      },
      { status: 400 }
    );
  }
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value);
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+|-+$/g, "");
}

function safeFileName(value: string): string {
  return path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "-") || "uploaded-assets.bin";
}
