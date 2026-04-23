'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatBRL } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Category } from '@finance-app/shared';

interface ParsedRow {
  index: number;
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  suggestedCategoryId: number | null;
  isDuplicate: boolean;
  error?: string;
}

interface RowState extends ParsedRow {
  categoryId: number | null;
  skip: boolean;
}

type Step = 'upload' | 'preview' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rows, setRows] = useState<RowState[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useCategories();
  const qc = useQueryClient();

  const reset = () => {
    setStep('upload');
    setFile(null);
    setRows([]);
    setParseError('');
    setImportedCount(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParsing(true);
    setParseError('');
    try {
      const res = await api.csvImport.parse(f);
      if (!res.success) throw new Error(res.error ?? 'Erro ao processar CSV');

      const parsed: ParsedRow[] = res.data.rows;
      setRows(parsed.map((r) => ({
        ...r,
        categoryId: r.suggestedCategoryId,
        skip: r.isDuplicate || !!r.error,
      })));
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const validRows = rows.filter((r) => !r.skip && !r.error && r.categoryId);
  const skippedCount = rows.filter((r) => r.skip).length;
  const errorCount = rows.filter((r) => !!r.error).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;
  const missingCat = rows.filter((r) => !r.skip && !r.error && !r.categoryId).length;

  const handleConfirm = async () => {
    if (validRows.length === 0) return;
    setConfirming(true);
    try {
      const payload = validRows.map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId!,
      }));
      const res = await api.csvImport.confirm(payload) as { success: boolean; data: { imported: number } };
      if (!res.success) throw new Error('Erro ao importar');
      setImportedCount(res.data.imported);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setStep('done');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro ao importar');
    } finally {
      setConfirming(false);
    }
  };

  const setCat = (index: number, catId: number) => {
    setRows((prev) => prev.map((r) => r.index === index ? { ...r, categoryId: catId } : r));
  };

  const toggleSkip = (index: number) => {
    setRows((prev) => prev.map((r) => r.index === index ? { ...r, skip: !r.skip } : r));
  };

  const toggleType = (index: number) => {
    setRows((prev) => prev.map((r) =>
      r.index === index ? { ...r, type: r.type === 'INCOME' ? 'EXPENSE' : 'INCOME' } : r
    ));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Extrato CSV
          </DialogTitle>
        </DialogHeader>

        {/* ── Step: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="flex flex-col gap-4 py-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors',
                dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
              )}
            >
              {parsing ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="font-medium">{parsing ? 'Processando...' : 'Arraste o arquivo ou clique para selecionar'}</p>
                <p className="text-sm text-muted-foreground mt-1">Aceita arquivos .csv (máx. 5MB)</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {parseError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {parseError}
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Formatos suportados</p>
              <p>• Separador: vírgula (,) ou ponto-e-vírgula (;)</p>
              <p>• Colunas detectadas automaticamente por nome: <em>data, descrição, valor, tipo</em></p>
              <p>• Datas: dd/mm/aaaa, dd-mm-aaaa ou aaaa-mm-dd</p>
              <p>• Valores: formato brasileiro (1.234,56) ou americano (1234.56)</p>
              <p>• Tipo inferido pelo sinal do valor se não houver coluna de tipo</p>
            </div>
          </div>
        )}

        {/* ── Step: Preview ─────────────────────────────────────────────── */}
        {step === 'preview' && (
          <>
            {/* Summary bar */}
            <div className="flex flex-wrap gap-2 py-1">
              <Badge variant="secondary">{rows.length} linhas lidas</Badge>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {validRows.length} para importar
              </Badge>
              {duplicateCount > 0 && (
                <Badge variant="secondary" className="text-amber-600">{duplicateCount} duplicadas</Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive">{errorCount} com erro</Badge>
              )}
              {missingCat > 0 && (
                <Badge variant="destructive">{missingCat} sem categoria</Badge>
              )}
            </div>

            {parseError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">
                <AlertTriangle className="h-4 w-4" /> {parseError}
              </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto rounded-lg border min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    <th className="p-2 text-left w-8"></th>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-left min-w-[140px]">Categoria</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.index}
                      className={cn(
                        'border-t',
                        row.skip ? 'opacity-40' : '',
                        row.error ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      )}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!row.skip}
                          disabled={!!row.error}
                          onChange={() => toggleSkip(row.index)}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {row.date ? new Date(row.date).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="p-2 max-w-[180px] truncate">{row.description || '—'}</td>
                      <td className="p-2">
                        {!row.error && (
                          <button
                            onClick={() => toggleType(row.index)}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold transition',
                              row.type === 'INCOME'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            )}
                          >
                            {row.type === 'INCOME' ? 'Entrada' : 'Saída'}
                          </button>
                        )}
                      </td>
                      <td className={cn('p-2 text-right font-semibold whitespace-nowrap', row.type === 'INCOME' ? 'text-green-600' : 'text-red-500')}>
                        {row.error ? '—' : `${row.type === 'INCOME' ? '+' : '-'}${formatBRL(row.amount)}`}
                      </td>
                      <td className="p-2">
                        {row.error ? (
                          <span className="text-red-500">{row.error}</span>
                        ) : (
                          <Select
                            value={row.categoryId?.toString() ?? ''}
                            onValueChange={(v) => setCat(row.index, parseInt(v, 10))}
                            disabled={row.skip}
                          >
                            <SelectTrigger className="h-7 text-xs w-full">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(categories as Category[]).map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()}>
                                  <span className="flex items-center gap-1.5">
                                    {c.color && (
                                      <span className="h-2 w-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: c.color }} />
                                    )}
                                    {c.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {row.error ? (
                          <span title={row.error}><AlertTriangle className="h-3.5 w-3.5 text-red-500 mx-auto" /></span>
                        ) : row.isDuplicate ? (
                          <span title="Possível duplicata"><AlertTriangle className="h-3.5 w-3.5 text-amber-500 mx-auto" /></span>
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button
                onClick={handleConfirm}
                disabled={validRows.length === 0 || missingCat > 0 || confirming}
              >
                {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Importar {validRows.length} transações
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: Done ─────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div>
              <p className="text-xl font-bold">{importedCount} transações importadas!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {skippedCount > 0 && `${skippedCount} linhas foram ignoradas.`}
              </p>
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
