import { useTheme } from '@/components/theme/theme-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AssetsStepProps {
    iconFile: File | null;
    setIconFile: (file: File | null) => void;
    setLightIconFile: (file: File | string | null) => void;
    setDarkIconFile: (file: File | string | null) => void;
    setManifestFile: (file: File | null) => void;
}

interface IconGroup {
    baseName: string; // e.g. "amazon"
    darkUrl: string;  // amazon.png (regular/dark)
    lightUrl?: string; // amazon-light.png
    darkName: string;
    lightName?: string;
}

const urlToFile = async (url: string, filename: string, mimeType: string): Promise<File> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], filename, { type: mimeType });
};

export default function AssetsStep({
    setLightIconFile,
    setDarkIconFile,
    setManifestFile,
}: AssetsStepProps) {
    const { theme } = useTheme();
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

    const [selectionMode, setSelectionMode] = useState<'initial' | 'custom'>('initial');
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);

    // We store groups now instead of flat list
    const [iconGroups, setIconGroups] = useState<IconGroup[]>([]);
    const [isLoadingIcons, setIsLoadingIcons] = useState(false);

    // Preview state
    const [previewLight, setPreviewLight] = useState<string | null>(null);
    const [previewDark, setPreviewDark] = useState<string | null>(null);

    // Resolve theme for logic
    useEffect(() => {
        if (theme === 'system') {
            const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            setResolvedTheme(isDark ? 'dark' : 'light');
        } else {
            setResolvedTheme(theme);
        }
    }, [theme]);

    useEffect(() => {
        const fetchIcons = async () => {
            setIsLoadingIcons(true);
            try {
                // IMPORTANT: User updated bucket name to 'connector-logos'
                const { data, error } = await supabase.storage.from('connector-logos').list('', {
                    limit: 1000,
                    sortBy: { column: 'name', order: 'asc' }
                });

                if (error) {
                    console.error('Error fetching icons:', error);
                    return;
                }

                if (data) {
                    const groupsMap = new Map<string, IconGroup>();

                    data.forEach(item => {
                        if (item.name === '.emptyFolderPlaceholder') return;

                        const url = supabase.storage.from('connector-logos').getPublicUrl(item.name).data.publicUrl;
                        const isLightVariant = item.name.endsWith('-light.png') || item.name.endsWith('-light.svg');

                        // Extract base name. 
                        // amazon.png -> amazon
                        // amazon-light.png -> amazon
                        let baseName = item.name;
                        // naive extension removal
                        const lastDot = baseName.lastIndexOf('.');
                        if (lastDot > -1) baseName = baseName.substring(0, lastDot);

                        if (isLightVariant && baseName.endsWith('-light')) {
                            baseName = baseName.substring(0, baseName.length - '-light'.length);
                        }

                        if (!groupsMap.has(baseName)) {
                            groupsMap.set(baseName, {
                                baseName,
                                darkUrl: '', // Placeholder, will fill if this is regular variant or if missing
                                darkName: '',
                            });
                        }

                        const group = groupsMap.get(baseName)!;

                        if (isLightVariant) {
                            group.lightUrl = url;
                            group.lightName = item.name;
                        } else {
                            group.darkUrl = url;
                            group.darkName = item.name;
                        }
                    });

                    // Filter so we prioritize showing groups that at least have one icon
                    const validGroups = Array.from(groupsMap.values()).filter(g => g.darkUrl || g.lightUrl);
                    setIconGroups(validGroups);
                }
            } catch (error) {
                console.error('Error listing icons:', error);
            } finally {
                setIsLoadingIcons(false);
            }
        };

        if (isLibraryOpen && iconGroups.length === 0) {
            fetchIcons();
        }
    }, [isLibraryOpen]);

    const handleLibrarySelect = async (group: IconGroup) => {
        try {
            // Determine URLs for both
            const darkUrl = group.darkUrl || group.lightUrl!; // Fallback if regular missing
            const lightUrl = group.lightUrl || group.darkUrl!; // Fallback if light missing (universal)

            setPreviewLight(lightUrl);
            setPreviewDark(darkUrl);

            // Directly pass URLs
            setLightIconFile(lightUrl);
            setDarkIconFile(darkUrl);

            setIsLibraryOpen(false);
            setSelectionMode('initial');
        } catch (error) {
            console.error('Error processing library selection:', error);
        }
    };

    const handleCustomUpload = (files: File[], isLight: boolean) => {
        const file = files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        if (isLight) {
            setPreviewLight(url);
            setLightIconFile(file);
        } else {
            setPreviewDark(url);
            setDarkIconFile(file);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 mt-8">
            <div className="space-y-4">
                <Label className="text-base">Connector Icon</Label>
                
                {selectionMode === 'initial' && !previewLight && !previewDark && (
                    <div className="grid grid-cols-2 gap-4">
                        <div
                            onClick={() => setIsLibraryOpen(true)}
                            className="cursor-pointer border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-all group"
                        >
                            <div className="p-3 rounded-full bg-secondary group-hover:bg-background transition-colors">
                                <ImageIcon className="w-6 h-6 text-foreground" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium">Choose from Library</p>
                                <p className="text-xs text-muted-foreground mt-1">Select from available icons</p>
                            </div>
                        </div>

                        <div
                            onClick={() => setSelectionMode('custom')}
                            className="cursor-pointer border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-all group"
                        >
                            <div className="p-3 rounded-full bg-secondary group-hover:bg-background transition-colors">
                                <Upload className="w-6 h-6 text-foreground" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium">Upload Custom</p>
                                <p className="text-xs text-muted-foreground mt-1">Upload your own icon files</p>
                            </div>
                        </div>
                    </div>
                )}

                {(previewLight || previewDark) && selectionMode === 'initial' && (
                    <div className="flex flex-col sm:flex-row gap-6 items-start border rounded-lg p-6 relative">
                        <div className="absolute right-2 top-2">
                            <Button variant="ghost" size="sm" onClick={() => {
                                setPreviewLight(null);
                                setPreviewDark(null);
                                setLightIconFile(null);
                                setDarkIconFile(null);
                            }}>
                                Change
                            </Button>
                        </div>

                        <div className="flex gap-8 w-full justify-start">
                            <div className="flex flex-col gap-2 items-center">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Light Mode</Label>
                                <div className="w-24 h-24 border rounded-md p-4 bg-background dark:bg-foreground flex items-center justify-center relative">
                                    {previewLight ? (
                                        <img src={previewLight} alt="Light Icon" className="w-24 h-24 object-contain" />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">None</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 items-center">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Dark Mode</Label>
                                <div className="w-24 h-24 border rounded-md p-4 bg-foreground dark:bg-background flex items-center justify-center relative">
                                    {previewDark ? (
                                        <img src={previewDark} alt="Dark Icon" className="w-24 h-24 object-contain" />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">None</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectionMode === 'custom' && (
                    <div className="space-y-6 border rounded-lg p-6 relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-2"
                            onClick={() => setSelectionMode('initial')}
                        >
                            Cancel
                        </Button>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Light Icon</Label>
                                <div className="h-32">
                                    <FileUpload
                                        id="light-icon-custom"
                                        onChange={(files) => handleCustomUpload(files, true)}
                                        accept={{ 'image/png, image/svg+xml': [] }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Dark Icon</Label>
                                <div className="h-32">
                                    <FileUpload
                                        id="dark-icon-custom"
                                        onChange={(files) => handleCustomUpload(files, false)}
                                        accept={{ 'image/png, image/svg+xml': [] }}
                                    />
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Recommended: 100x100px PNG or SVG</p>
                    </div>
                )}
            </div>

            <div className="space-y-2 flex flex-col items-start gap-2 w-full pt-4 border-t">
                <Label>Manifest (JSON)</Label>
                <div className="h-24 w-full">
                    <FileUpload
                        id="manifest-upload"
                        onChange={(files) => setManifestFile(files[0] || null)}
                        accept={{ 'application/json': ['.json'] }}
                    />
                </div>
                <p className="text-[10px] text-muted-foreground">Must follow the Bridge connector schema</p>
            </div>

            {/* Library Modal */}
            <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Select Connector Icon</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto min-h-[300px] p-1">
                        {isLoadingIcons ? (
                            <div className="flex items-center justify-center h-full min-h-[200px]">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                                {iconGroups.map((group) => {
                                    // Display Logic: 
                                    // If Light Mode -> Show Light Variant if exists, else Dark/Base.
                                    // If Dark Mode -> Show Dark/Base Variant if exists, else Light.
                                    const displayUrl = resolvedTheme === 'dark'
                                        ? (group.darkUrl || group.lightUrl)
                                        : (group.lightUrl || group.darkUrl);

                                    if (!displayUrl) return null;

                                    return (
                                        <div
                                            key={group.baseName}
                                            onClick={() => handleLibrarySelect(group)}
                                            className="cursor-pointer group flex flex-col items-center gap-2 p-3 rounded-lg border hover:border-primary hover:bg-accent transition-all"
                                        >
                                            <div className="w-12 h-12 relative flex items-center justify-center">
                                                <img src={displayUrl} alt={group.baseName} className="max-w-full max-h-full object-contain" />
                                            </div>
                                            <span className="text-[10px] text-center text-muted-foreground group-hover:text-foreground truncate w-full">
                                                {group.baseName}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}