import { Highlight, themes } from 'prism-react-renderer';

interface CodeBlockProps {
  code: string;
  language: 'markup' | 'css';
}

/** Read-only подсвеченный код-блок — замена Ace-редактора из старой версии сайта (там тоже был readOnly). */
export function CodeBlock({ code, language }: CodeBlockProps) {
  return (
    <Highlight code={code} language={language} theme={themes.vsDark}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className="f12 p10 r4 ov"
          style={{ ...style, margin: 0, minHeight: '100%' }}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
