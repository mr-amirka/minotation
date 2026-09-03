import { useMemo, useState } from 'react';
import { DATA, DocEntry } from './data';
import { Search } from './components/Search';
import { EntryCard } from './components/EntryCard';

function matches(entry: DocEntry, query: string): boolean {
  if (!query) return true;
  if (entry.name.toLowerCase().startsWith(query)) return true;
  if (entry.props.toLowerCase().includes(query)) return true;
  if (entry.keywords?.some((k) => k.toLowerCase().includes(query))) return true;
  if (entry.description?.toLowerCase().includes(query)) return true;
  return false;
}

export function App() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => DATA.filter((entry) => matches(entry, q)), [q]);

  return (
    <div className="h100vh rlv bg0 cD">
      <div className="abs st0 sl0 sr0 h56 bg111 dF aiC bb1 bsbS bcb999.2 px16">
        <div className="fx1 f16 fw6">minotation — handlers docs</div>
        <Search value={query} onChange={setQuery} />
      </div>
      <div className="abs st56 sl0 sr0 sb0 ovyAuto p16">
        {filtered.length ? (
          filtered.map((entry) => (
            <EntryCard key={entry.name} entry={entry} query={q} />
          ))
        ) : (
          <div className="dF jcC aiC h100%">Nothing found</div>
        )}
      </div>
    </div>
  );
}
