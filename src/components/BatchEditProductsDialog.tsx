import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface License { id: string; nomelicenciador: string; nomejurlicenciador: string; nomeagente?: string; descricaolicenciador?: string; }
interface Line { id: string; nomelinha: string; licenseId: string; }
interface ProductCategory { id: string; nomeCategoriaProduto: string; }

export function BatchEditProductsDialog({ selectedProductIds, lines, categories, licenses, onComplete }: { selectedProductIds: string[], lines: Line[], categories: ProductCategory[], licenses: License[], onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [lineId, setLineId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [ean, setEan] = useState('');
  const [launchYear, setLaunchYear] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineId && !categoryId && !licenseId && !name && !sku && !ean && !launchYear) {
      return toast.error('Selecione pelo menos um campo para alterar.');
    }

    setIsSaving(true);
    try {
      const updates: any = {};
      if (lineId && lineId !== 'none') updates.lineId = lineId;
      if (categoryId) updates.categoryId = categoryId === 'none' ? null : categoryId;
      if (licenseId) updates.licenseId = licenseId === 'none' ? null : licenseId;
      if (name) updates.name = name;
      if (sku) updates.sku = sku;
      if (ean) updates.ean = ean;
      if (launchYear) updates.launchYear = Number(launchYear);

      await Promise.all(selectedProductIds.map(id => 
        updateDoc(doc(db, 'products', id), updates)
      ));
      
      toast.success(`${selectedProductIds.length} produtos atualizados com sucesso!`);
      setOpen(false);
      setLineId('');
      setCategoryId('');
      setLicenseId('');
      setName('');
      setSku('');
      setEan('');
      setLaunchYear('');
      onComplete();
    } catch (err) {
      toast.error('Erro ao atualizar produtos em lote.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
          <Edit2 size={16} /> Editar Selecionados
        </button>
      } />
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edição em Lote</DialogTitle>
          <DialogDescription>
            Alterar campos para {selectedProductIds.length} produtos selecionados.
            Deixe em branco os campos que não deseja alterar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Select onValueChange={setLicenseId} value={licenseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Manter atual">
                    {licenseId === 'none' ? 'Remover Licenciador' : (licenses.find(l => l.id === licenseId)?.nomelicenciador)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Remover Licenciador</SelectItem>
                  {[...licenses].sort((a, b) => (a.nomelicenciador || '').localeCompare(b.nomelicenciador || '')).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nomelicenciador || `ID: ${l.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Linha</Label>
              <Select onValueChange={setLineId} value={lineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Manter atual">
                    {lines.find(l => l.id === lineId)?.nomelinha}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {lines.filter(l => !licenseId || licenseId === 'none' || l.licenseId === licenseId).sort((a, b) => (a.nomelinha || '').localeCompare(b.nomelinha || '')).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nomelinha || `ID: ${l.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="batch-sku">Código (SKU)</Label>
              <Input id="batch-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Manter atual" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-name">Nome do Produto</Label>
              <Input id="batch-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Manter atual" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select onValueChange={setCategoryId} value={categoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Manter atual">
                    {categoryId === 'none' ? 'Remover Categoria' : (categories.find(c => c.id === categoryId)?.nomeCategoriaProduto)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Remover Categoria</SelectItem>
                  {[...categories].sort((a,b) => (a.nomeCategoriaProduto || '').localeCompare(b.nomeCategoriaProduto || '')).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nomeCategoriaProduto || `ID: ${c.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-launchYear">Ano de Lançamento</Label>
              <Input id="batch-launchYear" type="number" value={launchYear} onChange={(e) => setLaunchYear(e.target.value)} placeholder="Manter atual" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-ean">EAN (Código de Barras)</Label>
            <Input id="batch-ean" value={ean} onChange={(e) => setEan(e.target.value)} placeholder="Manter atual" />
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
