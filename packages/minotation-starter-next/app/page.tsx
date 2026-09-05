export default function Page() {
  return (
    <div className="p24 dF fxdC gap2 bgF.06 r8">
      <h1 className="f22 fw5 c0">minotation starter (Next.js)</h1>
      <p className="f14 c0.6">
        Пишите обычные CSS-свойства прямо в className — сборка сама найдёт
        токены и соберёт из них CSS. Наведите на кнопку ниже.
      </p>
      <button className="p10 bxzBB bgF.1 bgF.2:h r4 crP dn200">
        Наведите на меня
      </button>
    </div>
  );
}
