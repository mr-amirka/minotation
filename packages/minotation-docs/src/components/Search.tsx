import TextField from '@mui/material/TextField';

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function Search({ value, onChange }: SearchProps) {
  return (
    <TextField
      className="wmax240"
      size="small"
      variant="filled"
      label="Search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
