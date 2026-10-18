import { FormField as KitFormField, type FormFieldProps as KitFormFieldProps } from '@/features/ux-kit/form-field';

export interface FormFieldProps extends Omit<KitFormFieldProps, 'id'> {
  /** id of the control the label names */
  htmlFor: string;
}

/** Admin call sites name the control with `htmlFor`; the field itself is the kit `FormField` (C-8). */
export function FormField({ htmlFor, ...rest }: FormFieldProps) {
  return <KitFormField id={htmlFor} {...rest} />;
}
