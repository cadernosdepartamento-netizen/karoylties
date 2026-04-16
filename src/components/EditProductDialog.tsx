import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
interface Product { 
  id: string; 
  lineId: string; 
  name: string; 
  sku?: string; 
  categoryId?: string;
  licenseId?: string;
  launchYear?: number;
  ean?: string;
}

export function EditProductDialog({ product, lines, categories, licenses }: { product: Product, lines: Line[], categories: ProductCategory[], licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name || '');
  const [lineId, setLineId] = useState(product.lineId || '');
  const [sku, setSku] = useState(product.sku || '');
  const [categoryId, setCategoryId] = useState(product.categoryId || '');
  const [licenseId, setLicenseId] = useState(product.licenseId || '');
  const [launchYear, setLaunchYear] = useState(product.launchYear ? String(product.launchYear) : '');
  const [ean, setEan] = useState(product.ean || '');

  useEffect(() => {
    if (open) {
      setName(product.name || '');
      setLineId(product.lineId || '');
      setSku(product.sku || '');
      setCategoryId(product.categoryId || '');
      setLicenseId(product.licenseId || '');
      setLaunchYear(product.launchYear ? String(product.launchYear) : '');
      setEan(product.ean || '');
    }
  }, [open, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineId) return toast.error('Selecione uma linha.');
    try {
      await updateDoc(doc(db, 'products', product.id), { 
        name, 
        lineId, 
        sku, 
        categoryId: categoryId === 'none' ? null : categoryId,
        licenseId: licenseId === 'none' ? null : licenseId,
        launchYear: launchYear ? Number(launchYear) : null,
        ean
      });
      toast.success('Produto atualizado com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao atualizar produto.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={false} render={
        <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-slate-400 hover:text-blue-600")}>
          <Edit2 size={16} />
        </button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
          <DialogDescription>Atualize os dados do produto.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Select onValueChange={setLicenseId} value={licenseId || 'none'}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {licenses.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.fantasyName || l.legalName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linha *</Label>
              <Select onValueChange={setLineId} value={lineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {lines.filter(l => !licenseId || licenseId === 'none' || l.licenseId === licenseId).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código (SKU)</Label>
              <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Ex: 123456" />
            </div>
            <div className="space-y-2">
              <Label>Nome do Produto *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select onValueChange={setCategoryId} value={categoryId || 'none'}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano de Lançamento</Label>
              <Input type="number" value={launchYear} onChange={e => setLaunchYear(e.target.value)} placeholder="Ex: 2024" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>EAN (Código de Barras)</Label>
            <Input value={ean} onChange={e => setEan(e.target.value)} placeholder="Ex: 7891234567890" />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Salvar Alterações</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
