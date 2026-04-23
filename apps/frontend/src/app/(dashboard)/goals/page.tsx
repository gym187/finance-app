'use client';

import { useState } from 'react';
import { Plus, Target, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useGoals, useGoalMutations } from '@/hooks/useGoals';
import type { SavingsGoal } from '@/hooks/useGoals';
import { formatBRL, formatDate } from '@/lib/formatters';
import { GoalModal } from '@/components/goals/GoalModal';
import { ContributeModal } from '@/components/goals/ContributeModal';

export default function GoalsPage() {
  const { data: goals = [], isLoading } = useGoals();
  const { create, update, contribute, remove } = useGoalMutations();

  const [goalModal, setGoalModal] = useState<{ open: boolean; editing: SavingsGoal | null }>({
    open: false,
    editing: null,
  });
  const [contributeModal, setContributeModal] = useState<{ open: boolean; goal: SavingsGoal | null }>({
    open: false,
    goal: null,
  });

  const active = goals.filter((g) => !g.isCompleted);
  const completed = goals.filter((g) => g.isCompleted);

  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const handleSubmitGoal = async (data: unknown) => {
    if (goalModal.editing) {
      await update.mutateAsync({ id: goalModal.editing.id, data });
    } else {
      await create.mutateAsync(data);
    }
    setGoalModal({ open: false, editing: null });
  };

  const handleContribute = async (amount: number) => {
    if (!contributeModal.goal) return;
    await contribute.mutateAsync({ id: contributeModal.goal.id, amount });
    setContributeModal({ open: false, goal: null });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta meta?')) return;
    await remove.mutateAsync(id);
  };

  const getDaysLeft = (deadline: string | null) => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getMonthlyNeeded = (goal: SavingsGoal) => {
    if (!goal.deadline) return null;
    const remaining = goal.targetAmount - goal.currentAmount;
    const days = getDaysLeft(goal.deadline);
    if (!days || days <= 0) return null;
    const months = Math.max(1, Math.ceil(days / 30));
    return remaining / months;
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Metas de Poupança</h2>
          <p className="text-sm text-muted-foreground">Defina e acompanhe seus objetivos financeiros</p>
        </div>
        <Button size="sm" onClick={() => setGoalModal({ open: true, editing: null })}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Meta
        </Button>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Target className="h-4 w-4" />
                Metas ativas
              </div>
              <p className="text-2xl font-bold">{active.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                Total poupado
              </div>
              <p className="text-2xl font-bold text-green-600">{formatBRL(totalSaved)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">de {formatBRL(totalTarget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4" />
                Concluídas
              </div>
              <p className="text-2xl font-bold">{completed.length}</p>
              {overallPct > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{overallPct.toFixed(0)}% do total</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active goals */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Target className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">Nenhuma meta ativa</p>
            <p className="text-sm mt-1">Crie sua primeira meta de poupança para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((goal) => {
            const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0);
            const daysLeft = getDaysLeft(goal.deadline);
            const monthlyNeeded = getMonthlyNeeded(goal);
            const isUrgent = daysLeft !== null && daysLeft <= 30;
            const isOverdue = daysLeft !== null && daysLeft < 0;

            return (
              <Card key={goal.id} className="overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: goal.color ?? '#3b82f6' }} />
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {goal.icon && <span className="text-xl flex-shrink-0">{goal.icon}</span>}
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{goal.name}</p>
                        {goal.deadline && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className={`text-xs ${isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-muted-foreground'}`}>
                              {isOverdue
                                ? 'Prazo vencido'
                                : daysLeft === 0
                                ? 'Vence hoje'
                                : `${daysLeft} dias restantes`}
                              {' · '}{formatDate(goal.deadline)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setContributeModal({ open: true, goal })}
                      >
                        + Aportar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setGoalModal({ open: true, editing: goal })}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(goal.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{formatBRL(goal.currentAmount)}</span>
                      <span className="text-muted-foreground">de {formatBRL(goal.targetAmount)}</span>
                    </div>
                    <Progress value={pct} className="h-2" style={{ '--progress-color': goal.color ?? '#3b82f6' } as React.CSSProperties} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(1)}% concluído</span>
                      <span>Faltam {formatBRL(Math.max(0, goal.targetAmount - goal.currentAmount))}</span>
                    </div>
                  </div>

                  {monthlyNeeded !== null && monthlyNeeded > 0 && (
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      Poupe <span className="font-semibold text-foreground">{formatBRL(monthlyNeeded)}/mês</span> para atingir no prazo
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed goals */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Metas concluídas ({completed.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {completed.map((goal) => (
              <Card key={goal.id} className="opacity-70">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBRL(goal.currentAmount)} poupados</p>
                  </div>
                  <Badge variant="secondary" className="text-green-600">Concluída</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-500"
                    onClick={() => handleDelete(goal.id)}
                  >
                    Excluir
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <GoalModal
        open={goalModal.open}
        onClose={() => setGoalModal({ open: false, editing: null })}
        onSubmit={handleSubmitGoal}
        editing={goalModal.editing}
        isLoading={create.isPending || update.isPending}
      />

      <ContributeModal
        open={contributeModal.open}
        onClose={() => setContributeModal({ open: false, goal: null })}
        onSubmit={handleContribute}
        goal={contributeModal.goal}
        isLoading={contribute.isPending}
      />
    </div>
  );
}
