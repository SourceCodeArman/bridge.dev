import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';

export default function TestPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await apiClient.post('/api/v1/core/custom-connectors/test_upload/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setResult(response.data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Unknown error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="container mx-auto p-8">
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Test Icon Upload</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">Select Icon (PNG/SVG/JPEG)</Label>
                        <Input
                            id="file-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>

                    <Button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="w-full"
                    >
                        {uploading ? 'Uploading...' : 'Test Upload'}
                    </Button>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-md text-sm whitespace-pre-wrap">
                            Error: {error}
                        </div>
                    )}

                    {result && (
                        <div className="p-4 bg-green-50 text-green-700 rounded-md text-sm space-y-2">
                            <div className="font-semibold">Success!</div>
                            <div className="break-all">URL: {result.url}</div>
                            {result.url && (
                                <img src={result.url} alt="Uploaded" className="w-16 h-16 object-contain border rounded bg-white" />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}