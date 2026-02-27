import { ToolExecutionService } from './ToolExecutionService';

export interface ForecastPoint {
    month: string;
    projectedBalance: number;
    income: number;
    expense: number;
}

export interface ForecastDetailItem {
    id: string;
    name: string;
    amount: number;
    date: string;
    type: 'recurring' | 'installment' | 'manual' | 'estimated';
    is_expense: boolean;
    categoryName?: string;
    status?: 'paid' | 'pending' | 'projected' | 'posted';
    meta?: any; // For holding extra info like installment progress (2/12)
}

export interface ForecastDetailResult {
    month: string;
    openingBalance: number;
    closingBalance: number;
    income: {
        total: number;
        items: ForecastDetailItem[];
    };
    expense: {
        total: number;
        items: ForecastDetailItem[];
    };
}

export const ForecastService = {
    async getForecast(months: number = 12): Promise<ForecastPoint[]> {
        const res = await ToolExecutionService.executeTool('get_financial_forecast', { months });
        return res.data;
    },

    async getForecastDetails(targetMonthStr: string): Promise<ForecastDetailResult> {
        const res = await ToolExecutionService.executeTool('get_forecast_details', { targetMonthStr });
        return res.data;
    }
};
