import "./globals.css";

export const metadata = {
  title: "TCGen-Buddy",
  description: "AI-powered enterprise test case generation assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Oxanium&family=Source+Code+Pro&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}