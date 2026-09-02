export default function Page() {
  return (
    <div className="p10 m5 w50% bgEEE">
      <h1 className="fx1 c333">minotation-next demo</h1>
      <p className="p20 bxsh19r3c43F">
        Эта страница существует только для того, чтобы проверить
        реальный webpack-пайплайн minotation-webpack/minotation-next: лоадер должен
        найти эти className-токены, плагин — скомпилировать их в CSS и записать
        как отдельный asset (static/mn.css).
      </p>
    </div>
  );
}
