import { ArrowLeft, ArrowRight, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";

import { ROUTES } from "@/router/routes";

interface DocsPaginationProps {
    prev?: {
        label: string;
        href: string;
    };
    next?: {
        label: string;
        href: string;
    };
}

export function DocsPagination({ prev, next }: DocsPaginationProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 mt-16 pt-8 border-t border-neutral-800">
            {prev ? (
                <Link
                    to={prev.href}
                    className="group flex flex-col gap-1 p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 hover:border-neutral-700 transition-colors sm:w-1/2"
                >
                    <div className="flex items-center gap-2 text-sm text-neutral-500 font-medium">
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Previous
                    </div>
                    <div className="text-lg font-semibold text-neutral-200 group-hover:text-primary transition-colors">
                        {prev.label}
                    </div>
                </Link>
            ) : (
                <div className="sm:w-1/2" />
            )}

            {next ? (
                <Link
                    to={next.href}
                    className="group flex flex-col gap-1 items-end p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 hover:border-neutral-700 transition-colors sm:w-1/2 text-right"
                >
                    <div className="flex items-center gap-2 text-sm text-neutral-500 font-medium">
                        Next
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                    <div className="text-lg font-semibold text-neutral-200 group-hover:text-primary transition-colors">
                        {next.label}
                    </div>
                </Link>
            ) : (
                <Link
                    to={ROUTES.DASHBOARD}
                    className="group flex flex-col gap-1 items-end p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 hover:border-neutral-700 transition-colors sm:w-1/2 text-right"
                >
                    <div className="flex items-center gap-2 text-sm text-neutral-500 font-medium">
                        Complete
                        <LayoutDashboard className="h-4 w-4 transition-transform group-hover:scale-110" />
                    </div>
                    <div className="text-lg font-semibold text-neutral-200 group-hover:text-primary transition-colors">
                        Go to Dashboard
                    </div>
                </Link>
            )}
        </div>
    );
}
