export interface NodeSize {
    width: number;
    height: number;
}

export interface NodeType {
    id: string;
    label: string;
    dimensions: NodeSize;
    resizable: boolean;
    preview: {
        widthClass: string;
        containerClass: string;
        showLine: boolean;
    };
    style?: {
        containerClass?: string;
        ratioOptions?: Array<{ width: number; height: number }>;
        radiusOptions?: string[];
    };
    handles?: {
        defaults?: {
            left: number;
            right: number;
            top: number;
            bottom: number;
        };
        styling?: Array<{
            type: string;
            rotation: number;
            borderRadius: string;
        }>;
        allowedHandleTypes?: string[];
        maxHandleCounts?: {
            left: number;
            right: number;
            top: number;
            bottom: number;
        };
    };
}

export interface NodeTypesData {
    nodeTypes: NodeType[];
}