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
import { cn } from '@/lib/utils';

// Types
interface License { id: string; nomelicenciador: string; nomejurlicenciador: string; nomeagente?: string; descricaolicenciador?: string; }
interface Line { id: string; nomelinha: string; licenseId: string; }
interface ProductCategory { id: string; nomeCategoriaProduto: string; }
interface Product { 
  id: string; 
  lineId: string; 
  name: string; 
  sku?: string; 
  categoryId?: string;
  licenseId?: string;
  launchYear?: number;
  ean?: string;
  custo_unitario?: number;
  quantidade_produzida?: number;
  data_producao?: string;
  quantidade_reprogramada?: number;
  data_reprogramacao?: string;
  valor_total_custo_producao?: number;
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
  const [custoUnitario, setCustoUnitario] = useState<string>(String(product.custo_unitario || 0));
  const [qtdProduzida, setQtdProduzida] = useState<string>(String(product.quantidade_produzida || 0));
  const [dataProducao, setDataProducao] = useState(product.data_producao || '');
  const [qtdReprogramada, setQtdReprogramada] = useState<string>(String(product.quantidade_reprogramada || 0));
  const [dataReprogramacao, setDataReprogramacao] = useState(product.data_reprogramacao || '');

  const valorTotalCustoProducao = React.useMemo(() => {
    const custo = parseFloat(custoUnitario) || 0;
    const qtdProv = parseInt(qtdProduzida) || 0;
    const qtdRepr = parseInt(qtdReprogramada) || 0;
    const finalQtd = qtdRepr > 0 ? qtdRepr : qtdProv;
    return finalQtd * custo;
  }, [custoUnitario, qtdProduzida, qtdReprogramada]);

  useEffect(() => {
    if (open) {
      setName(product.name || '');
      setLineId(product.lineId || '');
      setSku(product.sku || '');
      setCategoryId(product.categoryId || '');
      setLicenseId(product.licenseId || '');
      setLaunchYear(product.launchYear ? String(product.launchYear) : '');
      setEan(product.ean || '');
      setCustoUnitario(String(product.custo_unitario || 0));
      setQtdProduzida(String(product.quantidade_produzida || 0));
      setDataProducao(product.data_producao || '');
      setQtdReprogramada(String(product.quantidade_reprogramada || 0));
      setDataReprogramacao(product.data_reprogramacao || '');
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
        ean,
        custo_unitario: parseFloat(custoUnitario) || 0,
        quantidade_produzida: parseInt(qtdProduzida) || 0,
        data_producao: dataProducao || null,
        quantidade_reprogramada: parseInt(qtdReprogramada) || 0,
        data_reprogramacao: dataReprogramacao || null,
        valor_total_custo_producao: valorTotalCustoProducao
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
                  <SelectValue placeholder="Selecione...">
                    {licenseId === 'none' ? 'Nenhum' : (licenses.find(l => l.id === licenseId)?.nomelicenciador)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {[...licenses].sort((a, b) => (a.nomelicenciador || a.id).localeCompare(b.nomelicenciador || b.id)).map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nomelicenciador || `ID: ${l.id.slice(0,5)}`}
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
                  {lines.filter(l => !licenseId || licenseId === 'none' || l.licenseId === licenseId).sort((a, b) => (a.nomelinha || a.id).localeCompare(b.nomelinha || b.id)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nomelinha || `ID: ${l.id.slice(0,5)}`}</SelectItem>
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

          <div className="grid grid-cols-6 gap-4 mt-4">
            <div className="space-y-2 col-span-2">
              <Label>Categoria</Label>
              <Select onValueChange={setCategoryId} value={categoryId || 'none'}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione...">
                    {categoryId === 'none' ? 'Nenhuma' : (categories.find(c => c.id === categoryId)?.nomeCategoriaProduto)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {[...categories].sort((a, b) => (a.nomeCategoriaProduto || a.id).localeCompare(b.nomeCategoriaProduto || b.id)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nomeCategoriaProduto || `ID: ${c.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Ano de Lançamento</Label>
              <Input type="number" value={launchYear} onChange={e => setLaunchYear(e.target.value)} placeholder="Ex: 2024" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>EAN (Código de Barras)</Label>
              <Input value={ean} onChange={e => setEan(e.target.value)} placeholder="Ex: 7891234567890" />
            </div>
          </div>

          <div className="border-t border-slate-100 my-4 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
               <Database size={16} className="text-blue-600" /> Custos e Produção
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo Unitário (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={custoUnitario} 
                  onChange={(e) => setCustoUnitario(Math.max(0, parseFloat(e.target.value) || 0).toString())} 
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Total Custo</Label>
                <div className="h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-md font-semibold text-blue-700 text-sm">
                  {valorTotalCustoProducao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <Label>Qtd Produzida</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={qtdProduzida} 
                  onChange={(e) => setQtdProduzida(Math.max(0, parseInt(e.target.value) || 0).toString())} 
                />
              </div>
              <div className="space-y-2">
                <Label>Data Produção</Label>
                <Input 
                  type="date" 
                  value={dataProducao} 
                  onChange={(e) => setDataProducao(e.target.value)} 
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <Label>Qtd Reprogramada</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={qtdReprogramada} 
                  onChange={(e) => setQtdReprogramada(Math.max(0, parseInt(e.target.value) || 0).toString())} 
                />
              </div>
              <div className="space-y-2">
                <Label>Data Reprogramação</Label>
                <Input 
                  type="date" 
                  value={dataReprogramacao} 
                  onChange={(e) => setDataReprogramacao(e.target.value)} 
                  className="h-9"
                />
              </div>
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
