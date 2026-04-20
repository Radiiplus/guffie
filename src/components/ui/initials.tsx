import { AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface InitialsAvatarFallbackProps {
  initials: string;
  className?: string;
}

export function InitialsAvatarFallback({ initials, className }: InitialsAvatarFallbackProps) {
  return (
    <AvatarFallback
      style={{ fontFamily: '"Playwrite IE", cursive', fontWeight: 400 }}
      className={cn(
        "bg-violet-900/20 text-rose-300 ",
        className
      )}
    >
      {initials}
    </AvatarFallback>
  );
}
