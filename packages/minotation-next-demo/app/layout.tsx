// CSS minotation — через конвейер Next.js: файл с хешем и ссылка в <head>.
import 'minotation-next/mn.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
