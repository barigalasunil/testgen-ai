"use client";

import { useState } from "react";

export function AI_Prompt() {
    const [value, setValue] = useState("");

    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!value.trim()) return;

        console.log("SEND CLICKED");
        console.log("CALLING API...");
        
        setLoading(true);
        setResponse("");

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: value,
                    model: "phi3:mini",
                }),
            });

            const data = await res.json();
            console.log("API RESPONSE:", data);
            setResponse(data.result);
        } catch (error) {
            console.error("FETCH ERROR:", error);
            setResponse("Error: " + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "40px" }}>
            <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Type something..."
                style={{
                    width: "100%",
                    height: "100px",
                    padding: "10px",
                }}
            />

            <button
                onClick={handleSend}
                disabled={loading}
                style={{
                    marginTop: "10px",
                    padding: "10px 20px",
                    background: loading ? "#ccc" : "red",
                    color: "white",
                    cursor: loading ? "not-allowed" : "pointer",
                }}
            >
                {loading ? "Sending..." : "Send"}
            </button>

            {response && (
                <div style={{ marginTop: "20px", padding: "10px", border: "1px solid #ccc" }}>
                    <strong>Response:</strong>
                    <pre style={{ whiteSpace: "pre-wrap" }}>{response}</pre>
                </div>
            )}
        </div>
    );
}