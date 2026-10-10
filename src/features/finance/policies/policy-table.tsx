import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { authorshipOf, bodyLabel, policyStatus, type Authorship, type PolicyStatus } from '../model/policy-status';
import { PolicyApprove } from './policy-approve';

const STATUS_TEXT: Record<PolicyStatus, string> = { approved: 'Approved', unapproved: 'Not approved', placeholder: 'Placeholder (XXX)' };
const AUTHOR_TEXT: Record<Authorship, string> = { you: 'You', 'someone-else': 'Another user', system: 'System (migration / first use)' };

export interface PolicyTableProps {
  policies: readonly ValuationPolicyView[];
  timezone: string;
  onCopy: (source: ValuationPolicyView) => void;
}

/** Versions newest first, as stored: basis, currencies, FX policy, start, author and approval. */
export function PolicyTable({ policies, timezone, onCopy }: PolicyTableProps) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Currencies</TableHead>
          <TableHead>Default basis</TableHead>
          <TableHead>Time-based costs</TableHead>
          <TableHead>FX</TableHead>
          <TableHead>From</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {policies.map((policy) => {
          const status = policyStatus(policy);
          return (
            <TableRow key={policy.id} data-testid="policy-row" data-version={policy.version} data-status={status}>
              <TableCell>
                v{policy.version}
                {policy.notes && <p className="text-xs text-muted-foreground">{policy.notes}</p>}
              </TableCell>
              <TableCell>
                <Badge variant={status === 'approved' ? 'default' : 'outline'} data-testid="policy-status">
                  {STATUS_TEXT[status]}
                </Badge>
                {policy.approvedAt && (
                  <p className="text-xs">
                    <PlantTime iso={policy.approvedAt} tz={timezone} withDate />
                  </p>
                )}
              </TableCell>
              <TableCell>{policy.reportingCurrencies.length > 0 ? policy.reportingCurrencies.join(' + ') : 'none (XXX)'}</TableCell>
              <TableCell>{bodyLabel(policy.body.defaultBasis)}</TableCell>
              <TableCell>{bodyLabel(policy.body.timeBasisRule)}</TableCell>
              <TableCell>{bodyLabel(policy.body.fxPolicy)}</TableCell>
              <TableCell className="text-xs">
                <PlantTime iso={policy.effectiveFrom} tz={timezone} withDate />
              </TableCell>
              <TableCell className="text-xs">{AUTHOR_TEXT[authorshipOf(policy, userId)]}</TableCell>
              <TableCell className="min-w-[14rem] space-y-2">
                <PolicyApprove policy={policy} status={status} timezone={timezone} />
                {status !== 'placeholder' && (
                  <Button size="sm" variant="ghost" onClick={() => onCopy(policy)} data-testid="policy-copy">
                    New version from this
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
