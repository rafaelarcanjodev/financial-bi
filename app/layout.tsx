import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financeiro Familia Arcanjo",
  description: "Painel de BI local para o controle financeiro da familia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-page">{children}</body>
    </html>
  );
}
