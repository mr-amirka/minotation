/**
 * React-компонент для монтирования контента внутри `<iframe>` с ПОЛНОСТЬЮ
 * изолированными стилями: каждый `<MnIframe>` создаёт свой собственный
 * `minotationProvider()`-инстанс и запускает {@link createMnRuntime} на
 * `contentDocument` этого конкретного iframe — токены/CSS одного виджета
 * никак не пересекаются с родительской страницей или другими `<MnIframe>`.
 *
 * Замена старому 1.x `browser/reactFrameProvider.js`, который шарил ОДИН
 * `mn.styles$` на все iframe сразу (см. `old/minimalist-notation/browser/
 * reactFrameProvider.js`) — здесь наоборот, изоляция по умолчанию, а не
 * общий инстанс.
 *
 * React-содержимое рендерится внутрь `contentDocument.body` через
 * `createPortal` — стандартный паттерн "React внутри iframe" (сам React
 * не даёт iframe-элементу рендерить children как обычный DOM-узел, это
 * отдельный документ).
 *
 * @module MnIframe
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  minotationProvider,
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance } from 'minotation';
import { createMnRuntime } from 'minotation-runtime';

const DEFAULT_PRESETS = [presetStandard, presetSynonyms, presetMedias, presetNormalize, presetMain];

export interface MnIframeProps {
  /** Рендерится внутрь `contentDocument.body` iframe (через `createPortal`). */
  children: ReactNode;
  /** @default [presetStandard, presetSynonyms, presetMedias, presetNormalize, presetMain] */
  presets?: Array<(mn: MnInstance) => void>;
  /** Атрибут `class` внутри iframe. @default 'class' */
  attr?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Обязателен для доступности — у `<iframe>` без `title` нет осмысленного имени для screen reader'ов. */
  title: string;
}

/**
 * @example
 * <MnIframe title="Виджет 1">
 *   <div className="p10 bgF r8">Изолированный виджет</div>
 * </MnIframe>
 * <MnIframe title="Виджет 2">
 *   {// свой собственный mn-инстанс — стили не пересекаются с виджетом 1}
 *   <div className="p10 bg0 r8">Второй, независимый виджет</div>
 * </MnIframe>
 */
export function MnIframe({ children, presets, attr, className, style, title }: MnIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    /* istanbul ignore if — ref на элемент гарантированно привязан к моменту
       useEffect (контракт React); проверка только для TS-narrowing */
    if (!iframe) return undefined;
    function handleLoad(): void {
      setDoc(iframe!.contentDocument);
    }
    if (iframe.contentDocument?.readyState === 'complete') {
      handleLoad();
    }
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, []);

  useEffect(() => {
    if (!doc) return undefined;
    const mn = minotationProvider();
    mn.setPresets(presets ?? DEFAULT_PRESETS);
    const runtime = createMnRuntime(mn, { root: doc, attr });
    return () => runtime.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  return (
    <iframe ref={iframeRef} title={title} className={className} style={style}>
      {doc && createPortal(children, doc.body)}
    </iframe>
  );
}
