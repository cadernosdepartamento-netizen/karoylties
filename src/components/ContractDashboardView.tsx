import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown } from 'lucide-react';
import { Contract } from '@/types'; // Assuming types are in a types.ts, check if I need to define them here.

export function ContractDashboardView({ contract }: { contract: Contract }) {
  return (
    <div className="w-full h-full bg-white">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{contract.licenseName}</h1>
          <p className="text-sm text-slate-500">Contrato: {contract.contractNumber}</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
                <Download size={16} /> Exportar relatório
            </Button>
            <div className="border rounded px-3 py-1 text-sm bg-white cursor-pointer flex items-center gap-2">
                Ano 1 (01/07/25 - 30/06/26) <ChevronDown size={14} />
            </div>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
            { title: "Royalties reportados", value: "R$ 2.656.935,57", sub: "Acumulado no período", color: "text-orange-600" },
            { title: "Programação de pagamentos", value: "R$ 4.131.350,00", sub: "Agendado", color: "text-purple-600" },
            { title: "Histórico de pagamentos", value: "R$ 1.983.048,00", sub: "Pago", color: "text-blue-600" },
            { title: "Saldo de royalties", value: "-R$ 1.179.318,43", sub: "Saldo excedente", color: "text-red-600" },
        ].map((card, i) => (
            <Card key={i}>
                <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-slate-500 font-medium">{card.title}</p>
                    <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                    <p className="text-[10px] text-slate-400">{card.sub}</p>
                </CardContent>
            </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="visao-geral">
        <TabsList>
            <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
            <TabsTrigger value="royalties">Royalties reportados</TabsTrigger>
            <TabsTrigger value="programacao">Programação de pagamentos</TabsTrigger>
            <TabsTrigger value="historico">Histórico de pagamentos</TabsTrigger>
            <TabsTrigger value="analises">Análises</TabsTrigger>
        </TabsList>
        <TabsContent value="visao-geral" className="mt-4">
            {/* Dashboard grid */}
            <div className="grid grid-cols-3 gap-6">
                <Card className="col-span-2">
                    <CardContent className="p-6">
                        <h3 className="font-bold text-sm mb-4">Evolução de royalties (em BRL)</h3>
                        <div className="h-48 bg-slate-100 flex items-center justify-center rounded">
                           {/* Replace with Chart */}
                           Chart Placeholder
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <h3 className="font-bold text-sm mb-4">Resumo financeiro (BRL)</h3>
                        {/* Summary details */}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
        {/* Other tabs */}
      </Tabs>
    </div>
  );
}
