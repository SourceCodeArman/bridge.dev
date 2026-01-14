import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JsonViewer } from '@/components/ui/json-viewer';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useMemo } from 'react';

interface HttpRequestResponseTabsProps {
    request: {
        method: string;
        url: string;
        headers?: Record<string, string>;
        params?: Record<string, string>;
        body?: any;
    };
    response: {
        status_code: number;
        headers?: Record<string, string>;
        body?: any;
        raw_body?: string;
    };
    className?: string;
}

export default function HttpRequestResponseTabs({
    request,
    response,
    className,
}: HttpRequestResponseTabsProps) {
    // Build full URL with params
    const fullUrl = useMemo(() => {
        if (!request.url) return '';
        if (!request.params || Object.keys(request.params).length === 0) return request.url;

        try {
            const url = new URL(request.url);
            Object.entries(request.params).forEach(([key, val]) => {
                if (key.trim()) {
                    url.searchParams.set(key.trim(), val);
                }
            });
            return url.toString();
        } catch {
            const queryString = Object.entries(request.params)
                .filter(([key]) => key.trim())
                .map(([key, val]) => `${encodeURIComponent(key.trim())}=${encodeURIComponent(val)}`)
                .join('&');

            if (!queryString) return request.url;
            const separator = request.url.includes('?') ? '&' : '?';
            return `${request.url}${separator}${queryString}`;
        }
    }, [request.url, request.params]);

    // Get status color based on status code
    const getStatusColor = (code: number) => {
        if (code >= 200 && code < 300) return 'text-green-500';
        if (code >= 300 && code < 400) return 'text-yellow-500';
        if (code >= 400 && code < 500) return 'text-orange-500';
        if (code >= 500) return 'text-red-500';
        return 'text-muted-foreground';
    };

    const hasHeaders = (headers?: Record<string, string>) =>
        headers && Object.keys(headers).length > 0;

    return (
        <Tabs defaultValue="response" className={className}>
            <TabsList className="h-8 w-full grid grid-cols-2 mb-2">
                <TabsTrigger value="request" className="h-7 text-xs gap-1.5">
                    <ArrowUp className="h-3 w-3" />
                    Request
                </TabsTrigger>
                <TabsTrigger value="response" className="h-7 text-xs gap-1.5">
                    <ArrowDown className="h-3 w-3" />
                    Response
                </TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="mt-0 flex-1 overflow-auto">
                <div className="space-y-2 text-sm">
                    {/* Method + URL */}
                    <div className="pl-2 font-mono text-xs break-all">
                        <span className="font-bold text-primary">{request.method}</span>
                        <span className="ml-2 text-muted-foreground">{fullUrl}</span>
                    </div>

                    {/* Headers */}
                    {hasHeaders(request.headers) && (
                        <div>
                            <h5 className="text-xs font-medium text-muted-foreground mb-1">Headers</h5>
                            <JsonViewer data={request.headers} className="max-h-24" />
                        </div>
                    )}

                    {/* Body */}
                    {request.body && (
                        <div>
                            <h5 className="text-xs font-medium text-muted-foreground mb-1">Body</h5>
                            <JsonViewer data={request.body} />
                        </div>
                    )}
                </div>
            </TabsContent>

            <TabsContent value="response" className="mt-0 flex-1 overflow-auto">
                <div className="space-y-2 text-sm">
                    {/* Status Code - compact */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`font-bold font-mono ${getStatusColor(response.status_code)}`}>
                            {response.status_code}
                        </span>
                    </div>

                    {/* Response Body - main focus */}
                    {response.body !== undefined && response.body !== null && (
                        <JsonViewer data={response.body} />
                    )}

                    {/* Response Headers - collapsed at bottom */}
                    {hasHeaders(response.headers) && (
                        <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Headers ({Object.keys(response.headers!).length})
                            </summary>
                            <JsonViewer data={response.headers} className="mt-1 max-h-32" />
                        </details>
                    )}
                </div>
            </TabsContent>
        </Tabs>
    );
}
