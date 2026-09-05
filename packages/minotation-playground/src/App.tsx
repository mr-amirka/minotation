import { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Button,
  Box,
  Snackbar,
} from '@mui/material';
import { compilePreviewCss, PRESET_OPTIONS, DEFAULT_PRESET_IDS } from './compile';
import { encodeStateToHash, decodeStateFromHash } from './share';

const DEFAULT_HTML = `<div class="p20 bgF.06 r8 dF fxdC gap2">
  <h1 class="f22 fw5 c0">Hello, minotation!</h1>
  <p class="f14 c0.6">Отредактируйте HTML слева — превью обновится сразу.</p>
  <button class="p10 bxzBB bgF.12 r4 crP">Кнопка</button>
</div>
`;

export function App() {
  const initial = useMemo(() => decodeStateFromHash(window.location.hash), []);
  const [html, setHtml] = useState(initial?.html ?? DEFAULT_HTML);
  const [presetIds, setPresetIds] = useState<string[]>(initial?.presetIds ?? DEFAULT_PRESET_IDS);
  const [css, setCss] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCss(compilePreviewCss(html, presetIds));
    }, 150);
    return () => clearTimeout(timer);
  }, [html, presetIds]);

  function togglePreset(id: string): void {
    setPresetIds((prev) => (prev.indexOf(id) !== -1 ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function copyShareLink(): Promise<void> {
    const hash = encodeStateToHash({ html, presetIds });
    window.location.hash = hash;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  return (
    <Box className="dF fxdC" sx={{ height: '100vh' }}>
      <AppBar position="static" color="default">
        <Toolbar variant="dense" className="dF" sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" className="fw5">minotation playground</Typography>
          <FormGroup row>
            {PRESET_OPTIONS.map((p) => (
              <FormControlLabel
                key={p.id}
                control={<Checkbox size="small" checked={presetIds.indexOf(p.id) !== -1} onChange={() => togglePreset(p.id)} />}
                label={p.label}
              />
            ))}
          </FormGroup>
          <Button variant="outlined" size="small" onClick={copyShareLink}>Скопировать ссылку</Button>
        </Toolbar>
      </AppBar>
      <Box className="dF" sx={{ flex: 1, minHeight: 0 }}>
        <Box
          component="textarea"
          value={html}
          onChange={(e) => setHtml((e.target as HTMLTextAreaElement).value)}
          spellCheck={false}
          sx={{
            width: '50%',
            border: 0,
            borderRight: '1px solid #ddd',
            outline: 'none',
            resize: 'none',
            padding: '12px',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        />
        <Box
          component="iframe"
          title="preview"
          srcDoc={`<style>${css}</style>${html}`}
          sx={{ width: '50%', border: 0 }}
        />
      </Box>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Ссылка скопирована"
      />
    </Box>
  );
}
