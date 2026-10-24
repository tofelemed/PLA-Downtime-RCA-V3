import { useId, useState, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '../shared/form-field';

/** Image types every browser draws (HEIC, TIFF and the like do not). */
const WEB_IMAGES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];

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
    if (!WEB_IMAGES.includes(file.type)) return setError('Choose a PNG, JPEG, SVG, WebP, GIF or ICO image (report exports print PNG and JPEG logos).');
    if (file.size > MAX_IMAGE_BYTES) return setError('Choose an image smaller than 280 KB.');
    setError(null);
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && onChange(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-2">
      <FormField htmlFor={ids.url} label={`${label} address`} hint={inline ? 'An uploaded image is used. Clear to use an address.' : undefined} error={error}>
        <Input id={ids.url} className="h-9" placeholder="https://…" value={inline ? 'Uploaded image' : value} disabled={disabled || inline} onChange={(e) => onChange(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor={ids.file} className="sr-only">{`Upload ${label.toLowerCase()}`}</Label>
        <Input id={ids.file} type="file" accept={WEB_IMAGES.join(',')} className="h-9 max-w-xs" disabled={disabled} onChange={upload} />
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
