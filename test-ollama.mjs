// test-ollama.mjs
const urls = [
    'http://localhost:11434',
    'http://127.0.0.1:11434',
    'http://0.0.0.0:11434',
];

for (const base of urls) {
    try {
        const res = await fetch(`${base}/api/tags`);
        const data = await res.json();
        console.log(`✓ ${base} — models: ${data.models.map(m => m.name).join(', ')}`);
    } catch (err) {
        console.log(`✗ ${base} — ${err.message}`);
    }
}