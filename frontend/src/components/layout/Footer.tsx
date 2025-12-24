
import { cn } from "@/lib/utils"

export function Footer({ className }: React.HTMLAttributes<HTMLElement>) {
    return (
        <footer className={cn("py-4 px-6 border-t border-border", className)}>
            <div className="flex flex-col items-center justify-center gap-2 md:h-12 md:flex-row">
                <p className="text-xs text-muted-foreground text-center">
                    &copy; {new Date().getFullYear()} Bridge.dev. All rights reserved.
                </p>
            </div>
        </footer>
    )
}
