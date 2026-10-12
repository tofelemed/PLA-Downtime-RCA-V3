import { useCapabilities } from '@/features/auth/use-capabilities';

/**
 * Whether the user may change master data in the selected plant: the server's MASTER_DATA_WRITERS
 * (`master_data_admin`, `manager_approver`) are the code writers' set, so this is `canWriteCodes`.
 */
export function useMasterDataWriter(): boolean {
  return useCapabilities().canWriteCodes;
}
