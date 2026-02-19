import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@/components/google-analytics";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat"
});

export const metadata: Metadata = {
  title: "Saki Properties",
  description: "A modern property listing experience.",
  icons: {
    icon: "/favicon.svg"
  }
};

type FirebasePublicConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

function getFirebasePublicConfig(): FirebasePublicConfig {
  const raw = process.env.FIREBASE_WEB_CONFIG_JSON?.trim();
  if (raw) {
    try {
      return JSON.parse(raw) as FirebasePublicConfig;
    } catch {
      // Ignore invalid JSON and fall back to individual vars.
    }
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
  };
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const firebasePublicConfig = getFirebasePublicConfig();
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const firebaseConfigScript = `window.__FIREBASE_PUBLIC_CONFIG__=${JSON.stringify(
    firebasePublicConfig
  ).replace(/</g, "\\u003c")};`;

  return (
    <html lang="en" className={montserrat.variable}>
      <body className="font-sans">
        <script dangerouslySetInnerHTML={{ __html: firebaseConfigScript }} />
        <GoogleAnalytics measurementId={gaMeasurementId} />
        {children}
      </body>
    </html>
  );
}
