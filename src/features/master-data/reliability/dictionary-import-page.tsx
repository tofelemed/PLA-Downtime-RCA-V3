import { useCapabilities } from '@/features/auth/use-capabilities';
import { CsvImportForm } from '@/features/ux-kit/csv-import';
import { DataState } from '@/features/ux-kit/data-state';
import { sectionNameOf } from '../components/master-data-sections';
import { MasterDataLayout } from '../components/master-data-layout';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { CSV_HEADER, DICTIONARY_PAGE } from './dictionary-import-model';
import { useDictionaryImporter } from './use-dictionary-importer';

const COLUMNS = CSV_HEADER.split(',');

const COLUMN_HELP = (
  <p>
    kind (equipment_class, maintainable_item, failure_mode, failure_mechanism, failure_cause or detection_method), the equipment
    class code for items and modes (empty = every class), code, name, an optional description and category, asset types
    separated by ; (classes only) and isPending (true for a pending / unknown choice). Changed entries get a new version;
    entries missing from the file are kept.
  </p>
);

function DictionaryImportForm() {
  const importer = useDictionaryImporter();
  return (
    <CsvImportForm
      id="dictionary"
      columns={COLUMNS}
      columnHelp={COLUMN_HELP}
      templateName="failure-dictionary-template.csv"
      example="equipment_class,,PU,Pumps,,,Pump,"
      importer={importer}
      listPath={DICTIONARY_PAGE}
    />
  );
}

/** `/master-data/failure-dictionary/import`: the maintenance code export as CSV, on the shared import page. */
export function DictionaryImportPage() {
  const canWrite = useMasterDataWriter();
  const { canValidateFailures } = useCapabilities();
  return (
    <MasterDataLayout
      title="Import failure dictionary"
      alsoAllowed={canValidateFailures}
      back={{ to: DICTIONARY_PAGE, label: sectionNameOf(DICTIONARY_PAGE) }}
      description="Equipment classes, maintainable items, failure modes and the mechanism, cause and detection lists from a CSV file."
    >
      {canWrite ? <DictionaryImportForm /> : <DataState state="no-permission" detail="Only master-data administrators import the failure dictionary." />}
    </MasterDataLayout>
  );
}
