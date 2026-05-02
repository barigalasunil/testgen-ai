import { AI_Prompt } from "@/components/ui/animated-ai-input";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center pt-32 p-6 overflow-hidden relative">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-accent/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-4xl text-center space-y-6 mb-16 relative z-10">
        <h1 className="text-6xl font-extrabold tracking-tight lg:text-7xl">
          <span className="text-foreground">WinAI</span>{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent drop-shadow-sm">
            TC Maker
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Elevate your testing process with local AI. Simply describe your feature below, and let advanced lightweight models generate comprehensive test suites instantly.
        </p>
      </div>

      <div className="w-full relative z-10">
        <AI_Prompt />
      </div>
    </main>
  );
}