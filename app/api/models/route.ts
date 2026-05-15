import { NextResponse } from "next/server";

export async function GET() {
    try {
        const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
        const res = await fetch(`${ollamaUrl}/api/tags`);
        if (!res.ok) {
            return NextResponse.json({ models: [] }, { status: 500 });
        }
        const data = await res.json();
        const models = data.models.map((m: any) => m.name).filter(Boolean);
        return NextResponse.json({ models }, { status: 200 });
    } catch (e) {
        return NextResponse.json({ models: [] }, { status: 500 });
    }
}