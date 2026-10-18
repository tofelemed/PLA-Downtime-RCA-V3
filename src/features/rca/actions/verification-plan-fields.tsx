import { Input } from '@/components/ui/input';
import { FormField } from '@/features/ux-kit/form-field';
import { VERIFIER_IS_OWNER, verifierIsOwner } from '../model/action-form';
import { OwnerSelect } from './owner-select';

export interface VerificationPlanValue {
  ownerId: string;
  verifierId: string;
  verificationMethod: string;
}

export interface VerificationPlanFieldsProps {
  idPrefix: string;
  value: VerificationPlanValue;
  onChange: (patch: Partial<Pick<VerificationPlanValue, 'verifierId' | 'verificationMethod'>>) => void;
}

/**
 * CA4 verification plan of an action: how the completion is verified and the named verifier (a plant
 * member who is not the owner; when named, only they mark the action done — the server checks both).
 */
export function VerificationPlanFields({ idPrefix, value, onChange }: VerificationPlanFieldsProps) {
  const methodId = `${idPrefix}-verification-method`;
  return (
    <>
      <FormField id={methodId} label="Verification method" hint="How the completion is checked: inspection, test, record review.">
        <Input id={methodId} value={value.verificationMethod} maxLength={2000} onChange={(e) => onChange({ verificationMethod: e.target.value })} />
      </FormField>
      <div className="space-y-1">
        <OwnerSelect
          id={`${idPrefix}-verifier`}
          label="Verifier"
          noneLabel="Any RCA writer except the owner"
          value={value.verifierId}
          onChange={(verifierId) => onChange({ verifierId })}
        />
        {verifierIsOwner(value) && (
          <p className="text-xs text-destructive" role="alert" data-testid="verifier-is-owner">
            {VERIFIER_IS_OWNER}
          </p>
        )}
      </div>
    </>
  );
}
