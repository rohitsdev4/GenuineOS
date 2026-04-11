'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useFetchData } from '@/hooks/use-data';
import { formatCurrency } from '@/lib/helpers';
import { formatDate } from '@/lib/helpers';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  ListChecks,
} from 'lucide-react';

const PIE_COLORS = [
  '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#6366f1', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e', '#eab308',
];

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <p className="text-xl font-bold">{value}</p>
          )}
        </div>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            trend === 'up'
              ? 'bg-emerald-500/10'
              : trend === 'down'
                ? 'bg-red-500/10'
                : 'bg-blue-500/10'
          }`}
        >
          <Icon
            className={`w-4 h-4 ${
              trend === 'up'
                ? 'text-emerald-500'
                : trend === 'down'
                  ? 'text-red-500'
                  : 'text-blue-500'
            }`}
          />
        </div>
      </div>
    </Card>
  );
}

export default function ReportsTab() {
  const { data: paymentsData, isLoading: paymentsLoading } = useFetchData({
    model: 'payment',
  });
  const { data: expensesData, isLoading: expensesLoading } = useFetchData({
    model: 'expense',
  });
  const { data: sitesData, isLoading: sitesLoading } = useFetchData({
    model: 'site',
    filterField: 'status',
    filterValue: 'active',
  });
  const { data: tasksData, isLoading: tasksLoading } = useFetchData({
    model: 'task',
  });

  const payments = paymentsData?.data || [];
  const expenses = expensesData?.data || [];
  const activeSites = sitesData?.data || [];
  const tasks = tasksData?.data || [];

  const totalIncome = useMemo(
    () => payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
    [payments]
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    [expenses]
  );
  const netProfit = totalIncome - totalExpenses;

  const isLoading = paymentsLoading || expensesLoading || sitesLoading || tasksLoading;

  // 30-day breakdown
  const thirtyDayData = useMemo(() => {
    const days: Record<string, { date: string; income: number; expenses: number }> = {};
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA');
      days[key] = {
        date: d.toLocaleDateString('en', { day: '2-digit', month: 'short' }),
        income: 0,
        expenses: 0,
      };
    }

    payments.forEach((p: any) => {
      const key = new Date(p.date).toLocaleDateString('en-CA');
      if (days[key]) days[key].income += p.amount || 0;
    });

    expenses.forEach((e: any) => {
      const key = new Date(e.date).toLocaleDateString('en-CA');
      if (days[key]) days[key].expenses += e.amount || 0;
    });

    return Object.values(days);
  }, [payments, expenses]);

  // Category expense breakdown
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const cat = e.category || 'other';
      cats[cat] = (cats[cat] || 0) + (e.amount || 0);
    });

    return Object.entries(cats)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        percentage: totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, totalExpenses]);

  // Recent activity
  const recentActivity = useMemo(() => {
    const items: Array<{ id: string; type: string; title: string; date: string; amount?: number; category?: string }> = [];

    payments.forEach((p: any) =>
      items.push({
        id: p.id,
        type: 'payment',
        title: p.party || p.description || 'Payment',
        date: p.date || p.createdAt,
        amount: p.amount,
        category: p.mode,
      })
    );

    expenses.forEach((e: any) =>
      items.push({
        id: e.id,
        type: 'expense',
        title: e.title || 'Expense',
        date: e.date || e.createdAt,
        amount: e.amount,
        category: e.category,
      })
    );

    tasks.forEach((t: any) =>
      items.push({
        id: t.id,
        type: 'task',
        title: t.title || 'Task',
        date: t.createdAt,
        category: t.status,
      })
    );

    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [payments, expenses, tasks]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />;
      case 'expense':
        return <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <ListChecks className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'payment':
        return 'bg-emerald-500/10';
      case 'expense':
        return 'bg-red-500/10';
      default:
        return 'bg-blue-500/10';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Reports & Analytics</h2>
        <p className="text-sm text-muted-foreground">Financial overview and business insights</p>
      </div>

      {/* Financial overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome)}
          icon={DollarSign}
          trend="up"
          loading={paymentsLoading}
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          icon={TrendingDown}
          trend="down"
          loading={expensesLoading}
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(netProfit)}
          icon={TrendingUp}
          trend={netProfit >= 0 ? 'up' : 'down'}
          loading={paymentsLoading || expensesLoading}
        />
        <StatCard
          title="Active Sites"
          value={String(activeSites.length)}
          icon={Building2}
          trend="neutral"
          loading={sitesLoading}
        />
      </div>

      {/* 30-day breakdown chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">30-Day Income vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={thirtyDayData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={2}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'income' ? 'Income' : 'Expenses',
                  ]}
                />
                <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} name="income" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="expenses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Category breakdown + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Expense Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No expense data available</p>
            ) : (
              <div className="space-y-3">
                {categoryData.slice(0, 8).map((cat, index) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="font-medium">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{formatCurrency(cat.value)}</span>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {cat.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No recent activity</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityColor(item.type)}`}>
                      {getActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(item.date, 'relative')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.amount !== undefined && (
                        <span
                          className={`text-sm font-medium ${
                            item.type === 'payment' ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {item.type === 'payment' ? '+' : '-'}
                          {formatCurrency(item.amount)}
                        </span>
                      )}
                      {item.category && item.type === 'task' && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 capitalize">
                          {item.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
