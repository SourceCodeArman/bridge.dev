import { Outlet, Link } from "react-router-dom";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { Menu, X } from "lucide-react";
import { ROUTES } from "@/router/routes";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";

export default function DocsLayout() {
    // Only need one open state for the main sidebar provider
    const [open, setOpen] = useState(false);

    // Mobile specific menu toggle for the navbar, although Sidebar handles its own mobile toggle usually.
    // However, if we want a custom navbar on top for search, we can keep some structure.

    return (
        <Sidebar open={open} setOpen={setOpen}>
            <div className="flex h-screen w-full bg-neutral-800 flex-col md:flex-row overflow-hidden border border-border m-0 text-left">
                {/* Use the new DocsSidebar as the main sidebar */}
                <DocsSidebar />

                <main className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out overflow-y-auto bg-neutral-900 rounded-tl-3xl relative text-neutral-200">

                    {/* Docs Header */}
                    <header className="sticky top-0 z-40 border-b border-neutral-700 bg-neutral-900/95 backdrop-blur supports-backdrop-filter:bg-neutral-900/60 w-full">
                        <div className="container px-6 flex items-center justify-between h-16 max-w-7xl mx-auto">
                            <div className="flex items-center gap-4">
                                {/* Mobile Menu trigger using the Sidebar context would go here or utilize standard sidebar behavior */}
                                <button
                                    onClick={() => setOpen(!open)}
                                    className="md:hidden p-2 text-neutral-400 hover:text-neutral-200"
                                >
                                    {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                                </button>

                                <Link
                                    to={ROUTES.DOCS}
                                    className="text-lg font-semibold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent block"
                                >
                                    Documentation
                                </Link>
                            </div>

                            <div className="flex-1 max-w-md mx-4 hidden md:block">
                                <DocsSearch />
                            </div>
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <div className="flex-1 container px-6 py-8 max-w-7xl mx-auto w-full">
                        <div className="md:hidden mb-6">
                            <DocsSearch />
                        </div>

                        <article
                            className={cn(
                                "prose prose-invert max-w-none",
                                // Custom prose overrides for better readability
                                "prose-headings:scroll-mt-24 prose-headings:text-neutral-100",
                                "prose-h1:text-4xl prose-h1:font-bold prose-h1:bg-gradient-to-r prose-h1:from-white prose-h1:to-neutral-400 prose-h1:bg-clip-text prose-h1:text-transparent prose-h1:mb-8",
                                "prose-h2:text-2xl prose-h2:font-semibold prose-h2:border-b prose-h2:border-neutral-800 prose-h2:pb-3 prose-h2:mt-10 prose-h2:mb-6 prose-h2:text-neutral-200",
                                "prose-h3:text-xl prose-h3:font-medium prose-h3:text-neutral-200 prose-h3:mt-8 prose-h3:mb-4",
                                "prose-p:text-neutral-400 prose-p:leading-relaxed prose-p:mb-6",
                                "prose-li:text-neutral-400 prose-li:my-1",
                                "prose-ul:my-6 prose-ol:my-6",
                                "prose-strong:text-neutral-200 prose-strong:font-semibold",
                                "prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline hover:prose-a:text-primary/80 transition-colors",
                                "prose-code:bg-neutral-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-neutral-300 prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
                                "prose-pre:bg-neutral-950 prose-pre:border prose-pre:border-neutral-800 prose-pre:rounded-lg prose-pre:p-4",
                                "prose-blockquote:border-l-4 prose-blockquote:border-neutral-700 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-500"
                            )}
                        >
                            <Outlet />
                        </article>

                        {/* Footer for docs pages */}
                        <div className="mt-20 pt-8 border-t border-neutral-800 text-sm text-neutral-500 flex justify-between">
                            <p>© {new Date().getFullYear()} Bridge Inc.</p>
                            <div className="flex gap-4">
                                <a href="#" className="hover:text-neutral-300 transition-colors">Privacy</a>
                                <a href="#" className="hover:text-neutral-300 transition-colors">Terms</a>
                            </div>
                        </div>
                    </div>
                </main>
                <Toaster />
            </div>
        </Sidebar>
    );
}
