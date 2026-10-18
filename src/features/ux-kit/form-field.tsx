import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { fieldDescribedBy, fieldErrorId, fieldHintId } from './form-field-ids';

/** The one required marker: a visible "*" hidden from assistive technology, and "required" for it. */
export function RequiredMarker() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>
      <span className="sr-only"> required</span>
    </>
  );
}

export interface FormFieldProps {
  /** id of the control the label names; a direct child with this id is wired automatically */
  id: string;
  label: ReactNode;
  /** short help under the control (hidden while an error is shown) */
  hint?: ReactNode;
  /** validation message, announced and linked to the control */
  error?: string | null;
  required?: boolean;
  className?: string;
  /** test id of the error line; defaults to `field-error-<id>` */
  errorTestId?: string;
  children: ReactNode;
}

interface ControlAria {
  id?: unknown;
  'aria-describedby'?: unknown;
  'aria-invalid'?: unknown;
  'aria-required'?: unknown;
  required?: unknown;
}

function mergeIds(existing: unknown, added: string | undefined): string | undefined {
  const ids = [typeof existing === 'string' ? existing : '', added ?? ''].join(' ').split(/\s+/).filter(Boolean);
  return ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined;
}

/** Adds the field's describedby / invalid / required state to the control whose id matches. */
function wireControl(children: ReactNode, props: FormFieldProps): ReactNode {
  if (!isValidElement<ControlAria>(children) || children.props.id !== props.id) return children;
  const control = children as ReactElement<ControlAria>;
  const own = control.props;
  return cloneElement(control, {
    'aria-describedby': mergeIds(own['aria-describedby'], fieldDescribedBy(props.id, props)),
    'aria-invalid': own['aria-invalid'] ?? (props.error ? true : undefined),
    'aria-required': own['aria-required'] ?? (props.required && !own.required ? true : undefined),
  });
}

/**
 * Label (with the required marker), control, hint and error of one form field (C-8). A direct child
 * whose `id` equals `id` gets `aria-describedby`, `aria-invalid` and `aria-required`; for a composite
 * control, wire it yourself with {@link fieldDescribedBy}.
 */
export function FormField(props: FormFieldProps) {
  const { id, label, hint, error, required, className, errorTestId, children } = props;
  return (
    <div className={cn('space-y-1', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMarker />}
      </Label>
      {wireControl(children, props)}
      {hint && !error && (
        <p id={fieldHintId(id)} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={fieldErrorId(id)} role="alert" className="text-xs text-destructive" data-testid={errorTestId ?? `field-error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}
