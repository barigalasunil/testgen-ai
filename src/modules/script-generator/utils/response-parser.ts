export function parseGeneratedScript(rawResponse: string): string {
  let code = rawResponse.trim();

  if (code.startsWith('```')) {
    code = code.replace(/^```(?:typescript|ts)?\n?/, "").replace(/\n?```$/, "");
  }

  return code.trim();
}
