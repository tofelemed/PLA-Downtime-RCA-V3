import * as SliderPrimitive from '@radix-ui/react-slider';

export interface SplitSliderProps {
  id: string;
  /** whole minutes after the start: 1 … max */
  max: number;
  value: number;
  /** the accessible name of the drag handle (QA audit F6: axe `aria-input-field-name`) */
  label: string;
  /** the chosen instant in words, read out instead of the minute count */
  valueText: string;
  onChange: (value: number) => void;
}

/**
 * The 1-minute split slider. The generated `ui/slider` gives its thumb no name and takes none, so the split
 * dialog builds the same track and thumb from the primitive and names the thumb, which is the focusable control.
 */
export function SplitSlider({ id, max, value, label, valueText, onChange }: SplitSliderProps) {
  return (
    <SliderPrimitive.Root
      id={id}
      min={1}
      max={max}
      step={1}
      value={[value]}
      onValueChange={([next]) => onChange(next)}
      className="relative flex w-full touch-none select-none items-center"
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        data-testid="split-slider-thumb"
        className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
}
