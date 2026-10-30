import type { Metadata } from "next";
import { Inter, Noto_Sans_Ethiopic } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider, THEME_BOOT_SCRIPT } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Ge'ez script for Amharic. Falls back to Nyala / Abyssinica SIL if the font can't be downloaded.
const ethiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  variable: "--font-ethiopic",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Football Streaming Studio · የእግር ኳስ ስርጭት ስቱዲዮ",
  description: "Desktop production studio for football creators",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme / lang are set by the boot script before paint, hence suppressHydrationWarning.
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${ethiopic.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="bg-zinc-950 font-sans text-zinc-100 antialiased">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
