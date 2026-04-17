import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { collection, query, onSnapshot, doc, updateDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { updatePassword, updateProfile } from 'firebase/auth';
import { db } from '../firebase';
import { User } from 'firebase/auth';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  photoUrl?: string;
  role: 'admin' | 'user';
}

export function SettingsView({ currentUser, isAdmin }: { currentUser: User | null, isAdmin: boolean }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      if (isAdmin) {
        setUsers(usersData);
      } else {
        setUsers(usersData.filter(u => u.id === currentUser.uid));
      }
    }, (error) => {
      console.error("Error fetching users:", error);
      if (!isAdmin) {
        onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUsers([{ id: docSnap.id, ...docSnap.data() } as UserProfile]);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  const handleClearDatabase = async () => {
    if (!isAdmin) return;
    if (!window.confirm('TEM CERTEZA? Isso irá apagar TODOS os dados de licenciadores, linhas, produtos, contratos, pagamentos e relatórios. Esta ação não pode ser desfeita.')) return;

    setIsClearing(true);
    try {
      const collectionsToClear = ['licenses', 'lines', 'products', 'contracts', 'reports', 'payments', 'productCategories'];
      for (const colName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, colName));
        // Delete in batches of 500 (Firestore limit)
        const docs = querySnapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach((docRef) => {
            batch.delete(docRef.ref);
          });
          await batch.commit();
        }
      }
      toast.success('Banco de dados limpo com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao limpar banco de dados: ' + error.message);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Configurações de Usuários</CardTitle>
          <CardDescription>Gerencie os dados e permissões dos usuários da plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {users.map(user => (
              <UserEditCard key={user.id} userProfile={user} currentUser={currentUser} isAdmin={isAdmin} />
            ))}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-red-200 shadow-sm bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-red-800">Zona de Perigo</CardTitle>
            <CardDescription>Ações irreversíveis do sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-red-200 rounded-lg bg-white">
              <div>
                <h4 className="font-semibold text-slate-900">Limpar Banco de Dados</h4>
                <p className="text-sm text-slate-500">Remove todos os licenciadores, produtos, contratos e pagamentos. Mantém apenas os usuários.</p>
              </div>
              <Button 
                variant="destructive" 
                onClick={handleClearDatabase} 
                className="whitespace-nowrap"
                disabled={isClearing}
              >
                {isClearing ? 'Limpando...' : 'Apagar Tudo'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const UserEditCard: React.FC<{ userProfile: UserProfile, currentUser: User | null, isAdmin: boolean }> = ({ userProfile, currentUser, isAdmin }) => {
  const [name, setName] = useState(userProfile.name || '');
  const [photoUrl, setPhotoUrl] = useState(userProfile.photoUrl || '');
  const [role, setRole] = useState(userProfile.role || 'user');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isCurrentUser = currentUser?.uid === userProfile.id;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.id), {
        name,
        photoUrl,
        ...(isAdmin ? { role } : {}) // Only admin can update role
      });

      if (isCurrentUser && currentUser) {
        await updateProfile(currentUser, {
          displayName: name,
          photoURL: photoUrl
        });
      }

      if (password && isCurrentUser && currentUser) {
        await updatePassword(currentUser, password);
        setPassword('');
        toast.success('Senha atualizada com sucesso!');
      } else if (password && !isCurrentUser) {
        toast.error('Você só pode alterar a sua própria senha.');
      }

      toast.success('Dados do usuário atualizados com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao atualizar usuário.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
      <div className="flex items-center gap-4 mb-4">
        {photoUrl ? (
          <img src={photoUrl} alt={name || userProfile.email} className="w-12 h-12 rounded-full object-cover border" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg">
            {(name || userProfile.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h3 className="font-semibold text-slate-900">{name || 'Usuário sem nome'}</h3>
          <p className="text-sm text-slate-500">{userProfile.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={e => setName(e.target.value)} disabled={!isCurrentUser && !isAdmin} />
        </div>
        <div className="space-y-2">
          <Label>URL da Foto</Label>
          <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} disabled={!isCurrentUser && !isAdmin} placeholder="https://..." />
        </div>
        
        {isAdmin && (
          <div className="space-y-2">
            <Label>Cargo / Permissão</Label>
            <Select value={role} onValueChange={(val: any) => setRole(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário Padrão</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {(isCurrentUser) && (
          <div className="space-y-2">
            <Label>Nova Senha (deixe em branco para não alterar)</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="******" />
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isSaving || (!isCurrentUser && !isAdmin)}>
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}
