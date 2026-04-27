import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';

// Define the exact interfaces locally if App.tsx can't export easily, or just use any/unknown and map fields.
// For the sake of simplicity, we'll map fields internally.

interface Product {
  id: string;
  lineId: string;
  name: string;
  sku?: string;
  categoryId?: string;
  licenseId?: string;
  launchYear?: number;
  ean?: string;
  costPrice?: number;
}

export function ImportSalesDialog({ products, collectionName = 'sales', buttonText = 'Importar Vendas' }: { products: Product[], collectionName?: string, buttonText?: string }) {
  const [open, setOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseExcelDate = (val: any) => {
    if (!val) return "";
    
    // Se for um objeto Date do JavaScript (SheetJS com cellDates: true)
    if (val instanceof Date) {
      // Usamos os componentes UTC para garantir consistência com o que o SheetJS extrai
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const d = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // Se for o serial do Excel (número)
    if (typeof val === 'number') {
      try {
        const date = XLSX.SSF.parse_date_code(val);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      } catch (e) {
        // Fallback robusto para o cálculo manual evitando UTC zero se possível
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
    
    if (typeof val === 'string') {
      const cleanVal = val.trim();
      // Formato DD/MM/YYYY
      const parts = cleanVal.split('/');
      if (parts.length === 3) {
        let y = parts[2];
        if (y.length === 2) y = "20" + y; // Assume 20xx para anos de 2 dígitos
        return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      // Formato MM/YYYY ou MM-YYYY
      const partsShort = cleanVal.split(/[\/\-]/);
      if (partsShort.length === 2) {
        let m = partsShort[0];
        let y = partsShort[1];
        // Inverte se o segundo parecer um mês e o primeiro um ano
        if (y.length <= 2 && m.length === 4) {
           [m, y] = [y, m];
        }
        if (y.length === 2) y = "20" + y;
        return `${y}-${m.padStart(2, '0')}-01`;
      }
      // Formato YYYY-MM-DD
      if (cleanVal.includes('-') && cleanVal.length >= 7) {
        return cleanVal.split('T')[0];
      }
    }
    return String(val);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const data = await file.arrayBuffer();
      // cellDates: true faz com que o SheetJS tente criar objetos Date para células de data
      const workbook = XLSX.read(data, { cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];
      setTotalRows(json.length);
      
      const batchList: any[] = [];
      let importedCount = 0;
      let notFoundCount = 0;

      let lastSku = "";
      let lastDate = "";
      let lastDescription = "";

      json.forEach(row => {
        // Helper specifically for this loop to handle aliases
        const getVal = (keys: string[]) => {
          const foundKey = Object.keys(row).find(k => 
            keys.some(key => k.trim().toLowerCase() === key.toLowerCase())
          );
          return foundKey ? row[foundKey] : undefined;
        };

        const skuRaw = getVal(["código sku", "codigo sku", "sku", "código", "codigo"]);
        const sku = skuRaw ? String(skuRaw).trim() : lastSku;
        if (!sku) return;
        lastSku = sku;

        // Encontra o produto correspondente
        const product = products.find(p => String(p.sku || "").trim() === sku);
        
        if (!product) {
          console.warn(`Produto não encontrado para o SKU: ${sku}`);
          notFoundCount++;
          return;
        }

        const dateRaw = getVal(["date", "data", "data da venda", "data venda", "venda"]);
        const monthRaw = getVal(["mês", "mes", "month", "competencia", "competência", "mês ref", "mes ref"]);
        const yearRaw = getVal(["ano", "year", "exercicio", "exercício", "ano ref"]);

        let date = "";
        if (dateRaw) {
          date = parseExcelDate(dateRaw);
        } else if (monthRaw && yearRaw) {
          const m = typeof monthRaw === 'number' ? monthRaw : parseInt(String(monthRaw));
          const y = typeof yearRaw === 'number' ? yearRaw : parseInt(String(yearRaw));
          if (!isNaN(m) && !isNaN(y)) {
             date = `${y}-${String(m).padStart(2, '0')}-01`;
          } else if (typeof monthRaw === 'string' && !isNaN(y)) {
             const mStr = monthRaw.toLowerCase();
             const monthMap: Record<string, string> = {
                'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
                'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
             };
             const key = mStr.substring(0, 3);
             if (monthMap[key]) {
               date = `${y}-${monthMap[key]}-01`;
             }
          }
        }
        
        if (date) lastDate = date;
        const currentData = date || lastDate;

        const descriptionRaw = getVal(["produto", "descrição", "descricao", "nome"]);
        const description = descriptionRaw ? String(descriptionRaw).trim() : (lastDescription || product.name);
        if (descriptionRaw) lastDescription = String(descriptionRaw).trim();

        // Improved number parsing function
        const parseNum = (val: any) => {
          if (val === undefined || val === null || val === '') return 0;
          if (typeof val === 'number') return val;
          const cleanVal = String(val).replace(/\s/g, '').trim();
          
          // If both . and , are present
          if (cleanVal.includes('.') && cleanVal.includes(',')) {
            const lastDot = cleanVal.lastIndexOf('.');
            const lastComma = cleanVal.lastIndexOf(',');
            return lastDot > lastComma 
              ? parseFloat(cleanVal.replace(/,/g, ''))
              : parseFloat(cleanVal.replace(/\./g, '').replace(',', '.'));
          }
          
          // If only comma
          if (cleanVal.includes(',')) {
            // If it's something like "1,000" it might be thousand separator in US
            // or decimal in BR. But in this context (sales in Brazil), 
            // single comma is almost always decimal.
            return parseFloat(cleanVal.replace(',', '.'));
          }

          // If only dot
          if (cleanVal.includes('.')) {
            // CRITICAL: In Brazil, many systems export numbers like "59.593" meaning "59593" (integer).
            // JS parseFloat handles "59.593" as 59.593 (decimal).
            // We check for thousand separator pattern: a dot followed by exactly 3 digits at the end
            // OR dots separating groups of 3.
            const parts = cleanVal.split('.');
            // If it matches pattern like X.YYY or X.YYY.ZZZ (all parts after first have 3 digits)
            const isThousandPattern = parts.length > 1 && parts.slice(1).every(p => p.length === 3);
            if (isThousandPattern) {
              return parseFloat(cleanVal.replace(/\./g, ''));
            }
            return parseFloat(cleanVal);
          }
          
          return parseFloat(cleanVal) || 0;
        };

        const saleData: any = {
          sku,
          description,
          quantity: parseNum(getVal(["quantidade", "qtd", "quantidade vendida", "qtde", "quant", "qtd vendida", "qtd. vendida"])),
          ean: String(getVal(["ean"]) || product.ean || '').trim(),
          date: currentData || new Date().toISOString().split('T')[0],
          
          // Campos inseridos a partir da base de produtos
          licenseId: product.licenseId || '',
          lineId: product.lineId,
          categoryId: product.categoryId || '',
          launchYear: product.launchYear || 0,
          costPrice: product.costPrice || 0,

          createdAt: serverTimestamp()
        };

        if (collectionName === 'fobsales') {
          // Input column aliases based on user request
          const unitPriceUSD = parseNum(getVal(["valor_unitario", "valor unitário", "valor unitario"]));
          const totalValueUSD = parseNum(getVal(["valor_total", "valor total", "vlr total"]));
          const icmsUSD = parseNum(getVal(["icms"]));
          const pisUSD = parseNum(getVal(["pis"]));
          const cofinsUSD = parseNum(getVal(["cofins"]));
          const ipiUSD = parseNum(getVal(["ipi"]));
          const netValueUSD = parseNum(getVal(["valor_liquido", "valor liquido", "valor líquido"]));
          const dollarRate = parseNum(getVal(["taxa_dolar", "taxa dolar", "taxa de dolar"])) || 1;

          saleData.invoice = String(getVal(["invoice", "data_invoice", "nf", "nota fiscal"]) || '').trim();
          saleData.fabricante = String(getVal(["fabricante", "manufacturer"]) || '').trim();
          saleData.dollarRate = dollarRate;
          
          // USD Fields
          saleData.valor_unitario_usd = unitPriceUSD;
          saleData.valor_total_usd = totalValueUSD;
          saleData.icms_usd = icmsUSD;
          saleData.pis_usd = pisUSD;
          saleData.cofins_usd = cofinsUSD;
          saleData.ipi_usd = ipiUSD;
          saleData.valor_liquido_usd = netValueUSD;

          // BRL Fields (Not calculated here anymore as per request)
          saleData.valor_unitario_brl = 0; // Or keep as is, but don't multiply
          saleData.valor_total_brl = 0;
          saleData.icms_brl = 0;
          saleData.pis_brl = 0;
          saleData.cofins_brl = 0;
          saleData.ipi_brl = 0;
          saleData.valor_liquido_brl = 0;

          // Keep standard fields for generic logic fallback if needed
          saleData.unitPrice = unitPriceUSD;
          saleData.totalValue = totalValueUSD;
          saleData.icms = icmsUSD;
          saleData.pis = pisUSD;
          saleData.cofins = cofinsUSD;
          saleData.ipi = ipiUSD;
          saleData.netValue = netValueUSD;
        } else {
          // Standard sales import (kept as is for compatibility)
          saleData.unitPrice = parseNum(getVal(["valor unitário", "valor unitario", "preço unitário", "vlr unit", "unit price", "preco unitario", "vlr unitario"]));
          saleData.totalValue = parseNum(getVal(["valor total", "vlr total", "total value", "total", "valor bruto", "vlr bruto"]));
          saleData.icms = parseNum(getVal(["icms", "imposto icms"]));
          saleData.pis = parseNum(getVal(["pis"]));
          saleData.cofins = parseNum(getVal(["cofins", "confis"]));
          saleData.ipi = parseNum(getVal(["ipi"]));
          saleData.netValue = parseNum(getVal(["valor liquido", "valor líquido", "vlr liquido", "vlr líquido", "net value"]));
        }

        batchList.push(saleData);
      });

      if (batchList.length > 0) {
        // Utilizando batch do firestore para inserções otimizadas (limite 500 por batch)
        const batches = [];
        for (let i = 0; i < batchList.length; i += 500) {
          batches.push(batchList.slice(i, i + 500));
        }

        for (const b of batches) {
          const batch = writeBatch(db);
          b.forEach(docData => {
            const docRef = doc(collection(db, collectionName));
            batch.set(docRef, docData);
            importedCount++;
          });
          await batch.commit();
          const progress = Math.min(Math.round((importedCount / json.length) * 100), 100);
          setImportProgress(progress);
        }

        toast.success(`${importedCount} vendas importadas com sucesso!`);
        if (notFoundCount > 0) {
           toast.warning(`${notFoundCount} SKUs na planilha não foram encontrados na base de produtos e foram ignorados.`);
        }
        setOpen(false);
      } else {
        toast.error("Nenhuma venda válida encontrada na planilha. Verifique a coluna 'código sku'.");
      }

    } catch (error: any) {
      console.error("Erro na importação:", error);
      if (error?.code === 'resource-exhausted' || (error?.message && error.message.includes('Quota exceeded'))) {
        toast.error("Cota do Firebase excedida (20.000 gravações/dia atingida). Aguarde o reset diário ou faça upgrade.", { duration: 6000 });
      } else {
        toast.error("Erro ao ler o arquivo ou salvar no banco.");
      }
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setTotalRows(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    try {
      let headers = [];
      let sampleData = [];

      if (collectionName === 'fobsales') {
        headers = [
          "sku", "produto", "quantidade", "valor_unitario", "valor_total", 
          "icms", "pis", "cofins", "ipi", "valor_liquido", 
          "ean", "data_invoice", "fabricante", "taxa_dolar"
        ];
        sampleData = [
          ["SKU-FOB", "Produto Importado", 10, 10.50, 105.00, 0, 0, 0, 0, 105.00, "1234567890123", "2026-01-01", "Importadora ABC", 5.45]
        ];
      } else {
        headers = [
          "código sku", "produto", "quantidade", "valor unitário", "valor total",
          "ICMS", "PIS", "CONFIS", "IPI", "Valor liquido", "EAN", "Data"
        ];
        sampleData = [
          ["SKU-NORMAL", "Produto Nacional", 10, 50.00, 500.00, 0, 0, 0, 0, 500.00, "1234567890123", "2026-01-01"]
        ];
      }
      
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template Vendas");
      
      XLSX.writeFile(workbook, "template_importacao_vendas.xlsx");
      toast.success("Template baixado com sucesso.");
    } catch (error) {
      console.error("Erro ao gerar template:", error);
      toast.error("Erro ao gerar template.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", className: "gap-2" })}>
          <Upload size={16} /> {buttonText}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Dados de Vendas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-500">
            {collectionName === 'fobsales' ? (
              <>
                Para <strong>FOB (Importados)</strong>, a planilha deve conter as seguintes colunas (valores em USD):<br/>
                <code className="text-xs bg-slate-100 p-1 rounded mt-2 block">
                  sku, produto, quantidade, valor_unitario, valor_total, icms, pis, cofins, ipi, valor_liquido, ean, data_invoice, fabricante, taxa_dolar
                </code>
              </>
            ) : (
              <>
                A planilha precisa conter as colunas:<br/>
                <code className="text-xs bg-slate-100 p-1 rounded mt-2 block">
                  código sku, produto, quantidade, valor unitário, valor total, ICMS, PIS, CONFIS, IPI, Valor liquido, EAN, Data
                </code>
              </>
            )}
          </p>
          <p className="text-sm text-slate-500">
            Os dados de Licenciador, Linha, Categoria, Ano lançamento e Preço de custo serão inseridos automaticamente com base no <strong>Código SKU</strong>.
          </p>
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-slate-50">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full mb-3"
            >
              <Upload size={16} className="mr-2" />
              {isImporting ? `Importando (${importProgress}%)...` : "Selecionar Planilha"}
            </Button>
            <Button 
              onClick={handleDownloadTemplate}
              variant="outline"
              disabled={isImporting}
              className="w-full"
            >
              <Download size={16} className="mr-2" />
              Baixar Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
