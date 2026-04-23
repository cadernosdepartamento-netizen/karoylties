import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Edit2, Database } from 'lucide-react';
import { cn, sortOptions } from '@/lib/utils';

// Types
interface License { id: string; nomelicenciador: string; nomejurlicenciador: string; nomeagente?: string; descricaolicenciador?: string; }
interface Line { id: string; nomelinha: string; licenseId: string; }
interface ProductCategory { id: string; nomeCategoriaProduto: string; }
interface ProductionEntry {
  date: string;
  unitCost: number;
  quantity: number;
  totalValue: number;
  type: 'initial' | 'reprogramming';
}

interface Product { 
  id: string; 
  lineId: string; 
  name: string; 
  sku?: string; 
  categoryId?: string;
  licenseId?: string;
  launchYear?: number;
  ean?: string;
  productionHistory?: ProductionEntry[];
  avgUnitCost?: number;
  totalCostValue?: number;
  totalQuantityProduced?: number;
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
  
  const [history, setHistory] = useState<ProductionEntry[]>(product.productionHistory || [
    { date: '', unitCost: 0, quantity: 0, totalValue: 0, type: 'initial' }
  ]);

  const totals = React.useMemo(() => {
    const totalCostValue = history.reduce((sum, entry) => sum + (entry.unitCost * entry.quantity), 0);
    const totalQuantity = history.reduce((sum, entry) => sum + entry.quantity, 0);
    const avgUnitCost = totalQuantity > 0 ? totalCostValue / totalQuantity : 0;
    return { totalCostValue, totalQuantity, avgUnitCost };
  }, [history]);

  useEffect(() => {
    if (open) {
      setName(product.name || '');
      setLineId(product.lineId || '');
      setSku(product.sku || '');
      setCategoryId(product.categoryId || '');
      setLicenseId(product.licenseId || '');
      setLaunchYear(product.launchYear ? String(product.launchYear) : '');
      setEan(product.ean || '');
      setHistory(product.productionHistory && product.productionHistory.length > 0 
        ? product.productionHistory 
        : [{ date: '', unitCost: 0, quantity: 0, totalValue: 0, type: 'initial' }]
      );
    }
  }, [open, product]);

  const addReprogramming = () => {
    setHistory([...history, { 
      date: new Date().toISOString().split('T')[0], 
      unitCost: 0, 
      quantity: 0, 
      totalValue: 0, 
      type: 'reprogramming' 
    }]);
  };

  const removeEntry = (index: number) => {
    if (index === 0) return; // Cannot remove initial production
    setHistory(history.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof ProductionEntry, value: any) => {
    const newHistory = [...history];
    const entry = { ...newHistory[index], [field]: value };
    
    if (field === 'unitCost' || field === 'quantity') {
      entry.totalValue = Number(entry.unitCost) * Number(entry.quantity);
    }
    
    newHistory[index] = entry;
    setHistory(newHistory);
  };

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
        ean,
        productionHistory: history,
        avgUnitCost: totals.avgUnitCost,
        totalCostValue: totals.totalCostValue,
        totalQuantityProduced: totals.totalQuantity
      });
      toast.success('Produto atualizado com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao atualizar produto.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-slate-400 hover:text-blue-600")}>
          <Edit2 size={16} />
        </button>
      } />
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
          <DialogDescription>Atualize os dados e o histórico de produção do produto.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Select onValueChange={setLicenseId} value={licenseId || 'none'}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione...">
                    {licenseId === 'none' ? 'Nenhum' : (licenses.find(l => l.id === licenseId)?.nomelicenciador)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {sortOptions(licenses.map(l => ({ label: l.nomelicenciador || `ID: ${l.id.slice(0,5)}`, value: l.id }))).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linha *</Label>
              <Select onValueChange={setLineId} value={lineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione...">
                    {lines.find(l => l.id === lineId)?.nomelinha}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sortOptions(lines.filter(l => !licenseId || licenseId === 'none' || l.licenseId === licenseId).map(l => ({ label: l.nomelinha || `ID: ${l.id.slice(0,5)}`, value: l.id }))).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-6 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Código (SKU)</Label>
              <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Ex: 123456" />
            </div>
            <div className="space-y-2 col-span-4">
              <Label>Nome do Produto *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select onValueChange={setCategoryId} value={categoryId || 'none'}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione...">
                    {categoryId === 'none' ? 'Nenhuma' : (categories.find(c => c.id === categoryId)?.nomeCategoriaProduto)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {sortOptions(categories.map(c => ({ label: c.nomeCategoriaProduto || `ID: ${c.id.slice(0,5)}`, value: c.id }))).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano de Lançamento</Label>
              <Input type="number" value={launchYear} onChange={e => setLaunchYear(e.target.value)} placeholder="Ex: 2024" />
            </div>
            <div className="space-y-2">
              <Label>EAN</Label>
              <Input value={ean} onChange={e => setEan(e.target.value)} placeholder="Ex: 789123..." />
            </div>
          </div>

          <div className="border-t border-slate-100 my-4 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                 <Database size={16} className="text-blue-600" /> Histórico de Produção e Custos
              </h4>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Custo Médio</p>
                  <p className="text-sm font-bold text-blue-600">{totals.avgUnitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Investimento Total</p>
                  <p className="text-sm font-bold text-slate-900">{totals.totalCostValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {history.map((entry, index) => (
                <div key={index} className={cn(
                  "p-3 rounded-lg border relative group",
                  index === 0 ? "bg-blue-50/30 border-blue-100" : "bg-slate-50/30 border-slate-100"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                      {index === 0 ? 'Produção Inicial' : `Reprogramação #${index}`}
                    </span>
                    {index > 0 && (
                      <button 
                        type="button" 
                        onClick={() => removeEntry(index)}
                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-medium text-xs"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Data</Label>
                      <Input 
                        type="date" 
                        value={entry.date} 
                        onChange={(e) => updateEntry(index, 'date', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade</Label>
                      <Input 
                        type="number" 
                        value={entry.quantity} 
                        onChange={(e) => updateEntry(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Custo Unitário</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={entry.unitCost} 
                        onChange={(e) => updateEntry(index, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor Total</Label>
                      <div className="h-8 flex items-center px-2 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700">
                        {(entry.unitCost * entry.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button 
                type="button" 
                variant="outline" 
                onClick={addReprogramming}
                className="w-full border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 text-xs h-8"
              >
                + Adicionar Reprogramação
              </Button>
            </div>
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

