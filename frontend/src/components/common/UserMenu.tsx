import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const UserMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    if (!user) return null;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const getInitials = () => {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase();
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-sm font-medium text-white">
                    {getInitials()}
                </div>
                <div className="hidden text-left md:block">
                    <div className="text-sm font-medium text-foreground">
                        {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
            </button>

            {isOpen && (
                <>
                    {/* Overlay to close dropdown when clicking outside */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown menu */}
                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-popover shadow-xl">
                        <div className="border-b border-border px-4 py-3">
                            <div className="text-sm font-medium text-foreground">
                                {user.first_name} {user.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>

                        <Link
                            to="/profile"
                            className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            onClick={() => setIsOpen(false)}
                        >
                            <User className="h-4 w-4" />
                            <span>Profile</span>
                        </Link>

                        <Link
                            to="/settings"
                            className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            onClick={() => setIsOpen(false)}
                        >
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                        </Link>
                    </div>

                    <div className="border-t border-border p-2">
                        <button
                            onClick={handleLogout}
                            className="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Logout</span>
                        </button>
                    </div>
        </>
    )
}
        </div >
    );
};
