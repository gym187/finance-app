import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Transaction, BudgetSummary } from '@finance-app/shared';

interface CategoryTotal {
  name: string;
  value: number;
  color: string;
}

export interface ExportPDFOptions {
  transactions: Transaction[];
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  includeCategoryTotals?: boolean;
  categoryData?: CategoryTotal[];
  includeBudgets?: boolean;
  budgetSummary?: BudgetSummary[];
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function exportReportPDF(opts: ExportPDFOptions) {
  const {
    transactions,
    startDate,
    endDate,
    totalIncome,
    totalExpense,
    includeCategoryTotals,
    categoryData,
    includeBudgets,
    budgetSummary,
  } = opts;

  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FinanceApp - Relatório Financeiro', 14, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Período: ${fmtDate(startDate)} a ${fmtDate(endDate)}`, 14, 30);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 36);

  // Summary box
  doc.setDrawColor(200);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, 42, 182, 24, 2, 2, 'FD');

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  const result = totalIncome - totalExpense;
  doc.setTextColor(22, 163, 74);
  doc.text(`Entradas: ${fmtBRL(totalIncome)}`, 20, 52);

  doc.setTextColor(220, 38, 38);
  doc.text(`Saídas: ${fmtBRL(totalExpense)}`, 82, 52);

  doc.setTextColor(result >= 0 ? 22 : 220, result >= 0 ? 163 : 38, result >= 0 ? 74 : 38);
  doc.text(`Resultado: ${fmtBRL(result)}`, 142, 52);

  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`${transactions.length} transações`, 20, 60);

  let currentY = 72;

  // Category totals section
  if (includeCategoryTotals && categoryData && categoryData.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Gastos por Categoria', 14, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [['Categoria', 'Total', '% do Total']],
      body: categoryData.map((c) => [
        c.name,
        fmtBRL(c.value),
        totalExpense > 0 ? `${((c.value / totalExpense) * 100).toFixed(1)}%` : '0%',
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Budget summary section
  if (includeBudgets && budgetSummary && budgetSummary.length > 0) {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Orçamentos', 14, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [['Categoria', 'Orçado', 'Gasto', 'Restante', '%']],
      body: budgetSummary.map((b) => [
        b.categoryName,
        fmtBRL(b.budgeted),
        fmtBRL(b.spent),
        fmtBRL(b.budgeted - b.spent),
        `${b.percentage.toFixed(0)}%`,
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [234, 179, 8], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const pctStr = data.cell.raw as string;
          const pct = parseFloat(pctStr);
          if (pct >= 100) data.cell.styles.textColor = [220, 38, 38];
          else if (pct >= 80) data.cell.styles.textColor = [234, 179, 8];
          else data.cell.styles.textColor = [22, 163, 74];
        }
      },
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Transactions table
  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Transações', 14, currentY);
  currentY += 4;

  const tableData = transactions.map((tx) => [
    new Date(tx.date).toLocaleDateString('pt-BR'),
    tx.description,
    tx.category?.name ?? '—',
    tx.type === 'INCOME' ? 'Entrada' : 'Saída',
    fmtBRL(Math.abs(Number(tx.amount))),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35 },
      3: { cellWidth: 22 },
      4: { cellWidth: 30, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.raw as string;
        if (val === 'Entrada') data.cell.styles.textColor = [22, 163, 74];
        else data.cell.styles.textColor = [220, 38, 38];
      }
      if (data.section === 'body' && data.column.index === 4) {
        const typeVal = tableData[data.row.index]?.[3];
        if (typeVal === 'Entrada') data.cell.styles.textColor = [22, 163, 74];
        else data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`relatorio-${startDate}-${endDate}.pdf`);
}
