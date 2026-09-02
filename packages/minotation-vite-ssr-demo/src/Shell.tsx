// Сознательно НЕ импортируется из entry-client.tsx — только сервер рендерит
// внешнюю обёртку (аналог серверной html-разметки в SSR-фреймворках),
// клиент гидрирует только содержимое App.
export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="bgEEE p20">{children}</div>;
}
