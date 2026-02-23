import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import AccountsPage from './pages/AccountsPage';
import TransactionsPage from './pages/TransactionsPage';
import RecurringPage from './pages/RecurringPage';
import InstallmentPage from './pages/InstallmentPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BudgetPage from './pages/BudgetPage';
import ForecastPage from './pages/ForecastPage';
import ForecastDetailPage from './pages/ForecastDetailPage';
import CategoryPage from './pages/CategoryPage';
import AuditLogPage from './pages/AuditLogPage';

import { AuthLock } from './components/auth/AuthLock';
import { ToastProvider } from './components/common/Toast';

import { UndoProvider } from './components/common/UndoProvider';
import { DateProvider } from './components/common/DateProvider';

function App() {
  return (
    <BrowserRouter>
      <AuthLock>
        <ToastProvider>
          <DateProvider>
            <UndoProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/categories" element={<CategoryPage />} />
                  <Route path="/recurring" element={<RecurringPage />} />
                  <Route path="/installments" element={<InstallmentPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/budget" element={<BudgetPage />} />
                  <Route path="/forecast" element={<ForecastPage />} />
                  <Route path="/forecast/:month" element={<ForecastDetailPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/audit-logs" element={<AuditLogPage />} />
                </Route>
              </Routes>
            </UndoProvider>
          </DateProvider>
        </ToastProvider>
      </AuthLock>
    </BrowserRouter>
  );
}

export default App;
