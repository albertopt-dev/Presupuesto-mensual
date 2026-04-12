import "./globals.css";
import AuthGate from "@/components/AuthGate";
import { Toaster } from "sonner";

export const metadata = {
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#dcefd1" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AuthGate>{children}</AuthGate>
        <Toaster
          theme="dark"
          position="bottom-center"
          richColors
          toastOptions={{
            classNames: {
              toast: "text-base px-5 py-4 min-w-[360px]",
              title: "text-base font-semibold",
              description: "text-sm",
            },
          }}
        />
      </body>
    </html>
  );
}

