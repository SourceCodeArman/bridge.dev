import type { Template } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Users } from "lucide-react";

interface TemplateCardProps {
    template: Template;
    onSelect: (template: Template) => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
    return (
        <Card className="flex flex-col h-full hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onSelect(template)}>
            {/* Preview Image Placeholder or Actual Image */}
            <div className="h-40 w-full bg-muted/50 relative overflow-hidden flex items-center justify-center border-b">
                {template.preview_image_url ? (
                    <img
                        src={template.preview_image_url}
                        alt={template.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="text-muted-foreground/30 font-semibold text-4xl select-none">
                        Workflow
                    </div>
                )}
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="secondary" className="pointer-events-none">
                        View Details
                    </Button>
                </div>
            </div>

            <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-lg leading-tight line-clamp-1" title={template.name}>
                        {template.name}
                    </h3>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags?.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5">
                            {tag}
                        </Badge>
                    ))}
                    {(template.tags?.length || 0) > 3 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-muted-foreground">
                            +{template.tags!.length - 3}
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3">
                    {template.description}
                </p>
            </CardContent>

            <CardFooter className="p-4 pt-0 text-xs text-muted-foreground flex items-center justify-between border-t mt-4 pt-3">
                <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{template.usage_count || 0} uses</span>
                </div>
                {template.category && (
                    <span className="capitalize">{template.category}</span>
                )}
            </CardFooter>
        </Card>
    );
}
