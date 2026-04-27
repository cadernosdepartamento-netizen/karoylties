import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Edit2 } from 'lucide-react';

export function BatchEditSalesDialog({ selectedSaleIds, collectionName, licenses, lines, categories, onComplete }: { selectedSaleIds: string[], collectionName: string, licenses: any[], lines: any[], categories: any[], onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [licenseId, setLicenseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lineId, setLineId] = useState('');
  const [date, setDate] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [totalTaxes, setTotalTaxes] = useState('');
  const [netValue, setNetValue] = useState('');
  const [invoice, setInvoice] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isAnySelected = licenseId || categoryId || lineId || date || sku || description || quantity || exchangeRate || unitPrice || totalValue || totalTaxes || netValue || invoice || manufacturer;
    if (!isAnySelected) {
      return toast.error('Selecione pelo menos um campo para alterar.');
    }

    setIsSaving(true);
    try {
      const updates: any = {};
      if (licenseId) updates.licenseId = licenseId;
      if (categoryId) updates.categoryId = categoryId;
      if (lineId) updates.lineId = lineId;
      if (date) updates.date = date;
      if (sku) updates.sku = sku;
      if (description) updates.description = description;
      if (quantity) updates.quantity = Number(quantity);
      if (exchangeRate) updates.exchangeRate = Number(exchangeRate);
      if (unitPrice) updates.unitPrice = Number(unitPrice);
      if (totalValue) updates.totalValue = Number(totalValue);
      if (totalTaxes) updates.totalTaxes = Number(totalTaxes);
      if (netValue) updates.netValue = Number(netValue);
      if (invoice) updates.invoice = invoice;
      if (manufacturer) updates.manufacturer = manufacturer;

      const batch = writeBatch(db);
      selectedSaleIds.forEach(id => {
        batch.update(doc(db, collectionName, id), updates);
      });
      await batch.commit();
      
      toast.success(`${selectedSaleIds.length} vendas atualizadas com sucesso!`);
      setOpen(false);
      onComplete();
    } catch (err) {
      toast.error('Erro ao atualizar vendas em lote.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className="h-7 text-xs gap-2 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 font-medium transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />}>
        <Edit2 size={14} /> Editar {selectedSaleIds.length} Selecionados
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edição em Lote de Vendas</DialogTitle>
          <DialogDescription>
            Alterar campos para {selectedSaleIds.length} venda(s). Deixe em branco para não alterar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 pt-4">
          <div className="space-y-1">
            <Label>Licenciador</Label>
            <Select onValueChange={setLicenseId} value={licenseId}>
              <SelectTrigger><SelectValue placeholder="Manter atual" /></SelectTrigger>
              <SelectContent>
                {licenses.map(l => <SelectItem key={l.id} value={l.id}>{l.nomelicenciador}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Linha</Label>
            <Select onValueChange={setLineId} value={lineId}>
              <SelectTrigger><SelectValue placeholder="Manter atual" /></SelectTrigger>
              <SelectContent>
                {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.nomelinha}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select onValueChange={setCategoryId} value={categoryId}>
              <SelectTrigger><SelectValue placeholder="Manter atual" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.nomeCategoriaProduto}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Quantidade</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Taxa Dólar</Label>
            <Input type="number" step="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Valor Unitário</Label>
            <Input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Valor Total</Label>
            <Input type="number" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Total Impostos</Label>
            <Input type="number" step="0.01" value={totalTaxes} onChange={(e) => setTotalTaxes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Total Líquido</Label>
            <Input type="number" step="0.01" value={netValue} onChange={(e) => setNetValue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Invoice</Label>
            <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fabricante</Label>
            <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </div>

          <div className="col-span-2 flex justify-end gap-2 pt-4">
             <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
             <Button type="submit" disabled={isSaving}>
               {isSaving ? 'Salvando...' : 'Aplicar Alterações'}
             </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
