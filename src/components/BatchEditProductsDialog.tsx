import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface License { id: string; fantasyName: string; legalName: string; }
interface Line { id: string; name: string; licenseId: string; }
interface ProductCategory { id: string; name: string; }

export function BatchEditProductsDialog({ selectedProductIds, lines, categories, licenses, onComplete }: { selectedProductIds: string[], lines: Line[], categories: ProductCategory[], licenses: License[], onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [lineId, setLineId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineId && !categoryId && !licenseId) {
      return toast.error('Selecione pelo menos um campo para alterar.');
    }

    setIsSaving(true);
    try {
      const updates: any = {};
      if (lineId && lineId !== 'none') updates.lineId = lineId;
      if (categoryId) updates.categoryId = categoryId === 'none' ? null : categoryId;
      if (licenseId) updates.licenseId = licenseId === 'none' ? null : licenseId;

      await Promise.all(selectedProductIds.map(id => 
        updateDoc(doc(db, 'products', id), updates)
      ));
      
      toast.success(`${selectedProductIds.length} produtos atualizados com sucesso!`);
      setOpen(false);
      setLineId('');
      setCategoryId('');
      setLicenseId('');
      onComplete();
    } catch (err) {
      toast.error('Erro ao atualizar produtos em lote.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={false} render={
        <button className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
          <Edit2 size={16} /> Editar Selecionados
        </button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edição em Lote</DialogTitle>
          <DialogDescription>
            Alterar campos para {selectedProductIds.length} produtos selecionados.
            Deixe em branco os campos que não deseja alterar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Licenciador</Label>
            <Select onValueChange={setLicenseId} value={licenseId}>
              <SelectTrigger>
                <SelectValue placeholder="Manter atual" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Remover Licenciador</SelectItem>
                {licenses.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.fantasyName || l.legalName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Linha</Label>
            <Select onValueChange={setLineId} value={lineId}>
              <SelectTrigger>
                <SelectValue placeholder="Manter atual" />
              </SelectTrigger>
              <SelectContent>
                {lines.filter(l => !licenseId || licenseId === 'none' || l.licenseId === licenseId).map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select onValueChange={setCategoryId} value={categoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Manter atual" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Remover Categoria</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? 'Salvando...' : 'Aplicar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
