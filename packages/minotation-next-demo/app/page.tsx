export default function Page() {
  return (
    <div className="p10 m5 w50% bgE">
      <h1 className="fx1 c3">minotation-next demo</h1>
      <p className="p20 bxsh19r3c43F">
        Эта страница существует только для того, чтобы проверить
        реальный webpack-пайплайн minotation-webpack/minotation-next: лоадер должен
        найти эти className-токены, плагин — скомпилировать их в CSS, а Next.js —
        выдать его файлом с хешем через импорт minotation-next/mn.css в layout.
      </p>
    </div>
  );
}
