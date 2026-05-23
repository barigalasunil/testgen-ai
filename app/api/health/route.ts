import { NextResponse } from "next/server";
import { ollamaService } from "@/src/services/ai/ollama.service";

export async function GET() {
    try {
        await ollamaService.health();
        return NextResponse.json({ connected: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ connected: false, message }, { status: 503 });
    }
}
