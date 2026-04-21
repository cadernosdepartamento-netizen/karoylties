/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';
import { auth, db, storage, signIn, logOut, registerWithEmail, loginWithEmail, handleFirestoreError, OperationType, uploadFile } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
  Trash2,
  Edit,
  PackageSearch,
  Database,
  Eye,
  Edit2,
  Layers,
  Package,
  Upload,
  FileSpreadsheet,
  ExternalLink,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Info,
  CircleDollarSign,
  LayoutGrid,
  List,
  Pencil,
  FileDown,
  Loader2
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
import { EditProductDialog } from './components/EditProductDialog';
import { BatchEditProductsDialog } from './components/BatchEditProductsDialog';
import { DeleteProductDialog } from './components/DeleteProductDialog';
import { BatchDeleteProductsDialog } from './components/BatchDeleteProductsDialog';
import { MultiSelectDropdown } from './components/MultiSelectDropdown';
import { ImportSalesDialog } from './components/ImportSalesDialog';
import { SearchableSelect } from './components/SearchableSelect';

// Utility to safely handle different date formats from Excel/Firestore
const getSafeDate = (dateVal: string | number) => {
  if (!dateVal) return new Date(NaN);
  
  const numVal = Number(dateVal);
  if (!isNaN(numVal) && numVal > 10000 && numVal < 100000) {
    // Pin to Midday UTC to avoid timezone floor/ceiling issues
    return new Date((numVal - 25569) * 86400 * 1000 + (12 * 3600 * 1000));
  }

  if (typeof dateVal === 'string') {
    const clean = dateVal.trim();
    // Handle YYYY-MM-DD
    if (clean.includes('-') && !clean.includes('T')) {
      const parts = clean.split('-');
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      }
    }
    
    // Handle DD/MM/YYYY
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        let year = Number(parts[2]);
        if (year < 100) year += 2000;
        return new Date(year, Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
      }
    }
    
    const dt = new Date(dateVal);
    if (!isNaN(dt.getTime())) return dt;
  }
  
  return new Date(dateVal);
};

// Types
interface License { 
  id: string; 
  nomelicenciador: string; 
  nomejurlicenciador: string; 
  nomeagente?: string; 
  descricaolicenciador?: string;
}
interface Line { 
  id: string; 
  licenseId: string; 
  nomelinha: string; 
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
  costPrice?: number;
  custo_unitario?: number;
  quantidade_produzida?: number;
  data_producao?: string;
  quantidade_reprogramada?: number;
  data_reprogramacao?: string;
  valor_total_custo_producao?: number;
}
interface ProductCategory { id: string; nomeCategoriaProduto: string; }
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
  licenseId?: string;
  lineId: string;
  productId?: string;
  month: number;
  year: number;
  quantity: number;
  totalValue?: number;
  icms?: number;
  pis?: number;
  cofins?: number;
  ipi?: number;
  netValue: number;
  royaltyRate?: number;
  royaltyValue: number;
  productName?: string;
  calculationType?: string;
}
interface Payment {
  id: string;
  contractId: string;
  licenseId?: string;
  type: 'mg' | 'excess' | 'marketing' | 'other';
  responsible?: string;
  receiptDate?: string;
  paymentRequestDate?: string;
  identification?: string;
  dueDate?: string;
  amount: number;
  currency?: string;
  date: string;
  paymentOrder?: string;
  invoice?: string;
  notes?: string;
  year?: string;
  installmentNumber?: number | string;
  status: 'pending' | 'paid';
  createdAt?: any;
  documentUrl?: string;
  documentName?: string;
}

interface Sale {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  icms?: number;
  pis?: number;
  cofins?: number;
  ipi?: number;
  netValue?: number;
  ean?: string;
  date: string;
  licenseId: string;
  lineId: string;
  categoryId: string;
  launchYear: number;
  costPrice?: number;
  // FOB Specific Fields
  dollarRate?: number;
  invoice?: string;
  fabricante?: string;
  valor_unitario_usd?: number;
  valor_total_usd?: number;
  icms_usd?: number;
  pis_usd?: number;
  cofins_usd?: number;
  ipi_usd?: number;
  valor_liquido_usd?: number;
  valor_unitario_brl?: number;
  valor_total_brl?: number;
  icms_brl?: number;
  pis_brl?: number;
  cofins_brl?: number;
  ipi_brl?: number;
  valor_liquido_brl?: number;
  [key: string]: any; // Allow dynamic access for suffixes
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
function PortalTooltip({ 
  content, 
  children 
}: { 
  content: ReactNode, 
  children: ReactNode 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top - 8,
        left: rect.left + rect.width / 2
      });
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-block relative"
    >
      {children}
      {isOpen && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none w-auto min-w-[400px] bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden whitespace-nowrap -translate-x-1/2 -translate-y-full"
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
          {/* Seta do tooltip */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-slate-200 rotate-45"></div>
        </div>,
        document.body
      )}
    </div>
  );
}

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
  const [currencyView, setCurrencyView] = useState<'usd' | 'brl'>('brl');
  const [isSalesExpanded, setIsSalesExpanded] = useState(false);

  // Data States
  const [licenses, setLicenses] = useState<License[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [reports, setReports] = useState<RoyaltyReport[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [netSales, setNetSales] = useState<Sale[]>([]);
  const [wholeSales, setWholeSales] = useState<Sale[]>([]);
  const [fobSales, setFobSales] = useState<Sale[]>([]);

  // Sales Action States
  const [isDeletingSales, setIsDeletingSales] = useState(false);
  const [deleteSalesProgress, setDeleteSalesProgress] = useState(0);
  const [showConfirmDeleteSales, setShowConfirmDeleteSales] = useState(false);

  const handleClearAllData = async (collectionName: string, dataArray: any[]) => {
    setShowConfirmDeleteSales(false);
    setIsDeletingSales(true);
    setDeleteSalesProgress(0);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const totalItems = dataArray.length;
      if (totalItems === 0) {
        setIsDeletingSales(false);
        return;
      }

      const batchSize = 500;
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const item of dataArray) {
        if (!item.id) continue;
        currentBatch.delete(doc(db, collectionName, item.id));
        opCount++;

        if (opCount === batchSize) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        batches.push(currentBatch);
      }

      let committedCount = 0;
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        committedCount += (i === batches.length - 1 && opCount > 0) ? opCount : batchSize;
        const progress = Math.min(Math.round((committedCount / totalItems) * 100), 100);
        setDeleteSalesProgress(progress);
      }

      toast.success(`${totalItems} registros foram apagados da base.`);
    } catch (error) {
      console.error("Erro ao apagar registros:", error);
      toast.error("Houve um erro ao apagar os registros da base de dados.");
    } finally {
      setIsDeletingSales(false);
      setDeleteSalesProgress(0);
    }
  };

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

    const unsubSales = onSnapshot(collection(db, 'sales'), (snap) => {
      setSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'sales'));

    const unsubNetSales = onSnapshot(collection(db, 'netsales'), (snap) => {
      setNetSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'netsales'));

    const unsubWholeSales = onSnapshot(collection(db, 'wholesales'), (snap) => {
      setWholeSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'wholesales'));

    const unsubFobSales = onSnapshot(collection(db, 'fobsales'), (snap) => {
      setFobSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'fobsales'));

    return () => {
      unsubLicenses();
      unsubLines();
      unsubProducts();
      unsubProductCategories();
      unsubContracts();
      unsubReports();
      unsubPayments();
      unsubSales();
      unsubNetSales();
      unsubWholeSales();
      unsubFobSales();
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
            <SidebarDropdown 
                icon={<TrendingUp size={20} />} 
                label="Vendas" 
                active={activeTab.startsWith('sales')} 
                isOpen={isSalesExpanded}
                onClick={() => {
                  setIsSalesExpanded(!isSalesExpanded);
                  if (activeTab !== 'sales') {
                     setActiveTab('sales');
                  }
                }}
            >
                <SidebarSubItem label="Vendas líquidas" active={activeTab === 'sales_liquidas'} onClick={() => setActiveTab('sales_liquidas')} />
                <SidebarSubItem label="Compras líquidas" active={activeTab === 'sales_compras'} onClick={() => setActiveTab('sales_compras')} />
                <SidebarSubItem label="FOB" active={activeTab === 'sales_fob'} onClick={() => setActiveTab('sales_fob')} />
            </SidebarDropdown>
                
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
              {activeTab === 'sales' && 'Vendas'}
              {activeTab === 'sales_liquidas' && 'Vendas líquidas'}
              {activeTab === 'sales_compras' && 'Compras líquidas'}
              {activeTab === 'sales_fob' && 'FOB'}
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

              {(activeTab === 'sales' || activeTab === 'sales_liquidas' || activeTab === 'sales_compras' || activeTab === 'sales_fob') && (
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Dialog open={showConfirmDeleteSales} onOpenChange={setShowConfirmDeleteSales}>
                      <DialogTrigger 
                        className={cn(buttonVariants({ variant: "destructive" }), "gap-2 h-9 px-3")}
                        disabled={isDeletingSales}
                      >
                        {isDeletingSales ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            {deleteSalesProgress}%
                          </>
                        ) : (
                          <>
                            <LogOut size={16} className="rotate-90" /> 
                            Apagar Base
                          </>
                        )}
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Confirmar Exclusão Total
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-2 text-slate-600">
                          <p className="font-semibold text-slate-900">Esta ação é irreversível.</p>
                          <p>Você tem certeza que deseja apagar absolutamente toda a base de dados?</p>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                          <Button variant="outline" onClick={() => setShowConfirmDeleteSales(false)}>Cancelar</Button>
                          <Button variant="destructive" onClick={() => {
                             if (activeTab === 'sales') handleClearAllData('sales', sales);
                             else if (activeTab === 'sales_liquidas') handleClearAllData('netsales', netSales);
                             else if (activeTab === 'sales_compras') handleClearAllData('wholesales', wholeSales);
                             else if (activeTab === 'sales_fob') handleClearAllData('fobsales', fobSales);
                          }}>Sim, Apagar Tudo</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  <ImportSalesDialog products={products} buttonText={activeTab === 'sales_compras' ? 'Importar Compras' : activeTab === 'sales_fob' ? 'Importar Compras FOB' : 'Importar Vendas'} collectionName={
                      activeTab === 'sales' ? 'sales' : 
                      activeTab === 'sales_liquidas' ? 'netsales' : 
                      activeTab === 'sales_compras' ? 'wholesales' :
                      activeTab === 'sales_fob' ? 'fobsales' : 'sales'
                  } />
                </div>
              )}
              
              {activeTab === 'contracts' && isAdmin && (
                <div className="flex items-center gap-2">
                  <ImportContractsDialog licenses={licenses} lines={lines} products={products} />
                  <AddContractDialog licenses={licenses} lines={lines} products={products} contracts={contracts} />
                </div>
              )}
              {activeTab === 'reports' && isAdmin && (
                <div className="flex items-center gap-2">
                  <ImportReportsDialog contracts={contracts} lines={lines} products={products} licenses={licenses} />
                  <AddReportDialog contracts={contracts} lines={lines} products={products} licenses={licenses} sales={sales} netSales={netSales} wholeSales={wholeSales} fobSales={fobSales} />
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
            {activeTab === 'contracts' && <ContractsView contracts={contracts} licenses={licenses} reports={reports} lines={lines} products={products} payments={payments} isAdmin={isAdmin} />}
            {activeTab === 'licenses' && <LicensorsView licenses={licenses} isAdmin={isAdmin} />}
            {activeTab === 'lines' && <LinesView lines={lines} licenses={licenses} contracts={contracts} products={products} categories={productCategories} isAdmin={isAdmin} />}
            {activeTab === 'products' && <ProductsView products={products} lines={lines} categories={productCategories} licenses={licenses} isAdmin={isAdmin} />}
            {activeTab === 'sales' && <SalesView activeTab="sales" sales={sales} licenses={licenses} lines={lines} categories={productCategories} products={products} contracts={contracts} isAdmin={isAdmin} />}
            {activeTab === 'sales_liquidas' && <SalesView activeTab="sales_liquidas" sales={netSales} licenses={licenses} lines={lines} categories={productCategories} products={products} contracts={contracts} isAdmin={isAdmin} />}
            {activeTab === 'sales_compras' && <SalesView activeTab="sales_compras" sales={wholeSales} licenses={licenses} lines={lines} categories={productCategories} products={products} contracts={contracts} isAdmin={isAdmin} />}
            {activeTab === 'sales_fob' && <SalesView currencyView={currencyView} setCurrencyView={setCurrencyView} activeTab="sales_fob" sales={fobSales} licenses={licenses} lines={lines} categories={productCategories} products={products} contracts={contracts} isAdmin={isAdmin} />}
            {activeTab === 'reports' && <ReportsView reports={reports} contracts={contracts} lines={lines} products={products} licenses={licenses} isAdmin={isAdmin} />}
            {activeTab === 'payments' && <PaymentsView payments={payments} contracts={contracts} licenses={licenses} lines={lines} reports={reports} isAdmin={isAdmin} />}
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
  
  // If the date is already formatted correctly as DD/MM/YYYY, return verbatim
  // to avoid JS treating it as MM/DD/YYYY and swapping the month and day.
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  // Force strict parsing for YYYY-MM-DD formats to avoid any timezone shifting
  // and force DD/MM/YYYY formatting consistently.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // Handle full ISO date strings by extracting only the date portion
  if (dateStr.includes('T') && /^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }

  // Fallback for other formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  // Fallback using manual construction in local timezone
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const calculateDuration = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return '-';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    months--;
  }

  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const yearStr = years === 1 ? 'ano' : 'anos';
    if (remainingMonths === 0) return `${years} ${yearStr}`;
    const monthStr = remainingMonths === 1 ? 'mês' : 'meses';
    return `${years} ${yearStr} e ${remainingMonths} ${monthStr}`;
  }
  const monthStr = months === 1 ? 'mês' : 'meses';
  return `${months} ${monthStr}`;
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

function SidebarDropdown({ icon, label, active, isOpen, onClick, children }: { icon: React.ReactNode, label: string, active: boolean, isOpen: boolean, onClick: () => void, children: React.ReactNode }) {                
  return (
    <>
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
        <div className="ml-auto">
            {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </button>
      {isOpen && <div className="space-y-1">{children}</div>}
    </>
  );
}

function SidebarSubItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 pl-11 pr-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'text-blue-700 bg-blue-50' 
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

// Dialog Components

function AddLicensorDialog() {
  const [open, setOpen] = useState(false);
  const [nomelicenciador, setNomelicenciador] = useState('');
  const [nomejurlicenciador, setNomejurlicenciador] = useState('');
  const [nomeagente, setNomeagente] = useState('');
  const [descricaolicenciador, setDescricaolicenciador] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'licenses'), { 
        nomelicenciador, 
        nomejurlicenciador, 
        nomeagente, 
        descricaolicenciador, 
        createdAt: serverTimestamp() 
      });
      toast.success('Licenciador cadastrado com sucesso!');
      setOpen(false);
      setNomelicenciador('');
      setNomejurlicenciador('');
      setNomeagente('');
      setDescricaolicenciador('');
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
            <Label htmlFor="nomelicenciador">Nome</Label>
            <Input id="nomelicenciador" value={nomelicenciador} onChange={(e) => setNomelicenciador(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nomejurlicenciador">Nome Jurídico</Label>
            <Input id="nomejurlicenciador" value={nomejurlicenciador} onChange={(e) => setNomejurlicenciador(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nomeagente">Administradora/Agente</Label>
            <Input id="nomeagente" value={nomeagente} onChange={(e) => setNomeagente(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricaolicenciador">Descrição (Opcional)</Label>
            <Input id="descricaolicenciador" value={descricaolicenciador} onChange={(e) => setDescricaolicenciador(e.target.value)} />
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
  const [importProgress, setImportProgress] = useState(0);

  const templateColumns = [
    "Licenciador",
    "Nome da linha",
    "Tipo de marca",
    "Status"
  ];

  const downloadTemplate = () => {
    const wsData = [
      templateColumns,
      [licenses[0]?.nomelicenciador || "Exemplo Licenciador", "Exemplo Linha", "Licenciada", "Ativa"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    
    // Add instructions sheet
    const instData = [
      ["Instruções de Preenchimento"],
      ["1. Licenciador: Deve ser o 'Nome' de um licenciador já cadastrado no sistema."],
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
    setImportProgress(0);
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
        const total = jsonData.length;

        // Processamento em lotes para melhor performance e acompanhamento
        const batchSize = 100;
        for (let i = 0; i < jsonData.length; i += batchSize) {
          const chunk = jsonData.slice(i, i + batchSize);
          const batch = writeBatch(db);
          
          for (const row of chunk) {
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
              String(l.nomelicenciador || "").trim().toLowerCase() === licensorName.toLowerCase() ||
              String(l.nomejurlicenciador || "").trim().toLowerCase() === licensorName.toLowerCase()
            );
            if (!license) {
              skippedCount++;
              continue;
            }

            const brandType = (brandTypeRaw?.toString().toLowerCase() === 'própria') ? 'própria' : 'licenciada';
            const status = statusRaw?.toString() || 'Ativa';

            const newDocRef = doc(collection(db, 'lines'));
            batch.set(newDocRef, {
              nomelinha: lineName.toString(),
              licenseId: license.id,
              brandType,
              status,
              createdAt: serverTimestamp()
            });
            importedCount++;
          }
          
          await batch.commit();
          setImportProgress(Math.min(Math.round(((i + chunk.length) / total) * 100), 100));
        }

        toast.success(`${importedCount} linhas importadas com sucesso! ${skippedCount > 0 ? `(${skippedCount} puladas)` : ''}`);
        setOpen(false);
        setFile(null);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao processar o arquivo Excel.");
      } finally {
        setIsUploading(false);
        setImportProgress(0);
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
            {isUploading ? `Importando (${importProgress}%)...` : "Iniciar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLineDialog({ licenses }: { licenses: License[] }) {
  const [open, setOpen] = useState(false);
  const [nomelinha, setNomelinha] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [status, setStatus] = useState('Ativa');
  const [brandType, setBrandType] = useState<'própria' | 'licenciada'>('licenciada');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseId) return toast.error('Selecione um licenciador.');
    try {
      await addDoc(collection(db, 'lines'), { 
        nomelinha: nomelinha, 
        licenseId, 
        status,
        brandType,
        createdAt: serverTimestamp() 
      });
      toast.success('Linha cadastrada com sucesso!');
      setOpen(false);
      setNomelinha('');
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
            <Label>Licenciador</Label>
            <Select onValueChange={setLicenseId} value={licenseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o licenciador">
                  {licenses.find(l => l.id === licenseId)?.nomelicenciador}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[...licenses].sort((a, b) => (a.nomelicenciador || a.id).localeCompare(b.nomelicenciador || b.id)).map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nomelicenciador || `ID: ${l.id.slice(0,5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-nomelinha">Nome da linha</Label>
            <Input id="add-nomelinha" value={nomelinha} onChange={(e) => setNomelinha(e.target.value)} required />
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
  const [importProgress, setImportProgress] = useState(0);

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
      [licenses[0]?.nomelicenciador || "Exemplo Licenciador", lines[0]?.nomelinha || "Exemplo Linha", "SKU123", "Exemplo Produto", categories[0]?.nomeCategoriaProduto || "Exemplo Categoria", "2024", "7891234567890"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    
    const instData = [
      ["Instruções de Preenchimento"],
      ["1. Licenciador: Deve ser o 'Nome' de um licenciador já cadastrado no sistema."],
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
    setImportProgress(0);
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
        const total = jsonData.length;

        const batchSize = 100;
        for (let i = 0; i < jsonData.length; i += batchSize) {
          const chunk = jsonData.slice(i, i + batchSize);
          const batch = writeBatch(db);

          for (const row of chunk) {
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
                String(l.nomelicenciador || "").trim().toLowerCase() === licensorName.toLowerCase() ||
                String(l.nomejurlicenciador || "").trim().toLowerCase() === licensorName.toLowerCase()
              );
              if (license) licenseId = license.id;
            }

            const line = lines.find(l => 
              String(l.nomelinha || "").trim().toLowerCase() === lineName.toLowerCase() &&
              (!licenseId || l.licenseId === licenseId)
            );

            if (!line) {
              skippedCount++;
              continue;
            }

            let categoryId = '';
            if (categoryName) {
              const category = categories.find(c => String(c.nomeCategoriaProduto || "").trim().toLowerCase() === categoryName.toLowerCase());
              if (category) categoryId = category.id;
            }

            const launchYear = yearRaw ? Number(yearRaw) : null;

            const newDocRef = doc(collection(db, 'products'));
            batch.set(newDocRef, {
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
          await batch.commit();
          setImportProgress(Math.min(Math.round(((i + chunk.length) / total) * 100), 100));
        }

        toast.success(`${importedCount} produtos importados com sucesso! ${skippedCount > 0 ? `(${skippedCount} puladas)` : ''}`);
        setOpen(false);
        setFile(null);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao processar o arquivo Excel.");
      } finally {
        setIsUploading(false);
        setImportProgress(0);
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
              {isUploading ? `Importando (${importProgress}%)...` : 'Importar Produtos'}
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
  const [custoUnitario, setCustoUnitario] = useState<string>('0');
  const [qtdProduzida, setQtdProduzida] = useState<string>('0');
  const [dataProducao, setDataProducao] = useState('');
  const [qtdReprogramada, setQtdReprogramada] = useState<string>('0');
  const [dataReprogramacao, setDataReprogramacao] = useState('');

  const valorTotalCustoProducao = React.useMemo(() => {
    const custo = parseFloat(custoUnitario) || 0;
    const qtdProv = parseInt(qtdProduzida) || 0;
    const qtdRepr = parseInt(qtdReprogramada) || 0;
    const finalQtd = qtdRepr > 0 ? qtdRepr : qtdProv;
    return finalQtd * custo;
  }, [custoUnitario, qtdProduzida, qtdReprogramada]);

  const handleLineChange = (id: string) => {
    setLineId(id);
    const line = lines.find(l => l.id === id);
    if (line) {
      setLicenseId(line.licenseId);
    } else {
      setLicenseId('');
    }
  };

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
        custo_unitario: parseFloat(custoUnitario) || 0,
        quantidade_produzida: parseInt(qtdProduzida) || 0,
        data_producao: dataProducao || null,
        quantidade_reprogramada: parseInt(qtdReprogramada) || 0,
        data_reprogramacao: dataReprogramacao || null,
        valor_total_custo_producao: valorTotalCustoProducao,
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
      setCustoUnitario('0');
      setQtdProduzida('0');
      setDataProducao('');
      setQtdReprogramada('0');
      setDataReprogramacao('');
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
              <Label>Linha</Label>
              <Select onValueChange={handleLineChange} value={lineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione">
                    {lines.find(l => l.id === lineId)?.nomelinha}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[...lines].sort((a, b) => (a.nomelinha || a.id).localeCompare(b.nomelinha || b.id)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nomelinha || `ID: ${l.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Input 
                value={licenses.find(l => l.id === licenseId)?.nomelicenciador || ''} 
                readOnly 
                className="bg-slate-50 cursor-not-allowed" 
                placeholder="Selecione uma linha primeiro"
              />
            </div>
          </div>
          <div className="grid grid-cols-6 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="sku">Código (SKU)</Label>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-4">
              <Label htmlFor="prodname">Nome do Produto</Label>
              <Input id="prodname" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-6 gap-4 mt-4">
            <div className="space-y-2 col-span-2">
              <Label>Categoria</Label>
              <Select onValueChange={setCategoryId} value={categoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione">
                    {categories.find(c => c.id === categoryId)?.nomeCategoriaProduto}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[...categories].sort((a, b) => (a.nomeCategoriaProduto || a.id).localeCompare(b.nomeCategoriaProduto || b.id)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nomeCategoriaProduto || `ID: ${c.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="launchYear">Ano de Lançamento</Label>
              <Input id="launchYear" type="number" value={launchYear} onChange={(e) => setLaunchYear(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="ean">EAN (Código de Barras)</Label>
              <Input id="ean" value={ean} onChange={(e) => setEan(e.target.value)} />
            </div>
          </div>

          <div className="border-t border-slate-100 my-4 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Database size={16} className="text-blue-600" /> Custos e Produção
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custounit">Custo Unitário (R$)</Label>
                <Input 
                  id="custounit" 
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
                <Label htmlFor="qtdprod">Qtd Produzida</Label>
                <Input 
                  id="qtdprod" 
                  type="number" 
                  min="0"
                  value={qtdProduzida} 
                  onChange={(e) => setQtdProduzida(Math.max(0, parseInt(e.target.value) || 0).toString())} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataprod">Data Produção</Label>
                <Input 
                  id="dataprod" 
                  type="date" 
                  value={dataProducao} 
                  onChange={(e) => setDataProducao(e.target.value)} 
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <Label htmlFor="qtdreprog">Qtd Reprogramada</Label>
                <Input 
                  id="qtdreprog" 
                  type="number" 
                  min="0"
                  value={qtdReprogramada} 
                  onChange={(e) => setQtdReprogramada(Math.max(0, parseInt(e.target.value) || 0).toString())} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="datareprog">Data Reprogramação</Label>
                <Input 
                  id="datareprog" 
                  type="date" 
                  value={dataReprogramacao} 
                  onChange={(e) => setDataReprogramacao(e.target.value)} 
                  className="h-9"
                />
              </div>
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

function ContractDetailsDialog({ contract, licenses, lines, products, contracts, trigger, initialIsEditing = false }: { contract: Contract, licenses: License[], lines: Line[], products: Product[], contracts: Contract[], trigger?: React.ReactNode, initialIsEditing?: boolean }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [step, setStep] = useState(1);
  const totalSteps = 7;

  useEffect(() => {
    if (open) {
      setIsEditing(initialIsEditing);
    }
  }, [open, initialIsEditing]);
  
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
  const [isUploading, setIsUploading] = useState(false);

  // Sync state when dialog opens or contract changes
  useEffect(() => {
    if (open) {
      setLicenseId(contract.licenseId);
      setContractNumber(contract.contractNumber || '');
      setStartDate(contract.startDate);
      setEndDate(contract.endDate);
      setIsDividedIntoYears(contract.isDividedIntoYears || false);
      setNumYears(contract.years?.length.toString() || '1');
      setYears(contract.years || []);
      setPaymentTerms(contract.paymentTerms || '');
      setReportingFrequency(contract.reportingFrequency || 'Mensal');
      setStatus(contract.status || 'Ativo');
      setSellOffPeriod(contract.sellOffPeriod || '');
      setSellOffEndDate(contract.sellOffEndDate || '');
      setCurrency(contract.currency || 'BRL');
      setIsAddendum(contract.isAddendum || false);
      setParentId(contract.parentId || '');
      setHasNetSales(!!contract.royaltyRateNetSales1);
      setRoyaltyRateNetSales1((contract.royaltyRateNetSales1 ? contract.royaltyRateNetSales1 * 100 : 0).toString());
      setRoyaltyNetSalesNotes(contract.royaltyNetSalesNotes || '');
      setHasAdditionalNetSales(contract.hasAdditionalNetSales || false);
      setRoyaltyRateNetSales2((contract.royaltyRateNetSales2 ? contract.royaltyRateNetSales2 * 100 : 0).toString());
      setRoyaltyNetSalesNotes2(contract.royaltyNetSalesNotes2 || '');
      setHasNetPurchases(!!contract.royaltyRateNetPurchases);
      setRoyaltyRateNetPurchases((contract.royaltyRateNetPurchases ? contract.royaltyRateNetPurchases * 100 : 0).toString());
      setRoyaltyNetPurchasesNotes(contract.royaltyNetPurchasesNotes || '');
      setHasAdditionalNetPurchases(contract.hasAdditionalNetPurchases || false);
      setRoyaltyRateNetPurchases2((contract.royaltyRateNetPurchases2 ? contract.royaltyRateNetPurchases2 * 100 : 0).toString());
      setRoyaltyNetPurchasesNotes2(contract.royaltyNetPurchasesNotes2 || '');
      setHasFOB(!!contract.royaltyRateFOB);
      setRoyaltyRateFOB((contract.royaltyRateFOB ? contract.royaltyRateFOB * 100 : 0).toString());
      setRoyaltyFOBNotes(contract.royaltyFOBNotes || '');
      setHasAdditionalFOB(contract.hasAdditionalFOB || false);
      setRoyaltyRateFOB2((contract.royaltyRateFOB2 ? contract.royaltyRateFOB2 * 100 : 0).toString());
      setRoyaltyFOBNotes2(contract.royaltyFOBNotes2 || '');
      setSelectedLines(contract.lineIds || []);
      setSelectedProducts(contract.productIds || []);
      setSignedContractUrl(contract.signedContractUrl || '');
      setReportingDeadline(contract.reportingDeadline || '');
      setPaymentDeadline(contract.paymentDeadline || '');
      setNumInstallments(contract.mgInstallments?.length.toString() || '1');
      setInstallments(contract.mgInstallments || []);
      setHasMarketingFund(contract.hasMarketingFund || false);
      setMarketingFundType(contract.marketingFundType || '');
      setMarketingFundRate((contract.marketingFundRate ? contract.marketingFundRate * 100 : 0).toString());
      setHasMarketingFundInstallments(contract.hasMarketingFundInstallments || false);
      setNumMarketingFundInstallments(contract.marketingFundInstallments?.length.toString() || '1');
      setMarketingFundInstallments(contract.marketingFundInstallments || []);
      setPropertiesInfo(contract.propertiesInfo || '');
      setProductsInfo(contract.productsInfo || '');
      setStep(1);
    }
  }, [open, contract]);

  // Effects
  useEffect(() => {
    if (isDividedIntoYears) {
      const n = parseInt(numYears) || 0;
      setYears(prev => {
        let newYears = prev ? [...prev] : [];
        if (newYears.length < n) {
          for (let i = newYears.length + 1; i <= n; i++) {
            newYears.push({
              yearNumber: i,
              startDate: '',
              endDate: '',
              minimumGuarantee: 0
            });
          }
        } else if (newYears.length > n) {
          newYears = newYears.slice(0, n);
        }
        return newYears;
      });
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
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o licenciador">
                        {licenses.find(l => l.id === licenseId)?.nomelicenciador}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {[...licenses].sort((a, b) => (a.nomelicenciador || a.id).localeCompare(b.nomelicenciador || b.id)).map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.nomelicenciador || `ID: ${l.id.slice(0,5)}`}</SelectItem>
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
                        {contracts && [...contracts].filter(c => c.licenseId === licenseId && c.id !== contract.id).sort((a, b) => (a.contractNumber || a.id).localeCompare(b.contractNumber || b.id)).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.contractNumber || `ID: ${c.id.slice(0, 5)}`}</SelectItem>
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
                    {lines
                      .filter(l => l.licenseId === licenseId)
                      .sort((a, b) => (a.nomelinha || a.id).localeCompare(b.nomelinha || b.id))
                      .map(l => (
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
                          {l.nomelinha || `ID: ${l.id.slice(0,5)}`}
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
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          try {
                            setIsUploading(true);
                            const path = `contracts/${Date.now()}_${file.name}`;
                            const url = await uploadFile(file, path);
                            setSignedContractUrl(url);
                            toast.success(`Arquivo ${file.name} enviado com sucesso!`);
                          } catch (error) {
                            console.error("Upload error:", error);
                            toast.error("Erro ao enviar arquivo.");
                          } finally {
                            setIsUploading(false);
                          }
                        }
                      }}
                    />
                    {isUploading && (
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden animate-pulse">
                        <div className="bg-blue-600 h-full w-1/3 animate-progress transition-all duration-300"></div>
                      </div>
                    )}
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
                      disabled={isUploading}
                    />
                    {signedContractUrl && !isUploading && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 size={14} /> Arquivo vinculado com sucesso
                        <a href={signedContractUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-600 hover:underline flex items-center gap-1">
                          Ver arquivo <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
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
                  <p className="text-sm font-semibold text-slate-900">{license?.nomelicenciador || (contract.licenseId ? `ID: ${contract.licenseId.slice(0, 5)}` : '-')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº Contrato</p>
                  <p className="text-sm font-semibold text-slate-900">{contract.contractNumber || `ID: ${contract.id.slice(0, 5)}`}</p>
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
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Vigência</p>
                  <p className="text-sm text-slate-700 font-medium">{formatDateBR(contract.startDate)} - {formatDateBR(contract.endDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Compensação</p>
                  <p className="text-sm text-slate-700 font-medium">Royalty</p>
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
                      <Badge key={l.id} variant="outline" className="bg-white border-slate-200 text-slate-700">{l.nomelinha || `ID: ${l.id.slice(0, 5)}`}</Badge>
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
                        <Badge key={p.id} variant="secondary" className="bg-slate-100 text-slate-600 border-none text-[10px] py-0 px-2 h-5">{p.name || `ID: ${p.id.slice(0, 5)}`}</Badge>
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
  const [importProgress, setImportProgress] = useState(0);

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
    setImportProgress(0);
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
              String(l.nomelicenciador || "").trim().toLowerCase() === licenseName.toLowerCase() ||
              String(l.nomejurlicenciador || "").trim().toLowerCase() === licenseName.toLowerCase()
            );
            let licenseId = license?.id;

              if (!licenseId) {
                console.log(`Licenciador '${licenseName}' não encontrada. Criando nova...`);
                const newLicenseRef = await addDoc(collection(db, 'licenses'), {
                  nomelicenciador: licenseName,
                  nomejurlicenciador: String(getVal(["Licenciador (Nome jurídico)", "Nome Jurídico"]) || licenseName).trim(),
                  nomeagente: String(getVal(["Administradora/Agente", "Agente"]) || "").trim(),
                  createdAt: serverTimestamp()
                });
                licenseId = newLicenseRef.id;
              console.log(`Novo licenciador criado com ID: ${licenseId}`);
            }

            const lineNames = String(getVal(["Linhas Spiral", "Linhas"]) || "").split(',').map(s => s.trim()).filter(Boolean);
            const lineIds = lines
              .filter(l => l.licenseId === licenseId && lineNames.some(name => l.nomelinha.toLowerCase() === name.toLowerCase()))
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
          } catch (rowError) {
            console.error(`Erro ao processar linha ${i + 2}:`, rowError);
          }
          setImportProgress(Math.min(Math.round(((i + 1) / jsonData.length) * 100), 100));
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
            {isUploading ? `Importando (${importProgress}%)...` : "Iniciar Importação"}
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
  const [importProgress, setImportProgress] = useState(0);

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
    setImportProgress(0);
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
        const total = jsonData.length;

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
              String(l.nomelicenciador || "").trim().toLowerCase() === licenseName.toLowerCase() ||
              String(l.nomejurlicenciador || "").trim().toLowerCase() === licenseName.toLowerCase()
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
          setImportProgress(Math.min(Math.round(((i + 1) / total) * 100), 100));
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
        setImportProgress(0);
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
            {isUploading ? `Importando (${importProgress}%)...` : "Iniciar Importação"}
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
  const [importProgress, setImportProgress] = useState(0);

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
    setImportProgress(0);
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
            String(l.nomelicenciador || "").trim().toLowerCase() === licenseName.toLowerCase() ||
            String(l.nomejurlicenciador || "").trim().toLowerCase() === licenseName.toLowerCase()
          );

          const line = lines.find(l => 
            String(l.nomelinha || "").trim().toLowerCase() === lineName.toLowerCase() &&
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
          setImportProgress(Math.min(Math.round(((jsonData.indexOf(row) + 1) / jsonData.length) * 100), 100));
        }

        if (skippedCount > 0) {
          toast.warning(`${importedCount} registros importados, ${skippedCount} ignorados por inconsistência.`);
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
        setImportProgress(0);
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
            {isUploading ? `Importando (${importProgress}%)...` : "Iniciar Importação"}
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
  const [isUploading, setIsUploading] = useState(false);

  // Effects
  useEffect(() => {
    if (isDividedIntoYears) {
      const n = parseInt(numYears) || 0;
      setYears(prev => {
        const newYears = [...prev];
        if (newYears.length < n) {
          for (let i = newYears.length + 1; i <= n; i++) {
            newYears.push({
              yearNumber: i,
              startDate: '',
              endDate: '',
              minimumGuarantee: 0
            });
          }
        } else if (newYears.length > n) {
          return newYears.slice(0, n);
        }
        return newYears;
      });
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
                  <Select onValueChange={(v) => { setLicenseId(v); setParentId(''); }} value={licenseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o licenciador">
                        {licenses.find(l => l.id === licenseId)?.nomelicenciador}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {[...licenses].sort((a, b) => (a.nomelicenciador || a.id).localeCompare(b.nomelicenciador || b.id)).map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.nomelicenciador || `ID: ${l.id.slice(0,5)}`}</SelectItem>
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
                        {contracts && [...contracts].filter(c => c.licenseId === licenseId).sort((a, b) => (a.contractNumber || a.id).localeCompare(b.contractNumber || b.id)).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.contractNumber || `ID: ${c.id.slice(0, 5)}`}</SelectItem>
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
                  <Label htmlFor="hasMarketingFund" className="font-bold text-indigo-900">Fundo de Marketing (CMF)?</Label>
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
                        <Label htmlFor="hasMarketingFundInstallments" className="text-sm font-medium text-indigo-900">O fundo de marketing (CMF) terá parcelas de adiantamento?</Label>
                      </div>

                      {hasMarketingFundInstallments && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="space-y-2">
                            <Label className="text-xs">Quantas parcelas de Fundo de Marketing (CMF)?</Label>
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
                      {l.nomelinha || `ID: ${l.id.slice(0,5)}`}
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
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        try {
                          setIsUploading(true);
                          const path = `contracts/${Date.now()}_${file.name}`;
                          const url = await uploadFile(file, path);
                          setSignedContractUrl(url);
                          toast.success(`Arquivo ${file.name} enviado com sucesso!`);
                        } catch (error) {
                          console.error("Upload error:", error);
                          toast.error("Erro ao enviar arquivo.");
                        } finally {
                          setIsUploading(false);
                        }
                      }
                    }}
                  />
                  {isUploading && (
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden animate-pulse">
                      <div className="bg-blue-600 h-full w-1/3 animate-progress transition-all duration-300"></div>
                    </div>
                  )}
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
                    disabled={isUploading}
                  />
                  {signedContractUrl && !isUploading && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 size={14} /> Arquivo vinculado com sucesso
                      <a href={signedContractUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-600 hover:underline flex items-center gap-1">
                        Ver arquivo <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
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

function AddReportDialog({ contracts, lines, products, licenses, sales, netSales, wholeSales, fobSales }: { contracts: Contract[], lines: Line[], products: Product[], licenses: License[], sales: Sale[], netSales: Sale[], wholeSales: Sale[], fobSales: Sale[] }) {
  const [open, setOpen] = useState(false);
  const [licenseId, setLicenseId] = useState('');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [selectedLaunchYears, setSelectedLaunchYears] = useState<string[]>([]);
  const [contractId, setContractId] = useState('');
  const [royaltyRateType, setRoyaltyRateType] = useState('');
  const [selectedProductSkus, setSelectedProductSkus] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);

  const royaltySummary = React.useMemo(() => {
    if (!startDate || !endDate || selectedProductSkus.length === 0 || !royaltyRateType || !contractId) return null;
    
    const startDt = new Date(startDate + 'T00:00:00');
    const endDt = new Date(endDate + 'T23:59:59');
    
    const royaltyRateTypeMap: Record<string, Sale[]> = {
      'netSales1': netSales,
      'netPurchases': wholeSales,
      'fob': fobSales
    };
    
    const salesData = royaltyRateTypeMap[royaltyRateType] || sales;
    const trimmedSelectedSkus = selectedProductSkus.map(sk => String(sk).trim());

    const matchingSales = salesData.filter(s => {
      const saleSku = String(s.sku || "").trim();
      if (!trimmedSelectedSkus.includes(saleSku)) return false;
      const dt = getSafeDate(s.date);
      return !isNaN(dt.getTime()) && dt >= startDt && dt <= endDt;
    });

    let totalBase = 0;
    const isFob = royaltyRateType === 'fob';

    matchingSales.forEach(s => {
      if (isFob) {
        // Core Logic: Use BRL fields for FOB calculation
        totalBase += (Number(s.valor_liquido_brl) || 0);
      } else {
        const saleTaxes = (Number(s.icms) || 0) + (Number(s.pis) || 0) + (Number(s.cofins) || 0) + (Number(s.ipi) || 0);
        const saleNetValue = s.netValue !== undefined ? Number(s.netValue) : (Number(s.totalValue || 0) - saleTaxes);
        totalBase += saleNetValue;
      }
    });

    const contract = contracts.find(c => c.id === contractId);
    let royaltyRate = 0;
    if (contract) {
      if (royaltyRateType === 'netSales1') royaltyRate = contract.royaltyRateNetSales1 || 0;
      if (royaltyRateType === 'netPurchases') royaltyRate = contract.royaltyRateNetPurchases || 0;
      if (royaltyRateType === 'fob') royaltyRate = contract.royaltyRateFOB || 0;
    }

    return {
      totalBase,
      royaltyRate,
      royaltyValue: totalBase * royaltyRate,
      count: matchingSales.length,
      isFob
    };
  }, [startDate, endDate, selectedProductSkus, royaltyRateType, netSales, wholeSales, fobSales, sales, contracts, contractId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseId || !contractId || !royaltyRateType || !startDate || !endDate || selectedProductSkus.length === 0) {
      toast.error('Preencha os dados e selecione ao menos 1 produto.');
      return;
    }

    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    let royaltyRate = 0;
    if (royaltyRateType === 'netSales1') royaltyRate = contract.royaltyRateNetSales1 || 0;
    if (royaltyRateType === 'netPurchases') royaltyRate = contract.royaltyRateNetPurchases || 0;
    if (royaltyRateType === 'fob') royaltyRate = contract.royaltyRateFOB || 0;

    const startDt = new Date(startDate + 'T00:00:00');
    const endDt = new Date(endDate + 'T23:59:59');

    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
      toast.error('Datas inválidas.');
      return;
    }

    setIsCompiling(true);

    try {
      const royaltyRateTypeMap: Record<string, Sale[]> = {
        'netSales1': netSales,
        'netPurchases': wholeSales,
        'fob': fobSales
      };
      
      const salesData = royaltyRateTypeMap[royaltyRateType] || sales;

      const trimmedSelectedSkus = selectedProductSkus.map(sk => String(sk).trim());

      const matchingSales = salesData.filter(s => {
        const saleSku = String(s.sku || "").trim();
        if (!trimmedSelectedSkus.includes(saleSku)) return false;
        const dt = getSafeDate(s.date);
        return !isNaN(dt.getTime()) && dt >= startDt && dt <= endDt;
      });

      console.log("DEBUG_SKU_CHECK: Total Sales matching in period:", matchingSales.length);
      const uniqueSkus = Array.from(new Set(matchingSales.map(s => String(s.sku || "").trim()))).sort();
      console.log("DEBUG_SKU_CHECK: SKUs found:", uniqueSkus);
      
      if (matchingSales.length === 0) {
        toast.error('Nenhuma venda encontrada para os produtos e o período informados.');
        setIsCompiling(false);
        return;
      }

      const skuToProductId = new Map<string, string>();
      const skuToLineId = new Map<string, string>();
      for (const p of products) {
        if (p.sku) {
           const pSku = String(p.sku).trim();
           skuToProductId.set(pSku, p.id);
           skuToLineId.set(pSku, p.lineId);
        }
      }

      const groups = new Map<string, any>();
      for (const s of matchingSales) {
        const dt = getSafeDate(s.date);
        const month = dt.getMonth() + 1;
        const year = dt.getFullYear();
        const saleSku = String(s.sku || "").trim();
        const prodId = skuToProductId.get(saleSku) || "unknown";
        const saleLineId = skuToLineId.get(saleSku) || "unknown";

        const key = `${prodId}-${month}-${year}`;
        if (!groups.has(key)) {
          groups.set(key, { quantity: 0, totalValue: 0, icms: 0, pis: 0, cofins: 0, ipi: 0, netValue: 0, lineId: saleLineId, prodId, month, year });
        }
        const g = groups.get(key);
        const isFob = royaltyRateType === 'fob';

        if (isFob) {
          // Use BRL fields explicitly for FOB
          g.quantity += (Number(s.quantity) || 0);
          g.totalValue += (Number(s.valor_total_brl) || 0);
          g.icms += (Number(s.icms_brl) || 0);
          g.pis += (Number(s.pis_brl) || 0);
          g.cofins += (Number(s.cofins_brl) || 0);
          g.ipi += (Number(s.ipi_brl) || 0);
          g.netValue += (Number(s.valor_liquido_brl) || 0);
        } else {
          g.quantity += (Number(s.quantity) || 0);
          g.totalValue += (Number(s.totalValue) || 0);
          g.icms += (Number(s.icms) || 0);
          g.pis += (Number(s.pis) || 0);
          g.cofins += (Number(s.cofins) || 0);
          g.ipi += (Number(s.ipi) || 0);
          const saleTaxes = (Number(s.icms) || 0) + (Number(s.pis) || 0) + (Number(s.cofins) || 0) + (Number(s.ipi) || 0);
          const saleNetValue = s.netValue !== undefined ? Number(s.netValue) : (Number(s.totalValue || 0) - saleTaxes);
          g.netValue += saleNetValue;
        }
      }

      const batchList = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const g of groups.values()) {
        const royaltyValue = g.netValue * royaltyRate;
        const ref = doc(collection(db, 'reports'));
        currentBatch.set(ref, {
          contractId,
          licenseId,
          lineId: g.lineId,
          productId: g.prodId === "unknown" ? "" : g.prodId,
          month: g.month,
          year: g.year,
          quantity: g.quantity,
          totalValue: g.totalValue,
          icms: g.icms,
          pis: g.pis,
          cofins: g.cofins,
          ipi: g.ipi,
          netValue: g.netValue,
          royaltyRate,
          royaltyValue,
          calculationType: royaltyRateType === 'netSales1' ? 'Vendas' : 
                          royaltyRateType === 'netPurchases' ? 'Compras' : 
                          royaltyRateType === 'fob' ? 'FOB' : '',
          createdAt: serverTimestamp()
        });
        opCount++;
        if (opCount >= 500) {
          batchList.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        batchList.push(currentBatch);
      }

      for (const batch of batchList) {
        await batch.commit();
      }

      toast.success(`${groups.size} fechamentos mensais registrados a partir de ${matchingSales.length} vendas detectadas!`);
      setOpen(false);
      setLicenseId('');
      setSelectedLineIds([]);
      setContractId('');
      setRoyaltyRateType('');
      setSelectedProductSkus([]);
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'resource-exhausted' || (err?.message && err.message.includes('Quota exceeded'))) {
        toast.error('Cota do Firebase excedida (20.000 gravações/dia atingida). Tente novamente amanhã.', { duration: 6000 });
      } else {
        toast.error('Erro ao compilar relatório.');
      }
    } finally {
      setIsCompiling(false);
    }
  };

  const availableLines = lines.filter(l => l.licenseId === licenseId);
  const availableContracts = contracts.filter(c => c.licenseId === licenseId);
  
  // Melhora a filtragem: produtos que pertencem às linhas do licenciador selecionado
  const availableLineIds = new Set(availableLines.map(l => l.id));

  const availableLaunchYears = Array.from(new Set(products
      .filter(p => availableLineIds.has(p.lineId) && (selectedLineIds.length === 0 || selectedLineIds.includes(p.lineId)))
      .map(p => p.launchYear)
      .filter((y): y is number => !!y)
  )).sort((a,b) => b - a);

  const availableProducts = products.filter(p => 
    availableLineIds.has(p.lineId) && 
    (selectedLineIds.length === 0 || selectedLineIds.includes(p.lineId)) && 
    (selectedLaunchYears.length === 0 || selectedLaunchYears.includes(String(p.launchYear))) &&
    (
        royaltyRateType === 'netSales1' ? sales.some(s => s.sku === p.sku) :
        royaltyRateType === 'netPurchases' ? wholeSales.some(s => s.sku === p.sku) :
        royaltyRateType === 'fob' ? fobSales.some(s => s.sku === p.sku) :
        true
    ) &&
    !!p.sku
  );
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
      <DialogContent className="max-w-xl p-6 overflow-y-auto max-h-[95vh]">
          <DialogHeader>
            <DialogTitle>Gerar Novo Relatório de Royalties</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Licenciador</Label>
            <Select onValueChange={(v) => { 
                setLicenseId(v); 
                setSelectedLineIds([]); 
                setSelectedLaunchYears([]);
                setContractId(''); 
                setSelectedProductSkus([]); 
                setRoyaltyRateType(''); 
              }} 
              value={licenseId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o licenciador">
                  {licenses.find(l => l.id === licenseId)?.nomelicenciador}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[...licenses].sort((a,b) => a.nomelicenciador.localeCompare(b.nomelicenciador)).map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.nomelicenciador}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {licenseId && (
            <div className="space-y-2">
              <Label>Contrato do Licenciador</Label>
              <Select onValueChange={(v) => { setContractId(v); setRoyaltyRateType(''); }} value={contractId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato">
                    {selectedContract?.contractNumber || (selectedContract ? `ID: ${selectedContract.id.slice(0,5)}` : "")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableContracts.sort((a,b) => (a.contractNumber||'').localeCompare(b.contractNumber||'')).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.contractNumber || `ID: ${c.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {contractId && selectedContract && (
            <>
              <div className="space-y-2">
                <Label>Taxa de Royalties (do Contrato)</Label>
                <Select onValueChange={setRoyaltyRateType} value={royaltyRateType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a taxa a aplicar">
                      {royaltyRateType === 'netSales1' && typeof selectedContract.royaltyRateNetSales1 === 'number' && `${(selectedContract.royaltyRateNetSales1 * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
                      {royaltyRateType === 'netPurchases' && typeof selectedContract.royaltyRateNetPurchases === 'number' && `${(selectedContract.royaltyRateNetPurchases * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
                      {royaltyRateType === 'fob' && typeof selectedContract.royaltyRateFOB === 'number' && `${(selectedContract.royaltyRateFOB * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {typeof selectedContract.royaltyRateNetSales1 === 'number' && (
                      <SelectItem value="netSales1">{(selectedContract.royaltyRateNetSales1 * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% (Taxa sobre Vendas)</SelectItem>
                    )}
                    {typeof selectedContract.royaltyRateNetPurchases === 'number' && (
                      <SelectItem value="netPurchases">{(selectedContract.royaltyRateNetPurchases * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% (Taxa sobre Compras)</SelectItem>
                    )}
                    {typeof selectedContract.royaltyRateFOB === 'number' && (
                      <SelectItem value="fob">{(selectedContract.royaltyRateFOB * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% (Taxa FOB)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {royaltyRateType && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label>Tipo de Cálculo</Label>
                  <Input 
                    value={
                      royaltyRateType === 'netSales1' ? 'Vendas Líquidas' : 
                      royaltyRateType === 'netPurchases' ? 'Compras Líquidas' : 
                      royaltyRateType === 'fob' ? 'FOB' : ''
                    } 
                    className="bg-slate-50 font-medium text-blue-700" 
                    readOnly 
                  />
                </div>
              )}
            </>
          )}

          {licenseId && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 font-semibold uppercase">Filtro de Linhas (Opcional)</Label>
              <MultiSelectDropdown
                options={availableLines.map(l => ({ label: l.nomelinha, value: l.id }))}
                selectedValues={selectedLineIds}
                onChange={setSelectedLineIds}
                placeholder="Todas as linhas do licenciador"
              />
            </div>
          )}

          {licenseId && availableLaunchYears.length > 0 && (
             <div className="space-y-2">
               <Label className="text-xs text-slate-500 font-semibold uppercase">Ano de Lançamento (Opcional)</Label>
               <MultiSelectDropdown
                 options={availableLaunchYears.map(y => ({ label: String(y), value: String(y) }))}
                 selectedValues={selectedLaunchYears}
                 onChange={setSelectedLaunchYears}
                 placeholder="Todos os anos"
               />
             </div>
           )}

          {licenseId && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 font-semibold uppercase">Produtos a serem apurados</Label>
              <MultiSelectDropdown
                options={availableProducts.map(p => ({ label: `${p.sku} - ${p.name}`, value: String(p.sku) }))}
                selectedValues={selectedProductSkus}
                onChange={setSelectedProductSkus}
                placeholder="Selecione os produtos"
              />
              <p className="text-[10px] text-slate-400">Mostrando {availableProducts.length} produtos disponíveis.</p>
            </div>
          )}

          {licenseId && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Data Inicial (Vendas)</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Data Final (Vendas)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
          )}

          {royaltySummary && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                <Info size={16} />
                Resumo da Apuração
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Total de Registros</p>
                  <p className="font-semibold text-slate-800">{royaltySummary.count}</p>
                </div>
                <div>
                  <p className="text-slate-500">Base de Cálculo ({royaltySummary.isFob ? 'BRL - FOB' : 'BRL'})</p>
                  <p className="font-semibold text-slate-800">
                    {royaltySummary.totalBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Alíquota Aplicada</p>
                  <p className="font-semibold text-slate-800">{(royaltySummary.royaltyRate * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Valor Total a Pagar</p>
                  <p className="font-bold text-blue-700">
                    {royaltySummary.royaltyValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>

              {royaltySummary.isFob && (
                <div className="pt-2 mt-2 border-t border-blue-200 flex gap-2 items-start">
                  <div className="p-1 bg-blue-100 rounded text-blue-700 mt-0.5">
                    <Info size={10} />
                  </div>
                  <p className="text-[10px] text-blue-700 leading-tight">
                    <strong>Aviso FOB:</strong> As vendas originais em USD foram convertidas para BRL utilizando a taxa de câmbio gravada no momento da importação. Todos os cálculos de royalties estão sendo processados em Reais (BRL).
                  </p>
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full mt-4" disabled={isCompiling}>
            {isCompiling ? "Compilando Relatórios..." : "Gerar Relatório de Royalties"}
          </Button>
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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const filteredContracts = contracts.filter(c => !licenseId || c.licenseId === licenseId);
  const selectedContract = contracts.find(c => c.id === contractId);

  const availableYears = React.useMemo(() => {
    if (!selectedContract) return [];
    const yearsSet = new Set<string>();
    
    if (type === 'mg' && selectedContract.mgInstallments) {
      selectedContract.mgInstallments.forEach(i => i.year && yearsSet.add(String(i.year)));
    } else if (type === 'marketing' && selectedContract.marketingFundInstallments) {
      selectedContract.marketingFundInstallments.forEach(i => i.year && yearsSet.add(String(i.year)));
    } else if (selectedContract.isDividedIntoYears && selectedContract.years) {
      selectedContract.years.forEach(y => yearsSet.add(String(y.yearNumber)));
    }
    
    return Array.from(yearsSet).sort();
  }, [selectedContract, type]);

  const availableInstallments = React.useMemo(() => {
    if (!selectedContract) return [];
    const instSet = new Set<string>();

    if (type === 'mg' && selectedContract.mgInstallments) {
      selectedContract.mgInstallments.forEach(i => {
        if (!year || String(i.year) === year) instSet.add(String(i.installmentNumber));
      });
    } else if (type === 'marketing' && selectedContract.marketingFundInstallments) {
      selectedContract.marketingFundInstallments.forEach(i => {
        if (!year || String(i.year) === year) instSet.add(String(i.installmentNumber));
      });
    }
    
    return Array.from(instSet).sort();
  }, [selectedContract, type, year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let documentUrl = '';
      let documentName = '';

      if (file) {
        documentUrl = await uploadFile(file, `payments/${Date.now()}_${file.name}`);
        documentName = file.name;
      }

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
        documentUrl,
        documentName,
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
      setFile(null);
    } catch (err) {
      toast.error('Erro ao registrar pagamento.');
    } finally {
      setUploading(false);
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
                  <SelectItem value="marketing">Fundo de Marketing (CMF)</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Select onValueChange={(v) => { setLicenseId(v); setContractId(''); }} value={licenseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o licenciador">
                    {licenses.find(l => l.id === licenseId)?.nomelicenciador}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[...licenses].sort((a, b) => (a.nomelicenciador || a.id).localeCompare(b.nomelicenciador || b.id)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nomelicenciador || `ID: ${l.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select onValueChange={setContractId} value={contractId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato">
                    {(() => {
                      const c = contracts.find(c => c.id === contractId);
                      if (!c) return null;
                      return c.contractNumber || `ID: ${c.id.slice(0,5)}`;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[...filteredContracts].sort((a, b) => (a.contractNumber || '').localeCompare(b.contractNumber || '')).map(c => {
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contractNumber || `ID: ${c.id.slice(0,5)}`}
                      </SelectItem>
                    );
                  })}
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
              {availableYears.length > 0 ? (
                <Select onValueChange={setYear} value={year}>
                  <SelectTrigger><SelectValue placeholder="Selecione o ano" /></SelectTrigger>
                  <SelectContent>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Ex: 2025" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Parcela</Label>
              {type !== 'excess' && availableInstallments.length > 0 ? (
                <Select onValueChange={setInstallmentNumber} value={installmentNumber}>
                  <SelectTrigger><SelectValue placeholder="Selecione a parcela" /></SelectTrigger>
                  <SelectContent>
                    {availableInstallments.map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={installmentNumber} onChange={(e) => setInstallmentNumber(e.target.value)} placeholder="Ex: 1" disabled={type === 'excess'} />
              )}
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
            <Label>Comprovante / Documento (Invoice, Recibo, Boleto)</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="file" 
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
                className="cursor-pointer"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {file && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setFile(null)}
                  className="text-red-500 hover:text-red-600"
                >
                  <X size={16} />
                </Button>
              )}
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

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              'Registrar Pagamento'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DashboardView({ contracts, reports, payments, licenses, lines, products }: any) {
  const totalRoyalties = React.useMemo(() => reports.reduce((acc: number, r: any) => acc + r.royaltyValue, 0), [reports]);
  const totalMG = React.useMemo(() => contracts.reduce((acc: number, c: any) => acc + c.minimumGuarantee, 0), [contracts]);
  const totalPaid = React.useMemo(() => payments.filter((p: any) => p.status === 'paid').reduce((acc: number, p: any) => acc + p.amount, 0), [payments]);

  const activeContractsCount = React.useMemo(() => 
    contracts.filter((c: any) => ['Ativo', 'Ativo (sell-off)'].includes(getContractStatus(c).label)).length,
  [contracts]);

  const contractCompensations = React.useMemo(() => {
    return contracts.slice(0, 5).map((contract: any) => {
      const license = licenses.find((l: any) => l.id === contract.licenseId);
      const contractRoyalties = reports
        .filter((r: any) => r.contractId === contract.id)
        .reduce((acc: number, r: any) => acc + r.royaltyValue, 0);
      const progress = Math.min((contractRoyalties / (contract.minimumGuarantee || 1)) * 100, 100);
      
      return {
        id: contract.id,
        licenseName: license?.nomelicenciador || 'Licenciador',
        contractNumber: contract.contractNumber || contract.id.slice(0, 5),
        contractRoyalties,
        minimumGuarantee: contract.minimumGuarantee,
        currency: contract.currency,
        progress
      };
    });
  }, [contracts, licenses, reports]);

  const pendingPayments = React.useMemo(() => 
    payments.filter((p: any) => p.status === 'pending').slice(0, 5),
  [payments]);

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
          trend={`${activeContractsCount} contratos vigentes`}
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
              {contractCompensations.map((comp: any) => {
                return (
                  <div key={comp.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {comp.licenseName} - {comp.contractNumber}
                      </span>
                      <span className="text-slate-500">
                        {getCurrencySymbol(comp.currency || 'BRL')} {comp.contractRoyalties.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {getCurrencySymbol(comp.currency || 'BRL')} {comp.minimumGuarantee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${comp.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${comp.progress}%` }}
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
              {pendingPayments.map((payment: any) => (
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
              {pendingPayments.length === 0 && (
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
                    .flatMap((c: any) => (c.mgInstallments || []).map((inst: any) => {
                      const lic = licenses.find((l: any) => l.id === c.licenseId);
                      return {
                        ...inst,
                        contractId: c.id,
                        contractNumber: c.contractNumber || c.id.slice(0, 5),
                        licenseName: lic?.nomelicenciador || (c.licenseId ? `ID: ${c.licenseId.slice(0, 5)}` : 'Licenciador'),
                        currency: c.currency || 'BRL'
                      };
                    }));

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

function ContractCard({ 
  contract, 
  licenses, 
  lines, 
  products, 
  contracts, 
  isAdmin 
}: any) {
  // calculate values
  const start = new Date(contract.startDate).getTime();
  const end = new Date(contract.endDate).getTime();
  const now = new Date().getTime();
  
  const isValidDates = !isNaN(start) && !isNaN(end);
  let progressPercent = 0;
  if (isValidDates) {
    const total = end - start;
    const elapsed = Math.min(Math.max(now - start, 0), total);
    progressPercent = (elapsed / (total || 1)) * 100;
  }

  // Compensação progress (Royalties vs MG)
  const mgValue = Number(contract.totalRoyalties) || 0;
  const mgTotal = Number(contract.minimumGuarantee) || 1;
  const recoupmentPercent = (mgValue / mgTotal) * 100;
  const clampedRecoupment = Math.min(recoupmentPercent, 100);
  const isMGMet = mgValue >= mgTotal;
  const isExceeded = mgValue > mgTotal;
  
  const mgBarColor = isMGMet ? 'bg-emerald-500' : 'bg-orange-500';
  const mgBgColor = isExceeded ? 'bg-emerald-100' : 'bg-slate-100';

  const durationStr = calculateDuration(contract.startDate, contract.endDate);

  // Directly map status to background colors to ensure Tailwind includes the classes
  // Using -700 to match the exact tone of the status text
  let progressBgClass = 'bg-emerald-700';
  if (contract.calculatedStatus === 'Ativo') progressBgClass = 'bg-emerald-700';
  else if (contract.calculatedStatus === 'Ativo (sell-off)') progressBgClass = 'bg-amber-700';
  else if (contract.calculatedStatus === 'Encerrado') progressBgClass = 'bg-red-700';
  else if (contract.calculatedStatus === 'Aguardando') progressBgClass = 'bg-blue-700';

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm flex flex-col justify-between h-full group hover:shadow-md transition-shadow">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-0.5">
            <h2 className="text-2xl font-medium text-slate-900 tracking-tight leading-tight">{contract.licenseName}</h2>
            <div className="text-[13px] text-slate-400 font-light">{contract.contractNumber || '---'}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={cn("rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider", contract.statusColor)}>
              {contract.calculatedStatus}
            </Badge>
            <ContractDetailsDialog 
              contract={contract} 
              licenses={licenses} 
              lines={lines} 
              products={products}
              contracts={contracts}
              trigger={
                <button className="text-slate-400 hover:text-slate-600 underline text-[11px] underline-offset-4 decoration-slate-300">
                  Ver detalhes
                </button>
              }
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[13px] text-slate-500 font-normal">Vigência</h3>
            <Calendar className="text-slate-400" size={16} />
          </div>
          
          <div className="flex justify-between text-slate-400 text-[10px] mb-2 font-medium uppercase tracking-wide">
            <span>{durationStr}</span>
            <span>{contract.isPlurianual ? 'Plurianual' : 'Contrato'}</span>
          </div>

          <div className="flex justify-between text-slate-600 text-sm mb-2">
            <div>Início: <span className="text-slate-900 font-medium">{formatDateBR(contract.startDate)}</span></div>
            <div>Final: <span className="text-slate-900 font-medium">{formatDateBR(contract.endDate)}</span></div>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
            <div className={cn("h-full rounded-full transition-all duration-500", progressBgClass)} style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="flex justify-between text-slate-400 text-[10px]">
            <span>Sell-Off: {contract.sellOffPeriod || 0} dias</span>
            <span>Final: <span className="text-slate-600 font-medium">{formatDateBR(contract.sellOffEndDate)}</span></span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[13px] text-slate-500 font-normal">Compensação</h3>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none px-2 py-0.5 rounded-md text-[11px] font-medium tracking-normal">
               {contract.currency === 'Dólar' ? 'USD' : 
                contract.currency === 'Real' ? 'BRL' : 
                contract.currency === 'Euro' ? 'EUR' : 
                (contract.currency || 'BRL')}
            </Badge>
          </div>

          <div className="grid grid-cols-2 mb-2">
            <div className="space-y-0.5">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Royalties</div>
              <div className="text-lg font-semibold text-slate-700 leading-none">
                 {getCurrencySymbol(contract.currency || 'BRL')} {contract.totalRoyalties.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="space-y-0.5 text-right">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">MG</div>
              <div className="text-lg font-semibold text-slate-700 leading-none">
                 {getCurrencySymbol(contract.currency || 'BRL')} {contract.minimumGuarantee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Progress Bar with Recoupment Logic */}
          <div className={cn("h-1.5 w-full rounded-full overflow-hidden mb-4", mgBgColor)}>
            <div className={cn("h-full rounded-full transition-all duration-500", mgBarColor)} style={{ width: `${clampedRecoupment}%` }} />
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-400 mb-4 px-1">
             <span className={isMGMet ? "text-emerald-600 font-bold" : "text-orange-600 font-medium"}>
               {recoupmentPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% compensado
             </span>
             <span className="text-emerald-600 font-medium">
                {contract.totalMGPaid ? contract.totalMGPaid.toLocaleString('pt-BR', { style: 'currency', currency: contract.currency === 'Dólar' ? 'USD' : contract.currency === 'Euro' ? 'EUR' : 'BRL' }) : getCurrencySymbol(contract.currency || 'BRL') + ' 0,00'} pago
             </span>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[13px] text-slate-500 font-normal">Royalties</h3>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none px-2 py-0.5 rounded-md text-[11px] font-medium tracking-normal">
                {(contract.reportingFrequency || 'Trimestral').charAt(0).toUpperCase() + (contract.reportingFrequency || 'Trimestral').slice(1).toLowerCase()}
              </Badge>
            </div>
            <div className="flex justify-between items-end border-b border-slate-100 pb-3">
              <div className="space-y-0.5 text-slate-400 text-[11px] leading-relaxed">
                <div>Vendas líquidas</div>
                <div>Compras líquidas</div>
                <div>FOB</div>
              </div>
              <div className="space-y-0.5 text-slate-600 text-[11px] font-medium text-center">
                 <div>{Number(((contract.royaltyRateNetSales1 || 0) * 100).toFixed(1))}% {contract.royaltyRateNetSales2 ? `e ${Number((contract.royaltyRateNetSales2 * 100).toFixed(1))}%` : ''}</div>
                 <div>{Number(((contract.royaltyRateNetPurchases || 0) * 100).toFixed(1))}%</div>
                 <div>{Number(((contract.royaltyRateFOB || 0) * 100).toFixed(1))}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-transparent group-hover:border-slate-50">
        {isAdmin && (
          <>
            <ContractDetailsDialog 
              contract={contract} 
              licenses={licenses} 
              lines={lines} 
              products={products}
              contracts={contracts}
              initialIsEditing={true}
              trigger={
                <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                  <Edit2 size={16} />
                </button>
              }
            />
            <ContractDetailsDialog 
              contract={contract} 
              licenses={licenses} 
              lines={lines} 
              products={products}
              contracts={contracts}
              trigger={
                <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                  <Trash2 size={16} />
                </button>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

function ContractsView({ contracts, licenses, reports, lines, products, payments = [], isAdmin }: { 
  contracts: Contract[], 
  licenses: License[], 
  reports: RoyaltyReport[], 
  lines: Line[], 
  products: Product[],
  payments?: any[],
  isAdmin: boolean
}) {
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [viewType, setViewType] = useState<'cards' | 'table'>('cards');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'license', direction: 'asc' });

  const processedContracts = React.useMemo(() => contracts.map((contract: any) => {
    const statusInfo = getContractStatus(contract);
    const contractReports = reports.filter((r: any) => r.contractId === contract.id);
    const totalRoyalties = contractReports.reduce((sum: number, r: any) => sum + r.royaltyValue, 0);
    const balance = (contract.minimumGuarantee || 0) - totalRoyalties;
    const license = licenses.find((l: any) => l.id === contract.licenseId);
    
    // Calculate total MG Paid for this contract
    const mgPaid = payments
      .filter((p: any) => p.contractId === contract.id && p.type === 'mg' && p.status === 'paid')
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    
    return { 
      ...contract, 
      calculatedStatus: statusInfo.label, 
      statusColor: statusInfo.color,
      licenseName: license?.nomelicenciador || (contract.licenseId ? `ID: ${contract.licenseId.slice(0, 5)}` : ''),
      totalRoyalties,
      balance,
      totalMGPaid: mgPaid
    };
  }), [contracts, reports, licenses, payments]);

  const filteredContracts = React.useMemo(() => processedContracts.filter((c: any) => {
    if (statusFilter === 'Todos') return true;
    return c.calculatedStatus === statusFilter;
  }), [processedContracts, statusFilter]);

  const sortedContracts = React.useMemo(() => [...filteredContracts].sort((a, b) => {
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
  }), [filteredContracts, sortConfig]);

  const handleSort = React.useCallback((key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
    if (sortConfig.direction === 'asc') return <ChevronUp size={12} className="ml-1 text-blue-600" />;
    if (sortConfig.direction === 'desc') return <ChevronDown size={12} className="ml-1 text-blue-600" />;
    return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="bg-transparent gap-1 h-8">
              <TabsTrigger value="Todos" className="rounded-lg data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none px-4 text-xs font-medium">Todos</TabsTrigger>
              <TabsTrigger value="Ativo" className="rounded-lg data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none px-4 text-xs font-medium">Ativos</TabsTrigger>
              <TabsTrigger value="Ativo (sell-off)" className="rounded-lg data-[state=active]:bg-amber-50 data-[state=active]:text-amber-600 data-[state=active]:shadow-none px-4 text-xs font-medium">Sell-off</TabsTrigger>
              <TabsTrigger value="Encerrado" className="rounded-lg data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none px-4 text-xs font-medium">Encerrados</TabsTrigger>
              <TabsTrigger value="Aguardando" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-4 text-xs font-medium">Aguardando</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setViewType('cards')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              viewType === 'cards' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"
            )}
            title="Visualização em Cards"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            onClick={() => setViewType('table')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              viewType === 'table' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"
            )}
            title="Visualização em Tabela"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {viewType === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedContracts.map((contract: any) => (
            <ContractCard 
              key={contract.id}
              contract={contract}
              licenses={licenses}
              lines={lines}
              products={products}
              contracts={contracts}
              isAdmin={isAdmin}
            />
          ))}
          {sortedContracts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[32px]">
              Nenhum contrato encontrado para este filtro.
            </div>
          )}
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-slate-100">
            <div>
              <CardTitle className="text-lg">Contratos de Licenciamento</CardTitle>
              <CardDescription>Visualização em formato de tabela</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
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
                      <tr key={contract.id} className="hover:bg-slate-50 transition-colors group text-xs">
                        <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] transition-colors">
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
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{contract.contractNumber}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Badge className={cn("text-[10px] py-0", contract.statusColor)}>
                            {contract.calculatedStatus}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                          {formatDateBR(contract.startDate)}
                        </td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                          {formatDateBR(contract.endDate)}
                        </td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{contract.sellOffPeriod || '-'}</td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                          {formatDateBR(contract.sellOffEndDate)}
                        </td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                          {contract.currency === 'Dólar' ? 'USD' : 
                           contract.currency === 'Real' ? 'BRL' : 
                           contract.currency === 'Euro' ? 'EUR' : 
                           (contract.currency || 'BRL')}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap">
                          {getCurrencySymbol(contract.currency || 'BRL')} {contract.minimumGuarantee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 font-semibold text-emerald-600 whitespace-nowrap">
                          {getCurrencySymbol(contract.currency || 'BRL')} {contract.totalRoyalties.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-3 py-3 font-semibold whitespace-nowrap ${contract.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {getCurrencySymbol(contract.currency || 'BRL')} {contract.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{Number(((contract.royaltyRateNetSales1 || 0) * 100).toFixed(2))}%</td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{contract.royaltyRateNetSales2 ? Number((contract.royaltyRateNetSales2 * 100).toFixed(2)) : '-'}%</td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{contract.royaltyRateNetPurchases ? Number((contract.royaltyRateNetPurchases * 100).toFixed(2)) : '-'}%</td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{contract.royaltyRateFOB ? Number((contract.royaltyRateFOB * 100).toFixed(2)) : '-'}%</td>
                      </tr>
                    );
                  })}
                  {sortedContracts.length === 0 && (
                    <tr>
                      <td colSpan={15} className="px-3 py-8 text-center text-slate-400">Nenhum contrato cadastrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SalesView({ sales, licenses, lines, categories, products, contracts, isAdmin, activeTab, currencyView, setCurrencyView }: {
  sales: Sale[],
  licenses: License[],
  lines: Line[],
  categories: ProductCategory[],
  products: Product[],
  contracts: Contract[],
  isAdmin: boolean,
  activeTab: string,
  currencyView?: 'usd' | 'brl',
  setCurrencyView?: (view: 'usd' | 'brl') => void
}) {
  const collectionName = {
    'sales': 'sales',
    'sales_liquidas': 'netsales',
    'sales_compras': 'wholesales',
    'sales_fob': 'fobsales'
  }[activeTab] || 'sales';
  const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [selectedSaleMonths, setSelectedSaleMonths] = useState<string[]>([]);
  const [selectedSaleYears, setSelectedSaleYears] = useState<string[]>([]);
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(50);

  // Sales Summary State
  const [salesSummaryLicenseIds, setSalesSummaryLicenseIds] = useState<string[]>([]);
  const [salesSummaryLineIds, setSalesSummaryLineIds] = useState<string[]>([]);
  const [salesSummaryCategoryIds, setSalesSummaryCategoryIds] = useState<string[]>([]);
  const [salesSummaryValueType, setSalesSummaryValueType] = useState<'quantity' | 'totalValue' | 'netValue' | 'royaltyValue'>('netValue');
  const [salesSummaryViewMode, setSalesSummaryViewMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [expandedSalesYears, setExpandedSalesYears] = useState<number[]>([]);

  const monthMap: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  const filteredSales = React.useMemo(() => {
    return sales.filter(s => {
      const saleSku = String(s.sku || "").trim();
      if (selectedLicenses.length && !selectedLicenses.includes(s.licenseId)) return false;
      if (selectedLines.length && !selectedLines.includes(s.lineId)) return false;
      if (selectedCategories.length && !selectedCategories.includes(s.categoryId)) return false;
      if (selectedYears.length && !selectedYears.includes(String(s.launchYear))) return false;
      if (selectedSkus.length && !selectedSkus.includes(saleSku)) return false;
      
      const dt = getSafeDate(s.date);
      if (!isNaN(dt.getTime())) {
        const sm = String(dt.getMonth() + 1).padStart(2, '0');
        const sy = String(dt.getFullYear());
        if (selectedSaleMonths.length && !selectedSaleMonths.includes(sm)) return false;
        if (selectedSaleYears.length && !selectedSaleYears.includes(sy)) return false;
      }
      return true;
    });
  }, [sales, selectedLicenses, selectedLines, selectedCategories, selectedYears, selectedSkus, selectedSaleMonths, selectedSaleYears]);

  const allSaleMonths = React.useMemo(() => {
    const months = new Set<string>();
    sales.forEach(s => {
      const dt = getSafeDate(s.date);
      if(!isNaN(dt.getTime())) {
         months.add(String(dt.getMonth() + 1).padStart(2, '0'));
      }
    });
    return Array.from(months).sort();
  }, [sales]);

  const allSaleYears = React.useMemo(() => {
    const years = new Set<string>();
    sales.forEach(s => {
      const dt = getSafeDate(s.date);
      if(!isNaN(dt.getTime())) {
         years.add(String(dt.getFullYear()));
      }
    });
    return Array.from(years).sort();
  }, [sales]);

  const availableOptions = React.useMemo(() => {
    // 1. Licenses available for filtering
    const availableLicenses = licenses.filter(l => {
      return products.some(p => {
        const pSku = String(p.sku || "").trim();
        const matchesOthers = 
          (selectedLines.length === 0 || selectedLines.includes(p.lineId)) &&
          (selectedCategories.length === 0 || selectedCategories.includes(p.categoryId || '')) &&
          (selectedYears.length === 0 || selectedYears.includes(String(p.launchYear))) &&
          (selectedSkus.length === 0 || selectedSkus.includes(pSku));
        return matchesOthers && (p.licenseId === l.id);
      });
    });

    // 2. Lines available for filtering
    const availableLines = lines.filter(l => {
      return products.some(p => {
        const pSku = String(p.sku || "").trim();
        const matchesOthers = 
          (selectedLicenses.length === 0 || selectedLicenses.includes(p.licenseId || '')) &&
          (selectedCategories.length === 0 || selectedCategories.includes(p.categoryId || '')) &&
          (selectedYears.length === 0 || selectedYears.includes(String(p.launchYear))) &&
          (selectedSkus.length === 0 || selectedSkus.includes(pSku));
        return matchesOthers && (p.lineId === l.id);
      });
    });

    // 3. Categories available for filtering
    const availableCategories = categories.filter(c => {
      return products.some(p => {
        const pSku = String(p.sku || "").trim();
        const matchesOthers = 
          (selectedLicenses.length === 0 || selectedLicenses.includes(p.licenseId || '')) &&
          (selectedLines.length === 0 || selectedLines.includes(p.lineId)) &&
          (selectedYears.length === 0 || selectedYears.includes(String(p.launchYear))) &&
          (selectedSkus.length === 0 || selectedSkus.includes(pSku));
        return matchesOthers && (p.categoryId === c.id);
      });
    });

    // 4. Years available for filtering
    const availableYears = Array.from(new Set(products
      .filter(p => {
        const pSku = String(p.sku || "").trim();
        return (selectedLicenses.length === 0 || selectedLicenses.includes(p.licenseId || '')) &&
               (selectedLines.length === 0 || selectedLines.includes(p.lineId)) &&
               (selectedCategories.length === 0 || selectedCategories.includes(p.categoryId || '')) &&
               (selectedSkus.length === 0 || selectedSkus.includes(pSku));
      })
      .map(p => p.launchYear)
      .filter((y): y is number => !!y)
    ));

    // 5. SKUs available for filtering
    const availableSkus = Array.from(new Set(products
      .filter(p => {
        const pSku = String(p.sku || "").trim();
        return (selectedLicenses.length === 0 || selectedLicenses.includes(p.licenseId || '')) &&
               (selectedLines.length === 0 || selectedLines.includes(p.lineId)) &&
               (selectedCategories.length === 0 || selectedCategories.includes(p.categoryId || '')) &&
               (selectedYears.length === 0 || selectedYears.includes(String(p.launchYear)));
      })
      .map(p => String(p.sku || "").trim())
      .filter((s): s is string => !!s)
    ));

    return {
      licenses: availableLicenses,
      lines: availableLines,
      categories: availableCategories,
      years: availableYears,
      skus: availableSkus,
    };
  }, [licenses, lines, categories, products, selectedLicenses, selectedLines, selectedCategories, selectedYears, selectedSkus]);

  const groupedSales = React.useMemo(() => {
    const groups = new Map<string, any>();
    filteredSales.forEach(s => {
      const dt = getSafeDate(s.date);
      const m = isNaN(dt.getTime()) ? '00' : String(dt.getMonth() + 1).padStart(2, '0');
      const y = isNaN(dt.getTime()) ? '0000' : String(dt.getFullYear());
      // Clean SKU for grouping
      const cleanSku = String(s.sku || "").trim();
      const key = `${y}-${m}-${cleanSku}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          sku: cleanSku,
          description: s.description,
          month: m,
          year: y,
          quantity: 0,
          totalValue: 0,
          totalTaxes: 0,
          netValue: 0,
          count: 0
        });
      }
      
      const g = groups.get(key);
      const isFob = activeTab === 'sales_fob';
      const suffix = isFob ? (currencyView === 'usd' ? '_usd' : '_brl') : '';
      
      const saleQuantity = Number(s.quantity) || 0;
      let saleTotalValue = 0;
      let saleTaxes = 0;
      let saleNetValue = 0;

      if (isFob) {
        saleTotalValue = Number(s[`valor_total${suffix}`]) || 0;
        saleTaxes = (Number(s[`icms${suffix}`]) || 0) + (Number(s[`pis${suffix}`]) || 0) + (Number(s[`cofins${suffix}`]) || 0) + (Number(s[`ipi${suffix}`]) || 0);
        saleNetValue = Number(s[`valor_liquido${suffix}`]) || 0;
      } else {
        saleTotalValue = Number(s.totalValue) || 0;
        saleTaxes = (Number(s.icms) || 0) + (Number(s.pis) || 0) + (Number(s.cofins) || 0) + (Number(s.ipi) || 0);
        saleNetValue = Number(s.netValue) || 0;
      }

      g.quantity += saleQuantity;
      g.totalValue += saleTotalValue;
      g.totalTaxes += saleTaxes;
      g.netValue += saleNetValue;
      g.count++;
    });
    return Array.from(groups.values()).sort((a, b) => {
        if (a.year !== b.year) return Number(b.year) - Number(a.year);
        if (a.month !== b.month) return Number(b.month) - Number(a.month);
        return a.sku.localeCompare(b.sku);
    });
  }, [filteredSales, activeTab, currencyView]);

  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');

  const salesSummaryData = React.useMemo(() => {
    const filtered = sales.filter(s => {
      if (salesSummaryLicenseIds.length > 0 && !salesSummaryLicenseIds.includes(s.licenseId)) return false;
      if (salesSummaryLineIds.length > 0 && !salesSummaryLineIds.includes(s.lineId)) return false;
      if (salesSummaryCategoryIds.length > 0 && !salesSummaryCategoryIds.includes(s.categoryId)) return false;
      return true;
    });

    const yearsSet = new Set<number>();
    const grid: Record<number, Record<number, number>> = {};

    filtered.forEach(s => {
      const dt = getSafeDate(s.date);
      if (!isNaN(dt.getTime())) {
        const y = dt.getFullYear();
        const m = dt.getMonth() + 1;
        yearsSet.add(y);
        
        if (!grid[y]) grid[y] = {};
        if (!grid[y][m]) grid[y][m] = 0;
        
        const isFob = activeTab === 'sales_fob';
        const suffix = isFob ? (currencyView === 'usd' ? '_usd' : '_brl') : '';
        
        const val = salesSummaryValueType === 'quantity' ? (Number(s.quantity) || 0) :
                   salesSummaryValueType === 'totalValue' ? (isFob ? (Number(s[`valor_total${suffix}`]) || 0) : (Number(s.totalValue) || 0)) :
                   salesSummaryValueType === 'netValue' ? (isFob ? (Number(s[`valor_liquido${suffix}`]) || 0) : (Number(s.netValue) || 0)) :
                   (() => {
                     // Try to find a matching contract for this sale line
                     const contract = contracts.find((c: any) => 
                       c.licenseId === s.licenseId && 
                       (Array.isArray(c.lineIds) && c.lineIds.includes(s.lineId))
                     );
                     // Use specific rate or a default if none matches (fallback to 10% estimation)
                     const rate = contract?.royaltyRateNetSales1 || 0.1;
                     const baseValue = isFob ? (Number(s[`valor_liquido${suffix}`]) || 0) : (Number(s.netValue) || 0);
                     return baseValue * rate;
                   })();
        
        grid[y][m] += val;
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => a - b); // Oldest years first
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return { years, months, grid };
  }, [sales, salesSummaryLicenseIds, salesSummaryLineIds, salesSummaryCategoryIds, salesSummaryValueType, contracts, activeTab, currencyView]);

  return (
    <div className="space-y-6">
      {/* Header section moved to global header */}

      {/* Sales Summary Section */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 pt-4 pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-800">
                <TrendingUp size={18} className="text-emerald-600" />
                <h2 className="text-base font-semibold">
                  {activeTab === 'sales_fob' ? "Resumo de valores de produtos importados" : 
                   activeTab === 'sales_compras' ? "Resumo de valores de produtos comprados" : 
                   activeTab === 'sales_liquidas' ? "Resumo de valores de produtos vendidos" :
                   "Resumo de Vendas Consolidadas"}
                </h2>
              </div>
              
              <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500 bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100">
                <span>{salesSummaryViewMode === 'monthly' ? 'Mensal' : 'Trimestral'}</span>
                <span className="w-1 h-1 rounded-full bg-emerald-300" />
                <span>
                  {salesSummaryValueType === 'quantity' ? 'Quantidades' : 
                   salesSummaryValueType === 'totalValue' ? 'Valor Total (Bruto)' : 
                   salesSummaryValueType === 'netValue' ? 'Valor Líquido' : 
                   'Valor de Royalties'}
                </span>
              </div>
            </div>
            
            {/* Sales Summary Filters */}
            <div className="flex flex-wrap items-end gap-3 w-full">
              <div className="min-w-[180px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Licenciadores</Label>
                <MultiSelectDropdown
                  className="h-7 text-[10px]"
                  options={licenses.map(l => ({ label: l.nomelicenciador, value: l.id }))}
                  selectedValues={salesSummaryLicenseIds}
                  onChange={setSalesSummaryLicenseIds}
                  placeholder="Todos"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Linhas</Label>
                <MultiSelectDropdown
                  className="h-7 text-[10px]"
                  options={lines.filter(l => salesSummaryLicenseIds.length === 0 || salesSummaryLicenseIds.includes(l.licenseId)).map(l => ({ label: l.nomelinha, value: l.id }))}
                  selectedValues={salesSummaryLineIds}
                  onChange={setSalesSummaryLineIds}
                  placeholder="Todas"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Categorias</Label>
                <MultiSelectDropdown
                  className="h-7 text-[10px]"
                  options={categories.map(c => ({ label: c.nomeCategoriaProduto, value: c.id }))}
                  selectedValues={salesSummaryCategoryIds}
                  onChange={setSalesSummaryCategoryIds}
                  placeholder="Todas"
                />
              </div>

              <div className="min-w-[120px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Período</Label>
                <Select value={salesSummaryViewMode} onValueChange={(v: any) => setSalesSummaryViewMode(v)}>
                  <SelectTrigger className="h-7 text-[10px] w-full bg-white">
                    <span>{salesSummaryViewMode === 'monthly' ? 'Mensal' : 'Trimestral'}</span>
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Tipo de Valor</Label>
                <Select value={salesSummaryValueType} onValueChange={(v: any) => setSalesSummaryValueType(v)}>
                  <SelectTrigger className="h-7 text-[10px] w-full bg-white">
                    <span>
                      {salesSummaryValueType === 'quantity' ? 'Quantidades' : 
                       salesSummaryValueType === 'totalValue' ? 'Valor Total (Bruto)' : 
                       salesSummaryValueType === 'netValue' ? 'Valor Líquido' : 
                       'Valor de Royalties'}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="quantity">Quantidades</SelectItem>
                    <SelectItem value="totalValue">Valor Total (Bruto)</SelectItem>
                    <SelectItem value="netValue">Valor Líquido</SelectItem>
                    <SelectItem value="royaltyValue">Valor de Royalties</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse table-fixed min-w-[1000px]">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 border-r border-slate-200 w-24 text-center">Ano</th>
                  {salesSummaryViewMode === 'monthly' ? (
                    ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].map(m => (
                      <th key={m} className="px-1 py-2 text-center border-r border-slate-200 w-[calc((100%-208px)/12)]">{m}</th>
                    ))
                  ) : (
                    ['T1', 'T2', 'T3', 'T4'].map(t => (
                      <th key={t} className="px-1 py-2 text-center border-r border-slate-200 w-[calc((100%-208px)/4)]">{t}</th>
                    ))
                  )}
                  <th className="px-3 py-2 text-center w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesSummaryData.years.length === 0 ? (
                  <tr>
                    <td colSpan={salesSummaryViewMode === 'monthly' ? 14 : 6} className="px-4 py-8 text-center text-slate-400 italic">
                      Nenhuma venda encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  salesSummaryData.years.map(year => {
                    let yearTotal = 0;
                    const rowValues = salesSummaryViewMode === 'monthly' ? (
                      salesSummaryData.months.map(m => {
                        const val = salesSummaryData.grid[year]?.[m] || 0;
                        yearTotal += val;
                        return val;
                      })
                    ) : (
                      [1, 2, 3, 4].map(q => {
                        const qMonths = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];
                        const val = qMonths.reduce((acc, m) => acc + (salesSummaryData.grid[year]?.[m] || 0), 0);
                        yearTotal += val;
                        return val;
                      })
                    );

                    return (
                      <React.Fragment key={year}>
                        <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => {
                          setExpandedSalesYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
                        }}>
                          <td className="px-3 py-2 font-bold bg-slate-50/30 border-r border-slate-200 text-center flex items-center gap-2">
                             <span className="text-slate-400">
                                {expandedSalesYears.includes(year) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                             </span>
                             {year}
                          </td>
                          {rowValues.map((v, i) => (
                            <td key={i} className={`px-3 py-2 text-right border-r border-slate-200 ${v > 0 ? 'text-slate-900 font-medium' : 'text-slate-300'}`}>
                              {salesSummaryValueType === 'quantity' ? 
                                v.toLocaleString('pt-BR') : 
                                v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-bold bg-emerald-50/30 text-emerald-700">
                            {salesSummaryValueType === 'quantity' ? 
                              yearTotal.toLocaleString('pt-BR') : 
                              yearTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {expandedSalesYears.includes(year) && (
                          <tr className="bg-slate-50/80 animate-in fade-in slide-in-from-top-1 border-b border-slate-100">
                            <td className="px-3 py-1.5 text-[10px] italic text-slate-500 border-r border-slate-200 bg-slate-100/30 text-center">
                              % Cresc./Decr.
                            </td>
                            {rowValues.map((v, i) => {
                              let comparisonVal = 0;
                              const prevYear = year - 1;
                              if (salesSummaryData.years.includes(prevYear)) {
                                if (salesSummaryViewMode === 'monthly') {
                                  comparisonVal = salesSummaryData.grid[prevYear]?.[i + 1] || 0;
                                } else {
                                  const q = i + 1;
                                  const qMonths = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];
                                  comparisonVal = qMonths.reduce((acc, m) => acc + (salesSummaryData.grid[prevYear]?.[m] || 0), 0);
                                }
                              }
                              const variance = comparisonVal > 0 ? ((v - comparisonVal) / comparisonVal) * 100 : 0;
                              const isPositive = variance > 0;
                              const isZero = variance === 0 && v === comparisonVal;
                              if (comparisonVal === 0) return (
                                <td key={i} className="px-1 py-1.5 text-center border-r border-slate-200 text-slate-400 text-[10px]">-</td>
                              );
                              return (
                                <td key={i} className={`px-1 py-1.5 text-center border-r border-slate-200 text-[10px] font-medium ${isPositive ? 'text-emerald-600' : isZero ? 'text-slate-400' : 'text-rose-600'}`}>
                                  {isPositive ? '+' : ''}{variance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                                </td>
                              );
                            })}
                            <td className="px-3 py-1.5 text-right bg-emerald-50/50 text-[10px] font-bold text-slate-600">
                              {(() => {
                                let prevYearTotal = 0;
                                salesSummaryData.months.forEach(m => {
                                  prevYearTotal += salesSummaryData.grid[year - 1]?.[m] || 0;
                                });
                                if (prevYearTotal === 0) return '-';
                                const totalVar = ((yearTotal - prevYearTotal) / prevYearTotal) * 100;
                                return `${totalVar > 0 ? '+' : ''}${totalVar.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
                              })()}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-0">
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-slate-50/20">
          <CardHeader className="bg-white border-b border-slate-200 py-4 px-6">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-slate-800">
                  {activeTab === 'sales_fob' ? "Listagem de produtos importados" : 
                   activeTab === 'sales_compras' ? "Listagem de produtos comprados" : 
                   activeTab === 'sales_liquidas' ? "Listagem de vendas por produto" :
                   "Listagem de Vendas por Produto"}
                </h2>
              </div>

              <div className="flex items-center gap-4">
                  {activeTab === 'sales_fob' && (
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] uppercase font-bold text-slate-400">Moeda:</span>
                       <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                         <button 
                           onClick={() => setCurrencyView('usd')}
                           className={cn(
                             "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                             currencyView === 'usd' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                           )}
                         >
                           USD
                         </button>
                         <button 
                           onClick={() => setCurrencyView('brl')}
                           className={cn(
                             "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                             currencyView === 'brl' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                           )}
                         >
                           BRL
                         </button>
                       </div>
                    </div>
                  )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Exibição:</span>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button 
                      onClick={() => setViewMode('grouped')}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                        viewMode === 'grouped' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Agrupado
                    </button>
                    <button 
                      onClick={() => setViewMode('individual')}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                        viewMode === 'individual' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Individual
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Ver:</span>
                  <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); }}>
                    <SelectTrigger className="h-7 text-[10px] bg-slate-100 border-slate-200 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="10">10 itens</SelectItem>
                      <SelectItem value="50">50 itens</SelectItem>
                      <SelectItem value="100">100 itens</SelectItem>
                      <SelectItem value="500">500 itens</SelectItem>
                      <SelectItem value="1000">1000 itens</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex flex-wrap items-end gap-3 w-full">
            {/* Licenciador Filter */}
            <div className="min-w-[150px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Licenciador</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableOptions.licenses.map(l => ({ label: l.nomelicenciador, value: l.id }))}
                selectedValues={selectedLicenses}
                onChange={setSelectedLicenses}
                placeholder="Todos"
              />
            </div>

            {/* Linha Filter */}
            <div className="min-w-[130px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Linha</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableOptions.lines.map(l => ({ label: l.nomelinha, value: l.id }))}
                selectedValues={selectedLines}
                onChange={setSelectedLines}
                placeholder="Todas"
              />
            </div>

            {/* Categoria Filter */}
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Categoria</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableOptions.categories.map(c => ({ label: c.nomeCategoriaProduto, value: c.id }))}
                selectedValues={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="Todas"
              />
            </div>

            {/* Ano Filter */}
            <div className="min-w-[90px] max-w-[110px] space-y-1">
              <Label className="text-[11px] text-slate-400">Ano Lanç.</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableOptions.years.sort((a,b) => b-a).map(y => ({ label: String(y), value: String(y) }))}
                selectedValues={selectedYears}
                onChange={setSelectedYears}
                placeholder="Todos"
              />
            </div>

            {/* SKU Filter */}
            <div className="min-w-[200px] flex-[2] space-y-1">
              <Label className="text-[11px] text-slate-400">Código SKU</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableOptions.skus.sort().map(sku => {
                  const prod = products.find(p => String(p.sku || "").trim() === String(sku || "").trim());
                  const displayName = prod ? `${sku} - ${prod.name}` : sku;
                  return { label: displayName, value: sku };
                })}
                selectedValues={selectedSkus}
                onChange={setSelectedSkus}
                placeholder="Todos"
              />
            </div>

            {/* Sale Month Filter */}
            <div className="min-w-[110px] max-w-[130px] space-y-1">
              <Label className="text-[11px] text-slate-400">Mês Venda</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={allSaleMonths.map(m => ({ label: monthMap[m] || m, value: m }))}
                selectedValues={selectedSaleMonths}
                onChange={setSelectedSaleMonths}
                placeholder="Todos"
              />
            </div>

            {/* Sale Year Filter */}
            <div className="min-w-[100px] max-w-[120px] space-y-1">
              <Label className="text-[11px] text-slate-400">Ano Venda</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={allSaleYears.map(y => ({ label: y, value: y }))}
                selectedValues={selectedSaleYears}
                onChange={setSelectedSaleYears}
                placeholder="Todos"
              />
            </div>
          </div>

          {(selectedLicenses.length > 0 || selectedLines.length > 0 || selectedCategories.length > 0 || selectedYears.length > 0 || selectedSkus.length > 0 || selectedSaleMonths.length > 0 || selectedSaleYears.length > 0 || selectedSales.length > 0) && (
            <div className="flex flex-row justify-between items-center mt-4 w-full">
              <div>
                {(selectedLicenses.length > 0 || selectedLines.length > 0 || selectedCategories.length > 0 || selectedYears.length > 0 || selectedSkus.length > 0 || selectedSaleMonths.length > 0 || selectedSaleYears.length > 0) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-blue-600 h-7 text-xs"
                    onClick={() => {
                      setSelectedLicenses([]);
                      setSelectedLines([]);
                      setSelectedCategories([]);
                      setSelectedYears([]);
                      setSelectedSkus([]);
                      setSelectedSaleMonths([]);
                      setSelectedSaleYears([]);
                    }}
                  >
                    <X size={14} className="mr-1" /> Limpar Filtros
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedSales.length > 0 && viewMode === 'individual' && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-2">
                      <Edit size={14} /> Editar {selectedSales.length} Selecionados
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="h-7 text-xs gap-2"
                      onClick={async () => {
                        if (confirm(`Tem certeza que deseja apagar ${selectedSales.length} venda(s) selecionada(s)?`)) {
                          const batch = writeBatch(db);
                          selectedSales.forEach(id => batch.delete(doc(db, collectionName, id)));
                          await batch.commit();
                          setSelectedSales([]);
                          toast.success(`${selectedSales.length} vendas apagadas.`);
                        }
                      }}
                    >
                      <Trash2 size={14} /> Apagar {selectedSales.length} Selecionados
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
            </div>
          </div>
      </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 w-4">
                    <input 
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedSales.length === filteredSales.length && filteredSales.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSales(filteredSales.map(s => s.id));
                        else setSelectedSales([]);
                      }}
                    />
                  </th>
                  {viewMode === 'grouped' && <th className="px-4 py-3">Mês/Ano</th>}
                  {viewMode === 'individual' && <th className="px-4 py-3">Data</th>}
                  <th className="px-4 py-3 w-16 text-center bg-slate-50">Imagem</th>
                  <th className="px-4 py-3">Código SKU</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Quantidade</th>
                  {viewMode === 'individual' && <th className="px-4 py-3 text-right">Valor Unitário</th>}
                  <th className="px-4 py-3 text-right">Valor Total</th>
                  <th className="px-4 py-3 text-right">Total Impostos</th>
                  <th className="px-4 py-3 text-right">Total Líquido</th>
                  {activeTab === 'sales_fob' && (
                    <>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Fabricante</th>
                    </>
                  )}
                  {viewMode === 'grouped' && <th className="px-4 py-3 text-center">Registros</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {viewMode === 'grouped' ? (
                  groupedSales.slice(0, pageSize).map((group) => (
                    <tr key={group.sku + group.month + group.year} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{group.month}/{group.year}</td>
                      <td className="px-4 py-2 text-center">
                        {(() => {
                           const imageUrl = (group.sku && String(group.sku).trim()) ? `https://img.kalunga.com.br/FotosdeProdutos/${String(group.sku).trim().padStart(6, '0')}.jpg` : null;
                           return imageUrl ? (
                             <img 
                               src={imageUrl} 
                               alt={group.description} 
                               className="w-10 h-10 object-cover rounded border border-slate-200 mx-auto" 
                               referrerPolicy="no-referrer" 
                               onError={(e) => { 
                                 e.currentTarget.src = 'https://placehold.co/100x100?text=Sem+Imagem';
                                 e.currentTarget.onerror = null; 
                               }} 
                             />
                           ) : (
                             <div className="w-10 h-10 mx-auto bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-[9px] text-slate-400">N/A</div>
                           );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{group.sku}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate" title={group.description}>{group.description}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{group.quantity.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{group.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: activeTab === 'sales_fob' && currencyView === 'usd' ? 'USD' : 'BRL' })}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{group.totalTaxes.toLocaleString('pt-BR', { style: 'currency', currency: activeTab === 'sales_fob' && currencyView === 'usd' ? 'USD' : 'BRL' })}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right font-medium">{group.netValue.toLocaleString('pt-BR', { style: 'currency', currency: activeTab === 'sales_fob' && currencyView === 'usd' ? 'USD' : 'BRL' })}</td>
                      <td className="px-4 py-3 text-slate-400 text-[11px] text-center">{group.count} lin.</td>
                    </tr>
                  ))
                ) : (
                  filteredSales.slice(0, pageSize).map((sale, index) => {
                    const isFob = activeTab === 'sales_fob';
                    const suffix = isFob ? (currencyView === 'usd' ? '_usd' : '_brl') : '';
                    
                    let unitPriceValue = 0;
                    let totalValueValue = 0;
                    let totalImpostos = 0;
                    let totalLiquido = 0;

                    if (isFob) {
                      unitPriceValue = Number(sale[`valor_unitario${suffix}`]) || 0;
                      totalValueValue = Number(sale[`valor_total${suffix}`]) || 0;
                      totalImpostos = (Number(sale[`icms${suffix}`]) || 0) + (Number(sale[`pis${suffix}`]) || 0) + (Number(sale[`cofins${suffix}`]) || 0) + (Number(sale[`ipi${suffix}`]) || 0);
                      totalLiquido = Number(sale[`valor_liquido${suffix}`]) || 0;
                    } else {
                      unitPriceValue = sale.unitPrice || 0;
                      totalValueValue = sale.totalValue || 0;
                      totalImpostos = (sale.icms || 0) + (sale.pis || 0) + (sale.cofins || 0) + (sale.ipi || 0);
                      totalLiquido = sale.netValue !== undefined ? sale.netValue : (sale.totalValue - totalImpostos);
                    }
                    
                    return (
                    <tr key={`${sale.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2">
                        <input 
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedSales.includes(sale.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSales([...selectedSales, sale.id]);
                            else setSelectedSales(selectedSales.filter(id => id !== sale.id));
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDateBR(sale.date)}</td>
                      <td className="px-4 py-2 text-center">
                        {(() => {
                           const imageUrl = (sale.sku && String(sale.sku).trim()) ? `https://img.kalunga.com.br/FotosdeProdutos/${String(sale.sku).trim().padStart(6, '0')}.jpg` : null;
                           return imageUrl ? (
                             <img 
                               src={imageUrl} 
                               alt={sale.description} 
                               className="w-10 h-10 object-cover rounded border border-slate-200 mx-auto" 
                               referrerPolicy="no-referrer" 
                               onError={(e) => { 
                                 e.currentTarget.src = 'https://placehold.co/100x100?text=Sem+Imagem';
                                 e.currentTarget.onerror = null; 
                               }} 
                             />
                           ) : (
                             <div className="w-10 h-10 mx-auto bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-[9px] text-slate-400">N/A</div>
                           );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{sale.sku}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate" title={sale.description}>{sale.description}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{sale.quantity.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">
                        {unitPriceValue.toLocaleString('pt-BR', { style: 'currency', currency: activeTab === 'sales_fob' && currencyView === 'usd' ? 'USD' : 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">
                        {totalValueValue.toLocaleString('pt-BR', { style: 'currency', currency: activeTab === 'sales_fob' && currencyView === 'usd' ? 'USD' : 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">
                        {totalImpostos.toLocaleString('pt-BR', { style: 'currency', currency: activeTab === 'sales_fob' && currencyView === 'usd' ? 'USD' : 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right font-medium">
                        {totalLiquido.toLocaleString('pt-BR', { style: 'currency', currency: activeTab === 'sales_fob' && currencyView === 'usd' ? 'USD' : 'BRL' })}
                      </td>
                      {activeTab === 'sales_fob' && (
                        <>
                          <td className="px-4 py-3 text-sm text-slate-600">{sale.invoice || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{sale.fabricante || '-'}</td>
                        </>
                      )}
                    </tr>
                  )})
                )}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={viewMode === 'grouped' ? 10 : 8} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <PackageSearch size={32} strokeWidth={1.5} />
                        <p>Nenhuma venda encontrada para os filtros selecionados.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredSales.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-right text-slate-500 uppercase tracking-wider text-[11px]">Totais</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{filteredSales.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0).toLocaleString('pt-BR')}</td>
                    {viewMode === 'individual' && <td className="px-4 py-4 text-right"></td>}
                    <td className="px-4 py-4 text-sm text-slate-600 text-right">
                      {filteredSales.reduce((acc, s) => acc + (Number(s.totalValue) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600 text-right">
                      {filteredSales.reduce((acc, s) => acc + ((Number(s.icms) || 0) + (Number(s.pis) || 0) + (Number(s.cofins) || 0) + (Number(s.ipi) || 0)), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-900 text-right font-bold">
                      {filteredSales.reduce((acc, s) => acc + (Number(s.netValue) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    {viewMode === 'grouped' && <td className="px-4 py-4"></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
      
      {isAdmin && sales.length === 0 && (
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            className="gap-2 border-dashed border-2"
            onClick={async () => {
              // Seed dummy sales data for demonstration
              const dummySales = [
                {
                  sku: 'AG-2026-STITCH',
                  description: 'Agenda Diária Stitch 2026',
                  quantity: 150,
                  unitPrice: 45.90,
                  totalValue: 6885.00,
                  date: new Date().toISOString(),
                  licenseId: licenses[0]?.id || '1',
                  lineId: lines[0]?.id || '1',
                  categoryId: categories[0]?.id || '1',
                  launchYear: 2026
                },
                {
                  sku: 'AG-2026-MICKEY',
                  description: 'Agenda Diária Mickey 2026',
                  quantity: 200,
                  unitPrice: 42.90,
                  totalValue: 8580.00,
                  date: new Date().toISOString(),
                  licenseId: licenses[0]?.id || '1',
                  lineId: lines[0]?.id || '1',
                  categoryId: categories[0]?.id || '1',
                  launchYear: 2026
                }
              ];
              
              const promises = dummySales.map(s => addDoc(collection(db, 'sales'), s));
              await Promise.all(promises);
              toast.success("Dados de vendas carregados com sucesso (Simulação)");
            }}
          >
            <Database size={16} /> Carregar Dados de Exemplo (Integração)
          </Button>
        </div>
      )}
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
  const [selectedLicenseId, setSelectedLicenseId] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [selectedLaunchYears, setSelectedLaunchYears] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCalculationTypes, setSelectedCalculationTypes] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(50);

  // Summary Table States
  const [summaryLicenseIds, setSummaryLicenseIds] = useState<string[]>([]);
  const [summaryLineIds, setSummaryLineIds] = useState<string[]>([]);
  const [summaryContractIds, setSummaryContractIds] = useState<string[]>([]);
  const [summaryCurrencies, setSummaryCurrencies] = useState<string[]>([]);
  const [summaryCalculationTypes, setSummaryCalculationTypes] = useState<string[]>([]);
  const [summaryValueType, setSummaryValueType] = useState<string>('royaltyValue');
  const [summaryViewMode, setSummaryViewMode] = useState<string>('monthly');
  const [expandedYears, setExpandedYears] = useState<number[]>([]);
  const [expandedSalesYears, setExpandedSalesYears] = useState<number[]>([]);

  const { availableLaunchYears, availableYears, availableMonths, availableContracts, availableLines, allCurrencies, availableCalculationTypes } = React.useMemo(() => {
    const yearsSet = new Set<number>();
    const monthsSet = new Set<number>();
    const launchYearsSet = new Set<number>();
    const currenciesSet = new Set<string>();
    const calcTypesSet = new Set<string>();

    reports.forEach(r => {
      const contract = contracts.find(c => c.id === r.contractId);
      if (contract?.currency) currenciesSet.add(contract.currency);
      if (r.calculationType) calcTypesSet.add(r.calculationType);

      if (selectedLicenseId && r.licenseId !== selectedLicenseId) return;
      if (selectedLineIds.length > 0 && (!r.lineId || !selectedLineIds.includes(r.lineId))) return;

      yearsSet.add(r.year);
      monthsSet.add(r.month);
      
      const p = products.find(prod => prod.id === r.productId);
      if (p?.launchYear) {
        launchYearsSet.add(p.launchYear);
      }
    });

    return {
      availableYears: Array.from(yearsSet).sort((a,b)=>b-a),
      availableMonths: Array.from(monthsSet).sort((a,b)=>a-b),
      availableLaunchYears: Array.from(launchYearsSet).sort((a,b)=>b-a),
      availableContracts: contracts.filter(c => c.licenseId === selectedLicenseId),
      availableLines: lines.filter(l => l.licenseId === selectedLicenseId),
      allCurrencies: Array.from(currenciesSet).sort(),
      availableCalculationTypes: Array.from(calcTypesSet).sort()
    };
  }, [reports, products, selectedLicenseId, selectedLineIds, contracts, lines]);

  const summaryData = React.useMemo(() => {
    const filtered = reports.filter(r => {
      if (summaryLicenseIds.length > 0 && !summaryLicenseIds.includes(r.licenseId || '')) return false;
      if (summaryLineIds.length > 0 && !summaryLineIds.includes(r.lineId)) return false;
      if (summaryContractIds.length > 0 && !summaryContractIds.includes(r.contractId)) return false;
      
      if (summaryCurrencies.length > 0) {
        const contract = contracts.find(c => c.id === r.contractId);
        if (!contract || !summaryCurrencies.includes(contract.currency || '')) return false;
      }
      
      if (summaryCalculationTypes.length > 0 && !summaryCalculationTypes.includes(r.calculationType || '')) return false;

      return true;
    });

    const years = Array.from(new Set(filtered.map(r => r.year))).sort((a, b) => a - b);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    const grid: Record<number, Record<number, number>> = {};
    years.forEach(y => {
      grid[y] = {};
      months.forEach(m => grid[y][m] = 0);
    });

    filtered.forEach(r => {
      const value = summaryValueType === 'quantity' ? r.quantity :
                    summaryValueType === 'netValue' ? r.netValue :
                    r.royaltyValue;
      grid[r.year][r.month] += value;
    });

    return { years, months, grid };
  }, [reports, summaryLicenseIds, summaryLineIds, summaryContractIds, summaryCurrencies, summaryCalculationTypes, summaryValueType, summaryViewMode, contracts]);

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => {
      if (selectedLicenseId && r.licenseId !== selectedLicenseId) return false;
      if (selectedContractId && r.contractId !== selectedContractId) return false;
      if (selectedLineIds.length > 0 && !selectedLineIds.includes(r.lineId)) return false;
      if (selectedYears.length > 0 && !selectedYears.includes(String(r.year))) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(String(r.month))) return false;
      if (selectedCalculationTypes.length > 0 && !selectedCalculationTypes.includes(r.calculationType || '')) return false;

      if (selectedLaunchYears.length > 0) {
        const p = products.find(prod => prod.id === r.productId);
        if (!p || !p.launchYear || !selectedLaunchYears.includes(String(p.launchYear))) return false;
      }

      return true;
    });
  }, [reports, products, selectedLicenseId, selectedContractId, selectedLineIds, selectedYears, selectedMonths, selectedLaunchYears, selectedCalculationTypes]);

  const tableData = React.useMemo(() => {
    const groups = new Map<string, any>();

    filteredReports.forEach(r => {
      const key = `${r.year}-${r.month}-${r.licenseId}-${r.lineId}-${r.contractId}-${r.royaltyRate || 0}-${r.calculationType || ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          reportIds: [r.id],
          year: r.year,
          month: r.month,
          licenseId: r.licenseId,
          contractId: r.contractId,
          lineId: r.lineId,
          calculationType: r.calculationType || '',
          royaltyRate: r.royaltyRate || 0,
          quantity: 0,
          totalValue: 0,
          icms: 0,
          pis: 0,
          cofins: 0,
          ipi: 0,
          netValue: 0,
          royaltyValue: 0
        });
      } else {
        groups.get(key).reportIds.push(r.id);
      }

      const g = groups.get(key);
      g.quantity += r.quantity || 0;
      g.totalValue += r.totalValue || 0;
      g.icms += r.icms || 0;
      g.pis += r.pis || 0;
      g.cofins += r.cofins || 0;
      g.ipi += r.ipi || 0;
      g.netValue += r.netValue || 0;
      g.royaltyValue += r.royaltyValue || 0;
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [filteredReports]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(tableData.map((r: any) => r.id));
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
      const idsToDelete = tableData
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
    <div className="space-y-4">
      {/* Resumo de Apuração Section */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-600" />
              <h2 className="text-base font-semibold text-slate-800">Resumo de Apuração</h2>
            </div>
            
            {/* Summary Filters */}
            <div className="flex flex-wrap items-end gap-3 w-full">
              <div className="min-w-[180px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Licenciadores</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs"
                  options={licenses.map(l => ({ label: l.nomelicenciador, value: l.id }))}
                  selectedValues={summaryLicenseIds}
                  onChange={setSummaryLicenseIds}
                  placeholder="Todos"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Linhas</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs"
                  options={lines.filter(l => summaryLicenseIds.length === 0 || summaryLicenseIds.includes(l.licenseId)).map(l => ({ label: l.nomelinha, value: l.id }))}
                  selectedValues={summaryLineIds}
                  onChange={setSummaryLineIds}
                  placeholder="Todas"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Contratos</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs"
                  options={contracts.filter(c => summaryLicenseIds.length === 0 || summaryLicenseIds.includes(c.licenseId)).map(c => ({ label: c.contractNumber || `ID: ${c.id.slice(0,5)}`, value: c.id }))}
                  selectedValues={summaryContractIds}
                  onChange={setSummaryContractIds}
                  placeholder="Todos"
                />
              </div>

              <div className="min-w-[100px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Moeda</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs"
                  options={allCurrencies.map(c => ({ label: c, value: c }))}
                  selectedValues={summaryCurrencies}
                  onChange={setSummaryCurrencies}
                  placeholder="Todas"
                />
              </div>

              <div className="min-w-[130px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Tipo de Cálculo</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs"
                  options={[
                    { label: 'Vendas', value: 'Vendas' },
                    { label: 'Compras', value: 'Compras' },
                    { label: 'FOB', value: 'FOB' }
                  ]}
                  selectedValues={summaryCalculationTypes}
                  onChange={setSummaryCalculationTypes}
                  placeholder="Todos"
                />
              </div>

              <div className="min-w-[140px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Valores</Label>
                <Select value={summaryValueType} onValueChange={setSummaryValueType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue>
                      {summaryValueType === 'quantity' ? 'Quantidades' : 
                       summaryValueType === 'netValue' ? 'Valores Líquidos' : 
                       summaryValueType === 'royaltyValue' ? 'Valor de Royalties' : ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantity">Quantidades</SelectItem>
                    <SelectItem value="netValue">Valores Líquidos</SelectItem>
                    <SelectItem value="royaltyValue">Valor de Royalties</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[130px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Visão</Label>
                <Select value={summaryViewMode} onValueChange={setSummaryViewMode}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue>
                      {summaryViewMode === 'monthly' ? 'Mensal' : 
                       summaryViewMode === 'quarterly' ? 'Trimestral' : ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse table-fixed min-w-[1000px]">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 border-r border-slate-200 w-24 text-center">Ano</th>
                    {summaryViewMode === 'monthly' ? (
                      ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].map(m => (
                        <th key={m} className="px-1 py-2 text-center border-r border-slate-200 w-[calc((100%-208px)/12)]">{m}</th>
                      ))
                    ) : (
                      ['T1', 'T2', 'T3', 'T4'].map(t => (
                        <th key={t} className="px-1 py-2 text-center border-r border-slate-200 w-[calc((100%-208px)/4)]">{t}</th>
                      ))
                    )}
                    <th className="px-3 py-2 text-center w-28">Total</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryData.years.map(year => {
                  const isExpanded = expandedYears.includes(year);
                  const toggleYear = () => {
                    setExpandedYears(prev => 
                      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
                    );
                  };

                  let yearTotal = 0;
                  const rowValues = summaryViewMode === 'monthly' ? (
                    summaryData.months.map(m => {
                      const val = summaryData.grid[year][m] || 0;
                      yearTotal += val;
                      return val;
                    })
                  ) : (
                    [1, 2, 3, 4].map(q => {
                      const qMonths = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];
                      const val = qMonths.reduce((acc, m) => acc + (summaryData.grid[year][m] || 0), 0);
                      yearTotal += val;
                      return val;
                    })
                  );

                  return (
                    <React.Fragment key={year}>
                      <tr className="hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={toggleYear}>
                        <td className="px-3 py-2 font-medium bg-slate-50/30 border-r border-slate-200 flex items-center justify-center gap-2">
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </span>
                          {year}
                        </td>
                        {rowValues.map((v, i) => (
                          <td key={i} className="px-3 py-2 text-right border-r border-slate-200 text-slate-600">
                            {summaryValueType === 'quantity' ? v.toLocaleString('pt-BR') : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-bold bg-blue-50/30 text-blue-700">
                          {summaryValueType === 'quantity' ? yearTotal.toLocaleString('pt-BR') : yearTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80 animate-in fade-in slide-in-from-top-1 border-b border-slate-100">
                          <td className="px-3 py-1.5 text-[10px] italic text-slate-500 border-r border-slate-200 bg-slate-100/30 text-center">
                            % Cresc./Decr.
                          </td>
                          {rowValues.map((v, i) => {
                            // Adjust for quarterly if needed
                            let comparisonVal = 0;
                            const prevYear = year - 1;
                            
                            if (summaryViewMode === 'monthly') {
                              comparisonVal = summaryData.grid[prevYear]?.[i + 1] || 0;
                            } else {
                              const q = i + 1;
                              const qMonths = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];
                              comparisonVal = qMonths.reduce((acc, m) => acc + (summaryData.grid[prevYear]?.[m] || 0), 0);
                            }

                            const variance = comparisonVal > 0 ? ((v - comparisonVal) / comparisonVal) * 100 : 0;
                            const isPositive = variance > 0;
                            const isZero = variance === 0 && v === comparisonVal;

                            if (comparisonVal === 0) return (
                              <td key={i} className="px-1 py-1.5 text-center border-r border-slate-200 text-slate-400 text-[10px]">-</td>
                            );

                            return (
                              <td key={i} className={`px-1 py-1.5 text-center border-r border-slate-200 text-[10px] font-medium ${isPositive ? 'text-emerald-600' : isZero ? 'text-slate-400' : 'text-rose-600'}`}>
                                {isPositive ? '+' : ''}{variance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5 text-right bg-blue-50/50 text-[10px] font-bold text-slate-600">
                            {(() => {
                              let prevYearTotal = 0;
                              summaryData.months.forEach(m => {
                                prevYearTotal += summaryData.grid[year - 1]?.[m] || 0;
                              });
                              if (prevYearTotal === 0) return '-';
                              const totalVar = ((yearTotal - prevYearTotal) / prevYearTotal) * 100;
                              return `${totalVar > 0 ? '+' : ''}${totalVar.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
                            })()}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                <tr>
                  <td className="px-3 py-2 border-r border-slate-200 text-center">Totais</td>
                  {(summaryViewMode === 'monthly' ? Array.from({length: 12}, (_, i) => i + 1) : [1, 2, 3, 4]).map((idx, i) => {
                    let colTotal = 0;
                    summaryData.years.forEach(y => {
                      if (summaryViewMode === 'monthly') {
                        colTotal += summaryData.grid[y][idx] || 0;
                      } else {
                        const qMonths = idx === 1 ? [1, 2, 3] : idx === 2 ? [4, 5, 6] : idx === 3 ? [7, 8, 9] : [10, 11, 12];
                        colTotal += qMonths.reduce((acc, m) => acc + (summaryData.grid[y][m] || 0), 0);
                      }
                    });
                    return (
                      <td key={i} className="px-3 py-2 text-right border-r border-slate-200">
                        {summaryValueType === 'quantity' ? colTotal.toLocaleString('pt-BR') : colTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right bg-blue-100/50 text-blue-800">
                    {(() => {
                      let grandTotal = 0;
                      summaryData.years.forEach(y => {
                        summaryData.months.forEach(m => {
                          grandTotal += summaryData.grid[y][m] || 0;
                        });
                      });
                      return summaryValueType === 'quantity' ? grandTotal.toLocaleString('pt-BR') : grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
          <div className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <List size={16} className="text-slate-500" />
              <CardTitle className="text-sm font-semibold text-slate-800">Detalhamento de Apuração</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                  <span className="text-xs font-medium text-slate-500">{selectedIds.length} grupos selecionados</span>
                  <Dialog>
                    <DialogTrigger nativeButton={true} render={
                      <button className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "gap-2 h-8 px-3")}>
                        <Trash2 size={14} /> Excluir
                      </button>
                    } />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirmar Exclusão em Massa</DialogTitle>
                        <DialogDescription>
                          Tem certeza que deseja excluir os registros selecionados do banco de dados?
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
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 mt-4">
            <div className="space-y-1 min-w-[180px] flex-1">
              <Label className="text-xs">Licenciador</Label>
              <SearchableSelect
                className="h-8 text-xs"
                options={[
                  { label: "Todos os Licenciadores", value: "ALL" },
                  ...[...licenses].sort((a,b)=>a.nomelicenciador.localeCompare(b.nomelicenciador)).map(l => ({ label: l.nomelicenciador, value: l.id }))
                ]}
                value={selectedLicenseId || "ALL"}
                onValueChange={(v) => { 
                  setSelectedLicenseId(v==="ALL" ? "" : v); 
                  setSelectedLineIds([]); 
                  setSelectedContractId(''); 
                }}
                placeholder="Todos os Licenciadores"
              />
            </div>

            <div className="space-y-1 min-w-[150px] flex-1">
              <Label className="text-xs">Contrato</Label>
              <SearchableSelect
                disabled={!selectedLicenseId}
                className="h-8 text-xs"
                options={[
                  { label: "Todos os Contratos", value: "ALL" },
                  ...availableContracts.map(c => ({ label: c.contractNumber || `ID: ${c.id.slice(0,5)}`, value: c.id }))
                ]}
                value={selectedContractId || "ALL"}
                onValueChange={(v) => { setSelectedContractId(v==="ALL" ? "" : v); }}
                placeholder="Selecione um contrato"
              />
            </div>

            <div className="space-y-1 min-w-[140px] flex-1">
              <Label className="text-xs">Linha(s)</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableLines.map(l => ({ label: l.nomelinha, value: l.id }))}
                selectedValues={selectedLineIds}
                onChange={setSelectedLineIds}
                placeholder="Todas as Linhas"
              />
            </div>

            <div className="space-y-1 min-w-[120px] max-w-[150px]">
              <Label className="text-xs">Lançamento</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableLaunchYears.map(y => ({ label: String(y), value: String(y) }))}
                selectedValues={selectedLaunchYears}
                onChange={setSelectedLaunchYears}
                placeholder="Todos os Anos"
              />
            </div>

            <div className="space-y-1 min-w-[140px] flex-1">
              <Label className="text-xs">Tipo de Cálculo</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableCalculationTypes.map(t => ({ label: t, value: t }))}
                selectedValues={selectedCalculationTypes}
                onChange={setSelectedCalculationTypes}
                placeholder="Todos os Tipos"
              />
            </div>

            <div className="space-y-1 min-w-[100px] max-w-[130px]">
              <Label className="text-xs">Ano (Venda)</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableYears.map(y => ({ label: String(y), value: String(y) }))}
                selectedValues={selectedYears}
                onChange={setSelectedYears}
                placeholder="Todos os Anos"
              />
            </div>

            <div className="space-y-1 min-w-[100px] max-w-[130px]">
              <Label className="text-xs">Mês (Venda)</Label>
              <MultiSelectDropdown
                className="h-8 text-xs"
                options={availableMonths.map(m => ({ label: String(m).padStart(2, '0'), value: String(m) }))}
                selectedValues={selectedMonths}
                onChange={setSelectedMonths}
                placeholder="Todos Meses"
              />
            </div>
            
            <div className="space-y-1 min-w-[100px]">
              <Label className="text-xs">Visualização</Label>
              <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="10">10 itens</SelectItem>
                  <SelectItem value="50">50 itens</SelectItem>
                  <SelectItem value="100">100 itens</SelectItem>
                  <SelectItem value="500">500 itens</SelectItem>
                  <SelectItem value="1000">1000 itens</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-t border-slate-200 min-w-max">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedIds.length === tableData.length && tableData.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">Ano</th>
                  <th className="px-4 py-3 whitespace-nowrap">Mês</th>
                  <th className="px-4 py-3 whitespace-nowrap">Licenciador</th>
                  <th className="px-4 py-3 whitespace-nowrap">Linha</th>
                  <th className="px-4 py-3 whitespace-nowrap">Contrato</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Quantidade</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Valor Total</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">ICMS</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">PIS</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">COFINS</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">IPI</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Valor Líquido</th>
                  <th className="px-1 py-3 text-right whitespace-normal leading-tight w-[60px]">Taxa Royalties</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Valor Royalties</th>
                  <th className="px-4 py-3 whitespace-nowrap">Tipo</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tableData.slice(0, pageSize).map((row, i) => {
                  const l = licenses.find(x => x.id === row.licenseId);
                  const ln = lines.find(x => x.id === row.lineId);
                  const contract = contracts.find(c => c.id === row.contractId);

                  const downloadCSV = () => {
                    const groupReports = reports.filter(r => row.reportIds.includes(r.id));
                    const headers = ["Ano", "Mês", "Licenciador", "Linha", "SKU", "Produto", "Qtd", "Valor Total", "ICMS", "PIS", "COFINS", "IPI", "Valor Líquido", "Taxa", "Valor Royalties", "Cálculo"];
                    const csvRows = groupReports.map(r => {
                      const prod = products.find(p => p.id === r.productId);
                      return [
                        r.year, r.month, l?.nomelicenciador || '', ln?.nomelinha || '', prod?.sku || '', prod?.name || r.productId || '',
                        r.quantity, r.totalValue, r.icms, r.pis, r.cofins, r.ipi, r.netValue, r.royaltyRate, r.royaltyValue, r.calculationType || ''
                      ].map(v => String(v).replace('.', ',')).join(';');
                    });
                    const csvString = [headers.join(';'), ...csvRows].join('\n');
                    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `relatorio_${row.year}_${row.month}_${l?.nomelicenciador}.csv`;
                    link.click();
                  };

                  return (
                    <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${selectedIds.includes(row.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => handleSelectRow(row.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.year}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{String(row.month).padStart(2, '0')}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-medium">{l?.nomelicenciador || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{ln?.nomelinha || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{contract?.contractNumber || '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{row.quantity.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{row.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{row.icms.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{row.pis.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{row.cofins.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{row.ipi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap font-medium">{row.netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-1 py-3 text-right text-slate-600 whitespace-nowrap">{row.royaltyRate > 0 ? `${(row.royaltyRate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                        {row.royaltyValue > 0 ? row.royaltyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-medium uppercase italic bg-slate-50/30">{row.calculationType || '-'}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button onClick={downloadCSV} className="text-blue-600 hover:text-blue-800">
                          <FileDown size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {tableData.length === 0 && (
                  <tr>
                    <td colSpan={17} className="px-4 py-12 text-center text-slate-400">Nenhum relatório encontrado no banco de dados com os filtros atuais.</td>
                  </tr>
                )}
              </tbody>
              {tableData.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-right whitespace-nowrap text-sm">TOTAL</td>
                    <td className="px-4 py-4 text-right whitespace-nowrap text-sm">{tableData.reduce((acc, r)=>acc+r.quantity, 0).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-4 text-right whitespace-nowrap text-sm">{tableData.reduce((acc, r)=>acc+r.totalValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right whitespace-nowrap text-sm text-slate-600">{tableData.reduce((acc, r)=>acc+r.icms, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right whitespace-nowrap text-sm text-slate-600">{tableData.reduce((acc, r)=>acc+r.pis, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right whitespace-nowrap text-sm text-slate-600">{tableData.reduce((acc, r)=>acc+r.cofins, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right whitespace-nowrap text-sm text-slate-600">{tableData.reduce((acc, r)=>acc+r.ipi, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right whitespace-nowrap text-sm text-slate-600">{tableData.reduce((acc, r)=>acc+r.netValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-1 py-4 text-right whitespace-nowrap text-sm">-</td>
                    <td className="px-4 py-4 text-right whitespace-nowrap text-sm text-slate-600">
                      {tableData.reduce((acc, r)=>acc+r.royaltyValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState(payment.documentUrl || '');
  const [documentName, setDocumentName] = useState(payment.documentName || '');

  const filteredContracts = contracts.filter(c => !licenseId || c.licenseId === licenseId);
  const selectedContract = contracts.find(c => c.id === contractId);

  const availableYears = React.useMemo(() => {
    if (!selectedContract) return [];
    const yearsSet = new Set<string>();
    
    if (type === 'mg' && selectedContract.mgInstallments) {
      selectedContract.mgInstallments.forEach(i => i.year && yearsSet.add(String(i.year)));
    } else if (type === 'marketing' && selectedContract.marketingFundInstallments) {
      selectedContract.marketingFundInstallments.forEach(i => i.year && yearsSet.add(String(i.year)));
    } else if (selectedContract.isDividedIntoYears && selectedContract.years) {
      selectedContract.years.forEach(y => yearsSet.add(String(y.yearNumber)));
    }
    
    return Array.from(yearsSet).sort();
  }, [selectedContract, type]);

  const availableInstallments = React.useMemo(() => {
    if (!selectedContract) return [];
    const instSet = new Set<string>();

    if (type === 'mg' && selectedContract.mgInstallments) {
      selectedContract.mgInstallments.forEach(i => {
        if (!year || String(i.year) === year) instSet.add(String(i.installmentNumber));
      });
    } else if (type === 'marketing' && selectedContract.marketingFundInstallments) {
      selectedContract.marketingFundInstallments.forEach(i => {
        if (!year || String(i.year) === year) instSet.add(String(i.installmentNumber));
      });
    }
    
    return Array.from(instSet).sort();
  }, [selectedContract, type, year]);

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
    setUploading(true);
    try {
      let finalDocumentUrl = documentUrl;
      let finalDocumentName = documentName;

      if (file) {
        finalDocumentUrl = await uploadFile(file, `payments/${Date.now()}_${file.name}`);
        finalDocumentName = file.name;
      }

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
        documentUrl: finalDocumentUrl,
        documentName: finalDocumentName,
        updatedAt: serverTimestamp()
      });
      toast.success('Pagamento atualizado!');
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao atualizar pagamento.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-slate-400 hover:text-blue-600 h-8 w-8")}>
            <Pencil size={16} />
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
                  <SelectItem value="marketing">Fundo de Marketing (CMF)</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Licenciador</Label>
              <Select onValueChange={(v) => { setLicenseId(v); setContractId(''); }} value={licenseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o licenciador">
                    {licenses.find(l => l.id === licenseId)?.nomelicenciador}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[...licenses].sort((a, b) => (a.nomelicenciador || a.id).localeCompare(b.nomelicenciador || b.id)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nomelicenciador || `ID: ${l.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select onValueChange={setContractId} value={contractId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato">
                    {(() => {
                      const c = contracts.find(c => c.id === contractId);
                      if (!c) return null;
                      return c.contractNumber || `ID: ${c.id.slice(0,5)}`;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[...filteredContracts].sort((a, b) => (a.contractNumber || a.id).localeCompare(b.contractNumber || b.id)).map(c => {
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contractNumber || `ID: ${c.id.slice(0,5)}`}
                      </SelectItem>
                    );
                  })}
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
              {availableYears.length > 0 ? (
                <Select onValueChange={setYear} value={year}>
                  <SelectTrigger><SelectValue placeholder="Selecione o ano" /></SelectTrigger>
                  <SelectContent>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Ex: 2025" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Parcela</Label>
              {type !== 'excess' && availableInstallments.length > 0 ? (
                <Select onValueChange={setInstallmentNumber} value={String(installmentNumber)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a parcela" /></SelectTrigger>
                  <SelectContent>
                    {availableInstallments.map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={installmentNumber} onChange={(e) => setInstallmentNumber(e.target.value)} placeholder="Ex: 1" disabled={type === 'excess'} />
              )}
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
            <Label>Comprovante / Documento (Invoice, Recibo, Boleto)</Label>
            <div className="flex flex-col gap-2">
              {documentUrl && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-md">
                  <FileText size={16} className="text-blue-500" />
                  <span className="text-xs text-blue-700 flex-1 truncate">{documentName}</span>
                  <a 
                    href={documentUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    VISUALIZAR
                  </a>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-red-500 hover:text-red-700"
                    onClick={() => {
                      setDocumentUrl('');
                      setDocumentName('');
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Input 
                  type="file" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                  className="cursor-pointer h-9 text-xs"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                {file && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setFile(null)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
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
            <Button 
              type="submit" 
              className="flex-[2] bg-blue-600 hover:bg-blue-700"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Atualizar Pagamento'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsView({ payments, contracts, licenses, lines, reports, isAdmin }: {
  payments: Payment[],
  contracts: Contract[],
  licenses: License[],
  lines: Line[],
  reports: RoyaltyReport[],
  isAdmin: boolean
}) {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
  // Summary Table States
  const [summaryLicenseIds, setSummaryLicenseIds] = useState<string[]>([]);
  const [summaryLineIds, setSummaryLineIds] = useState<string[]>([]);
  const [summaryContractIds, setSummaryContractIds] = useState<string[]>([]);
  const [summaryTypes, setSummaryTypes] = useState<string[]>([]);
  const [summaryStatuses, setSummaryStatuses] = useState<string[]>([]);
  const [expandedSummaryYears, setExpandedSummaryYears] = useState<number[]>([]);

  // Filter States
  const [obsLicenseIds, setObsLicenseIds] = useState<string[]>([]);
  const [obsContractIds, setObsContractIds] = useState<string[]>([]);
  const [obsYears, setObsYears] = useState<string[]>([]);
  const [obsTypes, setObsTypes] = useState<string[]>([]);
  const [obsInvoices, setObsInvoices] = useState<string[]>([]);
  const [obsStatuses, setObsStatuses] = useState<string[]>([]);
  const [obsPaymentDate, setObsPaymentDate] = useState('');

  // Calculate Obligations
  const obligations = React.useMemo(() => {
    const list: any[] = [];
    
    contracts.forEach(contract => {
      const license = licenses.find(l => l.id === contract.licenseId);
      
      // 1. MG Installments
      if (contract.mgInstallments && contract.mgInstallments.length > 0) {
        contract.mgInstallments.forEach((inst, idx) => {
          const matchingPayment = payments.find(p => 
            p.contractId === contract.id && 
            p.type === 'mg' && 
            Number(p.installmentNumber) === Number(inst.installmentNumber) &&
            (inst.year ? String(p.year) === String(inst.year) : true)
          );
          
          list.push({
            id: `mg-${contract.id}-${inst.installmentNumber}-${inst.year || idx}`,
            licenseId: contract.licenseId,
            contractId: contract.id,
            type: 'Mínimo Garantido (MG)',
            license: license?.nomelicenciador || '-',
            contract: contract.contractNumber || contract.id,
            installmentNumber: inst.installmentNumber,
            year: inst.year || '-',
            amount: inst.amount,
            currency: contract.currency || 'BRL',
            invoice: matchingPayment?.invoice || '-',
            dueDate: inst.dueDate,
            status: matchingPayment?.status || 'pending',
            paymentDate: matchingPayment?.date || '-',
            documentUrl: matchingPayment?.documentUrl,
            documentName: matchingPayment?.documentName,
            rawDate: inst.dueDate
          });
        });
      }
      
      // 2. Marketing Fund Installments (CMF)
      if (contract.marketingFundInstallments && contract.marketingFundInstallments.length > 0) {
        contract.marketingFundInstallments.forEach((inst, idx) => {
          const matchingPayment = payments.find(p => 
            p.contractId === contract.id && 
            p.type === 'marketing' && 
            Number(p.installmentNumber) === Number(inst.installmentNumber) &&
            (inst.year ? String(p.year) === String(inst.year) : true)
          );
          
          list.push({
            id: `mkt-${contract.id}-${inst.installmentNumber}-${inst.year || idx}`,
            licenseId: contract.licenseId,
            contractId: contract.id,
            type: 'Fundo de Marketing (CMF)',
            license: license?.nomelicenciador || '-',
            contract: contract.contractNumber || contract.id,
            installmentNumber: inst.installmentNumber,
            year: inst.year || '-',
            amount: inst.amount,
            currency: contract.currency || 'BRL',
            invoice: matchingPayment?.invoice || '-',
            dueDate: inst.dueDate,
            status: matchingPayment?.status || 'pending',
            paymentDate: matchingPayment?.date || '-',
            documentUrl: matchingPayment?.documentUrl,
            documentName: matchingPayment?.documentName,
            rawDate: inst.dueDate
          });
        });
      }

      // 3. Excess Royalties (Calculated based on periods)
      if (contract.isDividedIntoYears && contract.years && contract.years.length > 0) {
        contract.years.forEach((cy) => {
          const startDt = new Date(cy.startDate + 'T00:00:00');
          const endDt = new Date(cy.endDate + 'T23:59:59');
          
          const contractReports = reports.filter(r => {
            if (r.contractId !== contract.id) return false;
            const reportDate = new Date(r.year, r.month - 1, 15); // middle of month
            return reportDate >= startDt && reportDate <= endDt;
          });
          
          const totalRoyalty = contractReports.reduce((sum, r) => sum + (r.royaltyValue || 0), 0);
          
          // Total MG for this year: sum of installments belonging to this year
          // We match by the 'year' field OR by the dueDate falling within the period
          const mgForYear = (contract.mgInstallments || [])
            .filter(inst => {
              // Priority 1: Direct match with yearNumber (e.g. "1" or "Ano 1")
              const instYearStr = String(inst.year || '').replace(/\D/g, ''); // Extract only digits
              if (instYearStr === String(cy.yearNumber)) return true;
              
              // Priority 2: Match by date range if year is not explicitly set or doesn't match numerically
              if (inst.dueDate) {
                const instDate = new Date(inst.dueDate + 'T12:00:00');
                return instDate >= startDt && instDate <= endDt;
              }
              return false;
            })
            .reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
          
          if (totalRoyalty > mgForYear + 0.01) { // Small epsilon to avoid float rounding issues
            const excess = totalRoyalty - mgForYear;
            const matchingPayment = payments.find(p => 
              p.contractId === contract.id && 
              p.type === 'excess' && 
              String(p.year) === String(cy.yearNumber)
            );

            list.push({
              id: `excess-${contract.id}-${cy.yearNumber}`,
              licenseId: contract.licenseId,
              contractId: contract.id,
              type: 'Royalties Excedentes',
              license: license?.nomelicenciador || '-',
              contract: contract.contractNumber || contract.id,
              installmentNumber: '-',
              year: cy.yearNumber,
              amount: excess,
              currency: contract.currency || 'BRL',
              invoice: matchingPayment?.invoice || '-',
              dueDate: cy.endDate, // Due date is typically after year ends
              status: matchingPayment?.status || 'pending',
              paymentDate: matchingPayment?.date || '-',
              documentUrl: matchingPayment?.documentUrl,
              documentName: matchingPayment?.documentName,
              rawDate: cy.endDate
            });
          }

          // Excess Marketing Fund if calculated via percentage
          if (contract.hasMarketingFund && contract.marketingFundRate && contract.marketingFundRate > 0) {
            const totalNetValue = contractReports.reduce((sum, r) => sum + (r.netValue || 0), 0);
            const calculatedMktFund = totalNetValue * (contract.marketingFundRate / 100);
            
            // Total of installments for this year - same improved matching logic
            const mktInstallmentsTotal = (contract.marketingFundInstallments || [])
              .filter(mi => {
                const instYearStr = String(mi.year || '').replace(/\D/g, '');
                if (instYearStr === String(cy.yearNumber)) return true;
                if (mi.dueDate) {
                  const instDate = new Date(mi.dueDate + 'T12:00:00');
                  return instDate >= startDt && instDate <= endDt;
                }
                return false;
              })
              .reduce((sum, mi) => sum + Number(mi.amount || 0), 0);

            if (calculatedMktFund > mktInstallmentsTotal + 0.01) {
              const excessMkt = calculatedMktFund - mktInstallmentsTotal;
              const matchingPayment = payments.find(p => 
                p.contractId === contract.id && 
                p.type === 'marketing' && 
                String(p.year) === String(cy.yearNumber) &&
                !p.installmentNumber // No installment number usually means it's the excess
              );

              list.push({
                id: `excess-mkt-${contract.id}-${cy.yearNumber}`,
                licenseId: contract.licenseId,
                contractId: contract.id,
                type: 'Fundo de Marketing (CMF) Excedente',
                license: license?.nomelicenciador || '-',
                contract: contract.contractNumber || contract.id,
                installmentNumber: '-',
                year: cy.yearNumber,
                amount: excessMkt,
                currency: contract.currency || 'BRL',
                invoice: matchingPayment?.invoice || '-',
                dueDate: cy.endDate,
                status: matchingPayment?.status || 'pending',
                paymentDate: matchingPayment?.date || '-',
                documentUrl: matchingPayment?.documentUrl,
                documentName: matchingPayment?.documentName,
                rawDate: cy.endDate
              });
            }
          }
        });
      } else {
        // Fallback for contracts not explicitly divided into years
        const startDt = new Date(contract.startDate + 'T00:00:00');
        const endDt = new Date(contract.endDate + 'T23:59:59');
        
        const contractReports = reports.filter(r => {
          if (r.contractId !== contract.id) return false;
          const reportDate = new Date(r.year, r.month - 1, 15);
          return reportDate >= startDt && reportDate <= endDt;
        });
        
        const totalRoyalty = contractReports.reduce((sum, r) => sum + (r.royaltyValue || 0), 0);
        const totalMG = (contract.mgInstallments || []).reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
        
        if (totalRoyalty > totalMG + 0.01) {
          const excess = totalRoyalty - totalMG;
          const matchingPayment = payments.find(p => 
            p.contractId === contract.id && 
            p.type === 'excess' && 
            !p.installmentNumber
          );

          list.push({
            id: `excess-${contract.id}-total`,
            licenseId: contract.licenseId,
            contractId: contract.id,
            type: 'Royalties Excedentes',
            license: license?.nomelicenciador || '-',
            contract: contract.contractNumber || contract.id,
            installmentNumber: '-',
            year: '-',
            amount: excess,
            currency: contract.currency || 'BRL',
            invoice: matchingPayment?.invoice || '-',
            dueDate: contract.endDate,
            status: matchingPayment?.status || 'pending',
            paymentDate: matchingPayment?.date || '-',
            documentUrl: matchingPayment?.documentUrl,
            documentName: matchingPayment?.documentName,
            rawDate: contract.endDate
          });
        }
      }
    });
    
    // Sort based on user request: Licenciador, Contrato, MG antes de Fundo de marketing, Ano e parcela
    return list.sort((a, b) => {
      // 1. Licenciador (A-Z)
      if (a.license !== b.license) return a.license.localeCompare(b.license);
      
      // 2. Contrato (A-Z)
      const contractA = String(a.contract);
      const contractB = String(b.contract);
      if (contractA !== contractB) return contractA.localeCompare(contractB);
      
      // 3. Tipo (MG -> Fundo Mkt -> Royalty Excess -> Mkt Excess)
      const typeOrder: Record<string, number> = {
        'Mínimo Garantido (MG)': 1,
        'Fundo de Marketing (CMF)': 2,
        'Royalties Excedentes': 3,
        'Fundo de Marketing (CMF) Excedente': 4
      };
      const orderA = typeOrder[a.type] || 99;
      const orderB = typeOrder[b.type] || 99;
      if (orderA !== orderB) return orderA - orderB;
      
      // 4. Ano (Ascending)
      const yearA = isNaN(Number(a.year)) ? 0 : Number(a.year);
      const yearB = isNaN(Number(b.year)) ? 0 : Number(b.year);
      if (yearA !== yearB) return yearA - yearB;
      
      // 5. Parcela (Ascending)
      const instA = isNaN(Number(a.installmentNumber)) ? 0 : Number(a.installmentNumber);
      const instB = isNaN(Number(b.installmentNumber)) ? 0 : Number(b.installmentNumber);
      return instA - instB;
    });
  }, [contracts, payments, reports, licenses]);

  const summaryData = React.useMemo(() => {
    const filtered = obligations.filter(ob => {
      if (summaryLicenseIds.length > 0 && !summaryLicenseIds.includes(ob.licenseId || '')) return false;
      if (summaryContractIds.length > 0 && !summaryContractIds.includes(ob.contractId || '')) return false;
      if (summaryTypes.length > 0 && !summaryTypes.includes(ob.type || '')) return false;
      if (summaryStatuses.length > 0 && !summaryStatuses.includes(ob.status || '')) return false;

      if (summaryLineIds.length > 0) {
        const contract = contracts.find(c => c.id === ob.contractId);
        if (!contract) return false;
        const hasMatchingLine = contract.lineIds?.some(lId => summaryLineIds.includes(lId));
        if (!hasMatchingLine) return false;
      }
      return true;
    });

    const extractDate = (dateStr: string) => {
      if (!dateStr || dateStr === '-') return { year: 0, month: 0 };
      
      // Handle DD/MM/YYYY formats
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          let y = parseInt(parts[2], 10);
          if (y < 100) y += 2000; // Normalizer 2-digit years to 4-digit
          return { year: y, month: parseInt(parts[1], 10) };
        }
      }

      // Handle YYYY-MM-DD formats
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length >= 3 && parts[0].length === 4) {
          return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
        }
      }

      // Fallback
      const dt = new Date(dateStr);
      if (!isNaN(dt.getTime())) {
        let y = dt.getFullYear();
        if (y < 100) y += 2000;
        return { year: y, month: dt.getMonth() + 1 };
      }

      return { year: 0, month: 0 };
    }

    const parsedData = filtered.map(ob => {
      const dt = extractDate(ob.dueDate || ob.rawDate || ob.paymentDate || '');
      return {
        ...ob,
        parsedYear: dt.year,
        parsedMonth: dt.month
      }
    }).filter(ob => ob.parsedYear > 0 && !isNaN(ob.parsedYear));

    const years = (Array.from(new Set(parsedData.map(ob => ob.parsedYear))) as number[]).sort((a, b) => a - b);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const grid: Record<number, Record<number, { total: number, items: any[] }>> = {};
    years.forEach((y: number) => {
      grid[y] = {};
      months.forEach((m: number) => grid[y][m] = { total: 0, items: [] });
    });

    parsedData.forEach(ob => {
      if (grid[ob.parsedYear] && grid[ob.parsedYear][ob.parsedMonth]) {
        grid[ob.parsedYear][ob.parsedMonth].total += Number(ob.amount) || 0;
        grid[ob.parsedYear][ob.parsedMonth].items.push(ob);
      }
    });

    return { years, months, grid };
  }, [obligations, summaryLicenseIds, summaryContractIds, summaryTypes, summaryStatuses, summaryLineIds, contracts]);

  // Unique years for filters
  const availableYears = React.useMemo(() => {
    const years = obligations.map(o => String(o.year)).filter(y => y && y !== '-');
    return Array.from(new Set(years)).sort();
  }, [obligations]);

  // Unique types for filters
  const availableTypes = React.useMemo(() => {
    const types = obligations.map(o => o.type);
    return Array.from(new Set(types)).sort();
  }, [obligations]);

  // Unique invoices for filters
  const availableInvoices = React.useMemo(() => {
    const invoices = obligations.map(o => String(o.invoice)).filter(i => i && i !== '-');
    return Array.from(new Set(invoices)).sort();
  }, [obligations]);

  // Filtered Obligations
  const filteredObligations = React.useMemo(() => {
    return obligations.filter(ob => {
      // License filter
      if (obsLicenseIds.length > 0 && !obsLicenseIds.includes(ob.licenseId)) return false;
      
      // Contract filter
      if (obsContractIds.length > 0 && !obsContractIds.includes(ob.contractId)) return false;

      // Year filter
      if (obsYears.length > 0 && !obsYears.includes(String(ob.year))) return false;

      // Type filter
      if (obsTypes.length > 0 && !obsTypes.includes(ob.type)) return false;

      // Invoice filter
      if (obsInvoices.length > 0 && !obsInvoices.includes(String(ob.invoice))) return false;

      // Status filter
      if (obsStatuses.length > 0 && !obsStatuses.includes(ob.status)) return false;

      // Payment Date filter
      if (obsPaymentDate && !formatDateBR(ob.paymentDate).includes(obsPaymentDate)) return false;

      return true;
    });
  }, [obligations, obsLicenseIds, obsContractIds, obsYears, obsTypes, obsInvoices, obsStatuses, obsPaymentDate]);

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

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro de pagamento?')) return;
    try {
      await deleteDoc(doc(db, 'payments', paymentId));
      toast.success('Pagamento excluído com sucesso!');
    } catch (err) {
      toast.error('Erro ao excluir pagamento.');
    }
  };

  const sortedPayments = React.useMemo(() => [...payments].sort((a: any, b: any) => {
    if (!sortConfig) {
      // Default sort: by date descending
      const dateA = a.date || (a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : 0);
      const dateB = b.date || (b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate() : 0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    }

    let aValue: any;
    let bValue: any;

    if (sortConfig.key === 'license') {
      const contractA = contracts.find((c: any) => c.id === a.contractId);
      const licenseA = licenses.find((l: any) => l.id === (a.licenseId || contractA?.licenseId));
      const contractB = contracts.find((c: any) => c.id === b.contractId);
      const licenseB = licenses.find((l: any) => l.id === (b.licenseId || contractB?.licenseId));
      aValue = licenseA?.nomelicenciador || (a.licenseId || contractA?.licenseId || '');
      bValue = licenseB?.nomelicenciador || (b.licenseId || contractB?.licenseId || '');
    } else if (sortConfig.key === 'contract') {
      const contractA = contracts.find((c: any) => c.id === a.contractId);
      const contractB = contracts.find((c: any) => c.id === b.contractId);
      aValue = contractA?.contractNumber || (a.contractId || '');
      bValue = contractB?.contractNumber || (b.contractId || '');
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
  }), [payments, sortConfig, contracts, licenses]);

  const SortableHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
    <th 
      className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group"
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
    <div className="space-y-6">
      {/* Resumo da Programação */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-blue-600" />
              <h2 className="text-base font-semibold text-slate-800">Resumo da Programação de Pagamentos</h2>
            </div>
            
            <div className="flex flex-wrap items-end gap-3 w-full">
              <div className="min-w-[180px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Licenciadores</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs bg-white border-slate-200"
                  options={licenses.map(l => ({ label: l.nomelicenciador, value: l.id }))}
                  selectedValues={summaryLicenseIds}
                  onChange={setSummaryLicenseIds}
                  placeholder="Todos"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Linhas</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs bg-white border-slate-200"
                  options={lines.filter(l => summaryLicenseIds.length === 0 || summaryLicenseIds.includes(l.licenseId)).map(l => ({ label: l.nomelinha, value: l.id }))}
                  selectedValues={summaryLineIds}
                  onChange={setSummaryLineIds}
                  placeholder="Todas"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Contratos</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs bg-white border-slate-200"
                  options={contracts.filter(c => summaryLicenseIds.length === 0 || summaryLicenseIds.includes(c.licenseId)).map(c => ({ label: c.contractNumber || `ID: ${c.id.slice(0,5)}`, value: c.id }))}
                  selectedValues={summaryContractIds}
                  onChange={setSummaryContractIds}
                  placeholder="Todos"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Tipo</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs bg-white border-slate-200"
                  options={availableTypes.map(t => ({ label: t, value: t }))}
                  selectedValues={summaryTypes}
                  onChange={setSummaryTypes}
                  placeholder="Todos"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[11px] text-slate-400">Status</Label>
                <MultiSelectDropdown
                  className="h-8 text-xs bg-white border-slate-200"
                  options={[
                    { label: 'Pago', value: 'paid' },
                    { label: 'Pendente', value: 'pending' }
                  ]}
                  selectedValues={summaryStatuses}
                  onChange={setSummaryStatuses}
                  placeholder="Todos"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse table-fixed min-w-[1000px]">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 border-r border-slate-200 w-24 text-center">Ano</th>
                  {['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].map(m => (
                    <th key={m} className="px-1 py-2 text-center border-r border-slate-200 w-[calc((100%-208px)/12)]">{m}</th>
                  ))}
                  <th className="px-3 py-2 text-center w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryData.years.map(year => {
                  let yearTotal = 0;
                  const rowValues = summaryData.months.map(m => {
                    const cellData = summaryData.grid[year][m];
                    const val = cellData?.total || 0;
                    yearTotal += val;
                    return (
                      <td key={m} className="px-1 py-2 text-right border-r border-slate-100 text-slate-600">
                        {val > 0 ? (
                          <PortalTooltip 
                            content={
                              <>
                                <div className="bg-slate-900 text-white p-2 text-xs font-semibold text-center">
                                  Composição ({m < 10 ? `0${m}` : m}/{year})
                                </div>
                                <table className="w-full text-left text-[10px] divide-y divide-slate-100">
                                  <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                      <th className="px-2 py-1.5 font-medium">Licenciador</th>
                                      <th className="px-2 py-1.5 font-medium">Tipo</th>
                                      <th className="px-2 py-1.5 font-medium text-center">Parcela</th>
                                      <th className="px-2 py-1.5 font-medium text-center">Ano</th>
                                      <th className="px-2 py-1.5 font-medium text-right">Valor</th>
                                      <th className="px-2 py-1.5 font-medium text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {cellData?.items.map((item: any, idx: number) => (
                                      <tr key={`${idx}-${item.license || 'N/A'}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-2 py-1.5 truncate max-w-[120px]" title={item.license}>{item.license}</td>
                                        <td className="px-2 py-1.5 truncate max-w-[120px]" title={item.type}>
                                          {item.type?.includes('Mínimo Garantido') ? 'MG' : 
                                           item.type?.includes('Fundo de Marketing') ? 'CMF' : 
                                           item.type}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">{item.installmentNumber || '-'}</td>
                                        <td className="px-2 py-1.5 text-center">{item.year || '-'}</td>
                                        <td className="px-2 py-1.5 text-right font-medium text-slate-700">
                                          {(Number(item.amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                          <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] uppercase font-bold", item.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                            {item.status === 'paid' ? 'Pago' : 'Pendente'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </>
                            }
                          >
                            <span className="cursor-help hover:text-blue-600 border-b border-dashed border-blue-300 pb-0.5">
                              {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </PortalTooltip>
                        ) : '-'}
                      </td>
                    );
                  });

                  return (
                    <React.Fragment key={year}>
                      <tr className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-3 py-2 border-r border-slate-100 font-semibold text-slate-800 flex items-center justify-center gap-1">
                          {year}
                        </td>
                        {rowValues}
                        <td className="px-3 py-2 text-right font-bold text-slate-800 bg-slate-50/50">
                          {yearTotal > 0 ? yearTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {summaryData.years.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center text-slate-400">
                      Nenhuma programação de pagamento encontrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
              {summaryData.years.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                  <tr>
                    <td className="px-3 py-3 border-r border-slate-200 text-center">TOTAL GERAL</td>
                    {summaryData.months.map(m => {
                      const monthTotal = summaryData.years.reduce((sum, y) => sum + (summaryData.grid[y][m]?.total || 0), 0);
                      return (
                        <td key={m} className="px-1 py-3 text-right border-r border-slate-200">
                          {monthTotal > 0 ? monthTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right">
                      {(() => {
                         let grandTotal = 0;
                         summaryData.years.forEach(y => {
                           summaryData.months.forEach(m => {
                             grandTotal += summaryData.grid[y][m] || 0;
                           })
                         });
                         return grandTotal > 0 ? grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-200 pb-3">
          <div className="flex justify-between items-center mb-4">
            <div>
              <CardTitle className="text-lg text-slate-800">Cronograma de Obrigações e Parcelas</CardTitle>
              <CardDescription>Acompanhe as parcelas acordadas em contrato e obrigações geradas por excesso</CardDescription>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 font-bold">{filteredObligations.length} de {obligations.length} Obrigações</Badge>
          </div>

          {/* Obligations Filters */}
          <div className="flex flex-wrap items-end gap-3 w-full animate-in fade-in duration-500">
            <div className="min-w-[180px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Licenciador</Label>
              <MultiSelectDropdown
                className="h-8 text-xs border-slate-200 bg-white"
                options={licenses.map(l => ({ label: l.nomelicenciador, value: l.id }))}
                selectedValues={obsLicenseIds}
                onChange={setObsLicenseIds}
                placeholder="Todos"
              />
            </div>

            <div className="min-w-[150px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Contratos</Label>
              <MultiSelectDropdown
                className="h-8 text-xs border-slate-200 bg-white"
                options={contracts
                  .filter(c => obsLicenseIds.length === 0 || obsLicenseIds.includes(c.licenseId))
                  .map(c => ({ label: c.contractNumber || `ID: ${c.id.slice(0,5)}`, value: c.id }))
                }
                selectedValues={obsContractIds}
                onChange={setObsContractIds}
                placeholder="Todos"
              />
            </div>

            <div className="min-w-[150px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Tipo</Label>
              <MultiSelectDropdown
                className="h-8 text-xs border-slate-200 bg-white"
                options={availableTypes.map(t => ({ label: t, value: t }))}
                selectedValues={obsTypes}
                onChange={setObsTypes}
                placeholder="Todos"
              />
            </div>

            <div className="min-w-[100px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Ano</Label>
              <MultiSelectDropdown
                className="h-8 text-xs border-slate-200 bg-white"
                options={availableYears.map(y => ({ label: y, value: y }))}
                selectedValues={obsYears}
                onChange={setObsYears}
                placeholder="Todos"
              />
            </div>

            <div className="min-w-[120px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Invoice / NF</Label>
              <MultiSelectDropdown
                className="h-8 text-xs border-slate-200 bg-white"
                options={availableInvoices.map(i => ({ label: i, value: i }))}
                selectedValues={obsInvoices}
                onChange={setObsInvoices}
                placeholder="Todos"
              />
            </div>

            <div className="min-w-[120px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Status</Label>
              <MultiSelectDropdown
                className="h-8 text-xs border-slate-200 bg-white"
                options={[
                  { label: 'Pago', value: 'paid' },
                  { label: 'Pendente', value: 'pending' }
                ]}
                selectedValues={obsStatuses}
                onChange={setObsStatuses}
                placeholder="Todos"
              />
            </div>

            <div className="min-w-[120px] flex-1 space-y-1">
              <Label className="text-[11px] text-slate-400">Data de Pagamento</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <Input 
                  className="h-8 text-xs pl-8 border-slate-200 bg-white"
                  placeholder="DD/MM/AAAA" 
                  value={obsPaymentDate}
                  onChange={(e) => setObsPaymentDate(e.target.value)}
                />
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-[10px] text-slate-400 hover:text-red-500"
              onClick={() => {
                setObsLicenseIds([]);
                setObsContractIds([]);
                setObsYears([]);
                setObsTypes([]);
                setObsInvoices([]);
                setObsStatuses([]);
                setObsPaymentDate('');
              }}
            >
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Licenciador</th>
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Nº Parcela</th>
                  <th className="px-4 py-3">Ano</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Invoice/NF</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Data Pgto</th>
                  <th className="px-4 py-3 text-center">Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredObligations.map((ob: any) => (
                  <tr key={ob.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-slate-800 truncate max-w-[120px]" title={ob.license}>{ob.license}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600">{ob.contract}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600 font-normal">{ob.type}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600">{ob.installmentNumber}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600">{ob.year}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap w-auto">
                      {getCurrencySymbol(ob.currency)} {ob.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-slate-600">{formatDateBR(ob.dueDate)}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600">{ob.invoice}</td>
                    <td className="px-4 py-3 text-center">
                      {ob.status === 'paid' ? (
                        <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-bold text-[9px]">
                          <CheckCircle2 size={12} /> PAGO
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-amber-600 font-bold text-[9px]">
                          <AlertCircle size={12} /> PENDENTE
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-slate-600">{formatDateBR(ob.paymentDate)}</td>
                    <td className="px-4 py-3 text-center">
                      {ob.documentUrl ? (
                        <a 
                          href={ob.documentUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center justify-center p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          title={`Ver ${ob.documentName || 'documento'}`}
                        >
                          <FileDown size={14} />
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {obligations.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400 italic">Nenhuma parcela ou obrigação detectada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Controle de Pagamentos</CardTitle>
          <CardDescription>Acompanhe parcelas de MG, royalties e fundo de marketing</CardDescription>
        </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1200px]">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <SortableHeader label="Tipo" sortKey="type" />
                <SortableHeader label="Licenciador" sortKey="license" />
                <SortableHeader label="Contrato" sortKey="contract" />
                <SortableHeader label="Identificação" sortKey="identification" />
                <SortableHeader label="Dt Vencimento" sortKey="dueDate" />
                <SortableHeader label="Dt Pagamento" sortKey="date" />
                <SortableHeader label="Valor" sortKey="amount" />
                <SortableHeader label="Invoice / NF" sortKey="invoice" />
                <SortableHeader label="Status" sortKey="status" />
                <th className="px-4 py-3 text-center">Doc</th>
                {isAdmin && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedPayments.map((payment: any) => {
                const contract = contracts.find((c: any) => c.id === payment.contractId);
                const license = licenses.find((l: any) => l.id === (payment.licenseId || contract?.licenseId));
                const symbol = getCurrencySymbol(payment.currency || contract?.currency || 'BRL');
                
                return (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-[13px] text-slate-600 font-normal">
                        {payment.type === 'mg' ? 'MG' : 
                         payment.type === 'excess' ? 'Royalties' : 
                         payment.type === 'marketing' ? 'Marketing' : 'Outros'}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium text-slate-800 truncate max-w-[120px]" title={license?.nomelicenciador || (license?.id ? `ID: ${license.id.slice(0,5)}` : '')}>
                        {license?.nomelicenciador || (license?.id ? `ID: ${license.id.slice(0,5)}` : (payment.licenseId ? `ID: ${payment.licenseId.slice(0,5)}` : '-'))}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-600">{contract?.contractNumber || (contract?.id ? `ID: ${contract.id.slice(0,5)}` : (payment.contractId ? `ID: ${payment.contractId.slice(0,5)}` : '-'))}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-600 truncate max-w-[100px]" title={payment.identification}>
                        {payment.identification || '-'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-600">{formatDateBR(payment.dueDate)}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-600">{formatDateBR(payment.date)}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap w-auto">
                        {symbol} {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-600">{payment.invoice || '-'}</td>
                      <td className="px-4 py-3 text-[13px]">
                        {payment.status === 'paid' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[8px] font-bold">PAGO</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[8px] font-bold">PENDENTE</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {payment.documentUrl ? (
                          <a 
                            href={payment.documentUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center justify-center p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title={`Baixar ${payment.documentName || 'documento'}`}
                          >
                            <FileDown size={14} />
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
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
                          <button 
                            onClick={() => handleDeletePayment(payment.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            title="Excluir Pagamento"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">Nenhum pagamento registrado.</td>
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

function EditLicensorDialog({ license }: { license: License }) {
  const [open, setOpen] = useState(false);
  const [nomelicenciador, setNomelicenciador] = useState(license.nomelicenciador || '');
  const [nomejurlicenciador, setNomejurlicenciador] = useState(license.nomejurlicenciador || '');
  const [nomeagente, setNomeagente] = useState(license.nomeagente || '');
  const [descricaolicenciador, setDescricaolicenciador] = useState(license.descricaolicenciador || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const licenseRef = doc(db, 'licenses', license.id);
      await updateDoc(licenseRef, { 
        nomelicenciador,
        nomejurlicenciador, 
        nomeagente, 
        descricaolicenciador, 
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
            <Pencil size={16} />
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
            <Label htmlFor="edit-nomelicenciador">Nome</Label>
            <Input id="edit-nomelicenciador" value={nomelicenciador} onChange={(e) => setNomelicenciador(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-nomejurlicenciador">Nome Jurídico</Label>
            <Input id="edit-nomejurlicenciador" value={nomejurlicenciador} onChange={(e) => setNomejurlicenciador(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-nomeagente">Administradora/Agente</Label>
            <Input id="edit-nomeagente" value={nomeagente} onChange={(e) => setNomeagente(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-descricaolicenciador">Descrição (Opcional)</Label>
            <Input id="edit-descricaolicenciador" value={descricaolicenciador} onChange={(e) => setDescricaolicenciador(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit">Salvar Alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLicensorDialog({ licenseId, licensorName }: { licenseId: string, licensorName: string }) {
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'licenses', licenseId));
      toast.success(`Licenciador ${licensorName} excluído com sucesso!`);
      setOpen(false);
    } catch (err) {
      toast.error('Erro ao excluir licenciador.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button 
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-slate-400 hover:text-red-600")}
        >
          <Trash2 size={16} />
        </button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir Licenciador</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o licenciador <strong>{licensorName}</strong>? Esta ação não pode ser desfeita.
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
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Agentes</th>
                {isAdmin && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
                {[...licenses].sort((a, b) => (a.nomelicenciador || a.id).localeCompare(b.nomelicenciador || b.id)).map((license) => (
                  <tr key={license.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 font-medium text-slate-900">{license.nomelicenciador || `ID: ${license.id.slice(0,5)}`}</td>
                    <td className="px-4 py-4 text-blue-600 font-medium">{license.nomeagente || '-'}</td>
                    {isAdmin && (
                      <td className="px-4 py-4 text-right flex justify-end gap-1">
                        <EditLicensorDialog license={license} />
                        <DeleteLicensorDialog 
                          licenseId={license.id} 
                          licensorName={license.nomelicenciador || license.id} 
                        />
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
  const [nomelinha, setNomelinha] = useState(line.nomelinha);
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
        nomelinha,
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
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o licenciador">
                    {licenses.find(l => l.id === licenseId)?.nomelicenciador}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[...licenses].sort((a, b) => (a.nomelicenciador || a.id).localeCompare(b.nomelicenciador || b.id)).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nomelicenciador || `ID: ${l.id.slice(0,5)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nomelinha">Nome da linha</Label>
              <Input id="edit-nomelinha" value={nomelinha} onChange={(e) => setNomelinha(e.target.value)} required />
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
                  variant={productCategories.includes(cat.nomeCategoriaProduto) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setProductCategories(prev =>
                      prev.includes(cat.nomeCategoriaProduto) ? prev.filter(name => name !== cat.nomeCategoriaProduto) : [...prev, cat.nomeCategoriaProduto]
                    );
                  }}
                >
                  {cat.nomeCategoriaProduto}
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
              {lineProducts.length > 0 ? lineProducts.map(p => p.sku || p.name || `ID: ${p.id.slice(0, 5)}`).join(', ') : 'Nenhum produto cadastrado.'}
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
     .sort((a, b) => (a.license.nomelicenciador || a.license.id).localeCompare(b.license.nomelicenciador || b.license.id));

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
                          <span className="font-bold text-slate-900">{license.nomelicenciador || `ID: ${license.id.slice(0,5)}`}</span>
                          <Badge variant="secondary" className="ml-2 text-[10px] h-5">
                            {groupLines.length} {groupLines.length === 1 ? 'Linha' : 'Linhas'}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Line Rows */}
                    {!isCollapsed && groupLines.sort((a, b) => (a.nomelinha || a.id).localeCompare(b.nomelinha || b.id)).map((line) => (
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
                                {line.nomelinha || `ID: ${line.id.slice(0,5)}`}
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
                              <DeleteLineDialog lineId={line.id} lineName={line.nomelinha} />
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

function ProductCategoriesView({ categories, isAdmin }: { categories: ProductCategory[], isAdmin: boolean }) {
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [pageSize, setPageSize] = useState<number>(20);

  const sortedCategories = [...categories].sort((a, b) => (a.nomeCategoriaProduto || '').localeCompare(b.nomeCategoriaProduto || ''));

  const handleAdd = async () => {
    if (!newCategory) return;
    try {
      await addDoc(collection(db, 'productCategories'), { 
        nomeCategoriaProduto: newCategory,
        createdAt: serverTimestamp()
      });
      setNewCategory('');
      toast.success('Categoria adicionada!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'productCategories');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        await deleteDoc(doc(db, 'productCategories', id));
        toast.success('Categoria excluída!');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'productCategories');
      }
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingValue.trim()) return;
    try {
      await updateDoc(doc(db, 'productCategories', id), { 
        nomeCategoriaProduto: editingValue.trim()
      });
      setEditingId(null);
      setEditingValue('');
      toast.success('Categoria atualizada!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'productCategories');
    }
  };

  if (!isAdmin && categories.length === 0) return null;

  return (
    <Card className="border-slate-200 shadow-sm mt-8">
      <CardHeader>
        <CardTitle>Categorias de Produtos</CardTitle>
      </CardHeader>
      <CardContent>
        {isAdmin && (
          <div className="flex gap-2 mb-4 items-center">
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nova categoria" />
            <Button onClick={handleAdd}>Adicionar</Button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-500 whitespace-nowrap">Visualização:</span>
              <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Linhas por página" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 itens</SelectItem>
                  <SelectItem value="40">40 itens</SelectItem>
                  <SelectItem value="80">80 itens</SelectItem>
                  <SelectItem value={categories.length.toString()}>Todos os itens</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 pb-2">
          {sortedCategories.slice(0, pageSize).map(cat => (
            <div key={cat.id} className="border p-3 rounded flex justify-between items-center bg-white shadow-sm hover:border-slate-300 transition-colors">
              {editingId === cat.id ? (
                <div className="flex gap-1 w-full">
                  <Input 
                    value={editingValue} 
                    onChange={e => setEditingValue(e.target.value)} 
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(cat.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <Button size="sm" onClick={() => handleUpdate(cat.id)} className="h-8 px-2">Ok</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 px-2">
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-sm truncate mr-2">{cat.nomeCategoriaProduto}</span>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditingValue(cat.nomeCategoriaProduto);
                        }} 
                        className="text-slate-400 hover:text-blue-600 h-8 w-8"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)} className="text-slate-400 hover:text-red-600 h-8 w-8">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {sortedCategories.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Nenhuma categoria encontrada.</p>}
      </CardContent>
    </Card>
  );
}

function ProductsView({ products, lines, categories, licenses, isAdmin }: { products: Product[], lines: Line[], categories: ProductCategory[], licenses: License[], isAdmin: boolean }) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLine, setFilterLine] = useState<string>('all');
  const [filterLicense, setFilterLicense] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  
  // States for Production Summary
  const [prodSummaryLicenseIds, setProdSummaryLicenseIds] = useState<string[]>([]);
  const [prodSummaryLineIds, setProdSummaryLineIds] = useState<string[]>([]);
  const [prodSummaryCategoryId, setProdSummaryCategoryId] = useState<string>('all');
  const [prodSummaryValueType, setProdSummaryValueType] = useState<'produced' | 'reprogrammed' | 'cost'>('produced');
  const [prodSummaryViewMode, setProdSummaryViewMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [expandedProdYears, setExpandedProdYears] = useState<number[]>([]);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'sku', direction: 'asc' });
  const [pageSize, setPageSize] = useState<number>(50);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredProducts = React.useMemo(() => products.filter(product => {
    const line = lines.find(l => l.id === product.lineId);
    const licenseId = product.licenseId || line?.licenseId;
    
    if (filterCategory !== 'all' && product.categoryId !== filterCategory) return false;
    if (filterLine !== 'all' && product.lineId !== filterLine) return false;
    if (filterLicense !== 'all' && licenseId !== filterLicense) return false;
    if (filterYear !== 'all' && String(product.launchYear) !== filterYear) return false;
    
    return true;
  }), [products, lines, filterCategory, filterLine, filterLicense, filterYear]);

  const sortedProducts = React.useMemo(() => [...filteredProducts].sort((a, b) => {
    let valA: any = a[sortConfig.key as keyof Product];
    let valB: any = b[sortConfig.key as keyof Product];

    if (sortConfig.key === 'category') {
      valA = categories.find(c => c.id === a.categoryId)?.nomeCategoriaProduto || '';
      valB = categories.find(c => c.id === b.categoryId)?.nomeCategoriaProduto || '';
    } else if (sortConfig.key === 'line') {
      valA = lines.find(l => l.id === a.lineId)?.nomelinha || '';
      valB = lines.find(l => l.id === b.lineId)?.nomelinha || '';
    } else if (sortConfig.key === 'license') {
      const lineA = lines.find(l => l.id === a.lineId);
      const lineB = lines.find(l => l.id === b.lineId);
      valA = licenses.find(l => l.id === (a.licenseId || lineA?.licenseId))?.nomelicenciador || '';
      valB = licenses.find(l => l.id === (b.licenseId || lineB?.licenseId))?.nomelicenciador || '';
    }

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (valA < valB) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (valA > valB) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  }), [filteredProducts, sortConfig, categories, lines, licenses]);

  const uniqueYears = Array.from(new Set(products.map(p => p.launchYear).filter(Boolean))).sort();

  const prodSummaryData = React.useMemo(() => {
    const filtered = products.filter(p => {
      const line = lines.find(l => l.id === p.lineId);
      const licId = p.licenseId || line?.licenseId;
      
      if (prodSummaryLicenseIds.length > 0 && !prodSummaryLicenseIds.includes(licId || '')) return false;
      if (prodSummaryLineIds.length > 0 && !prodSummaryLineIds.includes(p.lineId)) return false;
      if (prodSummaryCategoryId !== 'all' && p.categoryId !== prodSummaryCategoryId) return false;
      return true;
    });

    const yearsSet = new Set<number>();
    const grid: Record<number, Record<number, number>> = {};

    filtered.forEach(p => {
      const dateVal = (Number(p.quantidade_reprogramada) > 0 && p.data_reprogramacao) 
        ? p.data_reprogramacao 
        : p.data_producao;
      
      if (!dateVal) return;

      const dt = getSafeDate(dateVal);
      if (!isNaN(dt.getTime())) {
        const y = dt.getFullYear();
        const m = dt.getMonth() + 1;
        yearsSet.add(y);
        
        if (!grid[y]) grid[y] = {};
        if (!grid[y][m]) grid[y][m] = 0;
        
        const val = prodSummaryValueType === 'produced' ? (Number(p.quantidade_produzida) || 0) :
                    prodSummaryValueType === 'reprogrammed' ? (Number(p.quantidade_reprogramada) || 0) :
                    (Number(p.valor_total_custo_producao) || 0);
        
        grid[y][m] += val;
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a); // Newest years first
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return { years, months, grid };
  }, [products, prodSummaryLicenseIds, prodSummaryLineIds, prodSummaryCategoryId, prodSummaryValueType, lines, licenses, categories]);

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter(pid => pid !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  const handleBatchDelete = async () => {
    if (window.confirm(`Tem certeza que deseja excluir ${selectedProductIds.length} produtos?`)) {
      try {
        await Promise.all(selectedProductIds.map(id => deleteDoc(doc(db, 'products', id))));
        toast.success(`${selectedProductIds.length} produtos excluídos com sucesso!`);
        setSelectedProductIds([]);
      } catch (error) {
        toast.error('Erro ao excluir produtos em lote.');
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Production Summary Section */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 pt-4 pb-4 px-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-800">
                <TrendingUp size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold">Resumo de produção e custos</h2>
              </div>
              
              <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500 bg-emerald-50/10 px-3 py-1 rounded-full border border-emerald-100">
                <span>{prodSummaryViewMode === 'monthly' ? 'Mensal' : 'Trimestral'}</span>
                <span className="w-1 h-1 rounded-full bg-emerald-300" />
                <span>
                   {prodSummaryValueType === 'produced' ? 'Quantidades de Produção' : 
                    prodSummaryValueType === 'reprogrammed' ? 'Quantidades de Reprogramação' : 
                    'Valores Totais de Custo'}
                </span>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 w-full">
              <div className="min-w-[180px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Licenciadores</Label>
                <MultiSelectDropdown
                  className="h-7 text-[10px] bg-white"
                  options={licenses.map(l => ({ label: l.nomelicenciador, value: l.id }))}
                  selectedValues={prodSummaryLicenseIds}
                  onChange={setProdSummaryLicenseIds}
                  placeholder="Todos"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Linhas</Label>
                <MultiSelectDropdown
                  className="h-7 text-[10px] bg-white"
                  options={lines.filter(l => prodSummaryLicenseIds.length === 0 || prodSummaryLicenseIds.includes(l.licenseId)).map(l => ({ label: l.nomelinha, value: l.id }))}
                  selectedValues={prodSummaryLineIds}
                  onChange={setProdSummaryLineIds}
                  placeholder="Todas"
                />
              </div>

              <div className="min-w-[150px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Categorias</Label>
                <SearchableSelect
                  className="h-7 text-[10px] w-full bg-white"
                  options={[
                    { label: "Todas as Categorias", value: "all" },
                    ...categories.map(c => ({ label: c.nomeCategoriaProduto, value: c.id }))
                  ]}
                  value={prodSummaryCategoryId}
                  onValueChange={setProdSummaryCategoryId}
                  placeholder="Todas"
                />
              </div>

              <div className="min-w-[120px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Período</Label>
                <Select value={prodSummaryViewMode} onValueChange={(v: any) => setProdSummaryViewMode(v)}>
                  <SelectTrigger className="h-7 text-[10px] w-full bg-white">
                    <span>{prodSummaryViewMode === 'monthly' ? 'Mensal' : 'Trimestral'}</span>
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[180px] flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 font-medium">Tipo de Valor</Label>
                <Select value={prodSummaryValueType} onValueChange={(v: any) => setProdSummaryValueType(v)}>
                  <SelectTrigger className="h-7 text-[10px] w-full bg-white">
                    <span>
                      {prodSummaryValueType === 'produced' ? 'Quantidades de Produção' : 
                       prodSummaryValueType === 'reprogrammed' ? 'Quantidades de Reprogramação' : 
                       'Valores Totais de Custo'}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="produced">Quantidades de Produção</SelectItem>
                    <SelectItem value="reprogrammed">Quantidades de Reprogramação</SelectItem>
                    <SelectItem value="cost">Valores Totais de Custo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse table-fixed min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 border-r border-slate-200 w-24 text-center">Ano</th>
                {prodSummaryViewMode === 'monthly' ? (
                  ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].map(m => (
                    <th key={m} className="px-1 py-2 text-center border-r border-slate-200 w-[calc((100%-208px)/12)]">{m}</th>
                  ))
                ) : (
                  ['T1', 'T2', 'T3', 'T4'].map(t => (
                    <th key={t} className="px-1 py-2 text-center border-r border-slate-200 w-[calc((100%-208px)/4)]">{t}</th>
                  ))
                )}
                <th className="px-3 py-2 text-center w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prodSummaryData.years.length === 0 ? (
                <tr>
                  <td colSpan={prodSummaryViewMode === 'monthly' ? 14 : 6} className="px-4 py-8 text-center text-slate-400 italic">
                    Nenhum dado de produção encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                prodSummaryData.years.map(year => {
                  let yearTotal = 0;
                  const rowValues = prodSummaryViewMode === 'monthly' ? (
                    prodSummaryData.months.map(m => {
                      const val = prodSummaryData.grid[year]?.[m] || 0;
                      yearTotal += val;
                      return val;
                    })
                  ) : (
                    [1, 2, 3, 4].map(q => {
                      const qMonths = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];
                      const val = qMonths.reduce((acc, m) => acc + (prodSummaryData.grid[year]?.[m] || 0), 0);
                      yearTotal += val;
                      return val;
                    })
                  );

                  return (
                    <React.Fragment key={year}>
                      <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => {
                        setExpandedProdYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
                      }}>
                        <td className="px-3 py-2 font-bold bg-slate-50/30 border-r border-slate-200 text-center flex items-center justify-center gap-2">
                           <span className="text-slate-400">
                              {expandedProdYears.includes(year) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                           </span>
                           {year}
                        </td>
                        {rowValues.map((v, i) => (
                          <td key={i} className={`px-2 py-2 text-right border-r border-slate-200 ${v > 0 ? 'text-slate-900 font-medium' : 'text-slate-300'}`}>
                            {prodSummaryValueType === 'cost' ? 
                              v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                              v.toLocaleString('pt-BR')}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-bold bg-emerald-50/30 text-emerald-700">
                          {prodSummaryValueType === 'cost' ? 
                            yearTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                            yearTotal.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                      {expandedProdYears.includes(year) && (
                        <tr className="bg-slate-50/80 animate-in fade-in slide-in-from-top-1 border-b border-slate-100">
                          <td className="px-3 py-1.5 text-[10px] italic text-slate-500 border-r border-slate-200 bg-slate-100/30 text-center">
                            % Evolução
                          </td>
                          {rowValues.map((v, i) => {
                            let comparisonVal = 0;
                            const prevYear = year - 1;
                            if (prodSummaryData.years.includes(prevYear) || prodSummaryData.grid[prevYear]) {
                              if (prodSummaryViewMode === 'monthly') {
                                comparisonVal = prodSummaryData.grid[prevYear]?.[i + 1] || 0;
                              } else {
                                const q = i + 1;
                                const qMonths = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];
                                comparisonVal = qMonths.reduce((acc, m) => acc + (prodSummaryData.grid[prevYear]?.[m] || 0), 0);
                              }
                            }
                            const variance = comparisonVal > 0 ? ((v - comparisonVal) / comparisonVal) * 100 : 0;
                            const isPositive = variance > 0;
                            const isZero = variance === 0 && v === comparisonVal;
                            
                            if (comparisonVal === 0) return (
                              <td key={i} className="px-1 py-1.5 text-center border-r border-slate-200 text-slate-400 text-[10px]">-</td>
                            );
                            
                            return (
                              <td key={i} className={`px-1 py-1.5 text-center border-r border-slate-200 text-[10px] font-medium ${isPositive ? 'text-emerald-600' : isZero ? 'text-slate-400' : 'text-rose-600'}`}>
                                {isPositive ? '+' : ''}{variance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5 text-right bg-emerald-50/50 text-[10px] font-bold text-slate-600">
                            {(() => {
                              let prevYearTotal = 0;
                              const prevYear = year - 1;
                              if (prodSummaryData.grid[prevYear]) {
                                Array.from({length: 12}, (_, k) => k + 1).forEach(m => {
                                  prevYearTotal += prodSummaryData.grid[prevYear]?.[m] || 0;
                                });
                              }
                              if (prevYearTotal === 0) return '-';
                              const totalVar = ((yearTotal - prevYearTotal) / prevYearTotal) * 100;
                              return `${totalVar > 0 ? '+' : ''}${totalVar.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
                            })()}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
              {/* Grand Total Row */}
              {prodSummaryData.years.length > 0 && (
                <tr className="bg-slate-100/50 font-bold border-t-2 border-slate-200">
                  <td className="px-3 py-3 border-r border-slate-200 text-center text-slate-700 uppercase tracking-wider">
                    Total Geral
                  </td>
                  {(prodSummaryViewMode === 'monthly' ? Array.from({length: 12}) : Array.from({length: 4})).map((_, i) => {
                    let colTotal = 0;
                    prodSummaryData.years.forEach(y => {
                      if (prodSummaryViewMode === 'monthly') {
                        colTotal += prodSummaryData.grid[y]?.[i + 1] || 0;
                      } else {
                        const q = i + 1;
                        const qMonths = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];
                        colTotal += qMonths.reduce((acc, m) => acc + (prodSummaryData.grid[y]?.[m] || 0), 0);
                      }
                    });
                    return (
                      <td key={i} className="px-2 py-3 text-right border-r border-slate-200 text-emerald-800">
                        {prodSummaryValueType === 'cost' ? 
                          colTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                          colTotal.toLocaleString('pt-BR')}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-right text-emerald-900 bg-emerald-100/30">
                    {(() => {
                      let grandTotal = 0;
                      prodSummaryData.years.forEach(y => {
                        Object.values(prodSummaryData.grid[y] || {}).forEach((v: any) => grandTotal += (v as number));
                      });
                      return prodSummaryValueType === 'cost' ? 
                        grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                        grandTotal.toLocaleString('pt-BR');
                    })()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Gerencie os produtos vinculados às linhas</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Categoria</Label>
              <SearchableSelect
                className="h-8 text-xs min-w-[150px]"
                options={[
                  { label: "Todas as Categorias", value: "all" },
                  ...[...categories].sort((a,b)=>(a.nomeCategoriaProduto||'').localeCompare(b.nomeCategoriaProduto||'')).map(c => ({ label: c.nomeCategoriaProduto, value: c.id }))
                ]}
                value={filterCategory}
                onValueChange={setFilterCategory}
                placeholder="Todas"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Linha</Label>
              <SearchableSelect
                className="h-8 text-xs min-w-[150px]"
                options={[
                  { label: "Todas as Linhas", value: "all" },
                  ...[...lines].sort((a,b)=>(a.nomelinha||'').localeCompare(b.nomelinha||'')).map(l => ({ label: l.nomelinha, value: l.id }))
                ]}
                value={filterLine}
                onValueChange={setFilterLine}
                placeholder="Todas"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Licenciador</Label>
              <SearchableSelect
                className="h-8 text-xs min-w-[150px]"
                options={[
                  { label: "Todos os Licenciadores", value: "all" },
                  ...[...licenses].sort((a,b)=>(a.nomelicenciador||'').localeCompare(b.nomelicenciador||'')).map(l => ({ label: l.nomelicenciador, value: l.id }))
                ]}
                value={filterLicense}
                onValueChange={setFilterLicense}
                placeholder="Todos"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Ano</Label>
              <SearchableSelect
                className="h-8 text-xs min-w-[100px]"
                options={[
                  { label: "Todos", value: "all" },
                  ...uniqueYears.map(y => ({ label: String(y), value: String(y) }))
                ]}
                value={filterYear}
                onValueChange={setFilterYear}
                placeholder="Todos"
              />
            </div>
            
            {isAdmin && selectedProductIds.length > 1 && (
              <div className="flex items-center gap-2 ml-4">
                <BatchEditProductsDialog 
                  selectedProductIds={selectedProductIds} 
                  products={products}
                  licenses={licenses} 
                  lines={lines} 
                  categories={categories} 
                  onComplete={() => setSelectedProductIds([])} 
                />
                <BatchDeleteProductsDialog 
                  selectedProductIds={selectedProductIds} 
                  onComplete={() => setSelectedProductIds([])} 
                />
              </div>
            )}

            <div className="flex-grow" />
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 whitespace-nowrap">Visualização:</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Linhas por página" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 itens</SelectItem>
                    <SelectItem value="50">50 itens</SelectItem>
                    <SelectItem value="100">100 itens</SelectItem>
                    <SelectItem value={filteredProducts.length.toString()}>Todos os itens</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm text-left min-w-[1200px]">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0">
                <tr>
                  {isAdmin && (
                    <th className="px-4 py-3 w-12 text-center bg-slate-50">
                      <input 
                        type="checkbox" 
                        checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 w-16 bg-slate-50">Imagem</th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50" onClick={() => handleSort('sku')}>
                    <div className="flex items-center gap-1">Código {sortConfig.key === 'sku' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Nome {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50" onClick={() => handleSort('category')}>
                    <div className="flex items-center gap-1">Categoria {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50" onClick={() => handleSort('line')}>
                    <div className="flex items-center gap-1">Linha {sortConfig.key === 'line' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50" onClick={() => handleSort('license')}>
                    <div className="flex items-center gap-1">Licenciador {sortConfig.key === 'license' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50" onClick={() => handleSort('launchYear')}>
                    <div className="flex items-center gap-1">Ano {sortConfig.key === 'launchYear' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 bg-slate-50" onClick={() => handleSort('ean')}>
                    <div className="flex items-center gap-1">EAN {sortConfig.key === 'ean' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                  </th>
                  <th className="px-4 py-3 text-right bg-slate-50">Custo Unit.</th>
                  <th className="px-4 py-3 text-right bg-slate-50">Qtd Prod.</th>
                  <th className="px-4 py-3 text-right bg-slate-50 font-semibold bg-blue-50/30">Total Custo</th>
                  {isAdmin && <th className="px-4 py-3 text-right bg-slate-50">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedProducts.slice(0, pageSize).map((product) => {
                  const line = lines.find(l => l.id === product.lineId);
                  const category = categories.find(c => c.id === product.categoryId);
                  const license = licenses.find(l => l.id === (product.licenseId || line?.licenseId));
                  const imageUrl = (product.sku && product.sku.trim()) ? `https://img.kalunga.com.br/FotosdeProdutos/${String(product.sku.trim()).padStart(6, '0')}.jpg` : null;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                      {isAdmin && (
                        <td className="px-4 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => toggleSelectProduct(product.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                      )}
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
                      <td className="px-4 py-4 font-medium text-slate-900">{product.sku ? String(product.sku).padStart(6, '0') : '-'}</td>
                      <td className="px-4 py-4 text-slate-900">{product.name}</td>
                      <td className="px-4 py-4 text-slate-600">{category?.nomeCategoriaProduto || (product.categoryId ? `ID: ${product.categoryId.slice(0,5)}` : '-')}</td>
                      <td className="px-4 py-4 text-slate-600">{line?.nomelinha || (product.lineId ? `ID: ${product.lineId.slice(0,5)}` : '-')}</td>
                      <td className="px-4 py-4 text-slate-600">{license?.nomelicenciador || (license?.id ? `ID: ${license.id.slice(0,5)}` : (product.licenseId ? `ID: ${product.licenseId.slice(0,5)}` : '-'))}</td>
                      <td className="px-4 py-4 text-slate-600">{product.launchYear || '-'}</td>
                      <td className="px-4 py-4 text-slate-600">{product.ean || '-'}</td>
                      <td className="px-4 py-4 text-right">
                        {(product.custo_unitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[13px]">{product.quantidade_produzida || 0}</span>
                          {(product.quantidade_reprogramada || 0) > 0 && (
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded font-medium">Repr: {product.quantidade_reprogramada}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-blue-700 bg-blue-50/10">
                        {(product.valor_total_custo_producao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <EditProductDialog 
                              product={product} 
                              lines={lines} 
                              categories={categories} 
                              licenses={licenses} 
                            />
                            <DeleteProductDialog 
                              productId={product.id} 
                              productName={product.name} 
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 8} className="px-4 py-8 text-center text-slate-400">Nenhum produto encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <ProductCategoriesView categories={categories} isAdmin={isAdmin} />
    </div>
  );
}

