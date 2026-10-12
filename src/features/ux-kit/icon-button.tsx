import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AppIcon } from '@/lib/icons';

export type IconButtonProps = {
  icon: AppIcon;
  /** required: the accessible name and the tooltip text, e.g. "Edit unit" */
  label: string;
  /** default true: show `label` as a tooltip on hover / focus */
  tooltip?: boolean;
} & Omit<ButtonProps, 'children' | 'aria-label'>;

/**
 * Icon-only button with a mandatory accessible name (WCAG 4.1.2) shown as its tooltip. Use icons from
 * `@/lib/icons`; defaults to the `ghost` variant and `icon` size. Forwards its ref, so it works as an
 * `asChild` trigger of menus and dialogs.
 *
 * @example <IconButton icon={ActionIcon.edit} label="Edit unit" onClick={edit} />
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, tooltip = true, variant = 'ghost', size = 'icon', type = 'button', ...props },
  ref,
) {
  const button = (
    <Button ref={ref} variant={variant} size={size} type={type} aria-label={label} {...props}>
      <Icon aria-hidden="true" />
    </Button>
  );
  if (!tooltip) return button;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
