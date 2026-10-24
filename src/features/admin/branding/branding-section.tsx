import { useEffect, useId, useState } from 'react';
import { useBranding, useResetBranding, useSaveBranding } from '@/api/v2/queries/administration-config';
import type { BrandingInput, BrandingView } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { AdminCard } from '../shared/admin-card';
import { FormField } from '../shared/form-field';
import { useCommandFeedback } from '../shared/use-command-feedback';
import { contrastRatio, readableTextOn } from '@/features/shell/brand-colors';
import { formatNumber } from '@/features/ux-kit/format/decimal';
import { ImageField } from './image-field';

type NumberKey = 'logoSize' | 'logoBorderRadius' | 'logoContainerSize' | 'logoContainerRadius' | 'logoContainerPadding' | 'logoBackgroundOpacity';
/** Label and the server's limits (`BrandingV2Dto`), so a value out of range is caught before saving. */
const NUMBER_FIELDS: ReadonlyArray<{ key: NumberKey; label: string; min: number; max: number; step?: number }> = [
  { key: 'logoSize', label: 'Logo size (px)', min: 8, max: 256 },
  { key: 'logoContainerSize', label: 'Logo frame size (px)', min: 8, max: 256 },
  { key: 'logoBorderRadius', label: 'Logo corner radius (px)', min: 0, max: 128 },
  { key: 'logoContainerRadius', label: 'Frame corner radius (px)', min: 0, max: 128 },
  { key: 'logoContainerPadding', label: 'Frame padding (px)', min: 0, max: 64 },
  { key: 'logoBackgroundOpacity', label: 'Frame background opacity (0–1)', min: 0, max: 1, step: 0.05 },
];

/** Text fields that may be saved empty on purpose (no subtitle, no initials): sent as "", never dropped. */
const CLEARABLE = new Set(['appSubtitle', 'logoInitials']);

/** The editable fields of the branding view. */
function inputOf(view: BrandingView): BrandingInput {
  return Object.fromEntries(Object.entries(view).filter(([key]) => key !== 'isStored' && key !== 'updatedAt')) as BrandingInput;
}

const INFO =
  'Name, logo and colors shown in the header of every plant. Initials show when there is no logo (up to 4 letters; empty = the first letters of the name). The primary color is used by buttons, links and the logo frame; the header shows the frame at most 48 px.';

const announce = () => window.dispatchEvent(new Event('brandingUpdated'));

/** Application name, logo and colors for every plant (super administrators). */
export function BrandingSection() {
  const branding = useBranding();
  const save = useSaveBranding();
  const reset = useResetBranding();
  const feedback = useCommandFeedback();
  const ids = { name: useId(), subtitle: useId(), initials: useId(), primary: useId(), secondary: useId() };
  const [draft, setDraft] = useState<BrandingInput | null>(null);
  useEffect(() => setDraft(branding.data ? inputOf(branding.data) : null), [branding.data]);
  if (!branding.data || !draft) return <DataState state={dataStateOf(branding)} error={branding.error} onRetry={() => void branding.refetch()} />;
  const set = (patch: Partial<BrandingInput>) => setDraft({ ...draft, ...patch });
  const body = Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== undefined && (value !== '' || CLEARABLE.has(key)))) as BrandingInput;
  const submit = () => feedback(() => save.submit(body), 'Branding saved').then(announce).catch(() => undefined);
  return (
    <AdminCard
      title="Branding"
      info={INFO}
      testId="branding"
      actions={
        <>
          <ConfirmDialog trigger={<Button variant="outline" className="h-9" disabled={!branding.data.isStored}>Reset to defaults</Button>} title="Reset the branding?"
            description="The default name, logo and colors come back for every user." confirmLabel="Reset branding" destructive
            onConfirm={() => feedback(() => reset.submit(undefined), 'Branding reset').then(announce)} />
          <Button className="h-9" onClick={() => void submit()} disabled={save.isPending || !draft.appName.trim()}>Save changes</Button>
        </>
      }
    >
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <FormField htmlFor={ids.name} label="Application name" required error={draft.appName.trim() ? null : 'Enter a name.'}>
          <Input id={ids.name} className="h-9" value={draft.appName} maxLength={80} onChange={(e) => set({ appName: e.target.value })} />
        </FormField>
        <FormField htmlFor={ids.subtitle} label="Subtitle">
          <Input id={ids.subtitle} className="h-9" value={draft.appSubtitle ?? ''} maxLength={120} onChange={(e) => set({ appSubtitle: e.target.value })} />
        </FormField>
        <FormField htmlFor={ids.initials} label="Initials">
          <Input id={ids.initials} className="h-9" value={draft.logoInitials ?? ''} maxLength={4} onChange={(e) => set({ logoInitials: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField htmlFor={ids.primary} label="Primary color" hint={contrastWarning(draft.primaryColor)}>
            <Input id={ids.primary} type="color" className="h-9" value={draft.primaryColor ?? '#2563eb'} onChange={(e) => set({ primaryColor: e.target.value })} />
          </FormField>
          <FormField htmlFor={ids.secondary} label="Secondary color">
            <Input id={ids.secondary} type="color" className="h-9" value={draft.secondaryColor ?? '#ec4899'} onChange={(e) => set({ secondaryColor: e.target.value })} />
          </FormField>
        </div>
        <ImageField label="Logo" value={draft.logoUrl ?? ''} disabled={false} onChange={(logoUrl) => set({ logoUrl })} />
        <ImageField label="Browser icon" value={draft.faviconUrl ?? ''} disabled={false} onChange={(faviconUrl) => set({ faviconUrl })} />
        {NUMBER_FIELDS.map((field) => (
          <BrandingNumber key={field.key} field={field} value={draft[field.key]} onChange={(value) => set({ [field.key]: value })} />
        ))}
      </div>
    </AdminCard>
  );
}

function BrandingNumber({ field, value, onChange }: { field: (typeof NUMBER_FIELDS)[number]; value: number | undefined; onChange: (value: number | undefined) => void }) {
  const id = useId();
  const outside = value !== undefined && (value < field.min || value > field.max);
  return (
    <FormField htmlFor={id} label={field.label} error={outside ? `Enter ${field.min}–${field.max}.` : null}>
      <Input id={id} className="h-9" type="number" min={field.min} max={field.max} step={field.step ?? 1} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
    </FormField>
  );
}

/** A warning when text on the chosen colour is hard to read (it is drawn black or white, whichever reads better); nothing otherwise. */
function contrastWarning(color: string | undefined): string | undefined {
  const ratio = contrastRatio(color ?? '', readableTextOn(color));
  if (ratio === null || ratio >= 4.5) return undefined;
  return `Low contrast (${formatNumber(ratio, 1)}:1): text on this colour is hard to read; choose a darker or lighter shade.`;
}
