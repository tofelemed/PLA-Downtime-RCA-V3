import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCreateOrganization, useCreatePlant } from '@/api/v2/queries/administration-config';
import type { CreateOrganizationInput, CreatePlantInput, OrganizationView, PlantView } from '@/api/v2/types/administration';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import { useCommandFeedback } from '../shared/use-command-feedback';
import { HIERARCHY_FIELD_VOCABULARY } from './hierarchy-field-vocabulary';
import { PLANTS_PAGE } from './plants-page-path';

/** A plant just created, with its organization, offered as the new header selection. */
export interface CreatedPlant {
  plant: PlantView;
  organization?: OrganizationView;
}

/** Every cached plant directory (header selector, hierarchy tree, plant fields), whatever the user. */
const DIRECTORY_KEY = ['v2', 'directory'] as const;

/**
 * Creates an organization or a plant. The plant directory reloads after either, so the header lists the new
 * record at once; a new plant is then offered as the selected plant (`created`) before going back to the list.
 */
export function useHierarchyCreate(organizations: readonly OrganizationView[]) {
  const createOrg = useCreateOrganization();
  const createPlant = useCreatePlant();
  const feedback = useCommandFeedback(HIERARCHY_FIELD_VOCABULARY);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [created, setCreated] = useState<CreatedPlant | null>(null);
  const refreshDirectory = () => queryClient.invalidateQueries({ queryKey: DIRECTORY_KEY });

  const organization = async (body: CreateOrganizationInput) => {
    await feedback(() => createOrg.submit(body), 'Organization created');
    await refreshDirectory();
    navigate(PLANTS_PAGE);
  };
  const plant = async (body: CreatePlantInput) => {
    try {
      const view = await createPlant.submit(body);
      await refreshDirectory();
      setCreated({ plant: view, organization: organizations.find((org) => org.id === view.organizationId) });
    } catch (error) {
      toast({ ...friendlyToastContent(error, HIERARCHY_FIELD_VOCABULARY), variant: 'destructive' });
      throw error;
    }
  };
  return {
    busy: createOrg.isPending || createPlant.isPending,
    created,
    organization,
    plant,
    finish: () => navigate(PLANTS_PAGE),
  };
}
