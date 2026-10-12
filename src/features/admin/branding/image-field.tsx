import { useId, useState, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '../shared/form-field';

/** Inline images must stay small: the branding request is limited to 1 MiB in total. */
const MAX_IMAGE_BYTES = 280 * 1024;

export interface ImageFieldProps {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** An image as an address or an uploaded file (stored inline); shows a preview. */
export function ImageField({ label, value, disabled, onChange }: ImageFieldProps) {
  const ids = { url: useId(), file: useId() };
  const [error, setError] = useState<string | null>(null);
  const inline = value.startsWith('data:');
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file.');
    if (file.size > MAX_IMAGE_BYTES) return setError('Choose an image smaller than 280 KB.');
    setError(null);
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && onChange(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-2">
      <FormField htmlFor={ids.url} label={`${label} address`} hint={inline ? 'An uploaded image is used. Clear to use an address.' : 'https://… or upload a file below.'} error={error}>
        <Input id={ids.url} value={inline ? 'Uploaded image' : value} disabled={disabled || inline} onChange={(e) => onChange(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor={ids.file} className="sr-only">{`Upload ${label.toLowerCase()}`}</Label>
        <Input id={ids.file} type="file" accept="image/*" className="max-w-xs" disabled={disabled} onChange={upload} />
        {value && (
          <button type="button" className="text-sm underline" disabled={disabled} onClick={() => onChange('')}>
            Clear
          </button>
        )}
        {value && <img src={value} alt={`${label} preview`} className="h-10 w-10 rounded border object-contain" />}
      </div>
    </div>
  );
}
