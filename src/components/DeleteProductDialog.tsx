import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteProductDialogProps {
  productId: string;
  productName: string;
}

export function DeleteProductDialog({ productId, productName }: DeleteProductDialogProps) {
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      toast.success(`Produto "${productName}" excluído com sucesso!`);
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao excluir produto.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button 
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-slate-400 hover:text-red-600")}
          title="Excluir produto"
        >
          <Trash2 size={16} />
        </button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir Produto</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o produto <strong>{productName}</strong>? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete}>Confirmar Exclusão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
