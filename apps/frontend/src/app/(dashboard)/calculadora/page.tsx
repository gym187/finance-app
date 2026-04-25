'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatBRL, formatPercent } from '@/lib/formatters';

interface ChartPoint {
  label: string;
  investido: number;
  juros: number;
}

function calcCompoundInterest(
  principal: number,
  monthlyContrib: number,
  annualRate: number,
  years: number
): { chartData: ChartPoint[]; finalBalance: number; totalInvested: number; totalInterest: number } {
  const monthlyRate = annualRate / 100 / 12;
  const chartData: ChartPoint[] = [{ label: 'Início', investido: Math.round(principal), juros: 0 }];

  let balance = principal;
  let totalInvested = principal;

  for (let year = 1; year <= years; year++) {
    for (let month = 1; month <= 12; month++) {
      balance = balance * (1 + monthlyRate) + monthlyContrib;
      totalInvested += monthlyContrib;
    }
    chartData.push({
      label: `Ano ${year}`,
      investido: Math.round(totalInvested),
      juros: Math.round(balance - totalInvested),
    });
  }

  return { chartData, finalBalance: balance, totalInvested, totalInterest: balance - totalInvested };
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$${(value / 1_000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
}

export default function CalculadoraPage() {
  const [principal, setPrincipal] = useState('10000');
  const [monthlyContrib, setMonthlyContrib] = useState('500');
  const [annualRate, setAnnualRate] = useState('12');
  const [years, setYears] = useState('10');

  const p = Math.max(parseFloat(principal) || 0, 0);
  const mc = Math.max(parseFloat(monthlyContrib) || 0, 0);
  const ar = Math.max(parseFloat(annualRate) || 0, 0);
  const y = Math.min(Math.max(parseInt(years) || 1, 1), 50);

  const { chartData, finalBalance, totalInvested, totalInterest } = useMemo(
    () => calcCompoundInterest(p, mc, ar, y),
    [p, mc, ar, y]
  );

  const returnPct = totalInvested > 0 ? (totalInterest / totalInvested) * 100 : 0;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold sm:text-2xl">Calculadora de Juros Compostos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Simule o crescimento do seu investimento ao longo do tempo.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Investimento inicial (R$)</label>
              <Input
                type="number"
                min="0"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="10000"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Aporte mensal (R$)</label>
              <Input
                type="number"
                min="0"
                value={monthlyContrib}
                onChange={(e) => setMonthlyContrib(e.target.value)}
                placeholder="500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Taxa de juros anual (%)</label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={annualRate}
                onChange={(e) => setAnnualRate(e.target.value)}
                placeholder="12"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Período (anos, máx. 50)</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                placeholder="10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 content-start">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Montante Final</p>
              <p className="mt-1 text-2xl font-bold text-primary">{formatBRL(finalBalance)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Investido</p>
              <p className="mt-1 text-2xl font-bold">{formatBRL(totalInvested)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Juros Acumulados</p>
              <p className="mt-1 text-2xl font-bold text-green-500">{formatBRL(totalInterest)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Rendimento</p>
              <p className="mt-1 text-2xl font-bold text-green-500">{formatPercent(returnPct)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução Patrimonial</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInvestido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorJuros" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12 }} width={70} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatBRL(value),
                  name === 'investido' ? 'Total Investido' : 'Juros',
                ]}
              />
              <Legend
                formatter={(value) => (value === 'investido' ? 'Total Investido' : 'Juros')}
              />
              <Area
                type="monotone"
                dataKey="investido"
                stackId="1"
                stroke="#6366f1"
                fill="url(#colorInvestido)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="juros"
                stackId="1"
                stroke="#22c55e"
                fill="url(#colorJuros)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
