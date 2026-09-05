// React 18 требует явного флага, что тестовое окружение поддерживает act() —
// без него каждый act()-вызов пишет предупреждение в консоль (тесты при этом
// всё равно проходят, но вывод зашумлён).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
