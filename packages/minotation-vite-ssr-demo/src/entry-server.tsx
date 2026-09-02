import { renderToString } from 'react-dom/server';
import { App } from './App';
import { Shell } from './Shell';

export function render(): string {
  return renderToString(
    <Shell>
      <App />
    </Shell>,
  );
}
