import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    Wallet,
    Repeat,
    CreditCard,
    PieChart,
    Calculator,
    TrendingUp,
    Settings,
    Tag,
    Plus,
    Users
} from 'lucide-react';
import { TransactionForm } from './transactions/TransactionForm';
import { twMerge } from 'tailwind-merge';
import { ToolDebugPanel } from './ui/ToolDebugPanel';
import { RecurringService } from '../services/RecurringService';
import { InstallmentService } from '../services/InstallmentService';
import { ChatFAB } from './ai-chat/ChatFAB';
import { ChatPanel } from './ai-chat/ChatPanel';

const NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/accounts', label: 'Accounts', icon: Wallet },
    { to: '/categories', label: 'Categories', icon: Tag },
    { to: '/payees', label: 'Payees', icon: Users },
    { to: '/recurring', label: 'Recurring', icon: Repeat },
    { to: '/installments', label: 'Installments', icon: CreditCard },
    { to: '/analytics', label: 'Analytics', icon: PieChart },
    { to: '/budget', label: 'Budget', icon: Calculator },
    { to: '/forecast', label: 'Forecast', icon: TrendingUp },
    { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ to, icon: Icon, label, className, badgeCount }: { to: string; icon: any; label: string, className?: string, badgeCount?: number }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                twMerge(
                    'relative flex flex-col items-center justify-center p-2 text-xs font-medium text-gray-400 hover:text-white md:flex-row md:justify-start md:gap-3 md:text-sm md:rounded-lg md:px-3 md:py-2 transition-colors',
                    isActive && 'text-primary md:bg-gray-800 md:text-white',
                    className
                )
            }
        >
            <Icon className="h-6 w-6 md:h-5 md:w-5" />
            <span className="mt-1 md:mt-0 truncate">{label}</span>
            {badgeCount !== undefined && badgeCount > 0 && (
                <span className="absolute top-1 right-2 md:static md:ml-auto flex h-4 min-w-[1rem] px-1 items-center justify-center bg-red-600 text-[10px] font-bold text-white rounded-full group-hover:scale-110 transition-transform">
                    {badgeCount > 9 ? '9+' : badgeCount}
                </span>
            )}
        </NavLink>
    );
}

export function AppLayout() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [installmentCount, setInstallmentCount] = useState(0);
    const [recurringCount, setRecurringCount] = useState(0);

    const fetchPendingCounts = async () => {
        try {
            const [inst, rec] = await Promise.all([
                InstallmentService.getPendingCount(),
                RecurringService.getPendingCount()
            ]);
            setInstallmentCount(inst);
            setRecurringCount(rec);
        } catch (e) {
            console.error("Failed to fetch pending counts", e);
        }
    };

    // Background task processing
    useEffect(() => {
        const runBackgroundTasks = async () => {
            try {
                console.log("Running background tasks (Recurring & Installments)...");
                await Promise.all([
                    RecurringService.generateInstances(),
                    InstallmentService.checkOverdue()
                ]);

                // Fetch counts after checks
                fetchPendingCounts();
            } catch (e) {
                console.error("Background tasks failed", e);
            }
        };
        runBackgroundTasks();

        const handleRefresh = () => fetchPendingCounts();
        window.addEventListener('refresh-installment-count', handleRefresh);
        window.addEventListener('refresh-recurring-count', handleRefresh);
        return () => {
            window.removeEventListener('refresh-installment-count', handleRefresh);
            window.removeEventListener('refresh-recurring-count', handleRefresh);
        };
    }, []);

    // Toggle body class when chat is open to hide other FABs
    useEffect(() => {
        if (isChatOpen) {
            document.body.classList.add('ai-chat-open');
        } else {
            document.body.classList.remove('ai-chat-open');
        }
        return () => document.body.classList.remove('ai-chat-open');
    }, [isChatOpen]);

    const handleChatClose = useCallback(() => setIsChatOpen(false), []);

    return (
        <div className="flex h-screen w-full flex-col md:flex-row bg-gray-950 text-gray-100">
            {/* Sidebar (Desktop) */}
            <aside className="hidden w-64 flex-col border-r border-gray-800 bg-gray-900 md:flex">
                <div className="flex h-16 items-center px-6 border-b border-gray-800">
                    <span className="text-xl font-bold text-white">Money Manager</span>
                </div>
                <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
                    {NAV_ITEMS.map((item) => (
                        <NavItem
                            key={item.to}
                            {...item}
                            badgeCount={
                                item.to === '/installments' ? installmentCount :
                                    item.to === '/recurring' ? recurringCount :
                                        undefined
                            }
                        />
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
                <div className="mx-auto max-w-7xl p-4 md:p-8">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Nav (Mobile) */}
            <nav className="fixed bottom-0 left-0 right-0 flex h-16 items-center justify-around border-t border-gray-800 bg-gray-900 px-2 md:hidden z-50">
                {NAV_ITEMS.slice(0, 5).map((item) => (
                    <NavItem
                        key={item.to}
                        {...item}
                        badgeCount={
                            item.to === '/installments' ? installmentCount :
                                item.to === '/recurring' ? recurringCount :
                                    undefined
                        }
                    />
                ))}
            </nav>

            {/* Global Floating Action Button — Add Transaction */}
            <button
                onClick={() => setIsFormOpen(true)}
                className="fixed bottom-20 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-blue-700 transition-all z-[100] active:scale-95 group global-fab"
                title="Add Transaction"
            >
                <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>

            {/* AI Chat FAB */}
            {/* AI Chat FAB */}
            {!isChatOpen && <ChatFAB onClick={() => setIsChatOpen(true)} />}

            {/* AI Chat Panel Overlay */}
            {isChatOpen && <ChatPanel onClose={handleChatClose} />}

            <TransactionForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={() => {
                    // Simple way to refresh all data on the current page for MVP1
                    window.location.reload();
                }}
            />

            {/* Debug Panel for AI Tools */}
            <ToolDebugPanel />
        </div>
    );
}
