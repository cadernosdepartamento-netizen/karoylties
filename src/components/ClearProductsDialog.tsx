import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ClearProductsDialog() {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClear = async () => {
    setIsDeleting(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const docs = querySnapshot.docs;
      
      if (docs.length === 0) {
        toast.error('Não há produtos para apagar.');
        setOpen(false);
        return;
      }

      // Delete in batches of 500 (Firestore limit)
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach((d) => {
          batch.delete(doc(db, 'products', d.id));
        });
        await batch.commit();
      }

      toast.success(`${docs.length} produtos apagados com sucesso!`);
      setOpen(false);
    } catch (error) {
      console.error('Erro ao apagar produtos:', error);
      toast.error('Erro ao apagar produtos base.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <Button variant="outline" className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100 h-9">
          <Trash2 size={18} className="mr-2" /> Apagar Base
        </Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="text-red-500" />
            Apagar Base de Produtos
          </DialogTitle>
          <DialogDescription>
            Esta ação é IRREVERSÍVEL. Todos os produtos cadastrados na base serão permanentemente excluídos.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 font-medium text-slate-700">
          Deseja realmente apagar toda a base de produtos?
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button 
            className="bg-red-600 hover:bg-red-700" 
            onClick={handleClear}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" /> 
                Apagando...
              </>
            ) : (
              'Sim, Apagar Tudo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
