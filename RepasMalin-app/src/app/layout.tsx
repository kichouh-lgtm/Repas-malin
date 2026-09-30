import "./globals.css";
export const metadata = { title: "RepasMalin", description: "Planificateur de repas intelligent" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr"><body className="bg-stone-50 text-stone-900">{children}</body></html>
  );
}
