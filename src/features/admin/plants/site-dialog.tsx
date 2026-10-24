import { useState, type FormEvent } from 'react';
import { useCreateSite, useRenameSite } from '@/api/v2/queries/sites';
import { V2ApiError } from '@/api/v2/errors';
import type { SiteV2View } from '@/api/v2/types/sites';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { TextField } from '@/features/master-data/components/text-field';
import { StatusIcon } from '@/lib/icons';
import { useCommandFeedback } from '../shared/use-command-feedback';
import { siteCreateOf, validateSite, type SiteDraft, type SiteErrors } from './site-form-model';

export interface SiteDialogProps {
  /** the site to rename, or null to add one */
  site: SiteV2View | null;
  plantName: string;
  onClose: () => void;
}

const DUPLICATE = 'A site with this name already exists in this plant.';

function useSiteSave(site: SiteV2View | null, onClose: () => void) {
  const create = useCreateSite();
  const rename = useRenameSite();
  const feedback = useCommandFeedback();
  const [errors, setErrors] = useState<SiteErrors>({});
  const save = async (draft: SiteDraft) => {
    const found = validateSite(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      if (site) await feedback(() => rename.submit({ id: site.id, body: { name: draft.name.trim() } }), 'Site renamed');
      else await feedback(() => create.submit(siteCreateOf(draft)), 'Site added');
      onClose();
    } catch (error) {
      if (error instanceof V2ApiError && error.status === 409) setErrors({ name: DUPLICATE });
    }
  };
  return { save, errors, busy: create.isPending || rename.isPending };
}

/** The Name field gets focus on open (not the ⓘ next to the title). */
function focusName(event: Event) {
  const field = document.getElementById('site-name');
  if (!field) return;
  event.preventDefault();
  field.focus();
}

/** Add a site to the selected plant (name, optional time zone and day start) or rename one: a short dialog. */
export function SiteDialog({ site, plantName, onClose }: SiteDialogProps) {
  const [draft, setDraft] = useState<SiteDraft>({ name: site?.name ?? '', timezone: '', operationalDayStart: '' });
  const { save, errors, busy } = useSiteSave(site, onClose);
  const set = (patch: Partial<SiteDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(draft);
  };
  const title = site ? `Rename ${site.name}` : `Add site to ${plantName}`;
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[420px]" aria-describedby={undefined} onOpenAutoFocus={focusName}>
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>{title}</DialogTitle>
            <KpiInfo label={title} text={site ? 'Units on this site keep it; only the name changes.' : 'Leave time zone and day start empty to use the plant’s.'} />
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 [&_input]:h-9" noValidate aria-label={site ? 'Rename site' : 'Add site'}>
          <TextField id="site-name" label="Name" value={draft.name} onChange={(name) => set({ name })} error={errors.name} required maxLength={255} disabled={busy} />
          {!site && (
            <>
              <TextField id="site-timezone" label="Time zone" value={draft.timezone} onChange={(timezone) => set({ timezone })} placeholder="e.g. Asia/Tehran" disabled={busy} />
              <TextField id="site-day-start" label="Day start" value={draft.operationalDayStart} onChange={(operationalDayStart) => set({ operationalDayStart })} error={errors.operationalDayStart} placeholder="HH:MM" disabled={busy} maxLength={5} />
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" className="h-9" disabled={busy} aria-busy={busy || undefined}>
              {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
              {site ? 'Rename site' : 'Add site'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
