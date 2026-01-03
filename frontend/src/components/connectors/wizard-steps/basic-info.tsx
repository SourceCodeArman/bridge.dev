import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface BasicInfoStepProps {
    name: string;
    setName: (name: string) => void;
    description: string;
    setDescription: (description: string) => void;
}

export default function BasicInfoStep({
    name,
    setName,
    description,
    setDescription,
}: BasicInfoStepProps) {
    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-2 flex flex-col items-start gap-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Connector"
                    required
                    autoFocus
                />
            </div>

            <div className="space-y-2 flex flex-col items-start gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this connector do?"
                    rows={8}
                />
            </div>
        </div>
    );
}