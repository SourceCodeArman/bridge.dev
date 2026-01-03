import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeAwareIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string;
    lightSrc?: string;
    darkSrc?: string;
}

export const ThemeAwareIcon = ({ src, lightSrc, darkSrc, className, alt, ...props }: ThemeAwareIconProps) => {
    const { theme } = useTheme();
    const [currentSrc, setCurrentSrc] = useState(src);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        // Determine if we should show the light version
        // 1. Theme is explicitly 'light'
        // 2. Theme is 'system' and system is NOT dark
        const isLight = theme === 'light' || (theme === 'system' && !isSystemDark);

        setHasError(false);

        if (isLight) {
            // Priority 1: Explicit light source
            if (lightSrc) {
                setCurrentSrc(lightSrc);
                return;
            }

            // Priority 2: Guessing logic (only if no error yet and src is present)
            if (!hasError && src) {
                try {
                    const lastDotIndex = src.lastIndexOf('.');
                    if (lastDotIndex !== -1) {
                        const guessedLightSrc = `${src.substring(0, lastDotIndex)}-light${src.substring(lastDotIndex)}`;
                        setCurrentSrc(guessedLightSrc);
                    } else {
                        setCurrentSrc(src);
                    }
                } catch (e) {
                    setCurrentSrc(src);
                }
            } else {
                // If guessing failed previously (hasError=true), fall back to original
                setCurrentSrc(src);
            }
        } else {
            // Dark mode or fallback
            // Priority 1: Explicit dark source
            if (darkSrc) {
                setCurrentSrc(darkSrc);
            } else {
                // Priority 2: Standard src (usually dark/neutral)
                setCurrentSrc(src);
            }
        }
    }, [src, lightSrc, darkSrc, theme, hasError]);

    const handleError = () => {
        // If we tried to load a variant (light or guessed) and it failed, revert to original src
        if (currentSrc !== src) {
            setHasError(true);
            setCurrentSrc(src);
        }
    };

    return (
        <img
            src={currentSrc}
            alt={alt}
            className={cn("object-contain", className)}
            onError={handleError}
            {...props}
        />
    );
};
