export const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="border-t border-border bg-background px-6 py-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-4">
                    <span>© {currentYear} Bridge.dev</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">v1.0.0</span>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="hidden sm:inline">All systems operational</span>
                    <span className="sm:hidden">Online</span>
                </div>
            </div>
        </footer>
    );
};
