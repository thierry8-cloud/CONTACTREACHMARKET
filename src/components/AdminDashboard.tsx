import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Package, FolderTree, Store, ShoppingBag, CreditCard,
  Layers, Users, Mail, AlertTriangle, Tag, FileText, Settings, Shield,
  LogOut, Search, Plus, Edit, Trash2, Copy, Check, X, Eye, Phone,
  MapPin, Truck, RefreshCw, Filter, ArrowUpRight, CheckCircle2, XCircle,
  AlertCircle, Clock, ChevronDown, Download, Printer, ShieldCheck,
  Send, Calendar, DollarSign, Archive, ExternalLink, Upload, Percent,
  KeyRound, Lock, Image as ImageIcon
} from 'lucide-react';
import {
  Product, Order, PaymentConfirmation, AppSettings, OrderStatus, Category,
  PaymentStatus, PaymentMethod, ProductStatus, VendorShop, AdminMessage,
  CustomerProblemReport, Coupon, InventoryLog, AuditLog, CustomerUser,
  AdminUser, AdminRole, PaymentMethodConfig, ProductVariation, ProblemStatus, ProblemPriority
} from '../types.ts';
import { api, getStoredAdminUser } from '../services/api.ts';
import { getCategoryCoverImage, getCategoryImageSource } from '../utils/categoryImage.ts';

interface AdminDashboardProps {
  onLogout: () => void;
  categories: Category[];
  onRefreshPublicData: () => void;
}

type TabType =
  | 'overview'
  | 'products'
  | 'categories'
  | 'shops'
  | 'orders'
  | 'payments'
  | 'inventory'
  | 'customers'
  | 'messages'
  | 'problems'
  | 'coupons'
  | 'audit'
  | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLogout,
  categories: initialPropCategories,
  onRefreshPublicData
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(getStoredAdminUser());

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // State collections
  const [stats, setStats] = useState<any>({
    totalSalesFrw: 0,
    totalOrders: 0,
    pendingVerifications: 0,
    awaitingPaymentOrders: 0,
    confirmedOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    totalProducts: 0,
    activeProducts: 0,
    lowStockCount: 0,
    totalCategories: 0,
    totalShops: 0,
    totalCustomers: 0,
    unreadMessagesCount: 0,
    unresolvedProblemsCount: 0
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialPropCategories);
  const [shops, setShops] = useState<VendorShop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentConfirmation[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [problems, setProblems] = useState<CustomerProblemReport[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Filters
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('all');
  const [productShopFilter, setProductShopFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all');

  // Modals & Selected items
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderStatusModal, setOrderStatusModal] = useState<Order | null>(null);
  const [verifyModalPayment, setVerifyModalPayment] = useState<PaymentConfirmation | null>(null);
  const [printableInvoiceOrder, setPrintableInvoiceOrder] = useState<Order | null>(null);

  // Customer / Buyer Management States
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'buyers' | 'guests'>('all');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<{ customer: CustomerUser; orders: Order[] } | null>(null);
  const [loadingCustomerDetail, setLoadingCustomerDetail] = useState(false);
  const [resetPinCustomer, setResetPinCustomer] = useState<CustomerUser | null>(null);
  const [tempPin, setTempPin] = useState('');
  const [pinActionMessage, setPinActionMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Product Editor Modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState<{
    name: string;
    sku: string;
    description: string;
    price: number | string;
    discountPercent: number | string;
    discountPrice: number | string;
    category: string;
    subcategory: string;
    stock: number | string;
    imageUrl: string;
    imagesText: string;
    shopName: string;
    shopId: string;
    brand: string;
    unit: string;
    status: ProductStatus;
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    sizes: string;
    colors: string;
  }>({
    name: '',
    sku: '',
    description: '',
    price: 15000,
    discountPercent: '',
    discountPrice: '',
    category: 'hair-beauty',
    subcategory: '',
    stock: 25,
    imageUrl: '',
    imagesText: '',
    shopName: 'ContactReach Market',
    shopId: '',
    brand: '',
    unit: 'Piece',
    status: 'Available',
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    sizes: '',
    colors: ''
  });

  // Category Editor Modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameRw, setCatNameRw] = useState('');
  const [catIcon, setCatIcon] = useState('Tag');
  const [catDesc, setCatDesc] = useState('');
  const [catImageUrl, setCatImageUrl] = useState('');

  // Shop Editor Modal
  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<VendorShop | null>(null);
  const [shopForm, setShopForm] = useState({
    name: '',
    category: '',
    description: '',
    location: 'Kigali, Rwanda',
    address: 'Fair View Plaza, Kigali',
    phone: '0780022600',
    email: 'contactreachmedialimited@gmail.com',
    deliveryInfo: 'Express same-day Kigali delivery',
    logo: 'ShoppingBag',
    bannerColor: 'from-orange-500 to-amber-600'
  });

  // Stock Adjustment Modal
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [stockAdjustAmount, setStockAdjustAmount] = useState<number | string>(10);
  const [stockAdjustReason, setStockAdjustReason] = useState('New stock replenishment from supplier');

  // Coupon Editor Modal
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState<'percentage' | 'fixed'>('percentage');
  const [coupVal, setCoupVal] = useState<number | string>(10);
  const [coupMin, setCoupMin] = useState<number | string>('');
  const [coupMaxDiscount, setCoupMaxDiscount] = useState<number | string>('');
  const [coupExpiresAt, setCoupExpiresAt] = useState('');
  const [coupUsageLimit, setCoupUsageLimit] = useState<number | string>('');
  const [coupIsActive, setCoupIsActive] = useState(true);

  // Registered Buyers State & Modals
  const [selectedBuyer, setSelectedBuyer] = useState<CustomerUser | null>(null);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [buyerStatusFilter, setBuyerStatusFilter] = useState<'all' | 'Active' | 'Suspended'>('all');
  const [resetPasswordBuyer, setResetPasswordBuyer] = useState<CustomerUser | null>(null);
  const [newTempPassword, setNewTempPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // Problem Resolution Modal
  const [selectedProblem, setSelectedProblem] = useState<CustomerProblemReport | null>(null);
  const [probResolution, setProbResolution] = useState('');
  const [probStatus, setProbStatus] = useState<ProblemStatus>('In Progress');
  const [probStaffNote, setProbStaffNote] = useState('');

  // Load All Admin Data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        fetchedStats,
        fetchedOrders,
        fetchedProducts,
        fetchedCategories,
        fetchedShops,
        fetchedPayments,
        fetchedMessages,
        fetchedProblems,
        fetchedCoupons,
        fetchedInvLogs,
        fetchedAuditLogs,
        fetchedCustomers,
        fetchedSettings
      ] = await Promise.all([
        api.adminGetStats().catch(() => null),
        api.adminGetOrders().catch(() => []),
        api.getProducts().catch(() => []),
        api.getCategories().catch(() => []),
        api.getShops().catch(() => []),
        api.adminGetPayments().catch(() => []),
        api.adminGetMessages().catch(() => []),
        api.adminGetCustomerReports().catch(() => []),
        api.adminGetCoupons().catch(() => []),
        api.adminGetInventoryLogs().catch(() => []),
        api.adminGetAuditLogs().catch(() => []),
        api.adminGetCustomers().catch(() => []),
        api.getSettings().catch(() => null)
      ]);

      if (fetchedStats) setStats(fetchedStats);
      if (fetchedOrders) setOrders(fetchedOrders);
      if (fetchedProducts) setProducts(fetchedProducts);
      if (fetchedCategories) setCategories(fetchedCategories);
      if (fetchedShops) setShops(fetchedShops);
      if (fetchedPayments) setPayments(fetchedPayments);
      if (fetchedMessages) setMessages(fetchedMessages);
      if (fetchedProblems) setProblems(fetchedProblems);
      if (fetchedCoupons) setCoupons(fetchedCoupons);
      if (fetchedInvLogs) setInventoryLogs(fetchedInvLogs);
      if (fetchedAuditLogs) setAuditLogs(fetchedAuditLogs);
      if (fetchedCustomers) setCustomers(fetchedCustomers);
      if (fetchedSettings) setSettings(fetchedSettings);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = productCatFilter === 'all' || p.category === productCatFilter;
      const matchShop = productShopFilter === 'all' || p.shopName?.toLowerCase() === productShopFilter.toLowerCase();
      const q = productSearch.toLowerCase().trim();
      const matchQ = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.shopName && p.shopName.toLowerCase().includes(q));
      return matchCat && matchShop && matchQ;
    });
  }, [products, productCatFilter, productShopFilter, productSearch]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
      const matchPay = orderPaymentFilter === 'all' || o.paymentStatus === orderPaymentFilter;
      const q = orderSearch.toLowerCase().trim();
      const matchQ = !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q);
      return matchStatus && matchPay && matchQ;
    });
  }, [orders, orderStatusFilter, orderPaymentFilter, orderSearch]);

  // Handlers for Products
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdForm({
      name: '',
      sku: `CRM-${(categories[0]?.id || 'PROD').toUpperCase().slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      description: '',
      price: 15000,
      discountPercent: '',
      discountPrice: '',
      category: categories[0]?.id || 'hair-beauty',
      subcategory: '',
      stock: 25,
      imageUrl: '/src/assets/images/product_hair_curl_cream_1791966366308.jpg',
      imagesText: '',
      shopName: shops[0]?.name || 'Sky Beauty',
      shopId: shops[0]?.id || '',
      brand: '',
      unit: 'Piece',
      status: 'Available',
      isFeatured: false,
      isNewArrival: true,
      isBestSeller: false,
      sizes: '',
      colors: ''
    });
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    const existingPercent = p.discountPercent || (p.discountPrice && p.price > 0 && p.discountPrice < p.price
      ? Math.round(((p.price - p.discountPrice) / p.price) * 100)
      : '');
    setProdForm({
      name: p.name,
      sku: p.sku || '',
      description: p.description,
      price: p.price,
      discountPercent: existingPercent,
      discountPrice: p.discountPrice || '',
      category: p.category,
      subcategory: p.subcategory || '',
      stock: p.stock,
      imageUrl: p.imageUrl,
      imagesText: p.images ? p.images.join('\n') : '',
      shopName: p.shopName || 'ContactReach Market',
      shopId: p.shopId || '',
      brand: p.brand || '',
      unit: p.unit || 'Piece',
      status: p.status,
      isFeatured: Boolean(p.isFeatured),
      isNewArrival: Boolean(p.isNewArrival),
      isBestSeller: Boolean(p.isBestSeller),
      sizes: p.variations?.find(v => v.name.toLowerCase() === 'size')?.options.join(', ') || '',
      colors: p.variations?.find(v => v.name.toLowerCase() === 'color')?.options.join(', ') || ''
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name.trim() || !prodForm.category || !prodForm.description.trim()) {
      showToast('Please fill all required product fields.', 'error');
      return;
    }

    const variations: ProductVariation[] = [];
    if (prodForm.sizes.trim()) {
      variations.push({
        name: 'Size',
        options: prodForm.sizes.split(',').map(s => s.trim()).filter(Boolean)
      });
    }
    if (prodForm.colors.trim()) {
      variations.push({
        name: 'Color',
        options: prodForm.colors.split(',').map(c => c.trim()).filter(Boolean)
      });
    }

    const imagesList = prodForm.imagesText.split('\n').map(s => s.trim()).filter(Boolean);
    if (!imagesList.includes(prodForm.imageUrl.trim())) {
      imagesList.unshift(prodForm.imageUrl.trim());
    }

    const finalPrice = Math.max(0, Number(prodForm.price));
    const numPercent = prodForm.discountPercent && Number(prodForm.discountPercent) > 0
      ? Math.min(99, Math.max(1, Math.round(Number(prodForm.discountPercent))))
      : undefined;
    const finalDiscountPrice = numPercent && finalPrice > 0
      ? Math.max(0, Math.round(finalPrice * (1 - numPercent / 100)))
      : undefined;

    const payload: Partial<Product> = {
      name: prodForm.name.trim(),
      sku: prodForm.sku.trim(),
      description: prodForm.description.trim(),
      price: finalPrice,
      discountPercent: numPercent,
      discountPrice: finalDiscountPrice,
      category: prodForm.category,
      subcategory: prodForm.subcategory.trim() || undefined,
      stock: Math.max(0, parseInt(String(prodForm.stock), 10) || 0),
      imageUrl: prodForm.imageUrl.trim(),
      images: imagesList,
      shopName: prodForm.shopName,
      shopId: prodForm.shopId || undefined,
      brand: prodForm.brand.trim() || undefined,
      unit: prodForm.unit.trim() || 'Piece',
      status: prodForm.status,
      isFeatured: prodForm.isFeatured,
      isNewArrival: prodForm.isNewArrival,
      isBestSeller: prodForm.isBestSeller,
      variations: variations.length > 0 ? variations : undefined
    };

    try {
      if (editingProduct) {
        await api.adminUpdateProduct(editingProduct.id, payload);
        showToast('Product updated successfully!');
      } else {
        await api.adminAddProduct(payload);
        showToast('Product created and published!');
      }
      setProductModalOpen(false);
      fetchAllData();
      onRefreshPublicData();
    } catch (err: any) {
      showToast(err.message || 'Error saving product', 'error');
    }
  };

  const handleDuplicateProduct = async (id: string) => {
    try {
      await api.adminDuplicateProduct(id);
      showToast('Product duplicated successfully!');
      fetchAllData();
      onRefreshPublicData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this product?')) return;
    try {
      await api.adminDeleteProduct(id);
      showToast('Product removed.');
      fetchAllData();
      onRefreshPublicData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Stock Adjustment
  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProduct) return;
    try {
      await api.adminAdjustStock(stockModalProduct.id, Number(stockAdjustAmount), stockAdjustReason);
      showToast(`Stock updated for ${stockModalProduct.name}`);
      setStockModalProduct(null);
      fetchAllData();
      onRefreshPublicData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Category CRUD
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<Category> = {
        nameEn: catNameEn.trim(),
        nameRw: catNameRw.trim(),
        icon: catIcon,
        description: catDesc.trim(),
        imageUrl: catImageUrl.trim() ? catImageUrl.trim() : undefined
      };

      if (editingCategory) {
        await api.adminUpdateCategory(editingCategory.id, payload);
        showToast('Category updated!');
      } else {
        await api.adminAddCategory(payload);
        showToast('Category created!');
      }
      setCategoryModalOpen(false);
      fetchAllData();
      onRefreshPublicData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(`Delete category "${id}"? Linked products must be reassigned first.`)) return;
    try {
      await api.adminDeleteCategory(id);
      showToast('Category deleted.');
      fetchAllData();
      onRefreshPublicData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Image Upload Handlers (FileReader -> base64 Data URL)
  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file too large. Please select an image under 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProdForm(prev => {
        const existingList = prev.imagesText ? prev.imagesText.split('\n').filter(Boolean) : [];
        const updatedList = [result, ...existingList.filter(u => u !== result)];
        return {
          ...prev,
          imageUrl: result,
          imagesText: updatedList.join('\n')
        };
      });
      showToast('Product image uploaded successfully!');
    };
    reader.readAsDataURL(file);
  };

  const handleCategoryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file too large. Please select an image under 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCatImageUrl(result);
      showToast('Category image uploaded!');
    };
    reader.readAsDataURL(file);
  };

  // Promo Code Create & Edit Handler
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const val = Number(coupVal);
      if (coupType === 'percentage' && (val < 1 || val > 100)) {
        showToast('Percentage discount must be between 1% and 100%.', 'error');
        return;
      }

      const payload = {
        code: coupCode.trim().toUpperCase(),
        discountType: coupType,
        discountValue: val,
        minOrderAmount: coupMin ? Number(coupMin) : undefined,
        maxDiscount: coupMaxDiscount ? Number(coupMaxDiscount) : undefined,
        expiresAt: coupExpiresAt || undefined,
        usageLimit: coupUsageLimit ? Number(coupUsageLimit) : undefined,
        isActive: coupIsActive
      };

      if (editingCoupon) {
        await api.adminUpdateCoupon(editingCoupon.id, payload);
        showToast('Promo code updated successfully!');
      } else {
        await api.adminAddCoupon(payload);
        showToast(`Promo code "${payload.code}" created!`);
      }
      setCouponModalOpen(false);
      setEditingCoupon(null);
      fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Buyer Management Handlers
  const handleToggleBuyerStatus = async (buyer: CustomerUser) => {
    const targetStatus = buyer.status === 'Suspended' ? 'Active' : 'Suspended';
    if (!confirm(`Are you sure you want to change account status for ${buyer.name} to ${targetStatus}?`)) {
      return;
    }
    try {
      await api.adminUpdateBuyerStatus(buyer.id, targetStatus);
      showToast(`Buyer status updated to ${targetStatus}`);
      fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleResetBuyerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordBuyer) return;
    if (newTempPassword.length < 5) {
      showToast('Password must be at least 5 characters long.', 'error');
      return;
    }
    setResetPasswordLoading(true);
    try {
      await api.adminResetBuyerPassword(resetPasswordBuyer.id, newTempPassword);
      showToast(`Password successfully reset for ${resetPasswordBuyer.name}!`);
      setResetPasswordBuyer(null);
      setNewTempPassword('');
      fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // Shop CRUD
  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingShop) {
        await api.adminUpdateShop(editingShop.id, shopForm);
        showToast('Shop details updated!');
      } else {
        await api.adminAddShop(shopForm);
        showToast('New shop registered and saved!');
      }
      setShopModalOpen(false);
      fetchAllData();
      onRefreshPublicData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Order Update
  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderStatusModal) return;
    try {
      await api.adminUpdateOrderStatus(orderStatusModal.id, {
        status: orderStatusModal.status,
        paymentStatus: orderStatusModal.paymentStatus,
        assignedCourier: orderStatusModal.assignedCourier,
        courierPhone: orderStatusModal.courierPhone,
        internalNotes: orderStatusModal.internalNotes
      });
      showToast(`Order #${orderStatusModal.orderNumber} updated!`);
      setOrderStatusModal(null);
      fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Payment Verification
  const handleVerifyPayment = async (action: 'approve' | 'reject', adminNotes: string) => {
    if (!verifyModalPayment) return;
    try {
      await api.adminVerifyPayment(verifyModalPayment.id, action, adminNotes);
      showToast(`Payment ${action}d successfully!`);
      setVerifyModalPayment(null);
      fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Problem Resolution
  const handleSaveProblemResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProblem) return;
    try {
      await api.adminUpdateCustomerReport(selectedProblem.id, {
        status: probStatus,
        resolution: probResolution || undefined,
        newNote: probStaffNote || undefined
      });
      showToast(`Case #${selectedProblem.caseNumber} updated!`);
      setSelectedProblem(null);
      fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };


  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-800">
      {/* Toast Feedback */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-[#121316] text-white px-4 sm:px-8 py-3.5 border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-white border border-slate-700 p-0.5 shrink-0 flex items-center justify-center">
            <img src="/logo.png" alt="ContactReach" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight">
                ContactReach <span className="text-[#FF6000]">Admin</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-600/30 text-orange-400 border border-orange-500/30">
                {currentUser?.role || 'Administrator'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Signed in: {currentUser?.name || 'Ruth (Owner)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllData}
            title="Refresh database records"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors"
          >
            <span>Storefront</span>
            <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
          </a>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 hover:text-rose-100 text-xs font-bold transition-colors cursor-pointer border border-rose-800/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col md:flex-row max-w-[1600px] w-full mx-auto">
        {/* Left Sidebar Navigation */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200/80 p-3 sm:p-4 shrink-0 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Management Portal
            </div>

            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'overview' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview & Analytics</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'products' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4" />
                <span>Products Catalog</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'products' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'categories' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderTree className="w-4 h-4" />
                <span>Categories</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'categories' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {categories.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('shops')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'shops' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Store className="w-4 h-4" />
                <span>Saved Shops</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'shops' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {shops.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'orders' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-4 h-4" />
                <span>Orders & Delivery</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'payments' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4" />
                <span>Payment Verification</span>
              </div>
              {stats.pendingVerifications > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-black bg-rose-500 text-white animate-pulse">
                  {stats.pendingVerifications}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'inventory' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4" />
                <span>Inventory & Stock</span>
              </div>
              {stats.lowStockCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black bg-amber-500 text-white">
                  {stats.lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'messages' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4" />
                <span>Messages Inbox</span>
              </div>
              {stats.unreadMessagesCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-black bg-[#FF6000] text-white">
                  {stats.unreadMessagesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('problems')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'problems' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Problems & Reports</span>
              </div>
              {stats.unresolvedProblemsCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-black bg-rose-600 text-white">
                  {stats.unresolvedProblemsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'customers' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Customers</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'customers' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {customers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('coupons')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'coupons' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4" />
                <span>Coupons & Promos</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'audit' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Audit Logs</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings' ? 'bg-[#FF6000] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4" />
                <span>Business Settings</span>
              </div>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-600">ContactReach Media Ltd</p>
            <p>Support: 0780022600</p>
            <p>Receiver: Ruth (078002260)</p>
          </div>
        </aside>

        {/* Content Body Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Executive Dashboard Overview
                </h1>
                <p className="text-xs text-slate-500">
                  Real-time operational marketplace metrics computed directly from persistent database records.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Gross Customer Sales</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                    {stats.totalSalesFrw.toLocaleString()} RWF
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold block">
                    Verified Customer Payments
                  </span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>ContactReach Commission</span>
                    <DollarSign className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-orange-600 font-mono">
                    {(stats.totalCommissionsFrw || 0).toLocaleString()} RWF
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Marketplace Net Commission Revenue
                  </span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Supplier Payables Owed</span>
                    <CreditCard className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-amber-600 font-mono">
                    {(stats.totalSupplierPayoutsOwedFrw || 0).toLocaleString()} RWF
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Pending Disbursal to Local Suppliers
                  </span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Orders & Catalog</span>
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                    {stats.totalOrders} Orders
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    {stats.activeProducts} active products · {stats.totalShops} suppliers
                  </span>
                </div>
              </div>

              {/* Action Banner for pending items */}
              {(stats.pendingVerifications > 0 || stats.unresolvedProblemsCount > 0) && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-amber-900 font-bold">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>
                      Action required: {stats.pendingVerifications} payment(s) awaiting verification and {stats.unresolvedProblemsCount} unresolved customer complaint(s).
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('payments')}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold cursor-pointer"
                    >
                      Verify Payments
                    </button>
                    <button
                      onClick={() => setActiveTab('problems')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold cursor-pointer"
                    >
                      View Complaints
                    </button>
                  </div>
                </div>
              )}

              {/* Recent Orders in Dashboard */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">Recent Customer Orders</h3>
                    <p className="text-xs text-slate-500">Live order activity across Kigali and provincial centers</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-bold text-[#FF6000] hover:underline"
                  >
                    View All Orders →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Payment</th>
                        <th className="py-2.5 px-3">Order Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 6).map(ord => (
                        <tr key={ord.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold block text-slate-800">{ord.customerName}</span>
                            <span className="text-[11px] text-slate-400">{ord.customerPhone}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-[#FF6000]">
                            {ord.totalAmount.toLocaleString()} FRW
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              ord.paymentStatus === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ord.paymentStatus === 'Pending Verification'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {ord.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800">{ord.status}</span>
                          </td>
                          <td className="py-3 px-3 text-right space-x-1">
                            <button
                              onClick={() => {
                                setOrderStatusModal(ord);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                            >
                              Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">Products Management</h1>
                  <p className="text-xs text-slate-500">Add, edit, duplicate, archive, and manage stock & variations</p>
                </div>
                <button
                  onClick={handleOpenAddProduct}
                  className="px-4 py-2.5 bg-[#FF6000] hover:bg-[#e05500] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Product</span>
                </button>
              </div>

              {/* Filters */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex flex-wrap gap-2.5 items-center justify-between text-xs">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search by name, SKU, brand, or store..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={productCatFilter}
                    onChange={(e) => setProductCatFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.nameEn} ({c.nameRw})</option>
                    ))}
                  </select>

                  <select
                    value={productShopFilter}
                    onChange={(e) => setProductShopFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  >
                    <option value="all">All Saved Shops</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Product / SKU</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Shop</th>
                        <th className="py-3 px-3">Price (FRW)</th>
                        <th className="py-3 px-3">Stock</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0"
                              />
                              <div className="max-w-xs">
                                <span className="font-bold text-slate-900 block line-clamp-1">{p.name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-mono text-slate-400 font-bold">{p.sku}</span>
                                  {p.isFeatured && <span className="px-1.5 py-0.2 rounded bg-orange-100 text-orange-800 text-[9px] font-black">Featured</span>}
                                  {p.isNewArrival && <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[9px] font-black">New</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-medium capitalize">
                            {p.category}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {p.shopName || 'ContactReach Market'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-900">{p.price.toLocaleString()} FRW</span>
                            {((p.discountPercent && p.discountPercent > 0) || (p.discountPrice && p.discountPrice < p.price)) && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[10px] font-black">
                                  -{p.discountPercent || Math.round(((p.price - (p.discountPrice || 0)) / p.price) * 100)}%
                                </span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">
                                  {(p.discountPrice || Math.round(p.price * (1 - (p.discountPercent || 0) / 100))).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => {
                                setStockModalProduct(p);
                                setStockAdjustAmount(10);
                              }}
                              className={`px-2 py-0.5 rounded-full font-mono font-bold text-xs cursor-pointer ${
                                p.stock <= 5 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                              }`}
                            >
                              {p.stock} {p.unit || 'units'}
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              p.status === 'Available' ? 'bg-emerald-100 text-emerald-800' : p.status === 'Out of Stock' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              title="Edit product"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicateProduct(p.id)}
                              title="Duplicate product"
                              className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              title="Delete product"
                              className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">Categories & Subcategories</h1>
                  <p className="text-xs text-slate-500">Organize products into customer-facing departments</p>
                </div>
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setCatNameEn('');
                    setCatNameRw('');
                    setCatIcon('Tag');
                    setCatDesc('');
                    setCategoryModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-[#FF6000] hover:bg-[#e05500] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Category</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => {
                  const prodCount = products.filter(p => p.category === cat.id).length;
                  const coverImg = getCategoryCoverImage(cat, products);
                  return (
                    <div key={cat.id} className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                            <img
                              src={coverImg}
                              alt={cat.nameEn}
                              className="w-full h-full object-cover"
                            />
                            {cat.imageUrl && (
                              <span className="absolute bottom-0 right-0 bg-[#FF6000] text-white px-1 py-0.2 rounded-tl text-[8px] font-black">
                                Custom
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="font-extrabold text-sm text-slate-900 truncate">{cat.nameEn}</h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 shrink-0">
                                {prodCount} items
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 block truncate">{cat.nameRw}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {cat.imageUrl ? '🎨 Custom Image' : '⚡ Auto product image'}
                            </span>
                          </div>
                        </div>

                        {cat.description && (
                          <p className="text-xs text-slate-500 line-clamp-2">{cat.description}</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono text-slate-400">ID: {cat.id}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setCatNameEn(cat.nameEn);
                              setCatNameRw(cat.nameRw);
                              setCatIcon(cat.icon || 'Tag');
                              setCatDesc(cat.description || '');
                              setCatImageUrl(cat.imageUrl || '');
                              setCategoryModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                          >
                            Edit & Image
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SAVED SHOPS */}
          {activeTab === 'shops' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">Multiple Saved Shops & Vendors</h1>
                  <p className="text-xs text-slate-500">Manage permanent merchant stores, contact details, and locations</p>
                </div>
                <button
                  onClick={() => {
                    setEditingShop(null);
                    setShopForm({
                      name: '',
                      category: 'Fashion & Merchandise',
                      description: '',
                      location: 'Kigali, Rwanda',
                      address: 'Fair View Plaza, Kigali',
                      phone: '0780022600',
                      email: 'contactreachmedialimited@gmail.com',
                      deliveryInfo: 'Express same-day Kigali delivery',
                      logo: 'ShoppingBag',
                      bannerColor: 'from-orange-500 to-amber-600'
                    });
                    setShopModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-[#FF6000] hover:bg-[#e05500] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Saved Shop</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shops.map(shop => {
                  const shopProds = products.filter(p => p.shopId === shop.id || p.shopName === shop.name);
                  return (
                    <div key={shop.id} className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
                      <div className={`h-14 bg-gradient-to-r ${shop.bannerColor} p-3 flex items-center justify-between text-white`}>
                        <span className="font-extrabold text-sm">{shop.name}</span>
                        {shop.isVerified && (
                          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="p-4 space-y-3 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400">Category</span>
                          <p className="font-bold text-slate-800">{shop.category}</p>
                        </div>
                        <p className="text-slate-500 line-clamp-2">{shop.description}</p>
                        <div className="space-y-1 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{shop.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{shop.phone || '0780022600'}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="font-bold text-slate-700">{shopProds.length} products listed</span>
                          <button
                            onClick={() => {
                              setEditingShop(shop);
                              setShopForm({
                                name: shop.name,
                                category: shop.category,
                                description: shop.description,
                                location: shop.location,
                                address: shop.address || '',
                                phone: shop.phone || '0780022600',
                                email: shop.email || 'contactreachmedialimited@gmail.com',
                                deliveryInfo: shop.deliveryInfo || 'Kigali delivery',
                                logo: shop.logo,
                                bannerColor: shop.bannerColor
                              });
                              setShopModalOpen(true);
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg cursor-pointer"
                          >
                            Edit Shop
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: ORDERS & DELIVERIES */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">Orders & Delivery Management</h1>
                  <p className="text-xs text-slate-500">Track shipments, assign dispatch couriers, and generate invoices</p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex flex-wrap gap-2.5 items-center justify-between text-xs">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search by order CRM-..., name, or phone..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  >
                    <option value="all">All Order Statuses</option>
                    <option value="New">New</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Preparing">Preparing</option>
                    <option value="Ready for Delivery">Ready for Delivery</option>
                    <option value="Out for Delivery">Out for Delivery</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>

                  <select
                    value={orderPaymentFilter}
                    onChange={(e) => setOrderPaymentFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="Pending Payment">Pending Payment</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Order #</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Delivery Destination</th>
                        <th className="py-3 px-3">Total Amount</th>
                        <th className="py-3 px-3">Payment</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.map(ord => (
                        <tr key={ord.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(ord.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 block">{ord.customerName}</span>
                            <span className="text-[11px] text-slate-500">{ord.customerPhone}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                            {ord.deliveryAddress}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-[#FF6000]">
                            {ord.totalAmount.toLocaleString()} FRW
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              ord.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : ord.paymentStatus === 'Pending Verification' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {ord.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800">{ord.status}</span>
                            {ord.assignedCourier && (
                              <span className="block text-[10px] text-slate-400">Courier: {ord.assignedCourier}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => setOrderStatusModal(ord)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg cursor-pointer"
                            >
                              Update Status
                            </button>
                            <button
                              onClick={() => setPrintableInvoiceOrder(ord)}
                              title="Invoice"
                              className="p-1 text-slate-500 hover:text-slate-800"
                            >
                              <FileText className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PAYMENT VERIFICATION */}
          {activeTab === 'payments' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Mobile Money & Payment Verification</h1>
                <p className="text-xs text-slate-500">Audit customer payment submissions against telecom statements</p>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Order #</th>
                        <th className="py-3 px-3">Sender Phone</th>
                        <th className="py-3 px-3">Method</th>
                        <th className="py-3 px-3">Txn ID / Reference</th>
                        <th className="py-3 px-3">Amount Paid</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map(pm => (
                        <tr key={pm.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {pm.orderNumber}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800 font-mono">
                            {pm.paymentPhone}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-600">
                            {pm.paymentMethod}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-blue-600">
                            {pm.transactionId}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {pm.amountPaid.toLocaleString()} FRW
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              pm.verificationStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' : pm.verificationStatus === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {pm.verificationStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {pm.verificationStatus === 'Pending Review' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleVerifyPayment('approve', 'Verified with MTN/Airtel statement')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleVerifyPayment('reject', 'Transaction reference not found in records')}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">Verified by {pm.verifiedBy || 'Ruth'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: INVENTORY & STOCK LOGS */}
          {activeTab === 'inventory' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Inventory & Stock Movement Audit</h1>
                <p className="text-xs text-slate-500">Complete traceability of stock received, deducted, or restored</p>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Date / Time</th>
                        <th className="py-3 px-3">Product Name</th>
                        <th className="py-3 px-3">Previous</th>
                        <th className="py-3 px-3">Change</th>
                        <th className="py-3 px-3">New Stock</th>
                        <th className="py-3 px-3">Reason / Trigger</th>
                        <th className="py-3 px-4">Authorized By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inventoryLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800 max-w-xs truncate">
                            {log.productName}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-slate-500">
                            {log.previousStock}
                          </td>
                          <td className="py-3 px-3 font-mono font-extrabold">
                            <span className={log.changeAmount > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {log.changeAmount > 0 ? `+${log.changeAmount}` : log.changeAmount}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-extrabold text-slate-900">
                            {log.newStock}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {log.reason}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {log.adminName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: MESSAGES INBOX */}
          {activeTab === 'messages' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Admin Messages Inbox</h1>
                <p className="text-xs text-slate-500">Customer contact inquiries, wholesale requests, and general messages</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`p-5 rounded-2xl border bg-white shadow-2xs space-y-3 ${
                    msg.status === 'unread' ? 'border-orange-300 ring-1 ring-orange-200' : 'border-slate-200'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">{msg.name}</span>
                          <span className="text-xs text-slate-500">({msg.email})</span>
                          {msg.status === 'unread' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#FF6000] text-white uppercase">
                              Unread
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          Phone: {msg.phone || 'N/A'} {msg.orderNumber && `· Ref: ${msg.orderNumber}`}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-slate-800 mb-1">{msg.subject}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {msg.message}
                      </p>
                    </div>

                    {msg.replyNote && (
                      <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950">
                        <span className="font-bold block text-[11px]">Staff Reply Note (by {msg.repliedBy}):</span>
                        <p>{msg.replyNote}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {msg.status === 'unread' && (
                        <button
                          onClick={async () => {
                            await api.adminUpdateMessage(msg.id, { status: 'read' });
                            showToast('Marked as read');
                            fetchAllData();
                          }}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const note = prompt('Enter staff resolution or reply note:');
                          if (note) {
                            await api.adminUpdateMessage(msg.id, { replyNote: note });
                            showToast('Reply logged!');
                            fetchAllData();
                          }
                        }}
                        className="px-3 py-1 bg-[#121316] hover:bg-black text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        Add Reply Note
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: PROBLEMS & COMPLAINTS */}
          {activeTab === 'problems' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Customer Problems, Complaints & Reports</h1>
                <p className="text-xs text-slate-500">Track cases, assign investigators, and document official resolutions</p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {problems.map(prob => (
                  <div key={prob.id} className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                            {prob.caseNumber}
                          </span>
                          <span className="font-extrabold text-sm text-slate-900">{prob.customerName}</span>
                          <span className="text-xs text-slate-500">({prob.customerPhone})</span>
                        </div>
                        <span className="text-[11px] text-slate-400 capitalize">
                          Category: {prob.category.replace('_', ' ')} {prob.orderNumber && `· Order #${prob.orderNumber}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          prob.priority === 'urgent' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {prob.priority}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          prob.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {prob.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {prob.description}
                    </p>

                    {prob.resolution && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                        <span className="font-bold block text-[11px]">Official Resolution:</span>
                        <p>{prob.resolution}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Logged: {new Date(prob.createdAt).toLocaleString()} · Assigned: {prob.assignedTo || 'Unassigned'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedProblem(prob);
                          setProbStatus(prob.status);
                          setProbResolution(prob.resolution || '');
                          setProbStaffNote('');
                        }}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Manage & Resolve Case
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 10: CUSTOMERS & REGISTERED BUYERS */}
          {activeTab === 'customers' && (() => {
            const registeredBuyers = customers.filter(c => c.isRegisteredBuyer || Boolean(c.passwordHash) || c.accountType === 'buyer');
            const guestCustomers = customers.filter(c => !c.isRegisteredBuyer && !c.passwordHash && c.accountType !== 'buyer');
            const activeAccounts = customers.filter(c => c.status !== 'Suspended');
            const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);

            const filteredCustomers = customers.filter(c => {
              // Type filter
              if (customerFilter === 'buyers' && (!c.isRegisteredBuyer && !c.passwordHash && c.accountType !== 'buyer')) return false;
              if (customerFilter === 'guests' && (c.isRegisteredBuyer || Boolean(c.passwordHash) || c.accountType === 'buyer')) return false;

              // Search query
              if (!customerSearch.trim()) return true;
              const q = customerSearch.toLowerCase().trim();
              const cleanQ = q.replace(/\D/g, '');
              const cleanPhone = c.phone.replace(/\D/g, '');
              const phoneMatch = cleanQ.length > 0 && cleanPhone.includes(cleanQ);
              const nameMatch = c.name.toLowerCase().includes(q);
              const emailMatch = c.email?.toLowerCase().includes(q);
              const addressMatch = c.deliveryAddress?.toLowerCase().includes(q);
              return phoneMatch || nameMatch || emailMatch || addressMatch;
            });

            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Customer & Buyer Directory</h1>
                    <p className="text-xs text-slate-500">
                      Manage registered buyers, 5-digit PIN security accounts, customer phone numbers, and full purchase histories.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      fetchAllData();
                      showToast('Customer directory refreshed');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Customers</span>
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-xl font-black text-slate-900 mt-1">{customers.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Phone numbers recorded</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">5-Digit PIN Buyers</span>
                      <KeyRound className="w-4 h-4 text-[#FF6000]" />
                    </div>
                    <p className="text-xl font-black text-[#FF6000] mt-1">{registeredBuyers.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">With secure password account</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Accounts</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-xl font-black text-emerald-600 mt-1">{activeAccounts.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Eligible for fast checkout</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Customer Volume</span>
                      <DollarSign className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-lg font-black text-slate-900 mt-1">{totalRevenue.toLocaleString()} FRW</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Gross historical purchases</p>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search customer by name, phone (e.g. 078...), email, or location..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6000] focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto p-0.5 bg-slate-100 rounded-xl text-xs font-bold shrink-0">
                    <button
                      onClick={() => setCustomerFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        customerFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({customers.length})
                    </button>
                    <button
                      onClick={() => setCustomerFilter('buyers')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                        customerFilter === 'buyers'
                          ? 'bg-white text-[#FF6000] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Registered ({registeredBuyers.length})</span>
                    </button>
                    <button
                      onClick={() => setCustomerFilter('guests')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        customerFilter === 'guests'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Guests ({guestCustomers.length})
                    </button>
                  </div>
                </div>

                {/* Customer Table */}
                <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="py-3 px-4">Customer / Buyer</th>
                          <th className="py-3 px-3">Phone Number</th>
                          <th className="py-3 px-3">Account Security</th>
                          <th className="py-3 px-3">Delivery Address</th>
                          <th className="py-3 px-3">Orders</th>
                          <th className="py-3 px-3">Total Spent</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCustomers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400">
                              No customer records found matching your query.
                            </td>
                          </tr>
                        ) : (
                          filteredCustomers.map(c => {
                            const isRegistered = c.isRegisteredBuyer || Boolean(c.passwordHash) || c.accountType === 'buyer';
                            const isSuspended = c.status === 'Suspended';

                            return (
                              <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                                {/* Name and Avatar */}
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                                      {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 leading-tight">{c.name}</p>
                                      {c.email ? (
                                        <p className="text-[10px] text-slate-400">{c.email}</p>
                                      ) : (
                                        <p className="text-[10px] text-slate-400">ID: {c.id.slice(0, 12)}</p>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Phone */}
                                <td className="py-3.5 px-3">
                                  <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                                    <Phone className="w-3 h-3 text-[#FF6000] shrink-0" />
                                    <span>{c.phone}</span>
                                  </div>
                                  <a
                                    href={`https://wa.me/25${c.phone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-emerald-600 hover:underline inline-block font-semibold"
                                  >
                                    WhatsApp
                                  </a>
                                </td>

                                {/* Account Security */}
                                <td className="py-3.5 px-3">
                                  {isRegistered ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-50 border border-orange-200 text-[#FF6000]">
                                      <KeyRound className="w-3 h-3" />
                                      <span>5-Digit Password Account</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                      Guest Checkout
                                    </span>
                                  )}
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}
                                  </p>
                                </td>

                                {/* Delivery Address */}
                                <td className="py-3.5 px-3 text-slate-600 max-w-xs">
                                  <div className="flex items-start gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                    <span className="truncate">{c.deliveryAddress || 'Kigali Area'}</span>
                                  </div>
                                </td>

                                {/* Orders */}
                                <td className="py-3.5 px-3 font-mono font-bold text-blue-600">
                                  <span className="bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80">
                                    {c.totalOrders || 0}
                                  </span>
                                </td>

                                {/* Total Spent */}
                                <td className="py-3.5 px-3 font-mono font-extrabold text-[#FF6000]">
                                  {(c.totalSpent || 0).toLocaleString()} FRW
                                </td>

                                {/* Status */}
                                <td className="py-3.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                      isSuspended
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {c.status || 'Active'}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={async () => {
                                        setLoadingCustomerDetail(true);
                                        try {
                                          const detail = await api.adminGetCustomerById(c.id);
                                          if (detail) {
                                            setSelectedCustomerDetail(detail);
                                          } else {
                                            setSelectedCustomerDetail({ customer: c, orders: [] });
                                          }
                                        } catch {
                                          setSelectedCustomerDetail({ customer: c, orders: [] });
                                        } finally {
                                          setLoadingCustomerDetail(false);
                                        }
                                      }}
                                      className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-[#FF6000] hover:bg-orange-50 transition-colors cursor-pointer"
                                      title="View Full Profile and Orders"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>

                                    {isRegistered && (
                                      <button
                                        onClick={() => {
                                          setResetPinCustomer(c);
                                          setTempPin('');
                                          setPinActionMessage(null);
                                        }}
                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                        title="Reset 5-Digit Password"
                                      >
                                        <Lock className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    <button
                                      onClick={async () => {
                                        const nextStatus = isSuspended ? 'Active' : 'Suspended';
                                        try {
                                          await api.adminUpdateBuyerStatus(c.id, nextStatus);
                                          c.status = nextStatus;
                                          showToast(`Buyer status set to ${nextStatus}`);
                                          fetchAllData();
                                        } catch (err: any) {
                                          alert(err.message || 'Failed to update status');
                                        }
                                      }}
                                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                        isSuspended
                                          ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                          : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                      }`}
                                      title={isSuspended ? 'Activate Account' : 'Suspend Account'}
                                    >
                                      {isSuspended ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      ) : (
                                        <XCircle className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 11: COUPONS */}
          {activeTab === 'coupons' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">Discounts & Promo Codes</h1>
                  <p className="text-xs text-slate-500">Create promotional codes verified securely on checkout</p>
                </div>
                <button
                  onClick={() => {
                    setCoupCode('');
                    setCoupType('fixed');
                    setCoupVal(2000);
                    setCoupMin(15000);
                    setCouponModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-[#FF6000] hover:bg-[#e05500] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Coupon</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons.map(coup => (
                  <div key={coup.id} className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-base text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                        {coup.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="font-extrabold text-slate-900">
                        {coup.discountType === 'percentage' ? `${coup.discountValue}% OFF` : `${coup.discountValue.toLocaleString()} FRW OFF`}
                      </p>
                      {coup.minOrderAmount && (
                        <p className="text-slate-500">Min Order: {coup.minOrderAmount.toLocaleString()} FRW</p>
                      )}
                      <p className="text-slate-400 text-[11px] font-mono">Times used: {coup.timesUsed}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={async () => {
                          if (confirm(`Delete coupon ${coup.code}?`)) {
                            await api.adminDeleteCoupon(coup.id);
                            showToast('Coupon removed');
                            fetchAllData();
                          }
                        }}
                        className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 12: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">System Audit Trail</h1>
                <p className="text-xs text-slate-500">Immutable chronological log of all administrator operations</p>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-3">Administrator</th>
                        <th className="py-3 px-3">Action</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 block">{log.adminName}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{log.adminRole}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-orange-600">
                            {log.action}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 13: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Marketplace Settings & Business Configuration</h1>
                <p className="text-xs text-slate-500">Update business information, payment receiver numbers, and delivery rates</p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company / Marketplace Name</label>
                  <input
                    type="text"
                    value={settings?.marketName || ''}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, marketName: e.target.value } : null)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Support Email</label>
                    <input
                      type="email"
                      value={settings?.email || 'contactreachmedialimited@gmail.com'}
                      onChange={(e) => setSettings(prev => prev ? { ...prev, email: e.target.value } : null)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Support Phone</label>
                    <input
                      type="text"
                      value={settings?.phone || '0780022600'}
                      onChange={(e) => setSettings(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">MoMo Receiver Name</label>
                    <input
                      type="text"
                      value={settings?.receiverName || 'Ruth'}
                      onChange={(e) => setSettings(prev => prev ? { ...prev, receiverName: e.target.value } : null)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Receiver Phone (MoMo)</label>
                    <input
                      type="text"
                      value={settings?.paymentNumber || '078002260'}
                      onChange={(e) => setSettings(prev => prev ? { ...prev, paymentNumber: e.target.value } : null)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">MTN Merchant Code</label>
                    <input
                      type="text"
                      value={settings?.merchantCode || '078002'}
                      onChange={(e) => setSettings(prev => prev ? { ...prev, merchantCode: e.target.value } : null)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Standard Kigali Delivery Fee (FRW)</label>
                    <input
                      type="number"
                      value={settings?.deliveryFeeKigali || 1500}
                      onChange={(e) => setSettings(prev => prev ? { ...prev, deliveryFeeKigali: Number(e.target.value) } : null)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Upcountry Delivery Fee (FRW)</label>
                    <input
                      type="number"
                      value={settings?.deliveryFeeUpcountry || 3500}
                      onChange={(e) => setSettings(prev => prev ? { ...prev, deliveryFeeUpcountry: Number(e.target.value) } : null)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={async () => {
                      if (settings) {
                        await api.adminUpdateSettings(settings);
                        showToast('Settings saved to database!');
                        fetchAllData();
                        onRefreshPublicData();
                      }
                    }}
                    className="px-6 py-3 bg-[#FF6000] hover:bg-[#e05500] text-white font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    Save Marketplace Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: PRODUCT ADD / EDIT */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative border border-slate-200 flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-black text-base text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setProductModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={prodForm.name}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                  placeholder="e.g. Disposable Salon Neck Strips"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unique SKU Code</label>
                  <input
                    type="text"
                    value={prodForm.sku}
                    onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={prodForm.brand}
                    onChange={(e) => setProdForm({ ...prodForm, brand: e.target.value })}
                    placeholder="e.g. Cantu, Samsung, Nike"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (FRW) *</label>
                  <input
                    type="number"
                    required
                    value={prodForm.price}
                    onChange={(e) => {
                      const newPrice = e.target.value;
                      const priceNum = Number(newPrice) || 0;
                      const numPct = Number(prodForm.discountPercent) || 0;
                      const calcDiscountPrice = (numPct > 0 && priceNum > 0)
                        ? Math.max(0, Math.round(priceNum * (1 - numPct / 100)))
                        : '';
                      setProdForm({ ...prodForm, price: newPrice, discountPrice: calcDiscountPrice });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Discount Percentage (%)</label>
                    {prodForm.discountPercent && Number(prodForm.discountPercent) > 0 && (
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        {prodForm.discountPercent}% OFF
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={prodForm.discountPercent}
                      onChange={(e) => {
                        const pct = e.target.value;
                        const numPct = Number(pct);
                        const priceNum = Number(prodForm.price) || 0;
                        const calcDiscountPrice = (pct !== '' && numPct > 0 && priceNum > 0)
                          ? Math.max(0, Math.round(priceNum * (1 - numPct / 100)))
                          : '';
                        setProdForm({
                          ...prodForm,
                          discountPercent: pct,
                          discountPrice: calcDiscountPrice
                        });
                      }}
                      placeholder="e.g. 15 for 15% OFF"
                      className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-slate-300 font-mono text-emerald-600 font-bold"
                    />
                    <span className="absolute right-3.5 top-2.5 font-bold text-slate-400 pointer-events-none">%</span>
                  </div>

                  {/* Quick percentage discount presets */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {[5, 10, 15, 20, 25, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const priceNum = Number(prodForm.price) || 0;
                          const calcDiscountPrice = priceNum > 0 ? Math.max(0, Math.round(priceNum * (1 - preset / 100))) : '';
                          setProdForm({
                            ...prodForm,
                            discountPercent: preset,
                            discountPrice: calcDiscountPrice
                          });
                        }}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                          Number(prodForm.discountPercent) === preset
                            ? 'bg-[#FF6000] text-white border-orange-600'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                    {prodForm.discountPercent !== '' && (
                      <button
                        type="button"
                        onClick={() => setProdForm({ ...prodForm, discountPercent: '', discountPrice: '' })}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        None
                      </button>
                    )}
                  </div>

                  {prodForm.discountPercent && Number(prodForm.discountPercent) > 0 && Number(prodForm.price) > 0 && (
                    <div className="mt-1.5 p-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-[10px] text-emerald-800 font-medium">
                      Promo price: <span className="font-mono font-bold">{Math.max(0, Math.round(Number(prodForm.price) * (1 - Number(prodForm.discountPercent) / 100))).toLocaleString()} FRW</span>
                      <span className="text-slate-500 block">Save {(Number(prodForm.price) - Math.round(Number(prodForm.price) * (1 - Number(prodForm.discountPercent) / 100))).toLocaleString()} FRW ({prodForm.discountPercent}% off)</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    value={prodForm.stock}
                    onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={prodForm.category}
                    onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.nameEn} ({c.nameRw})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Saved Shop</label>
                  <select
                    value={prodForm.shopName}
                    onChange={(e) => {
                      const shp = shops.find(s => s.name === e.target.value);
                      setProdForm({ ...prodForm, shopName: e.target.value, shopId: shp?.id || '' });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold"
                  >
                    {shops.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.location})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-700">
                  Product Image * <span className="font-normal text-xs text-slate-500">(Upload from device or enter valid public image URL)</span>
                </label>

                {/* Upload or URL Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-50 hover:bg-orange-100 text-[#FF6000] border-2 border-dashed border-orange-200 rounded-xl cursor-pointer font-bold text-xs transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>Upload Image File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={prodForm.imageUrl}
                      onChange={(e) => setProdForm({ ...prodForm, imageUrl: e.target.value })}
                      placeholder="https://... or image URL"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Live Image Preview */}
                {prodForm.imageUrl && (
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={prodForm.imageUrl}
                        alt="Product Preview"
                        className="w-14 h-14 object-cover rounded-xl border border-slate-200 bg-white shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).setAttribute('src', '/src/assets/images/hero_marketplace_shopper_1791966365592.jpg');
                        }}
                      />
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Active Primary Image</span>
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
                          {prodForm.imageUrl.startsWith('data:') ? 'Uploaded local file (Base64)' : prodForm.imageUrl}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProdForm({ ...prodForm, imageUrl: '' })}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Available Sizes (comma separated)</label>
                  <input
                    type="text"
                    value={prodForm.sizes}
                    onChange={(e) => setProdForm({ ...prodForm, sizes: e.target.value })}
                    placeholder="e.g. S, M, L, XL, 38, 40, 42"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Available Colors (comma separated)</label>
                  <input
                    type="text"
                    value={prodForm.colors}
                    onChange={(e) => setProdForm({ ...prodForm, colors: e.target.value })}
                    placeholder="e.g. Black, White, Navy Blue"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Description *</label>
                <textarea
                  rows={4}
                  required
                  value={prodForm.description}
                  onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                  placeholder="Comprehensive specifications, materials, and usage details..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={prodForm.isFeatured}
                    onChange={(e) => setProdForm({ ...prodForm, isFeatured: e.target.checked })}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>Featured Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={prodForm.isNewArrival}
                    onChange={(e) => setProdForm({ ...prodForm, isNewArrival: e.target.checked })}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>New Arrival</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={prodForm.isBestSeller}
                    onChange={(e) => setProdForm({ ...prodForm, isBestSeller: e.target.checked })}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>Best Seller</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#FF6000] hover:bg-[#e05500] text-white font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  {editingProduct ? 'Save Changes' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ORDER STATUS & DISPATCH */}
      {orderStatusModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  Update Order #{orderStatusModal.orderNumber}
                </h3>
                <span className="text-slate-500">{orderStatusModal.customerName} · {orderStatusModal.totalAmount.toLocaleString()} FRW</span>
              </div>
              <button onClick={() => setOrderStatusModal(null)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOrderStatus} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Order Pipeline Status</label>
                <select
                  value={orderStatusModal.status}
                  onChange={(e) => setOrderStatusModal({ ...orderStatusModal, status: e.target.value as OrderStatus })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                >
                  <option value="New">New (Awaiting confirmation)</option>
                  <option value="Confirmed">Confirmed (Payment verified & stock allocated)</option>
                  <option value="Preparing">Preparing (Packing at warehouse)</option>
                  <option value="Ready for Delivery">Ready for Delivery / Ready for Pickup</option>
                  <option value="Out for Delivery">Out for Delivery (With courier)</option>
                  <option value="Delivered">Delivered (Successfully completed)</option>
                  <option value="Cancelled">Cancelled (Restore stock)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Status</label>
                <select
                  value={orderStatusModal.paymentStatus}
                  onChange={(e) => setOrderStatusModal({ ...orderStatusModal, paymentStatus: e.target.value as PaymentStatus })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                >
                  <option value="Pending Payment">Pending Payment</option>
                  <option value="Pending Verification">Pending Verification (Reviewing transaction)</option>
                  <option value="Paid">Paid (Confirmed in MTN/Airtel)</option>
                  <option value="Failed">Failed</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Courier</label>
                  <input
                    type="text"
                    value={orderStatusModal.assignedCourier || ''}
                    onChange={(e) => setOrderStatusModal({ ...orderStatusModal, assignedCourier: e.target.value })}
                    placeholder="e.g. Patrick (Moto Express)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Courier Phone</label>
                  <input
                    type="text"
                    value={orderStatusModal.courierPhone || ''}
                    onChange={(e) => setOrderStatusModal({ ...orderStatusModal, courierPhone: e.target.value })}
                    placeholder="078..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Internal Staff Note</label>
                <input
                  type="text"
                  value={orderStatusModal.internalNotes || ''}
                  onChange={(e) => setOrderStatusModal({ ...orderStatusModal, internalNotes: e.target.value })}
                  placeholder="e.g. Delivered to reception desk at Kimironko"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOrderStatusModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: INVOICE PRINT VIEW */}
      {printableInvoiceOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="ContactReach" className="w-10 h-10 rounded-full border border-slate-200" />
                <div>
                  <h3 className="font-black text-base text-slate-900">ContactReach Market</h3>
                  <span className="text-[10px] text-slate-400 font-mono">ContactReach Media Ltd · Kigali, Rwanda</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-lg text-slate-900 block">{printableInvoiceOrder.orderNumber}</span>
                <span className="text-[10px] text-slate-400 font-mono">{new Date(printableInvoiceOrder.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Billed To (Customer):</span>
                <p className="font-extrabold text-slate-900 text-sm">{printableInvoiceOrder.customerName}</p>
                <p className="text-slate-600 font-mono">{printableInvoiceOrder.customerPhone}</p>
                <p className="text-slate-500">{printableInvoiceOrder.deliveryAddress}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Payment Method:</span>
                <p className="font-bold text-slate-800">{printableInvoiceOrder.paymentMethod}</p>
                <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-black uppercase ${
                  printableInvoiceOrder.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {printableInvoiceOrder.paymentStatus}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400">
                  <tr>
                    <th className="p-3">Item Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printableInvoiceOrder.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-bold text-slate-800">{item.productName}</td>
                      <td className="p-3 text-center font-mono">{item.quantity}</td>
                      <td className="p-3 text-right font-mono">{item.price.toLocaleString()} FRW</td>
                      <td className="p-3 text-right font-mono font-bold">{(item.price * item.quantity).toLocaleString()} FRW</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">{printableInvoiceOrder.subtotal.toLocaleString()} FRW</span>
                </div>
                {printableInvoiceOrder.discountAmount && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount ({printableInvoiceOrder.couponCode || 'Promo'}):</span>
                    <span className="font-mono">-{printableInvoiceOrder.discountAmount.toLocaleString()} FRW</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Fee:</span>
                  <span className="font-mono">{printableInvoiceOrder.deliveryFee.toLocaleString()} FRW</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Due / Paid:</span>
                  <span className="font-mono text-[#FF6000]">{printableInvoiceOrder.totalAmount.toLocaleString()} FRW</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Support: 0780022600 · contactreachmedialimited@gmail.com</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Invoice</span>
                </button>
                <button
                  onClick={() => setPrintableInvoiceOrder(null)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: STOCK ADJUSTMENT */}
      {stockModalProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">Adjust Inventory Stock</h3>
                <span className="text-slate-500 font-semibold">{stockModalProduct.name}</span>
              </div>
              <button onClick={() => setStockModalProduct(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-xl flex justify-between font-bold">
                <span>Current Stock on Record:</span>
                <span className="font-mono text-slate-900">{stockModalProduct.stock} units</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Quantity to Add or Deduct (use negative to deduct)
                </label>
                <input
                  type="number"
                  required
                  value={stockAdjustAmount}
                  onChange={(e) => setStockAdjustAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Stock Adjustment *</label>
                <input
                  type="text"
                  required
                  value={stockAdjustReason}
                  onChange={(e) => setStockAdjustReason(e.target.value)}
                  placeholder="e.g. Supplier restocking, warehouse damaged box, return intake"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockModalProduct(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF6000] text-white font-bold rounded-xl"
                >
                  Save Stock Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CATEGORY EDITOR */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <button onClick={() => setCategoryModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name (English) *</label>
                <input
                  type="text"
                  required
                  value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  placeholder="e.g. Footwear & Shoes"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name (Kinyarwanda) *</label>
                <input
                  type="text"
                  required
                  value={catNameRw}
                  onChange={(e) => setCatNameRw(e.target.value)}
                  placeholder="e.g. Inkweto"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                />
              </div>

              {/* Category Cover Image Section */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700">
                    Category Image
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {catImageUrl ? '🎨 Custom Image Active' : '⚡ Auto Product Image Active'}
                  </span>
                </div>

                {/* Auto-detected preview notice */}
                {!catImageUrl && editingCategory && (
                  <div className="p-2.5 bg-orange-50/70 rounded-xl border border-orange-200/80 flex items-center gap-3">
                    {(() => {
                      const autoInfo = getCategoryImageSource(editingCategory, products);
                      return (
                        <>
                          <img
                            src={autoInfo.image}
                            alt={editingCategory.nameEn}
                            className="w-12 h-12 rounded-lg object-cover border border-orange-200 bg-white shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).setAttribute('src', '/src/assets/images/hero_marketplace_shopper_1791966365592.jpg');
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-800 block">
                              Auto-Selected from Products
                            </span>
                            <p className="text-[10px] text-slate-500 truncate">
                              {autoInfo.sourceLabel}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Custom Image Preview if set */}
                {catImageUrl && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={catImageUrl}
                        alt="Custom Category"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).setAttribute('src', '/src/assets/images/hero_marketplace_shopper_1791966365592.jpg');
                        }}
                      />
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Custom Category Image</span>
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
                          {catImageUrl.startsWith('data:') ? 'Uploaded local image file' : catImageUrl}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCatImageUrl('')}
                      className="text-[11px] text-[#FF6000] hover:underline font-bold shrink-0 cursor-pointer"
                    >
                      Reset to Auto
                    </button>
                  </div>
                )}

                {/* Customization Controls: Upload or URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer font-bold text-xs transition-colors">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload Custom File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCategoryImageUpload}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={catImageUrl}
                    onChange={(e) => setCatImageUrl(e.target.value)}
                    placeholder="Or enter image URL..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF6000] text-white font-bold rounded-xl"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: SHOP EDITOR */}
      {shopModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">
                {editingShop ? 'Edit Shop' : 'Register New Saved Shop'}
              </h3>
              <button onClick={() => setShopModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShop} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Shop Name *</label>
                <input
                  type="text"
                  required
                  value={shopForm.name}
                  onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                  placeholder="e.g. Kigali Tech Hub"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Specialty / Category</label>
                <input
                  type="text"
                  value={shopForm.category}
                  onChange={(e) => setShopForm({ ...shopForm, category: e.target.value })}
                  placeholder="e.g. Electronics & TV"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={shopForm.phone}
                    onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={shopForm.location}
                    onChange={(e) => setShopForm({ ...shopForm, location: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Shop Description</label>
                <textarea
                  rows={2}
                  value={shopForm.description}
                  onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShopModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF6000] text-white font-bold rounded-xl"
                >
                  Save Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: PROBLEM RESOLUTION */}
      {selectedProblem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">Manage Case #{selectedProblem.caseNumber}</h3>
                <span className="text-slate-500 font-bold">{selectedProblem.customerName} · {selectedProblem.customerPhone}</span>
              </div>
              <button onClick={() => setSelectedProblem(null)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProblemResolution} className="space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-700 block">Customer Reported Description:</span>
                <p className="text-slate-600">{selectedProblem.description}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Case Status</label>
                <select
                  value={probStatus}
                  onChange={(e) => setProbStatus(e.target.value as ProblemStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                >
                  <option value="New">New</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Awaiting Customer">Awaiting Customer</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Official Resolution Message</label>
                <textarea
                  rows={3}
                  value={probResolution}
                  onChange={(e) => setProbResolution(e.target.value)}
                  placeholder="State the resolution outcome (e.g. verified on statement, package redelivered via express courier)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Internal Investigation Note</label>
                <input
                  type="text"
                  value={probStaffNote}
                  onChange={(e) => setProbStaffNote(e.target.value)}
                  placeholder="Private internal note visible only to staff"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProblem(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl"
                >
                  Save Case Outcome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: COUPON MODAL */}
      {couponModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">Create Promo Coupon</h3>
              <button onClick={() => setCouponModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={coupCode}
                  onChange={(e) => setCoupCode(e.target.value.toUpperCase())}
                  placeholder="e.g. RAMADAN20, FLASH5000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discount Type</label>
                  <select
                    value={coupType}
                    onChange={(e) => setCoupType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                  >
                    <option value="percentage">Percentage % (Recommended)</option>
                    <option value="fixed">Fixed FRW</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {coupType === 'percentage' ? 'Discount Percentage (%) *' : 'Discount Value (FRW) *'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={coupType === 'percentage' ? 1 : 100}
                      max={coupType === 'percentage' ? 100 : undefined}
                      value={coupVal}
                      onChange={(e) => setCoupVal(e.target.value)}
                      placeholder={coupType === 'percentage' ? 'e.g. 15 for 15%' : 'e.g. 2000'}
                      className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-slate-300 font-mono font-bold"
                    />
                    {coupType === 'percentage' && (
                      <span className="absolute right-3.5 top-2.5 font-bold text-slate-400 pointer-events-none">%</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Minimum Order Amount (FRW)</label>
                <input
                  type="number"
                  value={coupMin}
                  onChange={(e) => setCoupMin(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCouponModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF6000] text-white font-bold rounded-xl"
                >
                  Publish Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail Profile Modal */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl relative border border-slate-200 space-y-5">
            <button
              onClick={() => setSelectedCustomerDetail(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF6000] to-amber-500 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
                {selectedCustomerDetail.customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 truncate">
                    {selectedCustomerDetail.customer.name}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      selectedCustomerDetail.customer.status === 'Suspended'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedCustomerDetail.customer.status || 'Active'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 mt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-[#FF6000]" />
                    {selectedCustomerDetail.customer.phone}
                  </span>
                  {selectedCustomerDetail.customer.email && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                      {selectedCustomerDetail.customer.email}
                    </span>
                  )}
                  {selectedCustomerDetail.customer.isRegisteredBuyer && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#FF6000] font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                      <KeyRound className="w-3 h-3" />
                      5-Digit Password Account
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Orders</span>
                <span className="text-lg font-black text-blue-600 font-mono mt-0.5 block">
                  {selectedCustomerDetail.orders?.length || selectedCustomerDetail.customer.totalOrders || 0}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Spent</span>
                <span className="text-base font-black text-[#FF6000] font-mono mt-0.5 block">
                  {(selectedCustomerDetail.customer.totalSpent || 0).toLocaleString()} FRW
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Registered On</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                  {selectedCustomerDetail.customer.createdAt ? new Date(selectedCustomerDetail.customer.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Last Active</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                  {selectedCustomerDetail.customer.lastLogin ? new Date(selectedCustomerDetail.customer.lastLogin).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#FF6000] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Delivery Address</span>
                <p className="text-slate-600 mt-0.5">
                  {selectedCustomerDetail.customer.deliveryAddress || 'No address registered yet.'}
                </p>
              </div>
            </div>

            {/* Purchase History */}
            <div>
              <h3 className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between">
                <span>Associated Order History ({selectedCustomerDetail.orders?.length || 0})</span>
                <span className="text-[10px] font-mono text-slate-400">Matched by customer phone number</span>
              </h3>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden max-h-52 overflow-y-auto">
                {selectedCustomerDetail.orders && selectedCustomerDetail.orders.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Items</th>
                        <th className="py-2.5 px-3">Total</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedCustomerDetail.orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{ord.orderNumber}</td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">
                            {new Date(ord.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-[11px] max-w-[140px] truncate">
                            {ord.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ') || 'Item'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-[#FF6000]">
                            {ord.totalAmount?.toLocaleString()} FRW
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                ord.status === 'Delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.status === 'Cancelled'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ord.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No orders linked directly to this customer phone yet.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {selectedCustomerDetail.customer.isRegisteredBuyer && (
                  <button
                    onClick={() => {
                      setResetPinCustomer(selectedCustomerDetail.customer);
                      setSelectedCustomerDetail(null);
                      setTempPin('');
                      setPinActionMessage(null);
                    }}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Reset 5-Digit PIN</span>
                  </button>
                )}
                <button
                  onClick={async () => {
                    const currentStatus = selectedCustomerDetail.customer.status || 'Active';
                    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
                    try {
                      await api.adminUpdateBuyerStatus(selectedCustomerDetail.customer.id, nextStatus);
                      selectedCustomerDetail.customer.status = nextStatus;
                      showToast(`Buyer account ${nextStatus}`);
                      fetchAllData();
                    } catch (err: any) {
                      alert(err.message || 'Failed to update status');
                    }
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl border cursor-pointer ${
                    selectedCustomerDetail.customer.status === 'Suspended'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {selectedCustomerDetail.customer.status === 'Suspended' ? 'Activate Account' : 'Suspend Account'}
                </button>
              </div>

              <button
                onClick={() => setSelectedCustomerDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Reset 5-Digit Password Modal */}
      {resetPinCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200 space-y-4">
            <button
              onClick={() => setResetPinCustomer(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#FF6000] flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">Reset 5-Digit Password</h3>
                <p className="text-xs text-slate-500">Buyer: {resetPinCustomer.name} ({resetPinCustomer.phone})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Set a temporary 5-digit password for this buyer. Provide the credentials to the user securely via WhatsApp or SMS.
            </p>

            {pinActionMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  pinActionMessage.isError
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinActionMessage.text}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanPin = tempPin.replace(/\D/g, '').slice(0, 5);
                if (cleanPin.length !== 5) {
                  setPinActionMessage({ text: 'Password must be exactly 5 digits (e.g. 12345).', isError: true });
                  return;
                }
                try {
                  await api.adminResetBuyerPassword(resetPinCustomer.id, cleanPin);
                  setPinActionMessage({
                    text: `5-Digit Password successfully updated to "${cleanPin}".`,
                    isError: false
                  });
                  setTimeout(() => {
                    setResetPinCustomer(null);
                    showToast('Password updated successfully');
                  }, 2000);
                } catch (err: any) {
                  setPinActionMessage({ text: err.message || 'Failed to reset password', isError: true });
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New 5-Digit Password / PIN *
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  value={tempPin}
                  onChange={(e) => setTempPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="e.g. 12345"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-black text-sm tracking-widest focus:ring-2 focus:ring-[#FF6000] focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Must be 5 numeric digits
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPinCustomer(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF6000] hover:bg-[#e05500] text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Save 5-Digit Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

