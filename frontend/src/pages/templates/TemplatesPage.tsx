import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Search,
    Filter,
    LayoutGrid,
    List as ListIcon,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { TemplateDetailModal } from "@/components/templates/TemplateDetailModal";
import { templateService } from "@/lib/api/services/template";
import { type Template } from "@/types";
import { toast } from "sonner";
import { ROUTES } from "@/router/routes";

const CATEGORIES = [
    { value: "all", label: "All Categories" },
    { value: "marketing", label: "Marketing" },
    { value: "sales", label: "Sales" },
    { value: "support", label: "Support" },
    { value: "dev", label: "Development" },
    { value: "productivity", label: "Productivity" },
];

export default function TemplatesPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const { data: templatesData, isLoading } = useQuery({
        queryKey: ['templates', category],
        queryFn: () => templateService.list({
            page: 1,
            page_size: 50,
            category: category === 'all' ? undefined : category
        })
    });

    const filteredTemplates = templatesData?.results.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
    ) || [];

    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template);
        setIsDetailOpen(true);
    };

    const handleClone = async (templateId: string, workflowName?: string) => {
        try {
            const workflow = await templateService.clone(templateId, { workflow_name: workflowName });
            toast.success("Template cloned successfully!");
            setIsDetailOpen(false);
            // Navigate to the new workflow
            navigate(ROUTES.WORKFLOWS_DETAIL.replace(':id', workflow.id));
        } catch (error) {
            console.error(error);
            toast.error("Failed to clone template");
            throw error; // Re-throw for button state
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Templates Library</h1>
                <p className="text-muted-foreground">
                    Start fast with pre-built workflows for common use cases.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between sticky top-0 bg-background z-10 py-2">
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-lg">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[400px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                        Loading templates...
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Search className="w-8 h-8 mb-4 opacity-50" />
                        <p>No templates found matching your criteria.</p>
                        {category !== 'all' && (
                            <Button variant="link" onClick={() => setCategory('all')}>
                                View all categories
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className={`grid gap-6 ${viewMode === 'grid'
                            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                            : 'grid-cols-1'
                        }`}>
                        {filteredTemplates.map(template => (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                onSelect={handleSelectTemplate}
                            />
                        ))}
                    </div>
                )}
            </div>

            <TemplateDetailModal
                template={selectedTemplate}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                onClone={handleClone}
            />
        </div>
    );
}
