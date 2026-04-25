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
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

interface StatCardProps {
  label: string;
  value: string;
  valueClass?: string;
}

function StatCard({ label, value, valueClass = '' }: StatCardProps) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4 sm:p-6">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</p>
        <p className={`mt-1 truncate text-base font-bold sm:text-xl ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  step?: string;
  min?: string;
  max?: string;
}

function Field({ label, value, onChange, placeholder, step, min, max }: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
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
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-xl font-semibold sm:text-2xl">Calculadora de Juros Compostos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Simule o crescimento do seu investimento ao longo do tempo.
        </p>
      </div>

      {/* Inputs + resultado lado a lado no lg, empilhados no mobile */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base">Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {/* No mobile: 2 inputs por linha para economizar espaço vertical */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Field
                label="Investimento inicial (R$)"
                value={principal}
                onChange={setPrincipal}
                placeholder="10000"
                min="0"
              />
              <Field
                label="Aporte mensal (R$)"
                value={monthlyContrib}
                onChange={setMonthlyContrib}
                placeholder="500"
                min="0"
              />
              <Field
                label="Taxa de juros anual (%)"
                value={annualRate}
                onChange={setAnnualRate}
                placeholder="12"
                min="0"
                step="0.1"
              />
              <Field
                label="Período (anos, máx. 50)"
                value={years}
                onChange={setYears}
                placeholder="10"
                min="1"
                max="50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Cards de resultado */}
        <div className="grid grid-cols-2 gap-3 content-start sm:gap-4">
          <StatCard label="Montante Final" value={formatBRL(finalBalance)} valueClass="text-primary" />
          <StatCard label="Total Investido" value={formatBRL(totalInvested)} />
          <StatCard label="Juros Acumulados" value={formatBRL(totalInterest)} valueClass="text-green-500" />
          <StatCard label="Rendimento" value={formatPercent(returnPct)} valueClass="text-green-500" />
        </div>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução Patrimonial</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="h-[220px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
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
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatBRL(value),
                    name === 'investido' ? 'Total Investido' : 'Juros',
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs">{value === 'investido' ? 'Total Investido' : 'Juros'}</span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="investido"
                  stackId="1"
                  stroke="#6366f1"
                  fill="url(#colorInvestido)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="juros"
                  stackId="1"
                  stroke="#22c55e"
                  fill="url(#colorJuros)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
