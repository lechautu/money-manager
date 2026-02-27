import { Router } from 'express';
import { StatisticsService } from '../services/StatisticsService.js';

export const analyticsRoutes = Router();

analyticsRoutes.get('/get_dashboard_summary', (req, res) => {
    try { res.json({ data: StatisticsService.getDashboardSummary(req.query.month as string || new Date().toISOString().substring(0, 7)) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_monthly_summary', (req, res) => {
    try { res.json({ data: StatisticsService.getMonthlySummary(req.query.month as string || new Date().toISOString().substring(0, 7)) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_spending_analytics', (req, res) => {
    try { res.json({ data: StatisticsService.getSpendingAnalytics(req.query.month as string || new Date().toISOString().substring(0, 7)) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_cashflow_trend', (req, res) => {
    try { res.json({ data: StatisticsService.getCashflowTrend(req.query.startDate as string || '', req.query.endDate as string || '') }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_daily_spending', (req, res) => {
    try { res.json({ data: StatisticsService.getDailySpending(req.query.month as string || new Date().toISOString().substring(0, 7)) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_category_movers', (req, res) => {
    try { res.json({ data: StatisticsService.getCategoryMovers(req.query.currentMonth as string || '', req.query.previousMonth as string || '') }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_pending_summary', (_req, res) => {
    try { res.json({ data: StatisticsService.getPendingSummary() }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_upcoming_payments', (_req, res) => {
    try { res.json({ data: StatisticsService.getUpcomingPayments() }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_financial_forecast', (req, res) => {
    try { res.json({ data: StatisticsService.getForecast(parseInt(req.query.months as string || '3', 10)) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

analyticsRoutes.get('/get_forecast_details', (req, res) => {
    try { res.json({ data: StatisticsService.getForecastDetails(req.query.targetMonthStr as string) }); }
    catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});
