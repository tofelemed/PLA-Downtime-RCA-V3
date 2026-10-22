import { useImportStandbyRecords } from '@/api/v2/queries/reliability-standby';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Section } from '@/features/ux-kit/page-layout';
import { MasterDataLayout } from '../../components/master-data-layout';
import { RowsImportPanel } from '../shared/rows-import-panel';
import { useReliabilityFormat } from '../shared/use-reliability-format';
import { STANDBY_CSV_EXAMPLE, STANDBY_CSV_COLUMNS, standbyImportResult, standbyImportSummary, standbyRowOf } from './standby-import-model';
import { StandbyMetricsSection } from './standby-metrics-section';
import { StandbyRegisterForm } from './standby-register-form';
import { StandbyRegistrationsTable } from './standby-registrations-table';

/**
 * `/master-data/standby-equipment` (SME D9): spare pumps and standby compressors — registrations, their
 * demand / test / running log and the measures the server computes from it.
 */
export function StandbyEquipmentPage() {
  const capabilities = useCapabilities();
  const { canWriteStandby } = capabilities;
  const format = useReliabilityFormat();
  const importer = useImportStandbyRecords();
  return (
    <MasterDataLayout
      title="Standby equipment"
      alsoAllowed={canWriteStandby}
      description="Equipment that waits on standby is judged on failed starts per demand, not on calendar time."
    >
      <Section title="Registrations">
        <StandbyRegistrationsTable format={format} canWrite={canWriteStandby} />
      </Section>
      <Section title="Measures">
        <StandbyMetricsSection format={format} />
      </Section>
      {canWriteStandby && (
        <>
          <Section title="Register standby equipment"><StandbyRegisterForm format={format} /></Section>
          <Section title="Import the demand / test log" description="An entry with a log reference already stored is replaced.">
            <RowsImportPanel
              id="standby-log"
              columns={STANDBY_CSV_COLUMNS}
              example={STANDBY_CSV_EXAMPLE}
              mapRow={standbyRowOf}
              submit={importer.submit}
              summary={standbyImportSummary}
              saved={(message) => standbyImportResult(message, capabilities)}
              pending={importer.isPending}
            />
          </Section>
        </>
      )}
    </MasterDataLayout>
  );
}
