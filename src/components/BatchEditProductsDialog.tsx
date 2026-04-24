import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  invoiceNumber?: string;
  unitCost: number;
  quantity: number;
  totalValue: number;
  ipi?: number;
  icms?: number;
  icmsst?: number;
  cofins?: number;
  pis?: number;
  totalTaxes?: number;
  netTotalCost?: number;
  type: 'initial' | 'reprogramming';
}

interface Product { 
  id: string; 
  lineId: string; 
  name: string; 
  productionHistory?: ProductionEntry[];
  avgUnitCost?: number;
  totalCostValue?: number;
  totalQuantityProduced?: number;
  totalTaxesGlobal?: number;
  netTotalGlobal?: number;
  [key: string]: any;
}

export function BatchEditProductsDialog({ selectedProductIds, products, lines, categories, licenses, onComplete }: { selectedProductIds: string[], products: Product[], lines: Line[], categories: ProductCategory[], licenses: License[], onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [lineId, setLineId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [ean, setEan] = useState('');
  const [launchYear, setLaunchYear] = useState('');
  const [custoUnitario, setCustoUnitario] = useState('');
  const [dataProducao, setDataProducao] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineId && !categoryId && !licenseId && !name && !sku && !ean && !launchYear && !custoUnitario && !dataProducao) {
      return toast.error('Selecione pelo menos um campo para alterar.');
    }

    setIsSaving(true);
    try {
      const baseUpdates: any = {};
      if (lineId && lineId !== 'none') baseUpdates.lineId = lineId;
      if (categoryId) baseUpdates.categoryId = categoryId === 'none' ? null : categoryId;
      if (licenseId) baseUpdates.licenseId = licenseId === 'none' ? null : licenseId;
      if (name) baseUpdates.name = name;
      if (sku) baseUpdates.sku = sku;
      if (ean) baseUpdates.ean = ean;
      if (launchYear) baseUpdates.launchYear = Number(launchYear);

      await Promise.all(selectedProductIds.map(async (id) => {
        const product = products.find(p => p.id === id);
        if (!product) return;

        const updates = { ...baseUpdates };
        
        // Handle production history update if cost/date provided
        if (custoUnitario || dataProducao) {
          const currentHistory: ProductionEntry[] = product.productionHistory && product.productionHistory.length > 0 
            ? [...product.productionHistory] 
            : [{ date: '', invoiceNumber: '', unitCost: 0, quantity: 0, totalValue: 0, ipi: 0, icms: 0, icmsst: 0, cofins: 0, pis: 0, totalTaxes: 0, netTotalCost: 0, type: 'initial' }];
          
          const firstEntry = { ...currentHistory[0] };
          if (custoUnitario) firstEntry.unitCost = parseFloat(custoUnitario);
          if (dataProducao) firstEntry.date = dataProducao;
          firstEntry.totalValue = firstEntry.unitCost * firstEntry.quantity;
          firstEntry.netTotalCost = firstEntry.totalValue - (firstEntry.totalTaxes || 0);

          currentHistory[0] = firstEntry;
          updates.productionHistory = currentHistory;

          // Recalculate totals
          const totalCostValue = currentHistory.reduce((sum, entry) => sum + (entry.totalValue || 0), 0);
          const totalQuantity = currentHistory.reduce((sum, entry) => sum + entry.quantity, 0);
          const avgUnitCost = totalQuantity > 0 ? totalCostValue / totalQuantity : 0;
          const totalTaxesGlobal = currentHistory.reduce((sum, entry) => sum + (entry.totalTaxes || 0), 0);
          const netTotalGlobal = currentHistory.reduce((sum, entry) => sum + (entry.netTotalCost || 0), 0);

          updates.totalCostValue = totalCostValue;
          updates.totalQuantityProduced = totalQuantity;
          updates.avgUnitCost = avgUnitCost;
          updates.totalTaxesGlobal = totalTaxesGlobal;
          updates.netTotalGlobal = netTotalGlobal;
        }

        await updateDoc(doc(db, 'products', id), updates);
      }));
      
      toast.success(`${selectedProductIds.length} produtos atualizados com sucesso!`);
      setOpen(false);
      // Reset states
      setLineId('');
      setCategoryId('');
      setLicenseId('');
      setName('');
      setSku('');
      setEan('');
      setLaunchYear('');
      setCustoUnitario('');
      setDataProducao('');
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
                  {sortOptions(licenses.map(l => ({ label: l.nomelicenciador || `ID: ${l.id.slice(0,5)}`, value: l.id }))).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                  {sortOptions(lines.filter(l => !licenseId || licenseId === 'none' || l.licenseId === licenseId).map(l => ({ label: l.nomelinha || `ID: ${l.id.slice(0,5)}`, value: l.id }))).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="batch-sku">Código (SKU)</Label>
              <Input id="batch-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Manter atual" />
            </div>
            <div className="space-y-2 col-span-4">
              <Label htmlFor="batch-name">Nome do Produto</Label>
              <Input id="batch-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Manter atual" />
            </div>
          </div>

          <div className="grid grid-cols-6 gap-4 mt-4">
            <div className="space-y-2 col-span-2">
              <Label>Categoria</Label>
              <Select onValueChange={setCategoryId} value={categoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Manter atual">
                    {categoryId === 'none' ? 'Remover Categoria' : (categories.find(c => c.id === categoryId)?.nomeCategoriaProduto)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Remover Categoria</SelectItem>
                  {sortOptions(categories.map(c => ({ label: c.nomeCategoriaProduto || `ID: ${c.id.slice(0,5)}`, value: c.id }))).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="batch-launchYear">Ano de Lançamento</Label>
              <Input id="batch-launchYear" type="number" value={launchYear} onChange={(e) => setLaunchYear(e.target.value)} placeholder="Manter atual" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="batch-ean">EAN</Label>
              <Input id="batch-ean" value={ean} onChange={(e) => setEan(e.target.value)} placeholder="Manter atual" />
            </div>
          </div>

          <div className="border-t border-slate-100 my-4 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2 text-blue-600">
               <Database size={16} /> Custos e Produção (Inicial)
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batch-custo">Custo Unitário (R$)</Label>
                <Input 
                  id="batch-custo" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={custoUnitario} 
                  onChange={(e) => setCustoUnitario(Math.max(0, parseFloat(e.target.value) || 0).toString())} 
                  placeholder="Manter atual"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-dataprod">Data Produção</Label>
                <Input 
                  id="batch-dataprod" 
                  type="date" 
                  value={dataProducao} 
                  onChange={(e) => setDataProducao(e.target.value)} 
                  className="h-9"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-2">* Atualizar o custo inicial recalcula o custo médio de cada item.</p>
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
