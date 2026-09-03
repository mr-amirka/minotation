import { useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { DocEntry } from '../data';
import { CodeBlock } from './CodeBlock';

interface FieldProps {
  label: string;
  value?: string;
}

function Field({ label, value }: FieldProps) {
  if (!value) return null;
  return (
    <div className="mt10 f14">
      <div className="f11 c999 mb5">{label}</div>
      <div>{value}</div>
    </div>
  );
}

interface HighlightedProps {
  text: string;
  query: string;
}

/** Подсвечивает совпавший с поиском префикс — как в старой версии сайта. */
function Highlighted({ text, query }: HighlightedProps) {
  if (!query || !text.toLowerCase().startsWith(query)) return <>{text}</>;
  return (
    <>
      <span className="cF00">{text.slice(0, query.length)}</span>
      {text.slice(query.length)}
    </>
  );
}

interface EntryCardProps {
  entry: DocEntry;
  query: string;
}

export function EntryCard({ entry, query }: EntryCardProps) {
  const [tab, setTab] = useState(0);
  const { compiled } = entry;
  const active = compiled[tab] || compiled[0];

  return (
    <div className="bg111 bb1 bsbS bcb999.2 r4 mb10 ov">
      <div className="px16 py12">
        <div className="f18 cF fw6">
          <Highlighted text={entry.name} query={query} />
        </div>
        <Field label="Properties" value={entry.props} />
        <Field label="Description" value={entry.description} />
        <Field label="Params" value={entry.params} />
        {entry.keywords ? (
          <Field label="Keywords" value={entry.keywords.join(', ')} />
        ) : null}
      </div>

      {compiled.length > 1 ? (
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          className="bt1 bstS bct999.2"
        >
          {compiled.map((c, i) => (
            <Tab key={c.token} label={c.token} value={i} />
          ))}
        </Tabs>
      ) : null}

      <div className="dF bt1 bstS bct999.2">
        <div className="fx1 w50% br1 bsrS bcr999.2">
          <CodeBlock code={active.html} language="markup" />
        </div>
        <div className="fx1 w50%">
          <CodeBlock code={active.css} language="css" />
        </div>
      </div>
    </div>
  );
}
