import { useCapabilities } from '@/features/auth/use-capabilities';
import { CsvImportForm } from '@/features/ux-kit/csv-import';
import { DataState } from '@/features/ux-kit/data-state';
import { sectionNameOf } from '../../components/master-data-sections';
import { MasterDataLayout } from '../../components/master-data-layout';
import { STANDBY_CSV_COLUMNS, STANDBY_CSV_HEADER, STANDBY_CSV_SAMPLE, STANDBY_PATH } from './standby-import-model';
import { useStandbyImporter } from './use-standby-importer';

const COLUMNS = STANDBY_CSV_HEADER.split(',');

function StandbyImportForm() {
  const importer = useStandbyImporter();
  const help = (
    <p>
      Columns: {STANDBY_CSV_COLUMNS}. The asset may be named by assetId instead of assetCode. An entry whose external
      reference is already stored is replaced. A JSON list of rows with the same names also works in the paste box.
    </p>
  );
  return (
    <CsvImportForm id="standby-log" columns={COLUMNS} columnHelp={help} templateName="standby-log-template.csv" example={STANDBY_CSV_SAMPLE} importer={importer} listPath={STANDBY_PATH} />
  );
}

/** `/master-data/standby-equipment/import`: the demand / test / running log of standby equipment as CSV. */
export function StandbyImportPage() {
  const { canWriteStandby } = useCapabilities();
  return (
    <MasterDataLayout
      title="Import standby log"
      alsoAllowed={canWriteStandby}
      back={{ to: STANDBY_PATH, label: sectionNameOf(STANDBY_PATH) }}
    >
      {canWriteStandby ? <StandbyImportForm /> : <DataState state="no-permission" detail="Your role does not record the standby log." />}
    </MasterDataLayout>
  );
}
