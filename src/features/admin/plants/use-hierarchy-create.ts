import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { V2ApiError } from '@/api/v2/errors';
import { useCreateOrganization, useCreatePlant } from '@/api/v2/queries/administration-config';
import type { CreateOrganizationInput, CreatePlantInput, OrganizationView, PlantView } from '@/api/v2/types/administration';
import { pageNameOf } from '@/features/auth/navigation-items';
import { fieldErrorsOf } from '@/features/master-data/model/field-errors';
import { useSaveFeedback, type SaveResult } from '@/features/ux-kit/save-result';
import { HIERARCHY_FIELD_VOCABULARY } from './hierarchy-field-vocabulary';
import type { HierarchyFieldErrors } from './hierarchy-fields';
import { PLANTS_PAGE } from './plants-page-path';

/** A plant just created, with its organization, offered as the new header selection. */
export interface CreatedPlant {
  plant: PlantView;
  organization?: OrganizationView;
}

/** Every cached plant directory (header selector, hierarchy tree, plant fields), whatever the user. */
const DIRECTORY_KEY = ['v2', 'directory'] as const;
const organizationPage = (id: string) => `${PLANTS_PAGE}/organizations/${id}/edit`;
const CODE_TAKEN = 'This code is already used. Codes must be unique — choose another code.';

/** The refused fields of a create, for the inputs (a taken code is a 409 without field list). */
export function hierarchyFieldErrorsOf(error: unknown): HierarchyFieldErrors {
  const fields: HierarchyFieldErrors = fieldErrorsOf(error);
  if (error instanceof V2ApiError && error.code === 'CODE_EXISTS') fields.code = CODE_TAKEN;
  return fields;
}

function organizationResult(view: OrganizationView, onAddAnother: () => void, onDismiss: () => void): SaveResult {
  return {
    title: 'Organization created',
    recordLabel: `${view.name} (${view.code})`,
    message: 'Add its first plant next: plants hold the units, users and data.',
    viewPath: organizationPage(view.id),
    viewLabel: 'View organization',
    listPath: PLANTS_PAGE,
    listLabel: pageNameOf(PLANTS_PAGE),
    onAddAnother,
    next: { label: 'Add a plant', path: `${PLANTS_PAGE}/new?organizationId=${encodeURIComponent(view.id)}` },
    onDismiss,
  };
}

/**
 * Creates an organization or a plant (DECISIONS 2026-10-22 "Save feedback"). The plant directory reloads
 * after either, so the header lists the new record at once. An organization ends in the result dialog; a
 * plant in `created`, which `SwitchPlantDialog` offers as the new header selection. A refusal is the red
 * `alert` of the form, and the promise rejects so the page can mark the fields (`hierarchyFieldErrorsOf`).
 * `onAddAnother` empties the form.
 */
export function useHierarchyCreate(organizations: readonly OrganizationView[], onAddAnother: () => void) {
  const createOrg = useCreateOrganization();
  const createPlant = useCreatePlant();
  const feedback = useSaveFeedback(HIERARCHY_FIELD_VOCABULARY);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [created, setCreated] = useState<CreatedPlant | null>(null);
  const refreshDirectory = () => queryClient.invalidateQueries({ queryKey: DIRECTORY_KEY });
  const saved = async <T>(work: () => Promise<T>) => {
    const view = await work();
    await refreshDirectory();
    return view;
  };

  const organization = async (body: CreateOrganizationInput) => {
    await feedback.run(() => saved(() => createOrg.submit(body)), (view) =>
      organizationResult(view, onAddAnother, () => navigate(organizationPage(view.id), { replace: true })));
  };
  const plant = async (body: CreatePlantInput) => {
    const view = await feedback.run(() => saved(() => createPlant.submit(body)), null);
    setCreated({ plant: view, organization: organizations.find((org) => org.id === view.organizationId) });
  };
  return {
    busy: createOrg.isPending || createPlant.isPending,
    created,
    organization,
    plant,
    /** the plant's result dialog closed */
    finish: () => setCreated(null),
    alert: feedback.alert,
    dialog: feedback.dialog,
  };
}
