import { exec } from "child_process";

export async function GET() {
    return new Promise<Response>((resolve) => {
        exec("ollama list", (error, stdout) => {
            if (error) {
                resolve(
                    new Response(JSON.stringify({ models: [] }), {
                        status: 500,
                    })
                );
                return;
            }

            const lines = stdout.split("\n").slice(1);

            const models = lines
                .map((line) => line.trim().split(/\s+/)[0])
                .filter(Boolean);

            resolve(
                new Response(JSON.stringify({ models }), {
                    status: 200,
                })
            );
        });
    });
}