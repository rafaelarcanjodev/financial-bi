import { NextResponse } from "next/server";
import { loadMasterData } from "@/lib/loadMasterData";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await loadMasterData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Falha ao ler data/master.json", error);
    return NextResponse.json(
      { error: "Nao foi possivel ler data/master.json" },
      { status: 500 }
    );
  }
}
