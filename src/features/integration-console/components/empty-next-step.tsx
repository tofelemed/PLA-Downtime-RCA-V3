/** The short next step under a list's own empty message (the message itself is the title). */
export function EmptyNextStep({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
