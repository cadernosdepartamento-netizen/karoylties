import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BatchDeleteProductsDialog({ selectedProductIds, onComplete }: { selectedProductIds: string[], onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(selectedProductIds.map(id => deleteDoc(doc(db, 'products', id))));
      toast.success(`${selectedProductIds.length} produtos excluídos com sucesso!`);
      setOpen(false);
      onComplete();
    } catch (error) {
      toast.error('Erro ao excluir produtos em lote.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button className={cn(buttonVariants({ variant: "destructive" }), "gap-2")}>
          <Trash2 size={16} /> Excluir Selecionados
        </button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exclusão em Lote</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir <strong>{selectedProductIds.length}</strong> produtos selecionados? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
