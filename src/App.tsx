/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ReactNode } from 'react';
import { auth, db, signIn, logOut, registerWithEmail, loginWithEmail, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  CreditCard, 
  Settings, 
  LogOut, 
  Plus,
  Search,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  Building2,
  Eye,
  Edit2,
  Layers,
  Package,
  Upload,
  FileSpreadsheet,
  Trash2,
  ExternalLink,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  CircleDollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';

import { SettingsView } from './components/SettingsView';

// Types
interface License { 
  id: string; 
  fantasyName: string; 
  legalName: string; 
  agent?: string; 
  description?: string; 
}
interface Line { 
  id: string; 
  licenseId: string; 
  name: string; 
  cnpj?: string;
  codRvp?: string;
  status?: string;
  brandType?: 'própria' | 'licenciada';
  royaltyRate?: number;
  productCategories?: string[];
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
}
interface ProductCategory { id: string; name: string; }
interface ContractYear {
  yearNumber: number;
  startDate: string;
  endDate: string;
  minimumGuarantee: number;
}

interface MGInstallment {
  installmentNumber: number;
  amount: number;
  dueDate: string;
  year?: string;
}

interface Contract { 
  id: string; 
  licenseId: string; 
  contractNumber?: string;
  minimumGuarantee: number; 
  startDate: string; 
  endDate: string; 
  paymentTerms?: string;
  reportingFrequency?: string;
  reportingDeadline?: string;
  lineIds: string[];
  productIds: string[];
  status?: 'Ativo' | 'Encerrado' | 'Suspenso';
  sellOffPeriod?: string;
  sellOffEndDate?: string;
  currency?: string;
  royaltyRateNetSales1?: number;
  royaltyRateNetPurchases?: number;
  royaltyRateFOB?: number;
  royaltyNetSalesNotes?: string;
  royaltyNetPurchasesNotes?: string;
  royaltyFOBNotes?: string;
  hasAdditionalNetSales?: boolean;
  royaltyRateNetSales2?: number;
  royaltyNetSalesNotes2?: string;
  hasAdditionalNetPurchases?: boolean;
  royaltyRateNetPurchases2?: number;
  royaltyNetPurchasesNotes2?: string;
  hasAdditionalFOB?: boolean;
  royaltyRateFOB2?: number;
  royaltyFOBNotes2?: string;
  signedContractUrl?: string;
  isDividedIntoYears?: boolean;
  years?: ContractYear[];
  mgInstallments?: MGInstallment[];
  hasMarketingFund?: boolean;
  marketingFundType?: string;
  marketingFundRate?: number;
  hasMarketingFundInstallments?: boolean;
  marketingFundInstallments?: MGInstallment[];
  propertiesInfo?: string;
  productsInfo?: string;
  paymentDeadline?: string;
  parentId?: string;
  isAddendum?: boolean;
}
interface RoyaltyReport {
  id: string;
  contractId: string;
  lineId: string;
  productId?: string;
  month: number;
  year: number;
  quantity: number;
  netValue: number;
  royaltyValue: number;
  productName?: string;
}
interface Payment {
  id: string;
  contractId: string;
  type: 'mg' | 'excess';
  installmentNumber?: number;
  amount: number;
  date: string;
  status: 'pending' | 'paid';
}

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  photoUrl?: string;
  role: 'admin' | 'user';
  createdAt?: any;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Error Boundary Component
class ErrorBoundary extends Component<any, any> {
  state: any;
  props: any;
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Ocorreu um erro inesperado.";
      try {
        const errObj = JSON.parse(this.state.error.message);
        if (errObj.error && errObj.error.toLowerCase().includes("permissions")) {
          message = "Você não tem permissão para realizar esta operação ou acessar estes dados. Verifique se você é um administrador.";
        }
      } catch (e) {
        // Not a JSON error
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <Card className="max-w-md w-full border-red-100 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertCircle size={28} />
                <CardTitle className="text-xl">Erro no Aplicativo</CardTitle>
              </div>
              <CardDescription>Ocorreu uma falha ao processar sua solicitação.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 border border-red-100 p-4 rounded-lg mb-6">
                <p className="text-red-800 text-sm font-medium">{message}</p>
              </div>
              <Button onClick={() => window.location.reload()} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                Recarregar Página
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data States
  const [licenses, setLicenses] = useState<License[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [reports, setReports] = useState<RoyaltyReport[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setUserProfile(snap.data());
    }, (error) => {
      console.error("Error fetching user profile:", error);
    });
    return () => unsub();
  }, [user]);

  const isAdmin = userProfile?.role === 'admin' || user?.email === 'cadernosdepartamento@gmail.com';

  useEffect(() => {
    if (!user) return;

    const unsubLicenses = onSnapshot(collection(db, 'licenses'), (snap) => {
      setLicenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as License)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'licenses'));

    const unsubLines = onSnapshot(collection(db, 'lines'), (snap) => {
      setLines(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Line)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'lines'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    const unsubProductCategories = onSnapshot(collection(db, 'productCategories'), (snap) => {
      setProductCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'productCategories'));

    const unsubContracts = onSnapshot(collection(db, 'contracts'), (snap) => {
      setContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'contracts'));

    const unsubReports = onSnapshot(collection(db, 'reports'), (snap) => {
      setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoyaltyReport)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'reports'));

    const unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'payments'));

    return () => {
      unsubLicenses();
      unsubLines();
      unsubProducts();
      unsubProductCategories();
      unsubContracts();
      unsubReports();
      unsubPayments();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
          <div className="p-6 flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BarChart3 className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">KaRoyalties</span>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <SidebarItem 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarItem 
              icon={<Building2 size={20} />} 
              label="Licenciadores" 
              active={activeTab === 'licenses'} 
              onClick={() => setActiveTab('licenses')} 
            />
            <SidebarItem 
              icon={<FileText size={20} />} 
              label="Contratos" 
              active={activeTab === 'contracts'} 
              onClick={() => setActiveTab('contracts')} 
            />
            <SidebarItem 
              icon={<Layers size={20} />} 
              label="Linhas" 
              active={activeTab === 'lines'} 
              onClick={() => setActiveTab('lines')} 
            />
            <SidebarItem 
              icon={<Package size={20} />} 
              label="Produtos" 
              active={activeTab === 'products'} 
              onClick={() => setActiveTab('products')} 
            />
            <SidebarItem 
              icon={<CircleDollarSign size={20} />} 
              label="Royalties" 
              active={activeTab === 'reports'} 
              onClick={() => setActiveTab('reports')} 
            />
            <SidebarItem 
              icon={<CreditCard size={20} />} 
              label="Pagamentos" 
              active={activeTab === 'payments'} 
              onClick={() => setActiveTab('payments')} 
            />
            <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Configurações
            </div>
            <SidebarItem 
              icon={<Settings size={20} />} 
              label="Cadastros Base" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || ''} 
                  className="w-8 h-8 rounded-full border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.displayName || user.email?.split('@')[0]}</p>
                  {isAdmin && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none text-[10px] px-1.5 py-0">Admin</Badge>}
                </div>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={logOut}
              className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 gap-3"
            >
              <LogOut size={18} />
              Sair
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900 capitalize">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'contracts' && 'Contratos'}
              {activeTab === 'licenses' && 'Licenciadores'}
              {activeTab === 'lines' && 'Linhas'}
              {activeTab === 'products' && 'Produtos'}
              {activeTab === 'reports' && 'Royalties'}
              {activeTab === 'payments' && 'Pagamentos'}
            </h1>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  placeholder="Buscar..." 
                  className="pl-10 w-64 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                />
              </div>
              
              {activeTab === 'contracts' && isAdmin && (
                <div className="flex items-center gap-2">
                  <ImportContractsDialog licenses={licenses} lines={lines} products={products} />
                  <AddContractDialog licenses={licenses} lines={lines} products={products} contracts={contracts} />
                </div>
              )}
              {activeTab === 'reports' && isAdmin && (
                <div className="flex items-center gap-2">
                  <ImportReportsDialog contracts={contracts} lines={lines} products={products} licenses={licenses} />
                  <AddReportDialog contracts={contracts} lines={lines} products={products} />
                </div>
              )}
              {activeTab === 'payments' && isAdmin && (
                <div className="flex items-center gap-2">
                  <ImportPaymentsDialog contracts={contracts} licenses={licenses} />
                  <AddPaymentDialog contracts={contracts} licenses={licenses} />
                </div>
              )}
              {activeTab === 'licenses' && isAdmin && (
                <AddLicensorDialog />
              )}
              {activeTab === 'lines' && isAdmin && (
                <div className="flex items-center gap-2">
                  <ImportLinesDialog licenses={licenses} />
                  <AddLineDialog licenses={licenses} />
                </div>
              )}
              {activeTab === 'products' && isAdmin && (
                <div className="flex items-center gap-2">
                  <ImportProductsDialog lines={lines} categories={productCategories} licenses={licenses} />
                  <AddProductDialog lines={lines} categories={productCategories} licenses={licenses} />
                </div>
              )}
            </div>
          </header>

          <div className="p-8 w-full">
            {activeTab === 'dashboard' && (
              <DashboardView 
                contracts={contracts} 
                reports={reports} 
                payments={payments} 
                licenses={licenses}
                lines={lines}
                products={products}
              />
            )}
            {activeTab === 'contracts' && <ContractsView contracts={contracts} licenses={licenses} reports={reports} lines={lines} products={products} isAdmin={isAdmin} />}
            {activeTab === 'licenses' && <LicensorsView licenses={licenses} isAdmin={isAdmin} />}
            {activeTab === 'lines' && <LinesView lines={lines} licenses={licenses} contracts={contracts} products={products} categories={productCategories} isAdmin={isAdmin} />}
            {activeTab === 'products' && <ProductsView products={products} lines={lines} categories={productCategories} licenses={licenses} isAdmin={isAdmin} />}
            {activeTab === 'reports' && <ReportsView reports={reports} contracts={contracts} lines={lines} products={products} licenses={licenses} isAdmin={isAdmin} />}
            {activeTab === 'payments' && <PaymentsView payments={payments} contracts={contracts} licenses={licenses} isAdmin={isAdmin} />}
            {activeTab === 'settings' && <SettingsView currentUser={user} isAdmin={isAdmin} />}
          </div>
        </main>
        <Toaster />
      </div>
  );
}

const getCurrencySymbol = (currency: string) => {
  switch (currency) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'BRL': return 'R$';
    default: return 'R$';
  }
};

const formatCurrencyBR = (value: number | string) => {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const parseCurrencyBR = (value: string) => {
  if (!value) return 0;
  // Remove thousands separator and replace decimal separator
  const cleanValue = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
};

const formatDateBR = (dateStr: string | undefined | null) => {
  if (!dateStr) return '-';
  // If it's already a date-like string but not a full ISO string, try to handle it
  // For strings like "Assinatura", new Date() returns Invalid Date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('pt-BR');
};

const getContractStatus = (contract: any) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startDate = contract.startDate ? new Date(contract.startDate) : null;
  const endDate = contract.endDate ? new Date(contract.endDate) : null;
  const sellOffEndDate = contract.sellOffEndDate ? new Date(contract.sellOffEndDate) : null;

  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(0, 0, 0, 0);
  if (sellOffEndDate) sellOffEndDate.setHours(0, 0, 0, 0);

  // Ativo: today >= startDate && today <= endDate
  if (startDate && endDate && today >= startDate && today <= endDate) {
    return { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none' };
  }

  // Ativo (sell-off): today > endDate && today <= sellOffEndDate
  if (endDate && sellOffEndDate && today > endDate && today <= sellOffEndDate) {
    return { label: 'Ativo (sell-off)', color: 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none' };
  }

  // Encerrado: today > sellOffEndDate OR (today > endDate && (!sellOffEndDate || sellOffEndDate <= endDate))
  if ((endDate && today > endDate && (!sellOffEndDate || sellOffEndDate <= endDate)) || (sellOffEndDate && today > sellOffEndDate)) {
    return { label: 'Encerrado', color: 'bg-red-100 text-red-700 hover:bg-red-100 border-none' };
  }

  // Default fallback if dates are missing or contract hasn't started yet
  if (startDate && today < startDate) {
    return { label: 'Aguardando', color: 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-none' };
  }

  return { label: 'Indefinido', color: 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-none' };
};

function LoginView() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegistering) {
        await registerWithEmail(email, password);
        toast.success('Conta criada com sucesso!');
      } else {
        await loginWithEmail(email, password);
        toast.success('Bem-vindo de volta!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full shadow-xl border-none">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <BarChart3 className="text-white w-10 h-10" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">KaRoyalties</CardTitle>
          <CardDescription className="text-slate-500">Gestão profissional de royalties e contratos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail Corporativo</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu.nome@kalunga.com.br" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-[10px] text-slate-400 italic">Obrigatório domínio @kalunga.com.br</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-medium rounded-xl transition-all"
            >
              {loading ? 'Aguarde...' : (isRegistering ? 'Criar Conta' : 'Entrar')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">Ou</span>
            </div>
          </div>

          <Button 
            variant="outline"
            onClick={signIn} 
            className="w-full border-slate-200 hover:bg-slate-50 text-slate-600 h-11 font-medium rounded-xl transition-all"
          >
            Entrar com Google
          </Button>

          <div className="text-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              {isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se (@kalunga)'}
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">
            Acesso restrito a administradores autorizados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'bg-blue-50 text-blue-700' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Dialog Components

function AddLicensorDialog() {
  const [open, setOpen] = useState(false);
  const [fantasyName, setFantasyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [agent, setAgent] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'licenses'), { 
        fantasyName, 
        legalName, 
        agent, 
        description, 
        createdAt: serverTimestamp() 
      });
      toast.success('Licenciador cadastrado com sucesso!');
      setOpen(false);
      setFantasyName('');
      setLegalName('');
      setAgent('');
      setDescription('');
    } catch (err) {
      toast.error('Erro ao cadastrar licenciador.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "default" }), "bg-blue-600 hover:bg-blue-700 gap-2")}>
            <Plus size={18} /> Novo Licenciador
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Licenciador</DialogTitle>
          <DialogDescription>Cadastre uma nova empresa licenciadora.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="fantasyName">Nome Fantasia</Label>
            <Input id="fantasyName" value={fantasyName} onChange={(e) => setFantasyName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Nome Jurídico</Label>
            <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent">Administradora/Agente</Label>
            <Input id="agent" value={agent} onChange={(e) => setAgent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Descrição (Opcional)</Label>
            <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit">Salvar Licenciador</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportLinesDialog({ licenses }: { licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const templateColumns = [
    "Licenciador",
    "Nome da linha",
    "Tipo de marca",
    "Status"
  ];

  const downloadTemplate = () => {
    const wsData = [
      templateColumns,
      [licenses[0]?.fantasyName || "Exemplo Licenciador", "Exemplo Linha", "Licenciada", "Ativa"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    
    // Add instructions sheet
    const instData = [
      ["Instruções de Preenchimento"],
      ["1. Licenciador: Deve ser o 'Nome Fantasia' de um licenciador já cadastrado no sistema."],
      ["2. Nome da linha: Nome descritivo da linha ou marca."],
      ["3. Tipo de marca: Deve ser exatamente 'Própria' ou 'Licenciada'."],
      ["4. Status: Deve ser exatamente 'Ativa' ou 'Inativa'."],
    ];
    const instWs = XLSX.utils.aoa_to_sheet(instData);
    XLSX.utils.book_append_sheet(wb, instWs, "Instruções");

    XLSX.writeFile(wb, "template_importacao_linhas.xlsx");
    toast.success("Template baixado com sucesso!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return toast.error("Selecione um arquivo para importar.");
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast.error("O arquivo está vazio ou não possui dados válidos.");
          setIsUploading(false);
          return;
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const row of jsonData) {
          const getVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(key => k.trim().toLowerCase() === key.toLowerCase())
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const licensorName = String(getVal(["Licenciador"]) || "").trim();
          const lineName = String(getVal(["Nome da linha", "Linha"]) || "").trim();
          const brandTypeRaw = String(getVal(["Tipo de marca", "Tipo"]) || "").trim();
          const statusRaw = String(getVal(["Status"]) || "").trim();

          if (!licensorName || !lineName) {
            skippedCount++;
            continue;
          }

          const license = licenses.find(l => 
            String(l.fantasyName || "").trim().toLowerCase() === licensorName.toLowerCase() ||
            String(l.legalName || "").trim().toLowerCase() === licensorName.toLowerCase()
          );
          if (!license) {
            console.warn(`Licenciador não encontrado: ${licensorName}`);
            skippedCount++;
            continue;
          }

          const brandType = (brandTypeRaw?.toString().toLowerCase() === 'própria') ? 'própria' : 'licenciada';
          const status = statusRaw?.toString() || 'Ativa';

          await addDoc(collection(db, 'lines'), {
            name: lineName.toString(),
            licenseId: license.id,
            brandType,
            status,
            createdAt: serverTimestamp()
          });
          importedCount++;
        }

        toast.success(`${importedCount} linhas importadas com sucesso! ${skippedCount > 0 ? `(${skippedCount} puladas)` : ''}`);
        setOpen(false);
        setFile(null);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao processar o arquivo Excel.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
          <Upload size={18} /> Importar Linhas
        </button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Linhas em Lote</DialogTitle>
          <DialogDescription>
            Faça o upload de uma planilha Excel para cadastrar múltiplas linhas de uma vez.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="p-4 border-2 border-dashed rounded-lg bg-slate-50 flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-900">Passo 1: Baixe o modelo</p>
              <p className="text-xs text-slate-500 mb-3">Utilize nossa planilha padrão para evitar erros.</p>
              <Button variant="secondary" size="sm" onClick={downloadTemplate} className="gap-2">
                <FileSpreadsheet size={16} /> Baixar Template
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Passo 2: Selecione o arquivo preenchido</Label>
            <Input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
            {file && <p className="text-xs text-blue-600 font-medium">Arquivo selecionado: {file.name}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isUploading}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!file || isUploading} className="bg-blue-600 hover:bg-blue-700">
            {isUploading ? "Importando..." : "Iniciar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLineDialog({ licenses }: { licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [status, setStatus] = useState('Ativa');
  const [brandType, setBrandType] = useState<'própria' | 'licenciada'>('licenciada');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseId) return toast.error('Selecione um licenciador.');
    try {
      await addDoc(collection(db, 'lines'), { 
        name, 
        licenseId, 
        status,
        brandType,
        createdAt: serverTimestamp() 
      });
      toast.success('Linha cadastrada com sucesso!');
      setOpen(false);
      setName('');
      setLicenseId('');
      setStatus('Ativa');
      setBrandType('licenciada');
    } catch (err) {
      toast.error('Erro ao cadastrar linha.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "default" }), "bg-blue-600 hover:bg-blue-700 gap-2")}>
            <Plus size={18} /> Nova Linha
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Linha / Marca</DialogTitle>
          <DialogDescription>Vincule uma nova linha a um licenciador existente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Licenciador Pai</Label>
            <Select onValueChange={setLicenseId} value={licenseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o licenciador" />
              </SelectTrigger>
              <SelectContent>
                {licenses.sort((a, b) => a.fantasyName.localeCompare(b.fantasyName)).map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.fantasyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pname">Nome da Linha</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select onValueChange={setStatus} value={status}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de marca</Label>
              <Select onValueChange={(v: any) => setBrandType(v)} value={brandType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="própria">Própria</SelectItem>
                  <SelectItem value="licenciada">Licenciada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Salvar Linha</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportProductsDialog({ lines, categories, licenses }: { lines: Line[], categories: ProductCategory[], licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const templateColumns = [
    "Licenciador",
    "Linha",
    "Código",
    "Nome",
    "Categoria",
    "Ano",
    "EAN"
  ];

  const downloadTemplate = () => {
    const wsData = [
      templateColumns,
      [licenses[0]?.fantasyName || "Exemplo Licenciador", lines[0]?.name || "Exemplo Linha", "SKU123", "Exemplo Produto", categories[0]?.name || "Exemplo Categoria", "2024", "7891234567890"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    
    const instData = [
      ["Instruções de Preenchimento"],
      ["1. Licenciador: Deve ser o 'Nome Fantasia' de um licenciador já cadastrado no sistema."],
      ["2. Linha: Deve ser o nome de uma linha já cadastrada e vinculada ao licenciador."],
      ["3. Código: Código SKU do produto."],
      ["4. Nome: Nome descritivo do produto."],
      ["5. Categoria: Nome de uma categoria já cadastrada no sistema."],
      ["6. Ano: Ano de lançamento (opcional)."],
      ["7. EAN: Código de barras EAN (opcional)."],
    ];
    const instWs = XLSX.utils.aoa_to_sheet(instData);
    XLSX.utils.book_append_sheet(wb, instWs, "Instruções");

    XLSX.writeFile(wb, "template_importacao_produtos.xlsx");
    toast.success("Template baixado com sucesso!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return toast.error("Selecione um arquivo para importar.");
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast.error("O arquivo está vazio ou não possui dados válidos.");
          setIsUploading(false);
          return;
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const row of jsonData) {
          const getVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(key => k.trim().toLowerCase() === key.toLowerCase())
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const licensorName = String(getVal(["Licenciador"]) || "").trim();
          const lineName = String(getVal(["Linha"]) || "").trim();
          const sku = String(getVal(["Código", "SKU"]) || "").trim();
          const productName = String(getVal(["Nome", "Produto"]) || "").trim();
          const categoryName = String(getVal(["Categoria"]) || "").trim();
          const yearRaw = getVal(["Ano", "Ano de lançamento"]);
          const ean = String(getVal(["EAN", "Código de barras"]) || "").trim();

          if (!lineName || !productName) {
            skippedCount++;
            continue;
          }

          let licenseId = '';
          if (licensorName) {
            const license = licenses.find(l => 
              String(l.fantasyName || "").trim().toLowerCase() === licensorName.toLowerCase() ||
              String(l.legalName || "").trim().toLowerCase() === licensorName.toLowerCase()
            );
            if (license) licenseId = license.id;
          }

          const line = lines.find(l => 
            String(l.name || "").trim().toLowerCase() === lineName.toLowerCase() &&
            (!licenseId || l.licenseId === licenseId)
          );

          if (!line) {
            console.warn(`Linha não encontrada: ${lineName}`);
            skippedCount++;
            continue;
          }

          let categoryId = '';
          if (categoryName) {
            const category = categories.find(c => String(c.name || "").trim().toLowerCase() === categoryName.toLowerCase());
            if (category) categoryId = category.id;
          }

          const launchYear = yearRaw ? Number(yearRaw) : null;

          await addDoc(collection(db, 'products'), {
            name: productName.toString(),
            lineId: line.id,
            sku: sku.toString(),
            categoryId,
            licenseId: licenseId || line.licenseId,
            launchYear: isNaN(launchYear as number) ? null : launchYear,
            ean: ean.toString(),
            createdAt: serverTimestamp()
          });
          importedCount++;
        }

        toast.success(`${importedCount} produtos importados com sucesso! ${skippedCount > 0 ? `(${skippedCount} pulados)` : ''}`);
        setOpen(false);
        setFile(null);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao processar o arquivo Excel.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
          <Upload size={18} /> Importar Produtos
        </button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Produtos em Lote</DialogTitle>
          <DialogDescription>
            Faça o upload de uma planilha Excel para cadastrar múltiplos produtos de uma vez.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-medium text-sm mb-2">Como importar:</h4>
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
              <li>Baixe o template de importação.</li>
              <li>Preencha os dados seguindo as instruções.</li>
              <li>Faça o upload do arquivo preenchido.</li>
            </ol>
            <Button variant="secondary" size="sm" onClick={downloadTemplate} className="mt-4 gap-2">
              <Upload size={14} className="rotate-180" /> Baixar Template
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Arquivo Excel (.xlsx)</label>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileChange}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isUploading}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!file || isUploading} className="bg-blue-600 hover:bg-blue-700">
              {isUploading ? 'Importando...' : 'Importar Produtos'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddProductDialog({ lines, categories, licenses }: { lines: Line[], categories: ProductCategory[], licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lineId, setLineId] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [launchYear, setLaunchYear] = useState('');
  const [ean, setEan] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineId) return toast.error('Selecione uma linha.');
    try {
      await addDoc(collection(db, 'products'), { 
        name, 
        lineId, 
        sku, 
        categoryId,
        licenseId,
        launchYear: launchYear ? Number(launchYear) : null,
        ean,
        createdAt: serverTimestamp() 
      });
      toast.success('Produto cadastrado com sucesso!');
      setOpen(false);
      setName('');
      setLineId('');
      setSku('');
      setCategoryId('');
      setLicenseId('');
      setLaunchYear('');
      setEan('');
    } catch (err) {
      toast.error('Erro ao cadastrar produto.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "default" }), "bg-blue-600 hover:bg-blue-700 gap-2")}>
            <Plus size={18} /> Novo Produto
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
          <DialogDescription>Cadastre um novo produto vinculado a uma linha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Select onValueChange={setLicenseId} value={licenseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {licenses.sort((a, b) => a.fantasyName.localeCompare(b.fantasyName)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.fantasyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linha Pai</Label>
              <Select onValueChange={setLineId} value={lineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {lines.filter(l => !licenseId || l.licenseId === licenseId).sort((a, b) => a.name.localeCompare(b.name)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prodname">Nome do Produto</Label>
            <Input id="prodname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">Código (SKU)</Label>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ean">EAN</Label>
              <Input id="ean" value={ean} onChange={(e) => setEan(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select onValueChange={setCategoryId} value={categoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="launchYear">Ano de Lançamento</Label>
              <Input id="launchYear" type="number" value={launchYear} onChange={(e) => setLaunchYear(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Salvar Produto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContractDetailsDialog({ contract, licenses, lines, products, contracts, trigger }: { contract: Contract, licenses: License[], lines: Line[], products: Product[], contracts: Contract[], trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 7;
  
  // Form States
  const [licenseId, setLicenseId] = useState(contract.licenseId);
  const [contractNumber, setContractNumber] = useState(contract.contractNumber || '');
  const [startDate, setStartDate] = useState(contract.startDate);
  const [endDate, setEndDate] = useState(contract.endDate);
  const [isDividedIntoYears, setIsDividedIntoYears] = useState(contract.isDividedIntoYears || false);
  const [numYears, setNumYears] = useState(contract.years?.length.toString() || '1');
  const [years, setYears] = useState<ContractYear[]>(contract.years || []);
  const [paymentTerms, setPaymentTerms] = useState(contract.paymentTerms || '');
  const [reportingFrequency, setReportingFrequency] = useState(contract.reportingFrequency || 'Mensal');
  const [status, setStatus] = useState<'Ativo' | 'Encerrado' | 'Suspenso'>(contract.status || 'Ativo');
  const [sellOffPeriod, setSellOffPeriod] = useState(contract.sellOffPeriod || '');
  const [sellOffEndDate, setSellOffEndDate] = useState(contract.sellOffEndDate || '');
  const [currency, setCurrency] = useState(contract.currency || 'BRL');
  const [isAddendum, setIsAddendum] = useState(contract.isAddendum || false);
  const [parentId, setParentId] = useState(contract.parentId || '');
  
  const [hasNetSales, setHasNetSales] = useState(!!contract.royaltyRateNetSales1);
  const [royaltyRateNetSales1, setRoyaltyRateNetSales1] = useState((contract.royaltyRateNetSales1 ? contract.royaltyRateNetSales1 * 100 : 0).toString());
  const [royaltyNetSalesNotes, setRoyaltyNetSalesNotes] = useState(contract.royaltyNetSalesNotes || '');
  const [hasAdditionalNetSales, setHasAdditionalNetSales] = useState(contract.hasAdditionalNetSales || false);
  const [royaltyRateNetSales2, setRoyaltyRateNetSales2] = useState((contract.royaltyRateNetSales2 ? contract.royaltyRateNetSales2 * 100 : 0).toString());
  const [royaltyNetSalesNotes2, setRoyaltyNetSalesNotes2] = useState(contract.royaltyNetSalesNotes2 || '');

  const [hasNetPurchases, setHasNetPurchases] = useState(!!contract.royaltyRateNetPurchases);
  const [royaltyRateNetPurchases, setRoyaltyRateNetPurchases] = useState((contract.royaltyRateNetPurchases ? contract.royaltyRateNetPurchases * 100 : 0).toString());
  const [royaltyNetPurchasesNotes, setRoyaltyNetPurchasesNotes] = useState(contract.royaltyNetPurchasesNotes || '');
  const [hasAdditionalNetPurchases, setHasAdditionalNetPurchases] = useState(contract.hasAdditionalNetPurchases || false);
  const [royaltyRateNetPurchases2, setRoyaltyRateNetPurchases2] = useState((contract.royaltyRateNetPurchases2 ? contract.royaltyRateNetPurchases2 * 100 : 0).toString());
  const [royaltyNetPurchasesNotes2, setRoyaltyNetPurchasesNotes2] = useState(contract.royaltyNetPurchasesNotes2 || '');

  const [hasFOB, setHasFOB] = useState(!!contract.royaltyRateFOB);
  const [royaltyRateFOB, setRoyaltyRateFOB] = useState((contract.royaltyRateFOB ? contract.royaltyRateFOB * 100 : 0).toString());
  const [royaltyFOBNotes, setRoyaltyFOBNotes] = useState(contract.royaltyFOBNotes || '');
  const [hasAdditionalFOB, setHasAdditionalFOB] = useState(contract.hasAdditionalFOB || false);
  const [royaltyRateFOB2, setRoyaltyRateFOB2] = useState((contract.royaltyRateFOB2 ? contract.royaltyRateFOB2 * 100 : 0).toString());
  const [royaltyFOBNotes2, setRoyaltyFOBNotes2] = useState(contract.royaltyFOBNotes2 || '');

  const [selectedLines, setSelectedLines] = useState<string[]>(contract.lineIds || []);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(contract.productIds || []);
  const [signedContractUrl, setSignedContractUrl] = useState(contract.signedContractUrl || '');
  const [reportingDeadline, setReportingDeadline] = useState(contract.reportingDeadline || '');
  const [paymentDeadline, setPaymentDeadline] = useState(contract.paymentDeadline || '');
  
  const [numInstallments, setNumInstallments] = useState(contract.mgInstallments?.length.toString() || '1');
  const [installments, setInstallments] = useState<MGInstallment[]>(contract.mgInstallments || []);
  
  const [hasMarketingFund, setHasMarketingFund] = useState(contract.hasMarketingFund || false);
  const [marketingFundType, setMarketingFundType] = useState(contract.marketingFundType || '');
  const [marketingFundRate, setMarketingFundRate] = useState((contract.marketingFundRate ? contract.marketingFundRate * 100 : 0).toString());
  const [hasMarketingFundInstallments, setHasMarketingFundInstallments] = useState(contract.hasMarketingFundInstallments || false);
  const [numMarketingFundInstallments, setNumMarketingFundInstallments] = useState(contract.marketingFundInstallments?.length.toString() || '1');
  const [marketingFundInstallments, setMarketingFundInstallments] = useState<MGInstallment[]>(contract.marketingFundInstallments || []);
  
  const [propertiesInfo, setPropertiesInfo] = useState(contract.propertiesInfo || '');
  const [productsInfo, setProductsInfo] = useState(contract.productsInfo || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Effects
  useEffect(() => {
    if (isDividedIntoYears && years.length === 0) {
      const n = parseInt(numYears) || 0;
      const newYears: ContractYear[] = [];
      for (let i = 1; i <= n; i++) {
        newYears.push({
          yearNumber: i,
          startDate: '',
          endDate: '',
          minimumGuarantee: 0
        });
      }
      setYears(newYears);
    }
  }, [isDividedIntoYears, numYears]);

  useEffect(() => {
    if (endDate && sellOffPeriod) {
      const date = new Date(endDate);
      if (!isNaN(date.getTime())) {
        date.setDate(date.getDate() + parseInt(sellOffPeriod));
        setSellOffEndDate(date.toISOString().split('T')[0]);
      }
    }
  }, [endDate, sellOffPeriod]);

  useEffect(() => {
    const n = parseInt(numInstallments) || 0;
    setInstallments(prev => {
      const newInst = [...prev];
      if (newInst.length < n) {
        for (let i = newInst.length + 1; i <= n; i++) {
          newInst.push({ installmentNumber: i, amount: 0, dueDate: '', year: '' });
        }
      } else if (newInst.length > n) {
        return newInst.slice(0, n);
      }
      return newInst;
    });
  }, [numInstallments]);

  useEffect(() => {
    const n = parseInt(numMarketingFundInstallments) || 0;
    setMarketingFundInstallments(prev => {
      const newInst = [...prev];
      if (newInst.length < n) {
        for (let i = newInst.length + 1; i <= n; i++) {
          newInst.push({ installmentNumber: i, amount: 0, dueDate: '', year: '' });
        }
      } else if (newInst.length > n) {
        return newInst.slice(0, n);
      }
      return newInst;
    });
  }, [numMarketingFundInstallments]);

  useEffect(() => {
    if (isAddendum && parentId && contracts) {
      const parentExists = contracts.some(c => c.id === parentId && c.licenseId === licenseId);
      if (!parentExists) {
        setParentId('');
      }
    }
  }, [licenseId, isAddendum, contracts]);

  const totalMG = installments.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'contracts', contract.id));
      toast.success('Contrato excluído com sucesso!');
      setOpen(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      toast.error('Erro ao excluir contrato.');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && step < totalSteps) {
      setStep(step + 1);
      return;
    }
    try {
      const contractRef = doc(db, 'contracts', contract.id);
      await updateDoc(contractRef, {
        licenseId,
        contractNumber,
        minimumGuarantee: totalMG,
        startDate,
        endDate,
        isDividedIntoYears,
        years,
        sellOffPeriod,
        sellOffEndDate,
        currency,
        royaltyRateNetSales1: hasNetSales ? (Number(royaltyRateNetSales1) || 0) / 100 : 0,
        royaltyNetSalesNotes,
        hasAdditionalNetSales,
        royaltyRateNetSales2: hasAdditionalNetSales ? (Number(royaltyRateNetSales2) || 0) / 100 : 0,
        royaltyNetSalesNotes2,
        royaltyRateNetPurchases: hasNetPurchases ? (Number(royaltyRateNetPurchases) || 0) / 100 : 0,
        royaltyNetPurchasesNotes,
        hasAdditionalNetPurchases,
        royaltyRateNetPurchases2: hasAdditionalNetPurchases ? (Number(royaltyRateNetPurchases2) || 0) / 100 : 0,
        royaltyNetPurchasesNotes2,
        royaltyRateFOB: hasFOB ? (Number(royaltyRateFOB) || 0) / 100 : 0,
        royaltyFOBNotes,
        hasAdditionalFOB,
        royaltyRateFOB2: hasAdditionalFOB ? (Number(royaltyRateFOB2) || 0) / 100 : 0,
        royaltyFOBNotes2,
        reportingFrequency,
        reportingDeadline,
        mgInstallments: installments,
        paymentDeadline,
        hasMarketingFund,
        marketingFundType,
        marketingFundRate: hasMarketingFund ? (Number(marketingFundRate) || 0) / 100 : 0,
        hasMarketingFundInstallments,
        marketingFundInstallments: hasMarketingFundInstallments ? marketingFundInstallments : [],
        propertiesInfo,
        lineIds: selectedLines,
        productsInfo,
        productIds: selectedProducts,
        signedContractUrl: signedContractUrl ? (signedContractUrl.startsWith('http') ? signedContractUrl : `https://${signedContractUrl}`) : '',
        status,
        isAddendum,
        parentId: isAddendum ? parentId : null,
        updatedAt: serverTimestamp()
      });
      toast.success('Contrato atualizado com sucesso!');
      setIsEditing(false);
      setStep(1);
    } catch (err) {
      toast.error('Erro ao atualizar contrato.');
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const license = licenses.find(l => l.id === contract.licenseId);
  const linkedLines = lines.filter(l => (contract.lineIds || []).includes(l.id));
  const linkedProducts = products.filter(p => (contract.productIds || []).includes(p.id));

  const allCategories = Array.from(new Set(linkedLines.flatMap(l => l.productCategories || [])));
  const productsByCat = allCategories.map(cat => ({
    category: cat,
    products: linkedProducts
      .filter(p => linkedLines.some(l => l.id === p.lineId && l.productCategories?.includes(cat)))
      .sort((a, b) => a.name.localeCompare(b.name))
  })).filter(item => item.products.length > 0);

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) setIsEditing(false); }}>
      <DialogTrigger
        nativeButton={true}
        render={
          trigger || (
            <button className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-2")}>
              <Eye size={14} /> Ver Detalhes
            </button>
          )
        }
      />
      <DialogContent className="w-[40vw] !max-w-[40vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl">{isEditing ? `Editar Contrato - Passo ${step} de ${totalSteps}` : 'Detalhes Completos do Contrato'}</DialogTitle>
              <DialogDescription>
                {isEditing ? (
                  <>
                    {step === 1 && "Identificação básica do contrato."}
                    {step === 2 && "Período de vigência e sell-off."}
                    {step === 3 && "Condições de Pagamento e Parcelas de MG."}
                    {step === 4 && "Taxas de Royalties e Apuração."}
                    {step === 5 && "Fundo de Marketing."}
                    {step === 6 && "Propriedades, Marcas e Linhas."}
                    {step === 7 && "Contrato Assinado."}
                  </>
                ) : `Informações detalhadas do contrato ${contract.contractNumber || contract.id}`}
              </DialogDescription>
            </div>
            {!isEditing && (
              <div className="flex gap-2">
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                    <span className="text-xs font-medium text-slate-500">Confirmar exclusão?</span>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleDelete}
                    >
                      Sim, Excluir
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 size={14} /> Excluir
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsEditing(true)}>
                      <Edit2 size={14} /> Editar
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-6 pt-4">
            {step === 1 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Licenciador</Label>
                  <Select onValueChange={setLicenseId} value={licenseId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o licenciador" /></SelectTrigger>
                    <SelectContent>
                      {licenses.sort((a, b) => a.fantasyName.localeCompare(b.fantasyName)).map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.fantasyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nº do Contrato</Label>
                  <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="Ex: 123/2024" />
                </div>
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Ex: BRL, USD" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select onValueChange={(val: any) => setStatus(val)} value={status}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Encerrado">Encerrado</SelectItem>
                      <SelectItem value="Suspenso">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="edit-isAddendum" 
                      checked={isAddendum} 
                      onChange={(e) => setIsAddendum(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label htmlFor="edit-isAddendum" className="cursor-pointer font-medium">Este contrato é um aditivo?</Label>
                  </div>
                  
                  {isAddendum && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Label>Contrato Pai</Label>
                      <Select onValueChange={setParentId} value={parentId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o contrato principal" /></SelectTrigger>
                        <SelectContent>
                          {contracts && contracts.filter(c => c.licenseId === licenseId && c.id !== contract.id).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.contractNumber || c.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Término</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg border">
                  <input 
                    type="checkbox" 
                    id="edit-divided" 
                    checked={isDividedIntoYears} 
                    onChange={(e) => setIsDividedIntoYears(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="edit-divided" className="cursor-pointer">O período do contrato será dividido em anos?</Label>
                </div>

                {isDividedIntoYears && (
                  <div className="space-y-4 p-4 border rounded-lg bg-white">
                    <div className="space-y-2">
                      <Label>Quantos anos?</Label>
                      <Input type="number" min="1" value={numYears} onChange={(e) => setNumYears(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {years.map((y, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-4 p-3 border rounded bg-slate-50">
                          <div className="col-span-2 font-bold text-xs uppercase text-slate-500">Ano {y.yearNumber}</div>
                          <div className="space-y-1">
                            <Label className="text-xs">Início</Label>
                            <Input 
                              type="date" 
                              value={y.startDate} 
                              onChange={(e) => {
                                const newYears = [...years];
                                newYears[idx].startDate = e.target.value;
                                setYears(newYears);
                              }} 
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Fim</Label>
                            <Input 
                              type="date" 
                              value={y.endDate} 
                              onChange={(e) => {
                                const newYears = [...years];
                                newYears[idx].endDate = e.target.value;
                                setYears(newYears);
                              }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Período Sell-off (dias)</Label>
                    <Input type="number" value={sellOffPeriod} onChange={(e) => setSellOffPeriod(e.target.value)} placeholder="Ex: 60" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Final Sell-off (Calculada)</Label>
                    <Input type="date" value={sellOffEndDate} readOnly className="bg-slate-50" />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quantas parcelas de MG?</Label>
                    <Input type="number" min="1" value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {installments.map((inst, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-4 p-3 border rounded bg-slate-50 items-end">
                        <div className="font-bold text-xs text-slate-500 pb-2">Parcela {inst.installmentNumber}</div>
                        <div className="space-y-1">
                          <Label className="text-xs">Ano</Label>
                          <Input 
                            placeholder="Ex: 2024"
                            value={inst.year || ''} 
                            onChange={(e) => {
                              const newInst = [...installments];
                              newInst[idx].year = e.target.value;
                              setInstallments(newInst);
                            }} 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                            <Input 
                              type="text" 
                              className="pl-8 text-lg font-semibold h-12"
                              value={formatCurrencyBR(inst.amount)} 
                              onChange={(e) => {
                                const val = parseCurrencyBR(e.target.value);
                                const newInst = [...installments];
                                newInst[idx].amount = val;
                                setInstallments(newInst);
                              }} 
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Vencimento</Label>
                          <Input 
                            placeholder={idx === 0 ? "Data ou 'Assinatura'" : "Data"}
                            value={inst.dueDate} 
                            onChange={(e) => {
                              const newInst = [...installments];
                              newInst[idx].dueDate = e.target.value;
                              setInstallments(newInst);
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center">
                    <span className="font-bold text-blue-900">Mínimo Garantido Total (Soma das Parcelas):</span>
                    <span className="text-xl font-black text-blue-600">
                      {currency} {totalMG.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo de Pagamento</Label>
                    <Input value={paymentDeadline} onChange={(e) => setPaymentDeadline(e.target.value)} placeholder="Ex: 30 dias após fatura" />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="edit-ns" checked={hasNetSales} onChange={(e) => setHasNetSales(e.target.checked)} />
                      <Label htmlFor="edit-ns" className="font-bold">Vendas Líquidas</Label>
                    </div>
                    {hasNetSales && (
                      <div className="grid grid-cols-4 gap-4 pl-6">
                        <div className="space-y-1">
                          <Label className="text-xs">Taxa (%)</Label>
                          <Input type="number" step="0.01" value={royaltyRateNetSales1} onChange={(e) => setRoyaltyRateNetSales1(e.target.value)} />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Observações/Taxas Específicas</Label>
                          <Input value={royaltyNetSalesNotes} onChange={(e) => setRoyaltyNetSalesNotes(e.target.value)} placeholder="Ex: 12% para e-commerce" />
                        </div>
                        <div className="col-span-4 flex items-center gap-2 pt-2">
                          <input type="checkbox" id="edit-ans" checked={hasAdditionalNetSales} onChange={(e) => setHasAdditionalNetSales(e.target.checked)} />
                          <Label htmlFor="edit-ans" className="text-xs font-medium">Existe mais uma taxa nesta modalidade?</Label>
                        </div>
                        {hasAdditionalNetSales && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Taxa 2 (%)</Label>
                              <Input type="number" step="0.01" value={royaltyRateNetSales2} onChange={(e) => setRoyaltyRateNetSales2(e.target.value)} />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label className="text-xs">Observações Taxa 2</Label>
                              <Input value={royaltyNetSalesNotes2} onChange={(e) => setRoyaltyNetSalesNotes2(e.target.value)} />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="edit-np" checked={hasNetPurchases} onChange={(e) => setHasNetPurchases(e.target.checked)} />
                      <Label htmlFor="edit-np" className="font-bold">Compras Líquidas</Label>
                    </div>
                    {hasNetPurchases && (
                      <div className="grid grid-cols-4 gap-4 pl-6">
                        <div className="space-y-1">
                          <Label className="text-xs">Taxa (%)</Label>
                          <Input type="number" step="0.01" value={royaltyRateNetPurchases} onChange={(e) => setRoyaltyRateNetPurchases(e.target.value)} />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Observações/Taxas Específicas</Label>
                          <Input value={royaltyNetPurchasesNotes} onChange={(e) => setRoyaltyNetPurchasesNotes(e.target.value)} />
                        </div>
                        <div className="col-span-4 flex items-center gap-2 pt-2">
                          <input type="checkbox" id="edit-anp" checked={hasAdditionalNetPurchases} onChange={(e) => setHasAdditionalNetPurchases(e.target.checked)} />
                          <Label htmlFor="edit-anp" className="text-xs font-medium">Existe mais uma taxa nesta modalidade?</Label>
                        </div>
                        {hasAdditionalNetPurchases && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Taxa 2 (%)</Label>
                              <Input type="number" step="0.01" value={royaltyRateNetPurchases2} onChange={(e) => setRoyaltyRateNetPurchases2(e.target.value)} />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label className="text-xs">Observações Taxa 2</Label>
                              <Input value={royaltyNetPurchasesNotes2} onChange={(e) => setRoyaltyNetPurchasesNotes2(e.target.value)} />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="edit-fob" checked={hasFOB} onChange={(e) => setHasFOB(e.target.checked)} />
                      <Label htmlFor="edit-fob" className="font-bold">FOB</Label>
                    </div>
                    {hasFOB && (
                      <div className="grid grid-cols-4 gap-4 pl-6">
                        <div className="space-y-1">
                          <Label className="text-xs">Taxa (%)</Label>
                          <Input type="number" step="0.01" value={royaltyRateFOB} onChange={(e) => setRoyaltyRateFOB(e.target.value)} />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Observações/Taxas Específicas</Label>
                          <Input value={royaltyFOBNotes} onChange={(e) => setRoyaltyFOBNotes(e.target.value)} />
                        </div>
                        <div className="col-span-4 flex items-center gap-2 pt-2">
                          <input type="checkbox" id="edit-afob" checked={hasAdditionalFOB} onChange={(e) => setHasAdditionalFOB(e.target.checked)} />
                          <Label htmlFor="edit-afob" className="text-xs font-medium">Existe mais uma taxa nesta modalidade?</Label>
                        </div>
                        {hasAdditionalFOB && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Taxa 2 (%)</Label>
                              <Input type="number" step="0.01" value={royaltyRateFOB2} onChange={(e) => setRoyaltyRateFOB2(e.target.value)} />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label className="text-xs">Observações Taxa 2</Label>
                              <Input value={royaltyFOBNotes2} onChange={(e) => setRoyaltyFOBNotes2(e.target.value)} />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Período de Apuração</Label>
                    <Select onValueChange={setReportingFrequency} value={reportingFrequency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Semanal">Semanal</SelectItem>
                        <SelectItem value="Mensal">Mensal</SelectItem>
                        <SelectItem value="Trimestral">Trimestral</SelectItem>
                        <SelectItem value="Semestral">Semestral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo de Envio (dias após período)</Label>
                    <Input value={reportingDeadline} onChange={(e) => setReportingDeadline(e.target.value)} placeholder="Ex: 15 dias" />
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <div className="p-4 border rounded-lg space-y-4 bg-indigo-50/30 border-indigo-100">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="edit-hasMarketingFund" checked={hasMarketingFund} onChange={(e) => setHasMarketingFund(e.target.checked)} />
                    <Label htmlFor="edit-hasMarketingFund" className="font-bold text-indigo-900">Fundo de Marketing?</Label>
                  </div>
                  {hasMarketingFund && (
                    <div className="space-y-6 pl-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo de Cálculo</Label>
                          <Input value={marketingFundType} onChange={(e) => setMarketingFundType(e.target.value)} placeholder="Ex: Sobre Vendas Líquidas" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Taxa (%)</Label>
                          <Input type="number" step="0.01" value={marketingFundRate} onChange={(e) => setMarketingFundRate(e.target.value)} />
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-indigo-100">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="edit-hasMarketingFundInstallments" 
                            checked={hasMarketingFundInstallments} 
                            onChange={(e) => setHasMarketingFundInstallments(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <Label htmlFor="edit-hasMarketingFundInstallments" className="text-sm font-medium text-indigo-900">O fundo de marketing terá parcelas de adiantamento?</Label>
                        </div>

                        {hasMarketingFundInstallments && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="space-y-2">
                              <Label className="text-xs">Quantas parcelas de Fundo de Marketing?</Label>
                              <Input type="number" min="1" value={numMarketingFundInstallments} onChange={(e) => setNumMarketingFundInstallments(e.target.value)} className="h-8 w-24" />
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              {marketingFundInstallments.map((inst, idx) => (
                                <div key={idx} className="grid grid-cols-4 gap-4 p-3 border rounded bg-white items-end">
                                  <div className="font-bold text-[10px] text-slate-400 pb-2">Parcela {inst.installmentNumber}</div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">Ano</Label>
                                    <Input 
                                      placeholder="Ex: 2024"
                                      value={inst.year || ''} 
                                      onChange={(e) => {
                                        const newInst = [...marketingFundInstallments];
                                        newInst[idx].year = e.target.value;
                                        setMarketingFundInstallments(newInst);
                                      }} 
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">Valor</Label>
                                    <Input 
                                      type="text" 
                                      value={formatCurrencyBR(inst.amount)} 
                                      onChange={(e) => {
                                        const val = parseCurrencyBR(e.target.value);
                                        const newInst = [...marketingFundInstallments];
                                        newInst[idx].amount = val;
                                        setMarketingFundInstallments(newInst);
                                      }} 
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">Vencimento</Label>
                                    <Input 
                                      type="date"
                                      value={inst.dueDate} 
                                      onChange={(e) => {
                                        const newInst = [...marketingFundInstallments];
                                        newInst[idx].dueDate = e.target.value;
                                        setMarketingFundInstallments(newInst);
                                      }} 
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Propriedades e Marcas</Label>
                  <textarea 
                    className="w-full min-h-[120px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={propertiesInfo}
                    onChange={(e) => setPropertiesInfo(e.target.value)}
                    placeholder="Insira as informações de propriedades e marcas..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Linhas Vinculadas</Label>
                  <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-slate-50">
                    {lines.filter(l => l.licenseId === licenseId).map(l => (
                      <Badge 
                        key={l.id} 
                        variant={selectedLines.includes(l.id) ? "default" : "outline"}
                        className="cursor-pointer py-1.5 px-3"
                        onClick={() => {
                          setSelectedLines(prev => 
                            prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]
                          );
                        }}
                      >
                        {l.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Produtos e Categorias</Label>
                  <textarea 
                    className="w-full min-h-[100px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={productsInfo}
                    onChange={(e) => setProductsInfo(e.target.value)}
                    placeholder="Descreva os produtos e categorias..."
                  />
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <div className="p-8 border-2 border-dashed rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-4">
                  <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                    <FileText size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-900">Upload do Contrato Assinado</p>
                    <p className="text-sm text-slate-500">Arraste ou clique para selecionar o arquivo PDF</p>
                  </div>
                  <div className="flex flex-col items-center gap-4 w-full max-w-md">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => document.getElementById('edit-contract-file-upload')?.click()}
                    >
                      <Upload size={16} /> Selecionar Arquivo
                    </Button>
                    <input 
                      type="file" 
                      id="edit-contract-file-upload" 
                      className="hidden" 
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          toast.success(`Arquivo ${e.target.files[0].name} selecionado.`);
                          // Simulating upload by setting a fake URL
                          setSignedContractUrl(`https://storage.mock/contracts/${e.target.files[0].name}`);
                        }
                      }}
                    />
                    <div className="w-full flex items-center gap-2">
                      <div className="h-[1px] bg-slate-200 flex-1"></div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">ou insira o link</span>
                      <div className="h-[1px] bg-slate-200 flex-1"></div>
                    </div>
                    <Input 
                      type="url" 
                      placeholder="Link do arquivo (Ex: Google Drive, Dropbox)" 
                      value={signedContractUrl}
                      onChange={(e) => setSignedContractUrl(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex justify-between items-center pt-6 border-t">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setStep(1); }}>
                  Cancelar
                </Button>
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Voltar
                  </Button>
                )}
              </div>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 min-w-[120px]">
                {step === totalSteps ? 'Salvar Alterações' : 'Próximo Passo'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-8 pt-4">
            {/* Seção 1: Identificação */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b pb-2">1. Identificação do Contrato</h3>
              <div className="grid grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Licenciador</p>
                  <p className="text-sm font-semibold text-slate-900">{license?.fantasyName}</p>
                  <p className="text-xs text-slate-500">{license?.legalName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº Contrato</p>
                  <p className="text-sm font-semibold text-slate-900">{contract.contractNumber || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                  <Badge className={
                    contract.status === 'Ativo' ? "bg-emerald-100 text-emerald-700 border-none" :
                    contract.status === 'Encerrado' ? "bg-slate-100 text-slate-700 border-none" :
                    "bg-amber-100 text-amber-700 border-none"
                  }>
                    {contract.status || 'Ativo'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Moeda</p>
                  <p className="text-sm text-slate-700 font-medium">{contract.currency || 'BRL'}</p>
                </div>
              </div>
            </div>

            {/* Seção 2: Vigência e Sell-off */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b pb-2">2. Vigência e Período de Sell-off</h3>
              <div className="grid grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Início</p>
                  <p className="text-sm text-slate-700 font-medium">{formatDateBR(contract.startDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Término</p>
                  <p className="text-sm text-slate-700 font-medium">{formatDateBR(contract.endDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período Sell-off</p>
                  <p className="text-sm text-slate-700 font-medium">{contract.sellOffPeriod ? `${contract.sellOffPeriod} dias` : '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Final Sell-off</p>
                  <p className="text-sm text-slate-700 font-medium">{formatDateBR(contract.sellOffEndDate)}</p>
                </div>
              </div>
            </div>

            {/* Seção 3: Valores de MG */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b pb-2">3. Valores de Mínimo Garantido (MG)</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Mínimo Garantido Total</p>
                    <p className="text-2xl font-black text-blue-700">
                      {getCurrencySymbol(contract.currency || 'BRL')} {contract.minimumGuarantee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {contract.isDividedIntoYears && (
                    <Badge variant="outline" className="bg-white text-blue-600 border-blue-200">Contrato Plurianual</Badge>
                  )}
                </div>
                
                {contract.isDividedIntoYears && contract.years && (
                  <div className="grid grid-cols-3 gap-4">
                    {contract.years.map((y: any) => (
                      <div key={y.yearNumber} className="p-3 border rounded-lg bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ano {y.yearNumber}</p>
                        <p className="text-sm font-bold text-slate-900">
                          {getCurrencySymbol(contract.currency || 'BRL')} {y.minimumGuarantee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {formatDateBR(y.startDate)} - {formatDateBR(y.endDate)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Seção 4: Royalties e Apuração */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b pb-2">4. Taxas de Royalties e Apuração</h3>
              <div className="grid grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periodicidade</p>
                  <p className="text-sm text-slate-700 font-medium">{contract.reportingFrequency || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo de Envio</p>
                  <p className="text-sm text-slate-700 font-medium">{contract.reportingDeadline ? `${contract.reportingDeadline} dias após período` : '-'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="p-3 border rounded-lg bg-slate-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendas Líquidas</p>
                    <Badge variant="outline" className="text-[9px] h-4 px-1">{contract.royaltyRateNetSales1 ? 'Ativo' : 'N/A'}</Badge>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{Number(((contract.royaltyRateNetSales1 || 0) * 100).toFixed(2))}%</p>
                  {contract.royaltyNetSalesNotes && <p className="text-[10px] text-slate-500 italic">{contract.royaltyNetSalesNotes}</p>}
                  {contract.hasAdditionalNetSales && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-[9px] text-slate-400 uppercase font-bold">Taxa Adicional</p>
                      <p className="text-sm font-bold text-slate-700">{Number(((contract.royaltyRateNetSales2 || 0) * 100).toFixed(2))}%</p>
                      {contract.royaltyNetSalesNotes2 && <p className="text-[10px] text-slate-500 italic">{contract.royaltyNetSalesNotes2}</p>}
                    </div>
                  )}
                </div>

                <div className="p-3 border rounded-lg bg-slate-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compras Líquidas</p>
                    <Badge variant="outline" className="text-[9px] h-4 px-1">{contract.royaltyRateNetPurchases ? 'Ativo' : 'N/A'}</Badge>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{Number(((contract.royaltyRateNetPurchases || 0) * 100).toFixed(2))}%</p>
                  {contract.royaltyNetPurchasesNotes && <p className="text-[10px] text-slate-500 italic">{contract.royaltyNetPurchasesNotes}</p>}
                </div>

                <div className="p-3 border rounded-lg bg-slate-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FOB</p>
                    <Badge variant="outline" className="text-[9px] h-4 px-1">{contract.royaltyRateFOB ? 'Ativo' : 'N/A'}</Badge>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{Number(((contract.royaltyRateFOB || 0) * 100).toFixed(2))}%</p>
                  {contract.royaltyFOBNotes && <p className="text-[10px] text-slate-500 italic">{contract.royaltyFOBNotes}</p>}
                </div>
              </div>
            </div>

            {/* Seção 5: Pagamento e Marketing */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b pb-2">5. Condições de Pagamento e Marketing</h3>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo de Pagamento</p>
                    <p className="text-sm text-slate-700 font-medium">{contract.paymentDeadline ? `${contract.paymentDeadline} dias após apuração` : '-'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parcelas de MG</p>
                    <div className="space-y-2">
                      {contract.mgInstallments && contract.mgInstallments.length > 0 ? (
                        contract.mgInstallments.map((inst: any) => (
                          <div key={inst.installmentNumber} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                            <span className="font-medium text-slate-600">Parcela {inst.installmentNumber} {inst.year ? `(${inst.year})` : ''}</span>
                            <span className="font-bold text-slate-900">{getCurrencySymbol(contract.currency || 'BRL')} {inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span className="text-slate-500">{formatDateBR(inst.dueDate)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">Nenhuma parcela definida</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fundo de Marketing</p>
                  </div>
                  {contract.hasMarketingFund ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Taxa</p>
                          <p className="text-sm font-bold text-slate-900">{Number(((contract.marketingFundRate || 0) * 100).toFixed(2))}%</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Tipo</p>
                          <p className="text-xs font-semibold text-slate-700">{contract.marketingFundType || '-'}</p>
                        </div>
                      </div>

                      {contract.hasMarketingFundInstallments && contract.marketingFundInstallments && contract.marketingFundInstallments.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parcelas de Adiantamento</p>
                          <div className="space-y-2">
                            {contract.marketingFundInstallments.map((inst: any) => (
                              <div key={inst.installmentNumber} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                                <span className="font-medium text-slate-600">Parcela {inst.installmentNumber} {inst.year ? `(${inst.year})` : ''}</span>
                                <span className="font-bold text-slate-900">{getCurrencySymbol(contract.currency || 'BRL')} {inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <span className="text-slate-500">{formatDateBR(inst.dueDate)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Inativo</p>
                  )}
                </div>
              </div>
            </div>

            {/* Seção 6: Propriedades e Linhas */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b pb-2">6. Propriedades, Marcas e Linhas</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informações de Propriedades</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[60px]">
                    {contract.propertiesInfo || 'Nenhuma informação adicional'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linhas Vinculadas</p>
                  <div className="flex flex-wrap gap-2">
                    {linkedLines.map(l => (
                      <Badge key={l.id} variant="outline" className="bg-white border-slate-200 text-slate-700">{l.name}</Badge>
                    ))}
                    {linkedLines.length === 0 && <span className="text-xs text-slate-400 italic">Nenhuma linha vinculada</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 7: Produtos por Categoria */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b pb-2">7. Produtos por Categoria</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {productsByCat.map(({ category, products }) => (
                  <div key={category} className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-l-2 border-blue-200 pl-2">{category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {products.map(p => (
                        <Badge key={p.id} variant="secondary" className="bg-slate-100 text-slate-600 border-none text-[10px] py-0 px-2 h-5">{p.name}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {productsByCat.length === 0 && <span className="text-xs text-slate-400 italic col-span-2">Nenhum produto vinculado a categorias.</span>}
              </div>
            </div>

            {/* Seção 8: Contrato Assinado */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider border-b pb-2">8. Documentação</h3>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-md border border-slate-200">
                    <FileText size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Contrato Assinado (PDF/Link)</p>
                    <p className="text-xs text-slate-500">{contract.signedContractUrl ? 'Documento disponível' : 'Nenhum documento anexado'}</p>
                  </div>
                </div>
                {contract.signedContractUrl && (
                  <Button variant="outline" size="sm" className="gap-2" render={
                    <a href={contract.signedContractUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} /> Abrir Documento
                    </a>
                  } />
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportContractsDialog({ licenses, lines, products }: { licenses: License[], lines: Line[], products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const templateColumns = [
    "Licenciador (Nome fantasia)",
    "Licenciador (Nome jurídico)",
    "Administradora/Agente",
    "ID Contrato",
    "Status",
    "Período de vigência",
    "Data de início",
    "Data de término",
    "Período de sell-off",
    "Data de término sell-off",
    "Moeda do contrato",
    "Total de mínimo garantido",
    "Quantidade de parcelas de mínimo garantido",
    "Valores de parcelas de mínimo garantido",
    "Datas de vencimento de parcelas de mínimo garantido",
    "Períodos de Anos",
    "Data início Ano 1",
    "Data final Ano 1",
    "Data início Ano 2",
    "Data final Ano 2",
    "Data início Ano 3",
    "Data final Ano 3",
    "Data início Ano 4",
    "Data final Ano 4",
    "% royalties vendas",
    "% royalties Compras",
    "% royalties FOB",
    "Taxa de royalties para cada categorias-propriedades-marcas",
    "Forma de cálculo de royalties se é em total líquido ou sobre valor de compra",
    "Período de apuração de relatório de royalties",
    "prazo para envio de relatório de royalties",
    "Prazo de pagamento de royalites e parcelas de mínimo garantido",
    "Taxa de CMF ou Fundo de Marketing",
    "Propriedades/Marcas em contrato",
    "Linhas Spiral",
    "Tipos de produtos em contrato"
  ];

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([templateColumns]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_importacao_contratos.xlsx");
    toast.success("Template baixado com sucesso!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseExcelDate = (val: any) => {
    if (!val) return "";
    if (typeof val === 'number') {
      const date = XLSX.utils.format_cell({ v: val, t: 'd' });
      return new Date(val * 86400000 - 2209161600000).toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return val;
  };

  const handleImport = async () => {
    if (!file) return toast.error("Selecione um arquivo para importar.");
    
    setIsUploading(true);
    console.log("Iniciando importação do arquivo:", file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        console.log(`Arquivo lido. Total de linhas encontradas: ${jsonData.length}`);
        
        if (jsonData.length === 0) {
          toast.error("O arquivo está vazio ou não possui dados válidos.");
          setIsUploading(false);
          return;
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const getVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(key => k.trim().toLowerCase() === key.toLowerCase())
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const licenseName = String(getVal(["Licenciador (Nome fantasia)", "Licenciador"]) || "").trim();
          
          if (!licenseName) {
            console.warn(`Linha ${i + 2}: Pulada por falta de 'Licenciador (Nome fantasia)'`);
            skippedCount++;
            continue;
          }

          console.log(`Processando linha ${i + 2}: ${licenseName}`);

          try {
            let license = licenses.find(l => 
              String(l.fantasyName || "").trim().toLowerCase() === licenseName.toLowerCase() ||
              String(l.legalName || "").trim().toLowerCase() === licenseName.toLowerCase()
            );
            let licenseId = license?.id;

            if (!licenseId) {
              console.log(`Licenciador '${licenseName}' não encontrada. Criando nova...`);
              const newLicenseRef = await addDoc(collection(db, 'licenses'), {
                fantasyName: licenseName,
                legalName: String(getVal(["Licenciador (Nome jurídico)", "Nome Jurídico"]) || licenseName).trim(),
                agent: String(getVal(["Administradora/Agente", "Agente"]) || "").trim(),
                createdAt: serverTimestamp()
              });
              licenseId = newLicenseRef.id;
              console.log(`Novo licenciador criado com ID: ${licenseId}`);
            }

            const lineNames = String(getVal(["Linhas Spiral", "Linhas"]) || "").split(',').map(s => s.trim()).filter(Boolean);
            const lineIds = lines
              .filter(l => l.licenseId === licenseId && lineNames.some(name => l.name.toLowerCase() === name.toLowerCase()))
              .map(l => l.id);

            const productNames = String(getVal(["Tipos de produtos em contrato", "Produtos"]) || "").split(',').map(s => s.trim()).filter(Boolean);
            const productIds = products
              .filter(p => p.licenseId === licenseId && productNames.some(name => p.name.toLowerCase() === name.toLowerCase()))
              .map(p => p.id);

            const contractData = {
              licenseId,
              contractNumber: String(getVal(["ID Contrato", "Contrato"]) || "").trim(),
              status: String(getVal(["Status"]) || "Ativo").trim(),
              startDate: parseExcelDate(getVal(["Data de início", "Início"])),
              endDate: parseExcelDate(getVal(["Data de término", "Término"])),
              sellOffPeriod: String(getVal(["Período de sell-off", "Sell-off"]) || ""),
              sellOffEndDate: parseExcelDate(getVal(["Data de término sell-off", "Fim Sell-off"])),
              currency: String(getVal(["Moeda do contrato", "Moeda"]) || "BRL").trim(),
              minimumGuarantee: Number(getVal(["Total de mínimo garantido", "MG"])) || 0,
              royaltyRateNetSales1: (Number(getVal(["% royalties vendas", "Royalty Vendas"])) || 0) / (Number(getVal(["% royalties vendas", "Royalty Vendas"])) > 1 ? 100 : 1),
              royaltyRateNetPurchases: (Number(getVal(["% royalties Compras", "Royalty Compras"])) || 0) / (Number(getVal(["% royalties Compras", "Royalty Compras"])) > 1 ? 100 : 1),
              royaltyRateFOB: (Number(getVal(["% royalties FOB", "Royalty FOB"])) || 0) / (Number(getVal(["% royalties FOB", "Royalty FOB"])) > 1 ? 100 : 1),
              paymentTerms: String(getVal(["Prazo de pagamento de royalites e parcelas de mínimo garantido", "Prazo Pagamento"]) || ""),
              reportingFrequency: String(getVal(["Período de apuração de relatório de royalties", "Frequência Relatório"]) || "Mensal"),
              lineIds,
              productIds,
              createdAt: serverTimestamp()
            };
            
            if (!contractData.contractNumber) {
              console.warn(`Linha ${i + 2}: Pulada por falta de 'ID Contrato'`);
              skippedCount++;
              continue;
            }

            await addDoc(collection(db, 'contracts'), contractData);
            importedCount++;
            console.log(`Contrato ${importedCount} importado com sucesso.`);
          } catch (rowError) {
            console.error(`Erro ao processar linha ${i + 2}:`, rowError);
          }
        }
        
        console.log(`Importação finalizada. Sucesso: ${importedCount}, Pulados: ${skippedCount}`);
        toast.success(`${importedCount} contratos importados com sucesso!`);
        if (skippedCount > 0) {
          toast.info(`${skippedCount} linhas foram ignoradas por falta de dados obrigatórios.`);
        }
        setOpen(false);
      } catch (err) {
        console.error("Erro crítico na importação:", err);
        toast.error("Erro ao processar o arquivo. Verifique o console para mais detalhes.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "outline" }), "border-slate-200 text-slate-600 hover:bg-slate-50 gap-2")}>
            <Upload size={18} /> Importar informações
          </button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Contratos</DialogTitle>
          <DialogDescription>
            Faça o upload de uma planilha Excel com as informações dos contratos.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>1. Baixe o modelo</Label>
            <p className="text-xs text-slate-500 mb-2">
              Utilize nosso template para garantir que os dados estejam no formato correto.
            </p>
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="w-full justify-start gap-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-blue-600"
            >
              <FileSpreadsheet size={18} /> Baixar Template (.xlsx)
            </Button>
          </div>

          <div className="space-y-2">
            <Label>2. Upload do arquivo</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-all bg-slate-50/50">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
                <div className="bg-white w-12 h-12 rounded-full shadow-sm border border-slate-100 flex items-center justify-center mx-auto">
                  <Upload size={20} className="text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {file ? file.name : "Clique para selecionar"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Suporta .xlsx e .xls
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={() => setOpen(false)}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || isUploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isUploading ? "Processando..." : "Iniciar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportPaymentsDialog({ contracts, licenses }: { contracts: Contract[], licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const templateColumns = [
    "Responsável",
    "Data Recebimento",
    "Data Solicitação Pagto",
    "Tipo",
    "Licenciador",
    "Contrato",
    "Identificação",
    "Data de Vencimento",
    "Data Pagamento",
    "Moeda",
    "Valor",
    "Ordem de Pagamento",
    "Invoice / NF",
    "Observações",
    "Ano",
    "Parcela",
    "Status"
  ];

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([templateColumns]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_importacao_pagamentos.xlsx");
    toast.success("Template baixado com sucesso!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseExcelDate = (val: any) => {
    if (!val) return "";
    if (typeof val === 'number') {
      return new Date(val * 86400000 - 2209161600000).toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return val;
  };

  const handleImport = async () => {
    if (!file) return toast.error("Selecione um arquivo para importar.");
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast.error("O arquivo está vazio.");
          setIsUploading(false);
          return;
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const getVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(key => k.trim().toLowerCase() === key.toLowerCase())
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const licenseName = String(getVal(["Licenciador"]) || "").trim();
          const contractNum = String(getVal(["Contrato"]) || "").trim();
          
          if (!licenseName || !contractNum) {
            skippedCount++;
            continue;
          }

          try {
            const license = licenses.find(l => 
              String(l.fantasyName || "").trim().toLowerCase() === licenseName.toLowerCase() ||
              String(l.legalName || "").trim().toLowerCase() === licenseName.toLowerCase()
            );
            const contract = contracts.find(c => 
              String(c.contractNumber || "").trim().toLowerCase() === contractNum.toLowerCase() &&
              (license ? c.licenseId === license.id : true)
            );

            if (!license || !contract) {
              skippedCount++;
              continue;
            }

            const typeMap: Record<string, string> = {
              'Mínimo Garantido': 'mg',
              'MG': 'mg',
              'Royalties Excedentes': 'excess',
              'Royalties': 'excess',
              'Fundo de Marketing': 'marketing',
              'Marketing': 'marketing',
              'Outros': 'other'
            };

            const statusMap: Record<string, string> = {
              'Pago': 'paid',
              'Pendente': 'pending'
            };

            const paymentData = {
              responsible: String(getVal(["Responsável"]) || "").trim(),
              receiptDate: parseExcelDate(getVal(["Data Recebimento"])),
              paymentRequestDate: parseExcelDate(getVal(["Data Solicitação Pagto"])),
              type: typeMap[String(getVal(["Tipo"]) || "")] || "mg",
              licenseId: license.id,
              contractId: contract.id,
              identification: String(getVal(["Identificação"]) || "").trim(),
              dueDate: parseExcelDate(getVal(["Data de Vencimento"])),
              date: parseExcelDate(getVal(["Data Pagamento"])),
              currency: String(getVal(["Moeda do contrato", "Moeda"]) || "BRL").trim(),
              amount: Number(getVal(["Valor", "Montante"])) || 0,
              paymentOrder: String(getVal(["Ordem de Pagamento", "OP"]) || "").trim(),
              invoice: String(getVal(["Invoice / NF", "NF", "Nota Fiscal", "Fatura"]) || "").trim(),
              notes: String(getVal(["Observações", "Notas"]) || "").trim(),
              year: String(getVal(["Ano"]) || ""),
              installmentNumber: String(getVal(["Parcela"]) || ""),
              status: statusMap[String(getVal(["Status"]) || "")] || "paid",
              createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'payments'), paymentData);
            importedCount++;
          } catch (rowError) {
            console.error(`Erro na linha ${i + 2}:`, rowError);
          }
        }
        
        toast.success(`${importedCount} pagamentos importados!`);
        if (skippedCount > 0) {
          toast.info(`${skippedCount} linhas ignoradas por dados incompletos ou não encontrados.`);
        }
        setOpen(false);
      } catch (err) {
        toast.error("Erro ao processar o arquivo.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "outline" }), "border-slate-200 text-slate-600 hover:bg-slate-50 gap-2")}>
            <Upload size={18} /> Importar Pagamentos
          </button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Pagamentos</DialogTitle>
          <DialogDescription>
            Faça o upload de uma planilha Excel com as informações dos pagamentos.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>1. Baixe o modelo</Label>
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="w-full justify-start gap-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-blue-600"
            >
              <FileSpreadsheet size={18} /> Baixar Template (.xlsx)
            </Button>
          </div>

          <div className="space-y-2">
            <Label>2. Upload do arquivo</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-all bg-slate-50/50">
              <input
                type="file"
                id="payment-file-upload"
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
              />
              <label htmlFor="payment-file-upload" className="cursor-pointer space-y-2 block">
                <div className="bg-white w-12 h-12 rounded-full shadow-sm border border-slate-100 flex items-center justify-center mx-auto">
                  <Upload size={20} className="text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {file ? file.name : "Clique para selecionar"}
                  </p>
                  <p className="text-xs text-slate-400">Suporta .xlsx e .xls</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!file || isUploading} className="bg-blue-600 hover:bg-blue-700">
            {isUploading ? "Processando..." : "Iniciar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportReportsDialog({ contracts, lines, products, licenses }: { contracts: Contract[], lines: Line[], products: Product[], licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const templateColumns = [
    "Licenciador", "Linha", "Ano", "Mês", "Código", "Produto", "Qtd", "Vlr_Unitario", 
    "Vlr_Total", "ICMS", "Pis", "Cofins", "IPI", "Total Líquido", "% Royalt", 
    "Royalties", "Cod_Barras", "Tipo de relatório", "Nome arquivo", "Categoria", 
    "Ano VA", "Preço de custo", "Contrato", "Status", "CMF", "Ano contrato", 
    "Taxa moeda", "ID Licenciador"
  ];

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([templateColumns]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_importacao_royalties.xlsx");
    toast.success("Template baixado com sucesso!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return toast.error("Selecione um arquivo para importar.");
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast.error("O arquivo está vazio.");
          setIsUploading(false);
          return;
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const row of jsonData) {
          // Helper to get value from row with flexible header matching
          const getVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(key => k.trim().toLowerCase() === key.toLowerCase())
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const licenseName = String(getVal(["Licenciador"]) || "").trim();
          const lineName = String(getVal(["Linha"]) || "").trim();
          const contractNum = String(getVal(["Contrato"]) || "").trim();
          const productName = String(getVal(["Produto"]) || "").trim();
          const sku = String(getVal(["Código", "SKU"]) || "").trim();
          const month = Number(getVal(["Mês"])) || 0;
          const year = Number(getVal(["Ano"])) || 0;
          const quantity = Number(getVal(["Qtd", "Quantidade"])) || 0;
          const netValue = Number(getVal(["Vlr_Total", "Total Líquido", "Valor Total"])) || 0;
          const royaltyValue = Number(getVal(["Royalties", "Valor Royalties"])) || 0;

          const license = licenses.find(l => 
            String(l.fantasyName || "").trim().toLowerCase() === licenseName.toLowerCase() ||
            String(l.legalName || "").trim().toLowerCase() === licenseName.toLowerCase()
          );

          const line = lines.find(l => 
            String(l.name || "").trim().toLowerCase() === lineName.toLowerCase() &&
            (license ? l.licenseId === license.id : true)
          );

          const contract = contracts.find(c => 
            String(c.contractNumber || "").trim().toLowerCase() === contractNum.toLowerCase() &&
            (license ? c.licenseId === license.id : true)
          );

          const product = products.find(p => 
            (sku && String(p.sku || "").trim().toLowerCase() === sku.toLowerCase()) || 
            (productName && String(p.name || "").trim().toLowerCase() === productName.toLowerCase())
          );

          if (!license) {
            console.warn(`Licenciador não encontrado: "${licenseName}"`);
            skippedCount++;
            continue;
          }

          if (!contract || !line) {
            console.warn(`Contrato ("${contractNum}") ou Linha ("${lineName}") não encontrados para o licenciador "${licenseName}"`);
            skippedCount++;
            continue;
          }

          await addDoc(collection(db, 'reports'), {
            contractId: contract.id,
            lineId: line.id,
            productId: product?.id || 'Geral',
            month,
            year,
            quantity,
            netValue,
            royaltyValue,
            icms: Number(getVal(["ICMS"])) || 0,
            pis: Number(getVal(["Pis"])) || 0,
            cofins: Number(getVal(["Cofins"])) || 0,
            ipi: Number(getVal(["IPI"])) || 0,
            codBarras: String(getVal(["Cod_Barras", "Código de Barras"]) || ""),
            reportType: String(getVal(["Tipo de relatório"]) || ""),
            fileName: String(getVal(["Nome arquivo"]) || ""),
            category: String(getVal(["Categoria"]) || ""),
            anoVA: String(getVal(["Ano VA"]) || ""),
            costPrice: Number(getVal(["Preço de custo"])) || 0,
            cmf: String(getVal(["CMF"]) || ""),
            contractYear: String(getVal(["Ano contrato"]) || ""),
            currencyRate: String(getVal(["Taxa moeda"]) || ""),
            createdAt: serverTimestamp()
          });
          importedCount++;
        }

        if (skippedCount > 0) {
          toast.warning(`${importedCount} registros importados, ${skippedCount} ignorados por inconsistência (verifique o console para detalhes).`);
        } else {
          toast.success(`${importedCount} registros importados com sucesso!`);
        }
        setOpen(false);
        setFile(null);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao processar o arquivo.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button className={cn(buttonVariants({ variant: "outline" }), "gap-2 border-slate-200 text-slate-600 hover:bg-slate-50")}>
          <FileSpreadsheet size={18} /> Importar Royalties
        </button>
      } />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Royalties</DialogTitle>
          <DialogDescription>
            Faça o upload de uma planilha Excel com as informações de royalties.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>1. Baixe o modelo</Label>
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="w-full justify-start gap-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-blue-600"
            >
              <FileSpreadsheet size={18} /> Baixar Template (.xlsx)
            </Button>
          </div>

          <div className="space-y-2">
            <Label>2. Upload do arquivo</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-all bg-slate-50/50">
              <input
                type="file"
                id="report-file-upload"
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
              />
              <label htmlFor="report-file-upload" className="cursor-pointer space-y-2 block">
                <div className="bg-white w-12 h-12 rounded-full shadow-sm border border-slate-100 flex items-center justify-center mx-auto">
                  <Upload size={20} className="text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {file ? file.name : "Clique para selecionar"}
                  </p>
                  <p className="text-xs text-slate-400">Suporta .xlsx e .xls</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!file || isUploading} className="bg-blue-600 hover:bg-blue-700">
            {isUploading ? "Processando..." : "Iniciar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddContractDialog({ licenses, lines, products, contracts }: { licenses: License[], lines: Line[], products: Product[], contracts: Contract[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 7;

  // Page 1: Identification
  const [licenseId, setLicenseId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [isAddendum, setIsAddendum] = useState(false);
  const [parentId, setParentId] = useState('');

  // Page 2: Period & Sell-off
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDividedIntoYears, setIsDividedIntoYears] = useState(false);
  const [numYears, setNumYears] = useState('1');
  const [years, setYears] = useState<ContractYear[]>([]);
  const [sellOffPeriod, setSellOffPeriod] = useState('');
  const [sellOffEndDate, setSellOffEndDate] = useState('');

  // Page 3: MG Installments
  const [numInstallments, setNumInstallments] = useState('1');
  const [installments, setInstallments] = useState<MGInstallment[]>([]);
  const [paymentDeadline, setPaymentDeadline] = useState('');

  // Page 4: Royalties
  const [hasNetSales, setHasNetSales] = useState(false);
  const [royaltyRateNetSales1, setRoyaltyRateNetSales1] = useState('');
  const [royaltyNetSalesNotes, setRoyaltyNetSalesNotes] = useState('');
  
  const [hasNetPurchases, setHasNetPurchases] = useState(false);
  const [royaltyRateNetPurchases, setRoyaltyRateNetPurchases] = useState('');
  const [royaltyNetPurchasesNotes, setRoyaltyNetPurchasesNotes] = useState('');
  
  const [hasFOB, setHasFOB] = useState(false);
  const [royaltyRateFOB, setRoyaltyRateFOB] = useState('');
  const [royaltyFOBNotes, setRoyaltyFOBNotes] = useState('');
  
  const [hasAdditionalNetSales, setHasAdditionalNetSales] = useState(false);
  const [royaltyRateNetSales2, setRoyaltyRateNetSales2] = useState('');
  const [royaltyNetSalesNotes2, setRoyaltyNetSalesNotes2] = useState('');

  const [hasAdditionalNetPurchases, setHasAdditionalNetPurchases] = useState(false);
  const [royaltyRateNetPurchases2, setRoyaltyRateNetPurchases2] = useState('');
  const [royaltyNetPurchasesNotes2, setRoyaltyNetPurchasesNotes2] = useState('');

  const [hasAdditionalFOB, setHasAdditionalFOB] = useState(false);
  const [royaltyRateFOB2, setRoyaltyRateFOB2] = useState('');
  const [royaltyFOBNotes2, setRoyaltyFOBNotes2] = useState('');
  
  const [reportingFrequency, setReportingFrequency] = useState('Trimestral');
  const [reportingDeadline, setReportingDeadline] = useState('');

  // Page 5: Marketing Fund
  const [hasMarketingFund, setHasMarketingFund] = useState(false);
  const [marketingFundType, setMarketingFundType] = useState('');
  const [marketingFundRate, setMarketingFundRate] = useState('');
  const [hasMarketingFundInstallments, setHasMarketingFundInstallments] = useState(false);
  const [numMarketingFundInstallments, setNumMarketingFundInstallments] = useState('1');
  const [marketingFundInstallments, setMarketingFundInstallments] = useState<MGInstallment[]>([]);

  // Page 6: Properties & Lines
  const [propertiesInfo, setPropertiesInfo] = useState('');
  const [selectedLines, setSelectedLines] = useState<string[]>([]);

  // Page 7: Products & Categories
  const [productsInfo, setProductsInfo] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Page 8: Signed Contract
  const [signedContractUrl, setSignedContractUrl] = useState('');

  // Effects
  useEffect(() => {
    if (isDividedIntoYears) {
      const n = parseInt(numYears) || 0;
      const newYears: ContractYear[] = [];
      for (let i = 1; i <= n; i++) {
        newYears.push({
          yearNumber: i,
          startDate: '',
          endDate: '',
          minimumGuarantee: 0
        });
      }
      setYears(newYears);
    } else {
      setYears([]);
    }
  }, [isDividedIntoYears, numYears]);

  useEffect(() => {
    if (endDate && sellOffPeriod) {
      const date = new Date(endDate);
      if (!isNaN(date.getTime())) {
        date.setDate(date.getDate() + parseInt(sellOffPeriod));
        setSellOffEndDate(date.toISOString().split('T')[0]);
      }
    }
  }, [endDate, sellOffPeriod]);

  useEffect(() => {
    const n = parseInt(numInstallments) || 0;
    setInstallments(prev => {
      const newInst = [...prev];
      if (newInst.length < n) {
        for (let i = newInst.length + 1; i <= n; i++) {
          newInst.push({ installmentNumber: i, amount: 0, dueDate: '', year: '' });
        }
      } else if (newInst.length > n) {
        return newInst.slice(0, n);
      }
      return newInst;
    });
  }, [numInstallments]);

  useEffect(() => {
    const n = parseInt(numMarketingFundInstallments) || 0;
    setMarketingFundInstallments(prev => {
      const newInst = [...prev];
      if (newInst.length < n) {
        for (let i = newInst.length + 1; i <= n; i++) {
          newInst.push({ installmentNumber: i, amount: 0, dueDate: '', year: '' });
        }
      } else if (newInst.length > n) {
        return newInst.slice(0, n);
      }
      return newInst;
    });
  }, [numMarketingFundInstallments]);

  useEffect(() => {
    if (isAddendum && parentId && contracts) {
      const parentExists = contracts.some(c => c.id === parentId && c.licenseId === licenseId);
      if (!parentExists) {
        setParentId('');
      }
    }
  }, [licenseId, isAddendum, contracts]);

  const totalMG = installments.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < totalSteps) {
      setStep(step + 1);
      return;
    }

    if (!licenseId) return toast.error('Selecione um licenciador.');
    
    try {
      await addDoc(collection(db, 'contracts'), {
        licenseId,
        contractNumber,
        status: 'Ativo',
        currency,
        startDate,
        endDate,
        isDividedIntoYears,
        years,
        sellOffPeriod,
        sellOffEndDate,
        minimumGuarantee: totalMG,
        royaltyRateNetSales1: hasNetSales ? (Number(royaltyRateNetSales1) || 0) / 100 : 0,
        royaltyNetSalesNotes,
        hasAdditionalNetSales,
        royaltyRateNetSales2: hasAdditionalNetSales ? (Number(royaltyRateNetSales2) || 0) / 100 : 0,
        royaltyNetSalesNotes2,
        royaltyRateNetPurchases: hasNetPurchases ? (Number(royaltyRateNetPurchases) || 0) / 100 : 0,
        royaltyNetPurchasesNotes,
        hasAdditionalNetPurchases,
        royaltyRateNetPurchases2: hasAdditionalNetPurchases ? (Number(royaltyRateNetPurchases2) || 0) / 100 : 0,
        royaltyNetPurchasesNotes2,
        royaltyRateFOB: hasFOB ? (Number(royaltyRateFOB) || 0) / 100 : 0,
        royaltyFOBNotes,
        hasAdditionalFOB,
        royaltyRateFOB2: hasAdditionalFOB ? (Number(royaltyRateFOB2) || 0) / 100 : 0,
        royaltyFOBNotes2,
        reportingFrequency,
        reportingDeadline,
        mgInstallments: installments,
        paymentDeadline,
        hasMarketingFund,
        marketingFundType,
        marketingFundRate: hasMarketingFund ? (Number(marketingFundRate) || 0) / 100 : 0,
        hasMarketingFundInstallments,
        marketingFundInstallments: hasMarketingFundInstallments ? marketingFundInstallments : [],
        propertiesInfo,
        lineIds: selectedLines,
        productsInfo,
        productIds: selectedProducts,
        signedContractUrl: signedContractUrl ? (signedContractUrl.startsWith('http') ? signedContractUrl : `https://${signedContractUrl}`) : '',
        isAddendum,
        parentId: isAddendum ? parentId : null,
        createdAt: serverTimestamp()
      });
      toast.success('Contrato cadastrado com sucesso!');
      setOpen(false);
      setStep(1);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao cadastrar contrato.');
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) setStep(1); }}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "default" }), "bg-blue-600 hover:bg-blue-700 gap-2")}>
            <Plus size={18} /> Novo Contrato
          </button>
        }
      />
      <DialogContent className="w-[40vw] !max-w-[40vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Contrato - Passo {step} de {totalSteps}</DialogTitle>
          <DialogDescription>
            {step === 1 && "Identificação básica do contrato."}
            {step === 2 && "Período de vigência e sell-off."}
            {step === 3 && "Condições de Pagamento e Parcelas de MG."}
            {step === 4 && "Taxas de Royalties e Apuração."}
            {step === 5 && "Fundo de Marketing."}
            {step === 6 && "Propriedades, Marcas e Linhas."}
            {step === 7 && "Contrato Assinado."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Licenciador</Label>
                <Select onValueChange={setLicenseId} value={licenseId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o licenciador" /></SelectTrigger>
                  <SelectContent>
                    {licenses.sort((a, b) => a.fantasyName.localeCompare(b.fantasyName)).map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.fantasyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nº do Contrato</Label>
                <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="Ex: 123/2024" />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Ex: BRL, USD" />
              </div>
              
              <div className="col-span-2 space-y-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="isAddendum" 
                    checked={isAddendum} 
                    onChange={(e) => setIsAddendum(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="isAddendum" className="cursor-pointer font-medium">Este contrato é um aditivo?</Label>
                </div>
                
                {isAddendum && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label>Contrato Pai</Label>
                    <Select onValueChange={setParentId} value={parentId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o contrato principal" /></SelectTrigger>
                      <SelectContent>
                        {contracts && contracts.filter(c => c.licenseId === licenseId).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.contractNumber || c.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Data Término</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg border">
                <input 
                  type="checkbox" 
                  id="divided" 
                  checked={isDividedIntoYears} 
                  onChange={(e) => setIsDividedIntoYears(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="divided" className="cursor-pointer">O período do contrato será dividido em anos?</Label>
              </div>

              {isDividedIntoYears && (
                <div className="space-y-4 p-4 border rounded-lg bg-white">
                  <div className="space-y-2">
                    <Label>Quantos anos?</Label>
                    <Input type="number" min="1" value={numYears} onChange={(e) => setNumYears(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {years.map((y, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-4 p-3 border rounded bg-slate-50">
                        <div className="col-span-2 font-bold text-xs uppercase text-slate-500">Ano {y.yearNumber}</div>
                        <div className="space-y-1">
                          <Label className="text-xs">Início</Label>
                          <Input 
                            type="date" 
                            value={y.startDate} 
                            onChange={(e) => {
                              const newYears = [...years];
                              newYears[idx].startDate = e.target.value;
                              setYears(newYears);
                            }} 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fim</Label>
                          <Input 
                            type="date" 
                            value={y.endDate} 
                            onChange={(e) => {
                              const newYears = [...years];
                              newYears[idx].endDate = e.target.value;
                              setYears(newYears);
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Período Sell-off (dias)</Label>
                  <Input type="number" value={sellOffPeriod} onChange={(e) => setSellOffPeriod(e.target.value)} placeholder="Ex: 60" />
                </div>
                <div className="space-y-2">
                  <Label>Data Final Sell-off (Calculada)</Label>
                  <Input type="date" value={sellOffEndDate} readOnly className="bg-slate-50" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Quantas parcelas de MG?</Label>
                  <Input type="number" min="1" value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {installments.map((inst, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-4 p-3 border rounded bg-slate-50 items-end">
                      <div className="font-bold text-xs text-slate-500 pb-2">Parcela {inst.installmentNumber}</div>
                      <div className="space-y-1">
                        <Label className="text-xs">Ano</Label>
                        <Input 
                          placeholder="Ex: 2024"
                          value={inst.year || ''} 
                          onChange={(e) => {
                            const newInst = [...installments];
                            newInst[idx].year = e.target.value;
                            setInstallments(newInst);
                          }} 
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                          <Input 
                            type="text" 
                            className="pl-8 text-lg font-semibold h-12"
                            value={formatCurrencyBR(inst.amount)} 
                            onChange={(e) => {
                              const val = parseCurrencyBR(e.target.value);
                              const newInst = [...installments];
                              newInst[idx].amount = val;
                              setInstallments(newInst);
                            }} 
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Vencimento</Label>
                        <Input 
                          placeholder={idx === 0 ? "Data ou 'Assinatura'" : "Data"}
                          value={inst.dueDate} 
                          onChange={(e) => {
                            const newInst = [...installments];
                            newInst[idx].dueDate = e.target.value;
                            setInstallments(newInst);
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center">
                  <span className="font-bold text-blue-900">Mínimo Garantido Total (Soma das Parcelas):</span>
                  <span className="text-xl font-black text-blue-600">
                    {currency} {totalMG.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="space-y-2">
                  <Label>Prazo de Pagamento</Label>
                  <Input value={paymentDeadline} onChange={(e) => setPaymentDeadline(e.target.value)} placeholder="Ex: 30 dias após fatura" />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="ns" checked={hasNetSales} onChange={(e) => setHasNetSales(e.target.checked)} />
                    <Label htmlFor="ns" className="font-bold">Vendas Líquidas</Label>
                  </div>
                  {hasNetSales && (
                    <div className="grid grid-cols-4 gap-4 pl-6">
                      <div className="space-y-1">
                        <Label className="text-xs">Taxa (%)</Label>
                        <Input type="number" step="0.01" value={royaltyRateNetSales1} onChange={(e) => setRoyaltyRateNetSales1(e.target.value)} />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Observações/Taxas Específicas</Label>
                        <Input value={royaltyNetSalesNotes} onChange={(e) => setRoyaltyNetSalesNotes(e.target.value)} placeholder="Ex: 12% para e-commerce" />
                      </div>
                      <div className="col-span-4 flex items-center gap-2 pt-2">
                        <input type="checkbox" id="ans" checked={hasAdditionalNetSales} onChange={(e) => setHasAdditionalNetSales(e.target.checked)} />
                        <Label htmlFor="ans" className="text-xs font-medium">Existe mais uma taxa nesta modalidade?</Label>
                      </div>
                      {hasAdditionalNetSales && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Taxa 2 (%)</Label>
                            <Input type="number" step="0.01" value={royaltyRateNetSales2} onChange={(e) => setRoyaltyRateNetSales2(e.target.value)} />
                          </div>
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Observações Taxa 2</Label>
                            <Input value={royaltyNetSalesNotes2} onChange={(e) => setRoyaltyNetSalesNotes2(e.target.value)} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="np" checked={hasNetPurchases} onChange={(e) => setHasNetPurchases(e.target.checked)} />
                    <Label htmlFor="np" className="font-bold">Compras Líquidas</Label>
                  </div>
                  {hasNetPurchases && (
                    <div className="grid grid-cols-4 gap-4 pl-6">
                      <div className="space-y-1">
                        <Label className="text-xs">Taxa (%)</Label>
                        <Input type="number" step="0.01" value={royaltyRateNetPurchases} onChange={(e) => setRoyaltyRateNetPurchases(e.target.value)} />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Observações/Taxas Específicas</Label>
                        <Input value={royaltyNetPurchasesNotes} onChange={(e) => setRoyaltyNetPurchasesNotes(e.target.value)} />
                      </div>
                      <div className="col-span-4 flex items-center gap-2 pt-2">
                        <input type="checkbox" id="anp" checked={hasAdditionalNetPurchases} onChange={(e) => setHasAdditionalNetPurchases(e.target.checked)} />
                        <Label htmlFor="anp" className="text-xs font-medium">Existe mais uma taxa nesta modalidade?</Label>
                      </div>
                      {hasAdditionalNetPurchases && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Taxa 2 (%)</Label>
                            <Input type="number" step="0.01" value={royaltyRateNetPurchases2} onChange={(e) => setRoyaltyRateNetPurchases2(e.target.value)} />
                          </div>
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Observações Taxa 2</Label>
                            <Input value={royaltyNetPurchasesNotes2} onChange={(e) => setRoyaltyNetPurchasesNotes2(e.target.value)} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="fob" checked={hasFOB} onChange={(e) => setHasFOB(e.target.checked)} />
                    <Label htmlFor="fob" className="font-bold">FOB</Label>
                  </div>
                  {hasFOB && (
                    <div className="grid grid-cols-4 gap-4 pl-6">
                      <div className="space-y-1">
                        <Label className="text-xs">Taxa (%)</Label>
                        <Input type="number" step="0.01" value={royaltyRateFOB} onChange={(e) => setRoyaltyRateFOB(e.target.value)} />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Observações/Taxas Específicas</Label>
                        <Input value={royaltyFOBNotes} onChange={(e) => setRoyaltyFOBNotes(e.target.value)} />
                      </div>
                      <div className="col-span-4 flex items-center gap-2 pt-2">
                        <input type="checkbox" id="afob" checked={hasAdditionalFOB} onChange={(e) => setHasAdditionalFOB(e.target.checked)} />
                        <Label htmlFor="afob" className="text-xs font-medium">Existe mais uma taxa nesta modalidade?</Label>
                      </div>
                      {hasAdditionalFOB && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Taxa 2 (%)</Label>
                            <Input type="number" step="0.01" value={royaltyRateFOB2} onChange={(e) => setRoyaltyRateFOB2(e.target.value)} />
                          </div>
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Observações Taxa 2</Label>
                            <Input value={royaltyFOBNotes2} onChange={(e) => setRoyaltyFOBNotes2(e.target.value)} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Período de Apuração</Label>
                  <Select onValueChange={setReportingFrequency} value={reportingFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prazo de Envio (dias após período)</Label>
                  <Input value={reportingDeadline} onChange={(e) => setReportingDeadline(e.target.value)} placeholder="Ex: 15 dias" />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="p-4 border rounded-lg space-y-4 bg-indigo-50/30 border-indigo-100">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasMarketingFund" checked={hasMarketingFund} onChange={(e) => setHasMarketingFund(e.target.checked)} />
                  <Label htmlFor="hasMarketingFund" className="font-bold text-indigo-900">Fundo de Marketing?</Label>
                </div>
                {hasMarketingFund && (
                  <div className="space-y-6 pl-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo de Cálculo</Label>
                        <Input value={marketingFundType} onChange={(e) => setMarketingFundType(e.target.value)} placeholder="Ex: Sobre Vendas Líquidas" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Taxa (%)</Label>
                        <Input type="number" step="0.01" value={marketingFundRate} onChange={(e) => setMarketingFundRate(e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-indigo-100">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="hasMarketingFundInstallments" 
                          checked={hasMarketingFundInstallments} 
                          onChange={(e) => setHasMarketingFundInstallments(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <Label htmlFor="hasMarketingFundInstallments" className="text-sm font-medium text-indigo-900">O fundo de marketing terá parcelas de adiantamento?</Label>
                      </div>

                      {hasMarketingFundInstallments && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="space-y-2">
                            <Label className="text-xs">Quantas parcelas de Fundo de Marketing?</Label>
                            <Input type="number" min="1" value={numMarketingFundInstallments} onChange={(e) => setNumMarketingFundInstallments(e.target.value)} className="h-8 w-24" />
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {marketingFundInstallments.map((inst, idx) => (
                              <div key={idx} className="grid grid-cols-4 gap-4 p-3 border rounded bg-white items-end">
                                <div className="font-bold text-[10px] text-slate-400 pb-2">Parcela {inst.installmentNumber}</div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Ano</Label>
                                  <Input 
                                    placeholder="Ex: 2024"
                                    value={inst.year || ''} 
                                    onChange={(e) => {
                                      const newInst = [...marketingFundInstallments];
                                      newInst[idx].year = e.target.value;
                                      setMarketingFundInstallments(newInst);
                                    }} 
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Valor</Label>
                                  <Input 
                                    type="text" 
                                    value={formatCurrencyBR(inst.amount)} 
                                    onChange={(e) => {
                                      const val = parseCurrencyBR(e.target.value);
                                      const newInst = [...marketingFundInstallments];
                                      newInst[idx].amount = val;
                                      setMarketingFundInstallments(newInst);
                                    }} 
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Vencimento</Label>
                                  <Input 
                                    type="date"
                                    value={inst.dueDate} 
                                    onChange={(e) => {
                                      const newInst = [...marketingFundInstallments];
                                      newInst[idx].dueDate = e.target.value;
                                      setMarketingFundInstallments(newInst);
                                    }} 
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Propriedades e Marcas</Label>
                <textarea 
                  className="w-full min-h-[120px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={propertiesInfo}
                  onChange={(e) => setPropertiesInfo(e.target.value)}
                  placeholder="Insira as informações de propriedades e marcas..."
                />
              </div>
              <div className="space-y-2">
                <Label>Linhas Vinculadas</Label>
                <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-slate-50">
                  {lines.filter(l => l.licenseId === licenseId).map(l => (
                    <Badge 
                      key={l.id} 
                      variant={selectedLines.includes(l.id) ? "default" : "outline"}
                      className="cursor-pointer py-1.5 px-3"
                      onClick={() => {
                        setSelectedLines(prev => 
                          prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]
                        );
                      }}
                    >
                      {l.name}
                    </Badge>
                  ))}
                  {licenseId && lines.filter(l => l.licenseId === licenseId).length === 0 && (
                    <span className="text-xs text-slate-400">Nenhuma linha cadastrada para este licenciador.</span>
                  )}
                  {!licenseId && <span className="text-xs text-slate-400">Selecione um licenciador no primeiro passo.</span>}
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-4">
                <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                  <FileText size={32} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900">Upload do Contrato Assinado</p>
                  <p className="text-sm text-slate-500">Arraste ou clique para selecionar o arquivo PDF</p>
                </div>
                <div className="flex flex-col items-center gap-4 w-full max-w-md">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => document.getElementById('contract-file-upload')?.click()}
                  >
                    <Upload size={16} /> Selecionar Arquivo
                  </Button>
                  <input 
                    type="file" 
                    id="contract-file-upload" 
                    className="hidden" 
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        toast.success(`Arquivo ${e.target.files[0].name} selecionado.`);
                        // Simulating upload by setting a fake URL
                        setSignedContractUrl(`https://storage.mock/contracts/${e.target.files[0].name}`);
                      }
                    }}
                  />
                  <div className="w-full flex items-center gap-2">
                    <div className="h-[1px] bg-slate-200 flex-1"></div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">ou insira o link</span>
                    <div className="h-[1px] bg-slate-200 flex-1"></div>
                  </div>
                  <Input 
                    type="url" 
                    placeholder="Link do arquivo (Ex: Google Drive, Dropbox)" 
                    value={signedContractUrl}
                    onChange={(e) => setSignedContractUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center pt-6 border-t">
            <div className="flex gap-2">
              {step > 1 && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  Voltar
                </Button>
              )}
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 min-w-[120px]">
              {step === totalSteps ? 'Finalizar Cadastro' : 'Próximo Passo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddReportDialog({ contracts, lines, products }: { contracts: Contract[], lines: Line[], products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [contractId, setContractId] = useState('');
  const [lineId, setLineId] = useState('');
  const [productId, setProductId] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [quantity, setQuantity] = useState('');
  const [netValue, setNetValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    const royaltyValue = Number(netValue) * ((contract.royaltyRateNetSales1 || 0) / 100);

    try {
      await addDoc(collection(db, 'reports'), {
        contractId,
        lineId,
        productId,
        month: Number(month),
        year: Number(year),
        quantity: Number(quantity),
        netValue: Number(netValue),
        royaltyValue,
        createdAt: serverTimestamp()
      });
      toast.success('Relatório enviado com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao enviar relatório.');
    }
  };

  const selectedContract = contracts.find(c => c.id === contractId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "default" }), "bg-blue-600 hover:bg-blue-700 gap-2")}>
            <Plus size={18} /> Novo Relatório
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Relatório de Royalties</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Contrato</Label>
            <Select onValueChange={setContractId} value={contractId}>
              <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
              <SelectContent>
                {contracts.sort((a, b) => (a.contractNumber || a.id).localeCompare(b.contractNumber || b.id)).map(c => (
                  <SelectItem key={c.id} value={c.id}>Contrato {c.contractNumber || `#${c.id.slice(0,5)}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Linha</Label>
            <Select onValueChange={setLineId} value={lineId}>
              <SelectTrigger><SelectValue placeholder="Selecione a linha" /></SelectTrigger>
              <SelectContent>
                {lines.filter(l => {
                  const contract = contracts.find(c => c.id === contractId);
                  return (contract?.lineIds || []).includes(l.id);
                }).sort((a, b) => a.name.localeCompare(b.name)).map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Produto</Label>
            <Select onValueChange={setProductId} value={productId}>
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {products.filter(p => {
                  const contract = contracts.find(c => c.id === contractId);
                  return (contract?.productIds || []).includes(p.id) && (lineId ? p.lineId === lineId : true);
                }).sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
                {(!selectedContract || (selectedContract.productIds || []).length === 0) && (
                  <SelectItem value="Geral">Geral / Não especificado</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Valor Líquido (R$)</Label>
              <Input type="number" step="0.01" value={netValue} onChange={(e) => setNetValue(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" className="w-full">Salvar Relatório</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddPaymentDialog({ contracts, licenses }: { contracts: Contract[], licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [responsible, setResponsible] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [paymentRequestDate, setPaymentRequestDate] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [contractId, setContractId] = useState('');
  const [type, setType] = useState('mg');
  const [identification, setIdentification] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentOrder, setPaymentOrder] = useState('');
  const [invoice, setInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [year, setYear] = useState('');
  const [installmentNumber, setInstallmentNumber] = useState('');
  const [status, setStatus] = useState<'pending' | 'paid'>('paid');

  const filteredContracts = contracts.filter(c => !licenseId || c.licenseId === licenseId);
  const selectedContract = contracts.find(c => c.id === contractId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'payments'), {
        responsible,
        receiptDate,
        paymentRequestDate,
        licenseId,
        contractId,
        type,
        identification,
        dueDate,
        amount: parseCurrencyBR(amount),
        currency,
        date,
        paymentOrder,
        invoice,
        notes,
        year,
        installmentNumber: installmentNumber,
        status,
        createdAt: serverTimestamp()
      });
      toast.success('Pagamento registrado!');
      setOpen(false);
      // Reset fields
      setResponsible('');
      setReceiptDate('');
      setPaymentRequestDate('');
      setLicenseId('');
      setContractId('');
      setType('mg');
      setIdentification('');
      setDueDate('');
      setAmount('');
      setCurrency('BRL');
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentOrder('');
      setInvoice('');
      setNotes('');
      setYear('');
      setInstallmentNumber('');
      setStatus('paid');
    } catch (err) {
      toast.error('Erro ao registrar pagamento.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "default" }), "bg-blue-600 hover:bg-blue-700 gap-2")}>
            <Plus size={18} /> Novo Pagamento
          </button>
        }
      />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div className="space-y-2">
              <Label>Data Recebimento</Label>
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Solicitação Pagto</Label>
              <Input type="date" value={paymentRequestDate} onChange={(e) => setPaymentRequestDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select onValueChange={(v: any) => setType(v)} value={type}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mg">Mínimo Garantido</SelectItem>
                  <SelectItem value="excess">Royalties Excedentes</SelectItem>
                  <SelectItem value="marketing">Fundo de Marketing</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Select onValueChange={(v) => { setLicenseId(v); setContractId(''); }} value={licenseId}>
                <SelectTrigger><SelectValue placeholder="Selecione o licenciador" /></SelectTrigger>
                <SelectContent>
                  {licenses.sort((a, b) => a.fantasyName.localeCompare(b.fantasyName)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.fantasyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select onValueChange={setContractId} value={contractId}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {filteredContracts.sort((a, b) => (a.contractNumber || '').localeCompare(b.contractNumber || '')).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.contractNumber || `ID: ${c.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Identificação</Label>
              <Input value={identification} onChange={(e) => setIdentification(e.target.value)} placeholder="Ex: Parcela 1/2025" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Pagamento</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select onValueChange={setCurrency} value={currency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL (R$)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input 
                value={amount} 
                onChange={(e) => setAmount(formatCurrencyBR(e.target.value))} 
                placeholder="0,00"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Ordem de Pagamento</Label>
              <Input value={paymentOrder} onChange={(e) => setPaymentOrder(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Invoice / NF</Label>
              <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Ex: 2025" />
            </div>
            <div className="space-y-2">
              <Label>Parcela</Label>
              <Input value={installmentNumber} onChange={(e) => setInstallmentNumber(e.target.value)} placeholder="Ex: 1" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select onValueChange={(v: any) => setStatus(v)} value={status}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <textarea 
              className="w-full min-h-[80px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais..."
            />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Registrar Pagamento</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DashboardView({ contracts, reports, payments, licenses, lines, products }: any) {
  const totalRoyalties = reports.reduce((acc: number, r: any) => acc + r.royaltyValue, 0);
  const totalMG = contracts.reduce((acc: number, c: any) => acc + c.minimumGuarantee, 0);
  const totalPaid = payments.filter((p: any) => p.status === 'paid').reduce((acc: number, p: any) => acc + p.amount, 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Cadastros Base" 
          value={`${licenses.length} Licenciadores`}
          icon={<Building2 className="text-indigo-600" />}
          trend={`${lines.length} Linhas | ${products.length} Produtos`}
          color="indigo"
        />
        <StatCard 
          title="Royalties Acumulados" 
          value={`R$ ${totalRoyalties.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<TrendingUp className="text-emerald-600" />}
          trend="+12.5% vs mês anterior"
          color="emerald"
        />
        <StatCard 
          title="Mínimo Garantido Total" 
          value={`R$ ${totalMG.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<CheckCircle2 className="text-blue-600" />}
          trend={`${contracts.filter((c: any) => ['Ativo', 'Ativo (sell-off)'].includes(getContractStatus(c).label)).length} contratos vigentes`}
          color="blue"
        />
        <StatCard 
          title="Pagamentos Efetuados" 
          value={`R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<CreditCard className="text-amber-600" />}
          trend="R$ 15.400,00 pendentes"
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Compensação de MG por Contrato</CardTitle>
            <CardDescription>Status de amortização do mínimo garantido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {contracts.slice(0, 5).map((contract: any) => {
                const license = licenses.find((l: any) => l.id === contract.licenseId);
                const contractRoyalties = reports
                  .filter((r: any) => r.contractId === contract.id)
                  .reduce((acc: number, r: any) => acc + r.royaltyValue, 0);
                const progress = Math.min((contractRoyalties / contract.minimumGuarantee) * 100, 100);
                
                return (
                  <div key={contract.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {license?.fantasyName || 'Licenciador'} - {contract.contractNumber || contract.id.slice(0, 5)}
                      </span>
                      <span className="text-slate-500">
                        {getCurrencySymbol(contract.currency || 'BRL')} {contractRoyalties.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {getCurrencySymbol(contract.currency || 'BRL')} {contract.minimumGuarantee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Próximos Pagamentos</CardTitle>
            <CardDescription>Parcelas de MG e Royalties vencendo em breve</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payments.filter((p: any) => p.status === 'pending').slice(0, 5).map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-md border border-slate-200">
                      <Calendar size={18} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Parcela MG</p>
                      <p className="text-xs text-slate-500">{formatDateBR(payment.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {getCurrencySymbol(contracts.find((c: any) => c.id === payment.contractId)?.currency || 'BRL')} {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 border-amber-200 bg-amber-50">Pendente</Badge>
                  </div>
                </div>
              ))}
              {payments.filter((p: any) => p.status === 'pending').length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  Nenhum pagamento pendente encontrado.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Cronograma de MG</CardTitle>
            <CardDescription>Datas e valores contratuais de MG</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {(() => {
                  const installments = contracts
                    .filter((c: any) => ['Ativo', 'Ativo (sell-off)'].includes(getContractStatus(c).label))
                    .flatMap((c: any) => (c.mgInstallments || []).map((inst: any) => ({
                      ...inst,
                      contractId: c.id,
                      contractNumber: c.contractNumber || c.id.slice(0, 5),
                      licenseName: licenses.find((l: any) => l.id === c.licenseId)?.fantasyName || 'Licenciador',
                      currency: c.currency || 'BRL'
                    })));

                  const groupedByMonth = installments.reduce((acc: any, inst: any) => {
                    const dateObj = inst.dueDate ? new Date(inst.dueDate) : null;
                    const isValidDate = dateObj && !isNaN(dateObj.getTime());
                    const monthKey = isValidDate ? dateObj.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) : 'Data não definida';
                    if (!acc[monthKey]) acc[monthKey] = {};
                    
                    const dateKey = isValidDate ? dateObj.toISOString().split('T')[0] : 'Data não definida';
                    if (!acc[monthKey][dateKey]) acc[monthKey][dateKey] = [];
                    
                    acc[monthKey][dateKey].push(inst);
                    return acc;
                  }, {});

                  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => {
                    if (a === 'Data não definida') return 1;
                    if (b === 'Data não definida') return -1;
                    // To sort months correctly, we need a date from them
                    const getFirstDate = (monthStr: string) => {
                      const dates = Object.keys(groupedByMonth[monthStr]);
                      const validDate = dates.find(d => d !== 'Data não definida');
                      return validDate ? new Date(validDate).getTime() : 0;
                    };
                    return getFirstDate(a) - getFirstDate(b);
                  });

                  return sortedMonths.map(month => (
                    <div key={month} className="space-y-4">
                      <h2 className="text-sm font-bold text-blue-600 uppercase border-b border-blue-100 pb-1">{month}</h2>
                      {Object.keys(groupedByMonth[month])
                        .sort((a, b) => {
                          if (a === 'Data não definida') return 1;
                          if (b === 'Data não definida') return -1;
                          return new Date(a).getTime() - new Date(b).getTime();
                        })
                        .map(date => (
                          <div key={date} className="space-y-2 pl-2">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateBR(date)}</h3>
                            {groupedByMonth[month][date]
                              .sort((a: any, b: any) => a.licenseName.localeCompare(b.licenseName))
                              .map((inst: any, idx: number) => {
                                const isPaid = payments.some((p: any) => 
                                  p.contractId === inst.contractId && 
                                  p.type === 'mg' && 
                                  p.installmentNumber === inst.installmentNumber &&
                                  p.status === 'paid'
                                );
                                return (
                                  <div key={`${inst.contractId}-${idx}`} className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 bg-slate-50 rounded-md border border-slate-100 text-blue-500">
                                        <FileText size={16} />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{inst.licenseName}</p>
                                          {isPaid ? (
                                            <Badge className="h-4 text-[8px] bg-emerald-100 text-emerald-700 border-none px-1">Pago</Badge>
                                          ) : (
                                            <Badge className="h-4 text-[8px] bg-amber-100 text-amber-700 border-none px-1">Pendente</Badge>
                                          )}
                                        </div>
                                        <p className="text-sm font-medium text-slate-900">Parcela {inst.installmentNumber} {inst.year ? `(${inst.year})` : ''}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-slate-900">
                                        {getCurrencySymbol(inst.currency)} {Number(inst.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-[10px] text-slate-400">Contrato: {inst.contractNumber}</p>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ))}
                    </div>
                  ));
                })()}
                {contracts.every(c => !(c.mgInstallments && c.mgInstallments.length > 0)) && (
                  <div className="text-center py-8 text-slate-400">
                    Nenhum cronograma de MG definido nos contratos ativos.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600'
  };

  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-xl ${colors[color]}`}>
            {icon}
          </div>
          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none">
            Este Mês
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs text-slate-400">
          <TrendingUp size={14} className="text-emerald-500" />
          <span>{trend}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractsView({ contracts, licenses, reports, lines, products, isAdmin }: { 
  contracts: Contract[], 
  licenses: License[], 
  reports: RoyaltyReport[], 
  lines: Line[], 
  products: Product[],
  isAdmin: boolean
}) {
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'license', direction: 'asc' });

  const processedContracts = contracts.map((contract: any) => {
    const statusInfo = getContractStatus(contract);
    const contractReports = reports.filter((r: any) => r.contractId === contract.id);
    const totalRoyalties = contractReports.reduce((sum: number, r: any) => sum + r.royaltyValue, 0);
    const balance = contract.minimumGuarantee - totalRoyalties;
    const license = licenses.find((l: any) => l.id === contract.licenseId);
    
    return { 
      ...contract, 
      calculatedStatus: statusInfo.label, 
      statusColor: statusInfo.color,
      licenseName: license?.fantasyName || '',
      totalRoyalties,
      balance
    };
  });

  const filteredContracts = processedContracts.filter((c: any) => {
    if (statusFilter === 'Todos') return true;
    return c.calculatedStatus === statusFilter;
  });

  const sortedContracts = [...filteredContracts].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;

    let valA: any;
    let valB: any;

    switch (sortConfig.key) {
      case 'license':
        valA = a.licenseName;
        valB = b.licenseName;
        break;
      case 'status':
        valA = a.calculatedStatus;
        valB = b.calculatedStatus;
        break;
      case 'startDate':
        valA = a.startDate ? new Date(a.startDate).getTime() : 0;
        valB = b.startDate ? new Date(b.startDate).getTime() : 0;
        break;
      case 'endDate':
        valA = a.endDate ? new Date(a.endDate).getTime() : 0;
        valB = b.endDate ? new Date(b.endDate).getTime() : 0;
        break;
      case 'sellOffEndDate':
        valA = a.sellOffEndDate ? new Date(a.sellOffEndDate).getTime() : 0;
        valB = b.sellOffEndDate ? new Date(b.sellOffEndDate).getTime() : 0;
        break;
      case 'currency':
        valA = a.currency || '';
        valB = b.currency || '';
        break;
      case 'mg':
        valA = a.minimumGuarantee;
        valB = b.minimumGuarantee;
        break;
      case 'royalties':
        valA = a.totalRoyalties;
        valB = b.totalRoyalties;
        break;
      case 'balance':
        valA = a.balance;
        valB = b.balance;
        break;
      default:
        return 0;
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
    if (sortConfig.direction === 'asc') return <ChevronUp size={12} className="ml-1 text-blue-600" />;
    if (sortConfig.direction === 'desc') return <ChevronDown size={12} className="ml-1 text-blue-600" />;
    return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm inline-block">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-transparent gap-1 h-9">
            <TabsTrigger value="Todos" className="rounded-lg data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none px-4">Todos</TabsTrigger>
            <TabsTrigger value="Ativo" className="rounded-lg data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none px-4">Ativos</TabsTrigger>
            <TabsTrigger value="Ativo (sell-off)" className="rounded-lg data-[state=active]:bg-amber-50 data-[state=active]:text-amber-600 data-[state=active]:shadow-none px-4">Sell-off</TabsTrigger>
            <TabsTrigger value="Encerrado" className="rounded-lg data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none px-4">Encerrados</TabsTrigger>
            <TabsTrigger value="Aguardando" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-4">Aguardando</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Contratos de Licenciamento</CardTitle>
          <CardDescription>Gerencie seus contratos ativos e históricos</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t border-slate-200 overflow-x-auto w-full">
          <table className="w-full text-sm text-left min-w-[1000px] border-separate border-spacing-0">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-30">
              <tr>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider sticky left-0 z-40 bg-slate-50 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('license')}
                >
                  <div className="flex items-center">Licenciador <SortIcon column="license" /></div>
                </th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50">ID Contrato</th>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">Status <SortIcon column="status" /></div>
                </th>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('startDate')}
                >
                  <div className="flex items-center">Início <SortIcon column="startDate" /></div>
                </th>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('endDate')}
                >
                  <div className="flex items-center">Término <SortIcon column="endDate" /></div>
                </th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50">Sell-off (Per.)</th>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('sellOffEndDate')}
                >
                  <div className="flex items-center">Sell-off (Fim) <SortIcon column="sellOffEndDate" /></div>
                </th>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('currency')}
                >
                  <div className="flex items-center">Moeda <SortIcon column="currency" /></div>
                </th>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('mg')}
                >
                  <div className="flex items-center">MG <SortIcon column="mg" /></div>
                </th>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('royalties')}
                >
                  <div className="flex items-center">Royalties <SortIcon column="royalties" /></div>
                </th>
                <th 
                  className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('balance')}
                >
                  <div className="flex items-center">Saldo <SortIcon column="balance" /></div>
                </th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50">% roy. Vendas 1</th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50">% roy. Vendas 2</th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50">% roy. Compras</th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-wider bg-slate-50">% FOB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedContracts.map((contract: any) => {
                return (
                  <tr key={contract.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-3 py-4 font-medium text-slate-900 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] transition-colors">
                      <ContractDetailsDialog 
                        contract={contract} 
                        licenses={licenses} 
                        lines={lines} 
                        products={products}
                        contracts={contracts}
                        trigger={
                          <button className="text-blue-600 hover:text-blue-800 hover:underline text-left font-semibold">
                            {contract.licenseName}
                          </button>
                        }
                      />
                    </td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">{contract.contractNumber}</td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <Badge className={contract.statusColor}>
                        {contract.calculatedStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">
                      {formatDateBR(contract.startDate)}
                    </td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">
                      {formatDateBR(contract.endDate)}
                    </td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">{contract.sellOffPeriod || '-'}</td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">
                      {formatDateBR(contract.sellOffEndDate)}
                    </td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">
                      {contract.currency === 'Dólar' ? 'USD' : 
                       contract.currency === 'Real' ? 'BRL' : 
                       contract.currency === 'Euro' ? 'EUR' : 
                       (contract.currency || 'BRL')}
                    </td>
                    <td className="px-3 py-4 font-semibold text-slate-900 whitespace-nowrap">
                      {getCurrencySymbol(contract.currency || 'BRL')} {contract.minimumGuarantee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-4 font-semibold text-emerald-600 whitespace-nowrap">
                      {getCurrencySymbol(contract.currency || 'BRL')} {contract.totalRoyalties.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-3 py-4 font-semibold whitespace-nowrap ${contract.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {getCurrencySymbol(contract.currency || 'BRL')} {contract.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">{Number(((contract.royaltyRateNetSales1 || 0) * 100).toFixed(2))}%</td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">{contract.royaltyRateNetSales2 ? Number((contract.royaltyRateNetSales2 * 100).toFixed(2)) : '-'}%</td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">{contract.royaltyRateNetPurchases ? Number((contract.royaltyRateNetPurchases * 100).toFixed(2)) : '-'}%</td>
                    <td className="px-3 py-4 text-slate-600 whitespace-nowrap">{contract.royaltyRateFOB ? Number((contract.royaltyRateFOB * 100).toFixed(2)) : '-'}%</td>
                  </tr>
                );
              })}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-8 text-center text-slate-400">Nenhum contrato cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

function ReportsView({ reports, contracts, lines, products, licenses, isAdmin }: {
  reports: RoyaltyReport[],
  contracts: Contract[],
  lines: Line[],
  products: Product[],
  licenses: License[],
  isAdmin: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const groupedReports = React.useMemo(() => {
    const groups: Record<string, any> = {};
    reports.forEach((r: any) => {
      const key = `${r.contractId}-${r.lineId}-${r.year}-${r.month}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          reportIds: [r.id],
          contractId: r.contractId,
          lineId: r.lineId,
          year: r.year,
          month: r.month,
          quantity: 0,
          netValue: 0,
          icms: 0,
          pis: 0,
          cofins: 0,
          ipi: 0,
          royaltyValue: 0,
          category: r.category,
          anoVA: r.anoVA,
          costPrice: 0,
          cmf: r.cmf,
        };
      } else {
        groups[key].reportIds.push(r.id);
      }
      groups[key].quantity += (r.quantity || 0);
      groups[key].netValue += (r.netValue || 0);
      groups[key].icms += (r.icms || 0);
      groups[key].pis += (r.pis || 0);
      groups[key].cofins += (r.cofins || 0);
      groups[key].ipi += (r.ipi || 0);
      groups[key].royaltyValue += (r.royaltyValue || 0);
      groups[key].costPrice += (r.costPrice || 0);
    });
    return Object.values(groups);
  }, [reports]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(groupedReports.map((r: any) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      const idsToDelete = groupedReports
        .filter(g => selectedIds.includes(g.id))
        .flatMap(g => g.reportIds);

      const promises = idsToDelete.map(id => deleteDoc(doc(db, 'reports', id)));
      await Promise.all(promises);
      toast.success(`${idsToDelete.length} registros excluídos com sucesso!`);
      setSelectedIds([]);
    } catch (err) {
      toast.error('Erro ao excluir registros selecionados.');
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Royalties</CardTitle>
          <CardDescription>Histórico de vendas e royalties reportados mensalmente</CardDescription>
        </div>
        {isAdmin && reports.length > 0 && (
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger nativeButton={true} render={
                <button className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 text-red-600 border-red-200 hover:bg-red-50")}>
                  <Trash2 size={14} /> Limpar Tudo
                </button>
              } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Limpar Todos os Registros</DialogTitle>
                  <DialogDescription>
                    Isso excluirá permanentemente TODOS os {reports.length} registros de royalties do banco de dados. Esta ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {}}>Cancelar</Button>
                  <Button variant="destructive" onClick={async () => {
                    try {
                      const promises = reports.map((r: any) => deleteDoc(doc(db, 'reports', r.id)));
                      await Promise.all(promises);
                      toast.success("Todos os registros foram excluídos!");
                    } catch (err) {
                      toast.error("Erro ao excluir registros.");
                    }
                  }}>Confirmar Exclusão Total</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
            <span className="text-xs font-medium text-slate-500">{selectedIds.length} selecionados</span>
            <Dialog>
              <DialogTrigger nativeButton={true} render={
                <button className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "gap-2")}>
                  <Trash2 size={14} /> Excluir Selecionados
                </button>
              } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar Exclusão em Massa</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja excluir os registros selecionados? Esta ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {}}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleDeleteSelected}>Confirmar Exclusão</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 overflow-x-auto">
          <table className="w-full text-[10px] text-left min-w-[1800px]">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-2 py-3 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedIds.length === groupedReports.length && groupedReports.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-2 py-3">Licenciador</th>
                <th className="px-2 py-3">Linha</th>
                <th className="px-2 py-3">Ano</th>
                <th className="px-2 py-3">Mês</th>
                <th className="px-2 py-3">Qtd</th>
                <th className="px-2 py-3">Vlr_Total</th>
                <th className="px-2 py-3">ICMS</th>
                <th className="px-2 py-3">Pis</th>
                <th className="px-2 py-3">Cofins</th>
                <th className="px-2 py-3">IPI</th>
                <th className="px-2 py-3">Total Líquido</th>
                <th className="px-2 py-3">Royalties</th>
                <th className="px-2 py-3">Categoria</th>
                <th className="px-2 py-3">Ano VA</th>
                <th className="px-2 py-3">Preço de custo</th>
                <th className="px-2 py-3">CMF</th>
                <th className="px-2 py-3">ID Licenciador</th>
                {isAdmin && <th className="px-2 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {groupedReports.map((report: any) => {
                const line = lines.find((l: any) => l.id === report.lineId);
                const contract = contracts.find((c: any) => c.id === report.contractId);
                const license = licenses.find((l: any) => l.id === contract?.licenseId);
                const symbol = getCurrencySymbol(contract?.currency || 'BRL');

                return (
                  <tr key={report.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(report.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-2 py-4">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.includes(report.id)}
                        onChange={() => handleSelectRow(report.id)}
                      />
                    </td>
                    <td className="px-2 py-4 font-medium text-slate-900">{license?.fantasyName || '-'}</td>
                    <td className="px-2 py-4 text-slate-600">{line?.name || 'Geral'}</td>
                    <td className="px-2 py-4 text-slate-600">{report.year}</td>
                    <td className="px-2 py-4 text-slate-600">{report.month}</td>
                    <td className="px-2 py-4 text-slate-600">{report.quantity}</td>
                    <td className="px-2 py-4 text-slate-600">{report.netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-4 text-slate-600">{report.icms?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</td>
                    <td className="px-2 py-4 text-slate-600">{report.pis?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</td>
                    <td className="px-2 py-4 text-slate-600">{report.cofins?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</td>
                    <td className="px-2 py-4 text-slate-600">{report.ipi?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</td>
                    <td className="px-2 py-4 text-slate-600">{report.netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-4 font-semibold text-emerald-600">{report.royaltyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-4 text-slate-600">{report.category || line?.productCategories?.join(', ') || '-'}</td>
                    <td className="px-2 py-4 text-slate-600">{report.anoVA || '-'}</td>
                    <td className="px-2 py-4 text-slate-600">{report.costPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '-'}</td>
                    <td className="px-2 py-4 text-slate-600">{report.cmf || '-'}</td>
                    <td className="px-2 py-4 text-slate-600 text-[8px]">{contract?.licenseId || '-'}</td>
                    {isAdmin && (
                      <td className="px-2 py-4 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600 h-6 w-6 p-0">
                            <Settings size={12} />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {groupedReports.length === 0 && (
                <tr>
                  <td colSpan={19} className="px-4 py-8 text-center text-slate-400">Nenhum relatório encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EditPaymentDialog({ payment, contracts, licenses }: { payment: any, contracts: Contract[], licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!open) setShowDeleteConfirm(false);
  }, [open]);

  const [responsible, setResponsible] = useState(payment.responsible || '');
  const [receiptDate, setReceiptDate] = useState(payment.receiptDate || '');
  const [paymentRequestDate, setPaymentRequestDate] = useState(payment.paymentRequestDate || '');
  const [licenseId, setLicenseId] = useState(payment.licenseId || '');
  const [contractId, setContractId] = useState(payment.contractId || '');
  const [type, setType] = useState(payment.type || 'mg');
  const [identification, setIdentification] = useState(payment.identification || '');
  const [dueDate, setDueDate] = useState(payment.dueDate || '');
  const [amount, setAmount] = useState(payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  const [currency, setCurrency] = useState(payment.currency || 'BRL');
  const [date, setDate] = useState(payment.date || '');
  const [paymentOrder, setPaymentOrder] = useState(payment.paymentOrder || '');
  const [invoice, setInvoice] = useState(payment.invoice || '');
  const [notes, setNotes] = useState(payment.notes || '');
  const [year, setYear] = useState(payment.year || '');
  const [installmentNumber, setInstallmentNumber] = useState(payment.installmentNumber || '');
  const [status, setStatus] = useState<'pending' | 'paid'>(payment.status || 'paid');

  const filteredContracts = contracts.filter(c => !licenseId || c.licenseId === licenseId);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'payments', payment.id));
      toast.success('Pagamento excluído com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao excluir pagamento.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'payments', payment.id), {
        responsible,
        receiptDate,
        paymentRequestDate,
        licenseId,
        contractId,
        type,
        identification,
        dueDate,
        amount: parseCurrencyBR(amount),
        currency,
        date,
        paymentOrder,
        invoice,
        notes,
        year,
        installmentNumber,
        status,
        updatedAt: serverTimestamp()
      });
      toast.success('Pagamento atualizado!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao atualizar pagamento.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-slate-400 hover:text-blue-600")}>
            <Settings size={16} />
          </button>
        }
      />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar Pagamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div className="space-y-2">
              <Label>Data Recebimento</Label>
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Solicitação Pagto</Label>
              <Input type="date" value={paymentRequestDate} onChange={(e) => setPaymentRequestDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select onValueChange={(v: any) => setType(v)} value={type}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mg">Mínimo Garantido</SelectItem>
                  <SelectItem value="excess">Royalties Excedentes</SelectItem>
                  <SelectItem value="marketing">Fundo de Marketing</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Select onValueChange={(v) => { setLicenseId(v); setContractId(''); }} value={licenseId}>
                <SelectTrigger><SelectValue placeholder="Selecione o licenciador" /></SelectTrigger>
                <SelectContent>
                  {licenses.sort((a, b) => a.fantasyName.localeCompare(b.fantasyName)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.fantasyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select onValueChange={setContractId} value={contractId}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {filteredContracts.sort((a, b) => (a.contractNumber || '').localeCompare(b.contractNumber || '')).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.contractNumber || `ID: ${c.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Identificação</Label>
              <Input value={identification} onChange={(e) => setIdentification(e.target.value)} placeholder="Ex: Parcela 1/2025" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Pagamento</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select onValueChange={setCurrency} value={currency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL (R$)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input 
                value={amount} 
                onChange={(e) => setAmount(formatCurrencyBR(e.target.value))} 
                placeholder="0,00"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Ordem de Pagamento</Label>
              <Input value={paymentOrder} onChange={(e) => setPaymentOrder(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Invoice / NF</Label>
              <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Ex: 2025" />
            </div>
            <div className="space-y-2">
              <Label>Parcela</Label>
              <Input value={installmentNumber} onChange={(e) => setInstallmentNumber(e.target.value)} placeholder="Ex: 1" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select onValueChange={(v: any) => setStatus(v)} value={status}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <textarea 
              className="w-full min-h-[80px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            {!showDeleteConfirm ? (
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={16} className="mr-2" /> Excluir
              </Button>
            ) : (
              <div className="flex-1 flex gap-2">
                <Button 
                  type="button" 
                  variant="destructive" 
                  className="flex-1"
                  onClick={handleDelete}
                >
                  Confirmar Exclusão
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancelar
                </Button>
              </div>
            )}
            <Button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700">Atualizar Pagamento</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsView({ payments, contracts, licenses, isAdmin }: {
  payments: Payment[],
  contracts: Contract[],
  licenses: License[],
  isAdmin: boolean
}) {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleConfirmPayment = async (paymentId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), { 
        status: 'paid',
        updatedAt: serverTimestamp()
      });
      toast.success('Pagamento confirmado!');
    } catch (err) {
      toast.error('Erro ao confirmar pagamento.');
    }
  };

  const sortedPayments = [...payments].sort((a: any, b: any) => {
    if (!sortConfig) {
      // Default sort: by date descending
      return new Date(b.date || b.createdAt?.toDate()).getTime() - new Date(a.date || a.createdAt?.toDate()).getTime();
    }

    let aValue: any;
    let bValue: any;

    if (sortConfig.key === 'license') {
      const contractA = contracts.find((c: any) => c.id === a.contractId);
      const licenseA = licenses.find((l: any) => l.id === (a.licenseId || contractA?.licenseId));
      const contractB = contracts.find((c: any) => c.id === b.contractId);
      const licenseB = licenses.find((l: any) => l.id === (b.licenseId || contractB?.licenseId));
      aValue = licenseA?.fantasyName || '';
      bValue = licenseB?.fantasyName || '';
    } else if (sortConfig.key === 'contract') {
      const contractA = contracts.find((c: any) => c.id === a.contractId);
      const contractB = contracts.find((c: any) => c.id === b.contractId);
      aValue = contractA?.contractNumber || '';
      bValue = contractB?.contractNumber || '';
    } else {
      aValue = a[sortConfig.key] || '';
      bValue = b[sortConfig.key] || '';
    }

    // Handle numeric values
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Handle date strings
    if (['receiptDate', 'paymentRequestDate', 'dueDate', 'date'].includes(sortConfig.key)) {
      const dateA = aValue ? new Date(aValue).getTime() : 0;
      const dateB = bValue ? new Date(bValue).getTime() : 0;
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }

    // Default string comparison
    const strA = String(aValue).toLowerCase();
    const strB = String(bValue).toLowerCase();
    if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortableHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
    <th 
      className="px-2 py-3 cursor-pointer hover:bg-slate-100 transition-colors group"
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={`
          ${sortConfig?.key === sortKey ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500'} 
          transition-colors
        `} />
      </div>
    </th>
  );

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Controle de Pagamentos</CardTitle>
        <CardDescription>Acompanhe parcelas de MG, royalties e fundo de marketing</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 overflow-x-auto">
          <table className="w-full text-[10px] text-left min-w-[1800px]">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <SortableHeader label="Responsável" sortKey="responsible" />
                <SortableHeader label="Dt Receb." sortKey="receiptDate" />
                <SortableHeader label="Dt Solic. Pagto" sortKey="paymentRequestDate" />
                <SortableHeader label="Tipo" sortKey="type" />
                <SortableHeader label="Licenciador" sortKey="license" />
                <SortableHeader label="Contrato" sortKey="contract" />
                <SortableHeader label="Identificação" sortKey="identification" />
                <SortableHeader label="Dt Vencimento" sortKey="dueDate" />
                <SortableHeader label="Dt Pagamento" sortKey="date" />
                <SortableHeader label="Moeda" sortKey="currency" />
                <SortableHeader label="Valor" sortKey="amount" />
                <SortableHeader label="Ordem Pagto" sortKey="paymentOrder" />
                <SortableHeader label="Invoice / NF" sortKey="invoice" />
                <SortableHeader label="Observações" sortKey="notes" />
                <SortableHeader label="Ano" sortKey="year" />
                <SortableHeader label="Parcela" sortKey="installmentNumber" />
                <SortableHeader label="Status" sortKey="status" />
                {isAdmin && <th className="px-2 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedPayments.map((payment: any) => {
                const contract = contracts.find((c: any) => c.id === payment.contractId);
                const license = licenses.find((l: any) => l.id === (payment.licenseId || contract?.licenseId));
                const symbol = getCurrencySymbol(payment.currency || contract?.currency || 'BRL');
                
                return (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-4 text-slate-600">{payment.responsible || '-'}</td>
                    <td className="px-2 py-4 text-slate-600">{formatDateBR(payment.receiptDate)}</td>
                    <td className="px-2 py-4 text-slate-600">{formatDateBR(payment.paymentRequestDate)}</td>
                    <td className="px-2 py-4">
                      <Badge variant="outline" className="capitalize text-[8px] font-bold">
                        {payment.type === 'mg' ? 'MG' : 
                         payment.type === 'excess' ? 'Royalties' : 
                         payment.type === 'marketing' ? 'Marketing' : 'Outros'}
                      </Badge>
                    </td>
                    <td className="px-2 py-4 font-medium text-slate-900 truncate max-w-[120px]" title={license?.fantasyName}>
                      {license?.fantasyName || '-'}
                    </td>
                    <td className="px-2 py-4 text-slate-600">{contract?.contractNumber || '-'}</td>
                    <td className="px-2 py-4 text-slate-600 truncate max-w-[100px]" title={payment.identification}>
                      {payment.identification || '-'}
                    </td>
                    <td className="px-2 py-4 text-slate-600">{formatDateBR(payment.dueDate)}</td>
                    <td className="px-2 py-4 text-slate-600">{formatDateBR(payment.date)}</td>
                    <td className="px-2 py-4 text-slate-600 font-bold">{payment.currency || 'BRL'}</td>
                    <td className="px-2 py-4 font-bold text-slate-900">
                      {symbol} {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-4 text-slate-600">{payment.paymentOrder || '-'}</td>
                    <td className="px-2 py-4 text-slate-600">{payment.invoice || '-'}</td>
                    <td className="px-2 py-4 text-slate-600 max-w-[120px] truncate" title={payment.notes}>
                      {payment.notes || '-'}
                    </td>
                    <td className="px-2 py-4 text-slate-600">{payment.year || '-'}</td>
                    <td className="px-2 py-4 text-slate-600">{payment.installmentNumber || '-'}</td>
                    <td className="px-2 py-4">
                      {payment.status === 'paid' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[8px] font-bold">PAGO</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[8px] font-bold">PENDENTE</Badge>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {payment.status === 'pending' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-6 px-1 text-[9px]"
                              onClick={() => handleConfirmPayment(payment.id)}
                            >
                              Confirmar
                            </Button>
                          )}
                          <EditPaymentDialog payment={payment} contracts={contracts} licenses={licenses} />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={18} className="px-4 py-8 text-center text-slate-400">Nenhum pagamento registrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EditLicensorDialog({ license }: { license: License }) {
  const [open, setOpen] = useState(false);
  const [fantasyName, setFantasyName] = useState(license.fantasyName);
  const [legalName, setLegalName] = useState(license.legalName);
  const [agent, setAgent] = useState(license.agent || '');
  const [description, setDescription] = useState(license.description || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const licenseRef = doc(db, 'licenses', license.id);
      await updateDoc(licenseRef, { 
        fantasyName, 
        legalName, 
        agent, 
        description, 
        updatedAt: serverTimestamp() 
      });
      toast.success('Licenciador atualizado com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao atualizar licenciador.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-slate-400 hover:text-blue-600")}>
            <Settings size={16} />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Licenciador</DialogTitle>
          <DialogDescription>Atualize as informações da empresa licenciadora.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-fantasyName">Nome Fantasia</Label>
            <Input id="edit-fantasyName" value={fantasyName} onChange={(e) => setFantasyName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-legalName">Nome Jurídico</Label>
            <Input id="edit-legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-agent">Administradora/Agente</Label>
            <Input id="edit-agent" value={agent} onChange={(e) => setAgent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Descrição (Opcional)</Label>
            <Input id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit">Salvar Alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LicensorsView({ licenses, isAdmin }: { licenses: License[], isAdmin: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Licenciadores</CardTitle>
          <CardDescription>Empresas licenciadoras cadastradas no sistema</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Nome Fantasia</th>
                <th className="px-4 py-3">Nome Jurídico</th>
                <th className="px-4 py-3">Agentes</th>
                {isAdmin && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[...licenses].sort((a, b) => a.fantasyName.localeCompare(b.fantasyName)).map((license) => (
                <tr key={license.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 font-medium text-slate-900">{license.fantasyName}</td>
                  <td className="px-4 py-4 text-slate-600">{license.legalName}</td>
                  <td className="px-4 py-4 text-blue-600 font-medium">{license.agent || '-'}</td>
                  {isAdmin && (
                    <td className="px-4 py-4 text-right">
                      <EditLicensorDialog license={license} />
                    </td>
                  )}
                </tr>
              ))}
              {licenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Nenhum licenciador cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EditLineDialog({ line, licenses, contracts, products, categories, trigger }: { 
  line: Line, 
  licenses: License[], 
  contracts: Contract[], 
  products: Product[], 
  categories: ProductCategory[],
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(line.name);
  const [licenseId, setLicenseId] = useState(line.licenseId);
  const [status, setStatus] = useState(line.status || '');
  const [brandType, setBrandType] = useState(line.brandType || 'própria');
  const [productCategories, setProductCategories] = useState<string[]>(line.productCategories || []);
  const [selectedContracts, setSelectedContracts] = useState<string[]>(
    contracts.filter(c => c.lineIds?.includes(line.id)).map(c => c.id)
  );

  const lineProducts = products.filter(p => p.lineId === line.id);
  const associatedContracts = contracts.filter(c => selectedContracts.includes(c.id));
  
  // Extract royalty rates from associated contracts
  const royaltyOptions = Array.from(new Set(associatedContracts.flatMap(c => [
    c.royaltyRateNetSales1,
    c.royaltyRateNetPurchases,
    c.royaltyRateFOB
  ].filter(r => r !== undefined && r !== null))));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lineRef = doc(db, 'lines', line.id);
      await updateDoc(lineRef, { 
        name,
        licenseId,
        status,
        brandType,
        productCategories
      });

      // Update contracts
      for (const contract of contracts) {
        const isAssociated = selectedContracts.includes(contract.id);
        const alreadyAssociated = contract.lineIds?.includes(line.id);

        if (isAssociated && !alreadyAssociated) {
          // Add lineId
          await updateDoc(doc(db, 'contracts', contract.id), {
            lineIds: [...(contract.lineIds || []), line.id]
          });
        } else if (!isAssociated && alreadyAssociated) {
          // Remove lineId
          await updateDoc(doc(db, 'contracts', contract.id), {
            lineIds: contract.lineIds.filter(id => id !== line.id)
          });
        }
      }
      
      toast.success('Linha e contratos atualizados com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao atualizar linha.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={trigger || (
        <button className="text-slate-400 hover:text-blue-600 p-2 rounded-md">
          <Settings size={16} />
        </button>
      )} />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Linha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Licenciador</Label>
              <Select onValueChange={setLicenseId} value={licenseId}>
                <SelectTrigger><SelectValue placeholder="Selecione o licenciador" /></SelectTrigger>
                <SelectContent>
                  {licenses.sort((a, b) => a.fantasyName.localeCompare(b.fantasyName)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.fantasyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input value={status} onChange={(e) => setStatus(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de marca</Label>
              <Select value={brandType} onValueChange={(v: 'própria' | 'licenciada') => setBrandType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="própria">Própria</SelectItem>
                  <SelectItem value="licenciada">Licenciada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categorias de Produtos</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50">
              {categories.map(cat => (
                <Badge
                  key={cat.id}
                  variant={productCategories.includes(cat.name) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setProductCategories(prev =>
                      prev.includes(cat.name) ? prev.filter(name => name !== cat.name) : [...prev, cat.name]
                    );
                  }}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contratos Associados</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50">
              {contracts.filter(c => c.licenseId === line.licenseId).map(c => (
                <Badge
                  key={c.id}
                  variant={selectedContracts.includes(c.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedContracts(prev =>
                      prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                    );
                  }}
                >
                  Contrato {c.contractNumber || `#${c.id.slice(0, 5)}`}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Produtos da Linha</Label>
            <div className="p-3 border rounded-lg bg-slate-50 text-sm">
              {lineProducts.length > 0 ? lineProducts.map(p => p.name).join(', ') : 'Nenhum produto cadastrado.'}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteReportDialog({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      toast.success('Relatório excluído com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao excluir relatório.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button 
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-slate-400 hover:text-red-600 h-6 w-6 p-0")}
        >
          <Trash2 size={12} />
        </button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir Relatório</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir este registro de relatório? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLineDialog({ lineId, lineName }: { lineId: string, lineName: string }) {
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'lines', lineId));
      toast.success('Linha excluída com sucesso!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao excluir linha.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button 
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-slate-400 hover:text-red-600")}
        >
          <Trash2 size={16} />
        </button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir Linha</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir a linha <strong>{lineName}</strong>? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinesView({ lines, licenses, contracts, products, categories, isAdmin }: { lines: Line[], licenses: License[], contracts: Contract[], products: Product[], categories: ProductCategory[], isAdmin: boolean }) {
  const [collapsedLicenses, setCollapsedLicenses] = useState<Record<string, boolean>>({});

  const toggleLicense = (licenseId: string) => {
    setCollapsedLicenses(prev => ({
      ...prev,
      [licenseId]: !prev[licenseId]
    }));
  };

  const expandAll = () => {
    setCollapsedLicenses({});
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    licenses.forEach(l => {
      allCollapsed[l.id] = true;
    });
    setCollapsedLicenses(allCollapsed);
  };

  const groupedLines = licenses.map(license => ({
    license,
    lines: lines.filter(l => l.licenseId === license.id)
  })).filter(group => group.lines.length > 0)
     .sort((a, b) => a.license.fantasyName.localeCompare(b.license.fantasyName));

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Linhas</CardTitle>
          <CardDescription>Gerencie as linhas vinculadas aos licenciadores</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} className="text-xs h-8">
            Expandir Tudo
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs h-8">
            Recolher Tudo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-bold w-[40%]">Nome</TableHead>
                <TableHead className="font-bold">Tipo de marca</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedLines.map(({ license, lines: groupLines }) => {
                const isCollapsed = collapsedLicenses[license.id];
                return (
                  <React.Fragment key={license.id}>
                    {/* Licensor Header Row */}
                    <TableRow 
                      className="bg-slate-50/80 hover:bg-slate-100 cursor-pointer select-none"
                      onClick={() => toggleLicense(license.id)}
                    >
                      <TableCell colSpan={4} className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronUp className="size-4 text-slate-400" />}
                          <span className="font-bold text-slate-900">{license.fantasyName}</span>
                          <Badge variant="secondary" className="ml-2 text-[10px] h-5">
                            {groupLines.length} {groupLines.length === 1 ? 'Linha' : 'Linhas'}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Line Rows */}
                    {!isCollapsed && groupLines.sort((a, b) => a.name.localeCompare(b.name)).map((line) => (
                      <TableRow key={line.id} className="hover:bg-slate-50/30">
                        <TableCell className="pl-10">
                          <EditLineDialog 
                            line={line} 
                            licenses={licenses} 
                            contracts={contracts} 
                            products={products} 
                            categories={categories}
                            trigger={
                              <button className="font-medium text-blue-600 hover:underline text-left">
                                {line.name}
                              </button>
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {line.brandType || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={line.status === 'Ativa' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'}
                          >
                            {line.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1">
                              <EditLineDialog 
                                line={line} 
                                licenses={licenses} 
                                contracts={contracts} 
                                products={products} 
                                categories={categories} 
                              />
                              <DeleteLineDialog lineId={line.id} lineName={line.name} />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          
          {lines.length === 0 && (
            <div className="text-center py-12 text-slate-400 bg-white">
              Nenhuma linha cadastrada.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductCategoriesView({ categories }: { categories: ProductCategory[] }) {
  const [newCategory, setNewCategory] = useState('');

  const handleAdd = async () => {
    if (!newCategory) return;
    await addDoc(collection(db, 'productCategories'), { name: newCategory });
    setNewCategory('');
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'productCategories', id));
  };

  return (
    <Card className="border-slate-200 shadow-sm mt-8">
      <CardHeader>
        <CardTitle>Categorias de Produtos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nova categoria" />
          <Button onClick={handleAdd}>Adicionar</Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left font-medium text-slate-500">Nome da Categoria</th>
                <th className="p-3 text-right font-medium text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                <tr key={cat.id}>
                  <td className="p-3">{cat.name}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}><Trash2 size={16} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductsView({ products, lines, categories, licenses, isAdmin }: { products: Product[], lines: Line[], categories: ProductCategory[], licenses: License[], isAdmin: boolean }) {
  return (
    <div className="space-y-8">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Gerencie os produtos vinculados às linhas</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[1200px]">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-16">Imagem</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Linha</th>
                  <th className="px-4 py-3">Licenciador</th>
                  <th className="px-4 py-3">Ano</th>
                  <th className="px-4 py-3">EAN</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((product) => {
                  const line = lines.find(l => l.id === product.lineId);
                  const category = categories.find(c => c.id === product.categoryId);
                  const license = licenses.find(l => l.id === (product.licenseId || line?.licenseId));
                  const imageUrl = (product.sku && product.sku.trim()) ? `https://img.kalunga.com.br/FotosdeProdutos/${product.sku.trim()}.jpg` : null;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2">
                        {imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt={product.name} 
                            className="w-12 h-12 object-cover rounded border border-slate-200" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => { 
                              e.currentTarget.src = 'https://placehold.co/100x100?text=Sem+Imagem';
                              e.currentTarget.onerror = null; // Prevent infinite loop if placeholder also fails
                            }} 
                          />
                        ) : (
                          <div className="w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-xs text-slate-400">N/A</div>
                        )}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">{product.sku || '-'}</td>
                      <td className="px-4 py-4 text-slate-900">{product.name}</td>
                      <td className="px-4 py-4 text-slate-600">{category?.name || '-'}</td>
                      <td className="px-4 py-4 text-slate-600">{line?.name || '-'}</td>
                      <td className="px-4 py-4 text-slate-600">{license?.fantasyName || '-'}</td>
                      <td className="px-4 py-4 text-slate-600">{product.launchYear || '-'}</td>
                      <td className="px-4 py-4 text-slate-600">{product.ean || '-'}</td>
                      {isAdmin && (
                        <td className="px-4 py-4 text-right">
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600">
                            <Settings size={16} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Nenhum produto cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <ProductCategoriesView categories={categories} />
    </div>
  );
}

