import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { integrationService } from '@/lib/api/services/integration';
import { toast } from 'sonner';

interface OAuthButtonProps {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    onSuccess: (tokens: any) => void;
    onError?: (error: any) => void;
    label?: string;
    disabled?: boolean;
}

export default function OAuthButton({
    clientId,
    clientSecret,
    redirectUri,
    onSuccess,
    onError,
    label = 'Connect with Google',
    disabled = false,
}: OAuthButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [popupWindow, setPopupWindow] = useState<Window | null>(null);

    // Handle message from popup
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            // Verify origin matches
            if (event.origin !== window.location.origin) return;

            // Check for oauth_code in message data
            if (event.data?.type === 'oauth_callback' && event.data?.code) {
                if (popupWindow) popupWindow.close();
                setPopupWindow(null);

                try {
                    // Exchange code for tokens
                    const tokens = await integrationService.googleExchange({
                        client_id: clientId,
                        client_secret: clientSecret,
                        code: event.data.code,
                        redirect_uri: redirectUri,
                    });

                    toast.success('Successfully connected to Google');
                    onSuccess(tokens);
                } catch (error) {
                    console.error('Token exchange error:', error);
                    toast.error('Failed to exchange authorization code');
                    onError?.(error);
                } finally {
                    setIsLoading(false);
                }
            } else if (event.data?.type === 'oauth_error') {
                if (popupWindow) popupWindow.close();
                setPopupWindow(null);
                setIsLoading(false);
                toast.error(`Authorization failed: ${event.data.error}`);
                onError?.(new Error(event.data.error));
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [clientId, clientSecret, redirectUri, onSuccess, onError, popupWindow]);

    const handleConnect = async () => {
        if (!clientId || !clientSecret) {
            toast.error('Client ID and Client Secret are required');
            return;
        }

        setIsLoading(true);

        try {
            // Get auth URL from backend
            const { url } = await integrationService.getGoogleAuthUrl({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
            });

            // Calculate center position for popup
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            // Open popup
            const popup = window.open(
                url,
                'Google Login',
                `width=${width},height=${height},top=${top},left=${left}`
            );

            if (popup) {
                setPopupWindow(popup);

                // Poll to see if popup was closed manually
                const pollTimer = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(pollTimer);
                        setIsLoading(false);
                        setPopupWindow(null);
                    }
                }, 1000);
            } else {
                toast.error('Popup blocked. Please allow popups for this site.');
                setIsLoading(false);
            }

        } catch (error) {
            console.error('Failed to start OAuth flow:', error);
            toast.error('Failed to initialize connection');
            setIsLoading(false);
            onError?.(error);
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            onClick={handleConnect}
            disabled={isLoading || disabled || !clientId || !clientSecret}
            className="w-full"
        >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                </>
            ) : (
                <>
                    <img
                        src="https://www.google.com/favicon.ico"
                        alt="Google"
                        className="mr-2 h-4 w-4"
                    />
                    {label}
                </>
            )}
        </Button>
    );
}
