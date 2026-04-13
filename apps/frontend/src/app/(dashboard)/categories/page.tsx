'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
} from '@/hooks/useCategories';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Category } from '@finance-app/shared';
import { IconPicker, getIconComponent } from '@/components/IconPicker';

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#f97316', '#eab308',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#6b7280',
];

const catSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  color: z.string().optional(),
  icon: z.string().optional(),
});
type CatForm = z.infer<typeof catSchema>;

export default function CategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<CatForm>({ resolver: zodResolver(catSchema), defaultValues: { color: '#3b82f6' } });

  const openCreate = () => {
    setEditCat(null);
    reset({ color: '#3b82f6' });
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    reset({ name: cat.name, color: cat.color ?? '#6b7280', icon: cat.icon ?? '' });
    setShowForm(true);
  };

  const onSubmit = async (data: CatForm) => {
    if (editCat) {
      await updateCat.mutateAsync({ id: editCat.id, data });
    } else {
      await createCat.mutateAsync(data);
    }
    setShowForm(false);
    reset();
  };

  const selectedColor = watch('color');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Categorias</h2>
          <p className="text-sm text-muted-foreground">{categories.length} categorias cadastradas</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          : categories.map((cat) => {
              const CatIcon = getIconComponent(cat.icon);
              return (
              <Card key={cat.id} className="group">
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white text-lg font-bold"
                    style={{ background: cat.color ?? '#6b7280' }}
                  >
                    {CatIcon ? <CatIcon className="h-5 w-5" /> : cat.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{cat.color}</p>
                  </div>
                  <div className="flex gap-1 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteCat.mutate(cat.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nome</label>
              <Input {...register('name')} placeholder="Ex: Alimentação" />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue('color', c)}
                    className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      borderColor: selectedColor === c ? 'hsl(var(--foreground))' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Ícone</label>
              <IconPicker value={watch('icon')} onChange={(v) => setValue('icon', v)} />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={createCat.isPending || updateCat.isPending}>
                {editCat ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
