import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Check, Copy, PhoneCall, MessageCircle, AlertCircle, ShieldCheck,
  MapPin, Tag, Smartphone, CheckCircle2, ChevronRight, Info, AlertTriangle, Truck,
  Zap, Radio
} from 'lucide-react';
import { CartItem, Order, PaymentMethod, AppSettings, CustomerUser } from '../types.ts';
import { Language, translations } from '../translations.ts';
import { api } from '../services/api.ts';
import { buildUssdCode, formatUssdTelUri, autoTriggerUssd, USSD_CONFIG } from '../utils/ussd.ts';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  settings: AppSettings;
  onOrderCreated: (order: Order) => void;
  onOpenConfirmation: (order: Order) => void;
  currentLang: Language;
  buyerUser?: CustomerUser | null;
  onOpenBuyerAuth?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  settings,
  onOrderCreated,
  onOpenConfirmation,
  currentLang,
  buyerUser,
  onOpenBuyerAuth
}) => {
  const t = translations[currentLang];

  // Steps: 'details' -> 'payment'
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [dialerPrompted, setDialerPrompted] = useState(false);

  // Form State - Auto-populated from buyerUser if logged in
  const [customerName, setCustomerName] = useState(buyerUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(buyerUser?.phone || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(settings.kigaliAreas?.[0]?.id || 'gasabo');
  const [deliveryAddress, setDeliveryAddress] = useState(buyerUser?.deliveryAddress || 'Kigali, Gasabo');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [discountMsg, setDiscountMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Update form fields when buyerUser changes
  useEffect(() => {
    if (buyerUser) {
      if (buyerUser.name && !customerName) setCustomerName(buyerUser.name);
      if (buyerUser.phone && !customerPhone) setCustomerPhone(buyerUser.phone);
      if (buyerUser.deliveryAddress && (!deliveryAddress || deliveryAddress === 'Kigali, Gasabo')) {
        setDeliveryAddress(buyerUser.deliveryAddress);
      }
    }
  }, [buyerUser]);

  // Determine which payment methods are enabled for products in cart
  const availablePaymentMethods = useMemo<PaymentMethod[]>(() => {
    const validMethods: PaymentMethod[] = ['MTN Merchant Code', 'MTN Mobile Money', 'Airtel Money'];
    if (!cart || cart.length === 0) return validMethods;

    // Check if products in cart have paymentMethods specified
    const methodsWithItems = cart.filter(item => item.product.paymentMethods && item.product.paymentMethods.length > 0);
    if (methodsWithItems.length === 0) {
      return validMethods;
    }

    // Find intersection of allowed methods
    let intersection = new Set<PaymentMethod>(methodsWithItems[0].product.paymentMethods);
    for (let i = 1; i < methodsWithItems.length; i++) {
      const current = new Set(methodsWithItems[i].product.paymentMethods);
      for (const m of Array.from(intersection)) {
        if (!current.has(m)) intersection.delete(m);
      }
    }

    const result = Array.from(intersection);
    return result.length > 0 ? result : validMethods;
  }, [cart]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    availablePaymentMethods[0] || 'MTN Merchant Code'
  );

  useEffect(() => {
    if (availablePaymentMethods.length > 0 && !availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0]);
    }
  }, [availablePaymentMethods, paymentMethod]);

  // Completed Created Order state
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  if (!isOpen) return null;

  // Delivery and Fee Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const isOutsideKigali = selectedLocationId === 'outside';
  const qualifiesForFreeDelivery = subtotal >= (settings.freeDeliveryThreshold || 50000) && !isOutsideKigali;

  const currentArea = settings.kigaliAreas?.find(a => a.id === selectedLocationId);
  const deliveryFee = qualifiesForFreeDelivery
    ? 0
    : isOutsideKigali
    ? (settings.deliveryFeeUpcountry || 3500)
    : (currentArea ? currentArea.fee : (settings.deliveryFeeKigali || 1500));

  const grandTotal = Math.max(0, subtotal + deliveryFee - appliedDiscount);

  // Primary merchant code and receiver info from product or settings
  const primaryProduct = cart[0]?.product;
  const merchantCode = primaryProduct?.merchantCode || settings.merchantCode || USSD_CONFIG.mtnMerchantCode;
  const receiverPhone = primaryProduct?.receiverPhone || settings.paymentNumber || USSD_CONFIG.mtnMomoNumber;
  const receiverName = primaryProduct?.receiverName || settings.receiverName || USSD_CONFIG.receiverName;

  // Active USSD code calculation using Rwandan telecom standards
  const amountToPay = createdOrder ? createdOrder.totalAmount : grandTotal;
  
  const activeUssdCode = buildUssdCode(
    paymentMethod,
    amountToPay,
    receiverPhone,
    merchantCode
  );

  const activeTelUri = formatUssdTelUri(activeUssdCode);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    try {
      const res = await api.validateCoupon(discountCode.trim(), subtotal);
      if (res.valid) {
        setAppliedDiscount(res.discountAmount);
        const pctLabel = res.discountType === 'percentage' && res.discountValue ? ` (${res.discountValue}% OFF)` : '';
        setDiscountMsg({ text: res.message || `Coupon applied${pctLabel}: ${res.discountAmount.toLocaleString()} FRW discount!`, isError: false });
      } else {
        setDiscountMsg({ text: res.message || 'Invalid promo code', isError: true });
      }
    } catch (err: any) {
      if (discountCode.trim().toUpperCase() === 'WELCOME10' || discountCode.trim().toUpperCase() === 'CRM2026' || discountCode.trim().toUpperCase() === 'MOMO') {
        const disc = Math.min(10000, Math.round(subtotal * 0.1));
        setAppliedDiscount(disc);
        setDiscountMsg({ text: `Promo applied: 10% OFF (-${disc.toLocaleString()} FRW)!`, isError: false });
      } else {
        setDiscountMsg({ text: err.message || 'Invalid coupon code.', isError: true });
      }
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      setError(
        currentLang === 'en'
          ? 'Please enter your full name, Rwandan phone number, and delivery address.'
          : 'Nyamuneka wuzuze amazina yawe, telefone yo mu Rwanda n\'aderesi yo koherezaho.'
      );
      return;
    }

    if (cart.length === 0) {
      setError('Your shopping cart is empty.');
      return;
    }

    // Check stock locally before submitting
    for (const item of cart) {
      if (item.product.status === 'Out of Stock' || item.product.stock < item.quantity) {
        setError(`"${item.product.name}" is out of stock or requested quantity exceeds available stock (${item.product.stock} left).`);
        return;
      }
    }

    setLoading(true);
    try {
      const selectedLocationName = isOutsideKigali
        ? 'Outside Kigali (Upcountry / Intara)'
        : (currentArea?.name || 'Kigali Area');

      const orderPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryLocation: selectedLocationName,
        deliveryAddress: deliveryAddress.trim(),
        deliveryNotes: deliveryNotes.trim() || undefined,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity
        })),
        paymentMethod,
        couponCode: appliedDiscount > 0 ? discountCode.trim() : undefined
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to place order');
      }

      const orderData: Order = await response.json();
      setCreatedOrder(orderData);
      onOrderCreated(orderData);
      setStep('payment');
      setDialerPrompted(true);

      // Automatically launch the phone dialer with USSD code on mobile phones
      const codeToDial = buildUssdCode(
        paymentMethod,
        orderData.totalAmount,
        receiverPhone,
        merchantCode
      );
      setTimeout(() => {
        autoTriggerUssd(codeToDial);
      }, 300);
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating order.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualDial = (methodToUse = paymentMethod) => {
    const code = buildUssdCode(methodToUse, amountToPay, receiverPhone, merchantCode);
    setDialerPrompted(true);
    autoTriggerUssd(code);
  };

  const handleSelectPaymentMethodInStep2 = (method: PaymentMethod) => {
    setPaymentMethod(method);
    const code = buildUssdCode(method, amountToPay, receiverPhone, merchantCode);
    setDialerPrompted(true);
    setTimeout(() => {
      autoTriggerUssd(code);
    }, 200);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeUssdCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleAlreadyPaid = () => {
    if (createdOrder) {
      onOpenConfirmation(createdOrder);
      onClose();
    }
  };

  const whatsappUrl = `https://wa.me/${settings.whatsAppNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hello ContactReach Market Support, I am paying for Order Reference: ${createdOrder?.orderNumber || 'Pending'} for the total amount of ${amountToPay.toLocaleString()} FRW (${paymentMethod}).`
  )}`;

  const upcountryWhatsappUrl = `https://wa.me/${settings.whatsAppNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hello ContactReach Market, I am ordering from outside Kigali (${deliveryAddress || 'Upcountry'}). Please confirm available transport arrangements and delivery fees for my order.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] overflow-y-auto shadow-2xl relative border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center p-0.5">
              <img
                src="/logo.png"
                alt="ContactReach Market Logo"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                {currentLang === 'en' ? 'Checkout & Payment' : 'Kwishyura Komande'}
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                ContactReach Market
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'details' ? (
            /* STEP 1: Details and Payment Selection */
            <form onSubmit={handleCreateOrder} className="space-y-6">
              {/* Buyer Account Status Banner */}
              {buyerUser ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      ✓
                    </div>
                    <div>
                      <p className="font-extrabold text-emerald-950">
                        {currentLang === 'en' ? 'Signed in as' : 'Mwinjiye nka'} {buyerUser.name}
                        <span className="font-mono text-emerald-700 font-bold ml-1.5">({buyerUser.phone})</span>
                      </p>
                      <p className="text-[10px] text-emerald-700">
                        {currentLang === 'en' ? 'Your details and delivery address are automatically loaded.' : 'Imyirondoro n\'aho mutuye byikoresheje mu buryo bwikora.'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider hidden sm:inline-block">
                    5-Digit PIN Account
                  </span>
                </div>
              ) : onOpenBuyerAuth ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-slate-800 text-xs flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#FF6000] shrink-0" />
                    <span className="font-medium text-slate-700">
                      {currentLang === 'en'
                        ? 'Have a buyer account? Sign in with your phone and 5-digit password for instant checkout.'
                        : 'Ufite konti? Injira ukoresheje nimero yawe n\'imibare 5 y\'ibanga.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBuyerAuth();
                    }}
                    className="px-3 py-1.5 bg-white border border-orange-300 text-[#FF6000] font-bold rounded-xl text-[11px] hover:bg-orange-50 cursor-pointer shrink-0 ml-2 shadow-2xs"
                  >
                    {currentLang === 'en' ? 'Sign In / Register' : 'Injira / Fata Konti'}
                  </button>
                </div>
              ) : null}

              {/* Warning/Guidance Banner */}
              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 text-xs space-y-1">
                <span className="font-extrabold flex items-center gap-1.5 text-[#EA580C]">
                  <Info className="w-4 h-4" />
                  {currentLang === 'en'
                    ? 'Complete order information before submitting:'
                    : 'Nyamuneka wuzuze amakuru yose asabwa mbere yo kohereza komande:'}
                </span>
                <p className="text-[11px] text-orange-900">
                  Select your exact delivery location in Kigali or Upcountry to calculate official transport fees. Stock is reserved and confirmed upon verified payment.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              {/* 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: Customer and delivery boxes */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Box 1: Delivery Area & Location */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#EA580C]" />
                      <h3 className="font-bold text-xs text-slate-800">
                        {currentLang === 'en' ? '1. Select Delivery Area' : '1. Hitamo Agace ko koherezaho'}
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Delivery Zone / Agace
                      </label>
                      <select
                        value={selectedLocationId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedLocationId(val);
                          if (val === 'outside') {
                            setDeliveryAddress('Outside Kigali / Upcountry Province');
                          } else {
                            const found = settings.kigaliAreas?.find(a => a.id === val);
                            setDeliveryAddress(`Kigali, ${found?.name.split(' ')[0] || 'Gasabo'}`);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-orange-500 bg-slate-50"
                      >
                        {settings.kigaliAreas?.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name} — {qualifiesForFreeDelivery ? 'FREE DELIVERY' : `${area.fee.toLocaleString()} RWF`} ({area.estimatedTime})
                          </option>
                        ))}
                        <option value="outside">
                          Outside Kigali / Intara (Additional delivery charges apply)
                        </option>
                      </select>
                    </div>

                    {/* Notice for Outside Kigali */}
                    {isOutsideKigali && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] leading-relaxed">
                            {settings.outsideKigaliNotice ||
                              'Locations outside the configured Kigali delivery areas: Additional delivery charges apply. The buyer must contact the seller to confirm the cost and arrangements before the order is finalized.'}
                          </p>
                        </div>
                        <a
                          href={upcountryWhatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Contact Seller on WhatsApp to Confirm Transport</span>
                        </a>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Physical Delivery Address / Aderesi y'Aho Uri *
                      </label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Street, House No, Landmark (e.g. Kimironko near Market, KN 4 Ave)..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-orange-500 bg-slate-50/60 font-medium"
                      />
                    </div>
                  </div>

                  {/* Box 2: Customer Identity */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                    <h3 className="font-bold text-xs text-slate-800">
                      {currentLang === 'en' ? '2. Customer Contact' : '2. Imyirondoro yawe'}
                    </h3>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {currentLang === 'en' ? 'Full Name *' : 'Amazina yawe yose *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={currentLang === 'en' ? 'Enter your full name' : 'Shyiramo amazina yawe'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-orange-500 bg-slate-50/60 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {currentLang === 'en' ? 'Rwandan Phone Number (MTN / Airtel) *' : 'Nimero ya telefoni (MTN / Airtel) *'}
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="078... or 073..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-orange-500 bg-slate-50/60 font-mono"
                      />
                    </div>
                  </div>

                  {/* Box 3: Delivery Instructions */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 shadow-2xs">
                    <h3 className="font-bold text-xs text-slate-800">
                      {currentLang === 'en'
                        ? '3. Delivery Notes (Optional)'
                        : '3. Amabwiriza yo kohereza (Niba ubishaka)'}
                    </h3>
                    <textarea
                      rows={2}
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder={
                        currentLang === 'en'
                          ? 'Specific instructions for our delivery driver...'
                          : 'Andika amabwiriza yo kohereza...'
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-orange-500 bg-slate-50/60"
                    />
                  </div>

                  {/* Box 4: Selectable Payment Methods */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-slate-800">
                        {currentLang === 'en' ? '4. Select Payment Method' : '4. Uburyo bwo kwishyura'}
                      </h3>
                      <span className="text-[10px] text-slate-500">
                        Enabled for this product
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {availablePaymentMethods.includes('MTN Merchant Code') && (
                        <label
                          onClick={() => setPaymentMethod('MTN Merchant Code')}
                          className={`p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                            paymentMethod === 'MTN Merchant Code'
                              ? 'border-amber-500 bg-amber-50/80 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-lg bg-amber-400 text-slate-900 font-black text-[11px] flex items-center justify-center shrink-0">
                              MoMo
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block leading-tight">
                                MTN Merchant Code
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                *182*8*1*{merchantCode}#
                              </span>
                            </div>
                          </div>
                          {paymentMethod === 'MTN Merchant Code' && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                        </label>
                      )}

                      {availablePaymentMethods.includes('MTN Mobile Money') && (
                        <label
                          onClick={() => setPaymentMethod('MTN Mobile Money')}
                          className={`p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                            paymentMethod === 'MTN Mobile Money'
                              ? 'border-amber-500 bg-amber-50/80 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-lg bg-amber-400 text-slate-900 font-black text-[11px] flex items-center justify-center shrink-0">
                              MTN
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block leading-tight">
                                MTN MoMo Transfer
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                *182*1*1*{receiverPhone}#
                              </span>
                            </div>
                          </div>
                          {paymentMethod === 'MTN Mobile Money' && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                        </label>
                      )}

                      {availablePaymentMethods.includes('Airtel Money') && (
                        <label
                          onClick={() => setPaymentMethod('Airtel Money')}
                          className={`p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                            paymentMethod === 'Airtel Money'
                              ? 'border-red-500 bg-red-50/80 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-lg bg-red-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                              AIR
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block leading-tight">
                                Airtel Money
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                *182*1*2*{receiverPhone}#
                              </span>
                            </div>
                          </div>
                          {paymentMethod === 'Airtel Money' && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                        </label>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 bg-slate-100/80 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-1">
                      <span>Receiver: <strong>{receiverName}</strong></span>
                      <span className="font-mono text-orange-600 font-bold">
                        {paymentMethod === 'MTN Merchant Code' ? `Code: ${merchantCode}` : `Tel: ${receiverPhone}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Order Summary Card */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
                  <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-2.5">
                    {currentLang === 'en' ? 'Order Summary' : 'Ibyerekeye Komande'}
                  </h3>

                  {/* Items in Checkout */}
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-start gap-2.5 text-xs">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-100"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 line-clamp-2 leading-tight">
                            {item.product.name}
                          </h4>
                          {item.product.shopName && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Shop: {item.product.shopName}
                            </span>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                            <span>Ingano: {item.quantity}</span>
                            <span className="font-bold text-[#FF5500] font-mono">
                              RWF {(item.product.price * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals Breakdown */}
                  <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>{currentLang === 'en' ? 'Subtotal' : 'Igiteranyo cy\'ibicuruzwa'}</span>
                      <span className="font-bold font-mono text-slate-800">
                        RWF {subtotal.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>
                        {currentLang === 'en' ? 'Delivery Fee' : 'Amafaranga y\'urugendo'}
                        {qualifiesForFreeDelivery && (
                          <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            FREE
                          </span>
                        )}
                      </span>
                      <span className="font-bold font-mono text-slate-800">
                        {deliveryFee === 0 ? '0 RWF' : `RWF ${deliveryFee.toLocaleString()}`}
                      </span>
                    </div>

                    {appliedDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Discount Applied {subtotal > 0 ? `(${Math.round((appliedDiscount / subtotal) * 100)}% OFF)` : ''}</span>
                        <span className="font-mono">- RWF {appliedDiscount.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-sm text-slate-900">
                      <span>{currentLang === 'en' ? 'Grand Total' : 'Igiteranyo Cyose'}</span>
                      <span className="text-[#FF5500] font-mono text-base">
                        RWF {grandTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Discount Code Input Box */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Have a discount code? (e.g. MOMO)"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-orange-500 bg-slate-50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyDiscount}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                    {discountMsg && (
                      <p className={`text-[11px] font-medium ${discountMsg.isError ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {discountMsg.text}
                      </p>
                    )}
                  </div>

                  {/* Big Orange Submit Button: Tumiza Nonaha */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm bg-[#FF5500] hover:bg-[#E54D00] text-white shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <span>Tegereza...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>{currentLang === 'en' ? 'Proceed to Payment' : 'Tumiza & Komeza Kwishyura'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* STEP 2: USSD Transfer & "I Have Already Paid" workflow */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Order Registered Banner */}
              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#FF5500] tracking-wider">
                    {currentLang === 'en' ? 'Order Registered Successfully' : 'Komande Yakiriwe Neza'}
                  </span>
                  <div className="text-sm font-black text-slate-900 mt-0.5">
                    Order Ref: <span className="font-mono text-[#FF5500]">{createdOrder?.orderNumber}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Location: {createdOrder?.deliveryLocation}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">
                    {currentLang === 'en' ? 'Total to Pay' : 'Amafaranga yo Kwishyura'}
                  </span>
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {amountToPay.toLocaleString()} RWF
                  </span>
                </div>
              </div>

              {/* Automatic Dialer Activation Notice */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <PhoneCall className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-extrabold text-emerald-900 leading-tight">
                      {currentLang === 'en'
                        ? 'USSD Code Automatically Launched in Your Phone Dialer'
                        : 'Kode ya USSD ifunguwe mu buryo bwikora kuri telefoni yawe'}
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      {currentLang === 'en'
                        ? 'If your phone dialer did not prompt automatically, tap the green "Dial USSD Now" button below.'
                        : 'Niba dialer ya telefoni itahise ifunguka, kanda akabuto k\'icyatsi hano hasi uhite uhamagara.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleManualDial(paymentMethod)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  {currentLang === 'en' ? 'Re-open Dialer' : 'Fungura Dialer'}
                </button>
              </div>

              {/* Operator & Payment Method Selector on Step 2 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  {currentLang === 'en' ? 'Select Your Payment Method & USSD Format:' : 'Hitamo Uburyo bwo Kwishyura:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Option 1: MTN MoMo Direct */}
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethodInStep2('MTN Mobile Money')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      paymentMethod === 'MTN Mobile Money'
                        ? 'border-amber-500 bg-amber-50/90 shadow-xs ring-2 ring-amber-400/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center">
                        MTN
                      </span>
                      {paymentMethod === 'MTN Mobile Money' && (
                        <Check className="w-4 h-4 text-amber-700" />
                      )}
                    </div>
                    <div className="font-extrabold text-xs text-slate-900 leading-tight">
                      MTN MoMo (Direct)
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      *182*1*1*{receiverPhone}*{amountToPay}#
                    </div>
                  </button>

                  {/* Option 2: MTN MoMoPay Merchant */}
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethodInStep2('MTN Merchant Code')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      paymentMethod === 'MTN Merchant Code'
                        ? 'border-amber-500 bg-amber-50/90 shadow-xs ring-2 ring-amber-400/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center">
                        MoMo
                      </span>
                      {paymentMethod === 'MTN Merchant Code' && (
                        <Check className="w-4 h-4 text-amber-700" />
                      )}
                    </div>
                    <div className="font-extrabold text-xs text-slate-900 leading-tight">
                      MTN MoMoPay (Code)
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      *182*8*1*{merchantCode}*{amountToPay}#
                    </div>
                  </button>

                  {/* Option 3: Airtel Money */}
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethodInStep2('Airtel Money')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      paymentMethod === 'Airtel Money'
                        ? 'border-red-500 bg-red-50/90 shadow-xs ring-2 ring-red-400/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="w-7 h-7 rounded-lg bg-red-600 text-white font-black text-[10px] flex items-center justify-center">
                        AIR
                      </span>
                      {paymentMethod === 'Airtel Money' && (
                        <Check className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="font-extrabold text-xs text-slate-900 leading-tight">
                      Airtel Money
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      *182*1*2*{receiverPhone}*{amountToPay}#
                    </div>
                  </button>
                </div>
              </div>

              {/* MoMo Provider Details & Primary Call Action */}
              <div className="border border-slate-200 rounded-3xl p-5 bg-white space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-11 h-11 rounded-2xl font-black text-xs flex items-center justify-center shadow-xs ${
                        paymentMethod.startsWith('MTN') ? 'bg-amber-400 text-slate-900' : 'bg-red-600 text-white'
                      }`}
                    >
                      {paymentMethod.startsWith('MTN') ? 'MTN' : 'AIR'}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{paymentMethod}</h4>
                      <p className="text-xs text-slate-500">
                        {paymentMethod === 'MTN Merchant Code'
                          ? 'MTN MoMoPay Merchant Account'
                          : paymentMethod === 'Airtel Money'
                          ? 'Airtel Money Transfer'
                          : 'MTN Mobile Money Direct Transfer'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg">
                    {currentLang === 'en' ? 'Awaiting Payment' : 'Tegereza Kwishyura'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-500 block">
                      {paymentMethod === 'MTN Merchant Code' ? 'Merchant / Business' : 'Account Name'}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                      {paymentMethod === 'MTN Merchant Code' ? 'ContactReach Market' : receiverName}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-500 block">
                      {paymentMethod === 'MTN Merchant Code' ? 'Merchant Code' : 'Receiver Phone'}
                    </span>
                    <span className="font-extrabold text-[#FF5500] text-sm mt-0.5 block font-mono">
                      {paymentMethod === 'MTN Merchant Code' ? merchantCode : receiverPhone}
                    </span>
                  </div>
                </div>

                {/* Pre-filled USSD Code Box with Copy */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      {currentLang === 'en' ? 'Pre-filled USSD Dialing Code' : 'Kode ya USSD Yuzuye neza'}
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {amountToPay.toLocaleString()} RWF
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-4 bg-slate-950 text-white rounded-2xl font-mono text-sm sm:text-base font-bold shadow-inner border border-slate-800">
                    <span className="truncate text-amber-400 tracking-wider">{activeUssdCode}</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-3.5 py-2 bg-[#FF5500] hover:bg-orange-600 text-white rounded-xl text-xs font-sans font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-xs active:scale-95"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? (currentLang === 'en' ? 'Copied!' : 'Byakoporowe!') : (currentLang === 'en' ? 'Copy Code' : 'Koporora')}</span>
                    </button>
                  </div>
                </div>

                {/* Direct Dial Action: Big Green Button with pulsing phone icon */}
                <div>
                  <a
                    href={activeTelUri}
                    onClick={() => handleManualDial(paymentMethod)}
                    className="w-full py-4 px-5 rounded-2xl font-black text-sm sm:text-base bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg shadow-emerald-600/30 ring-4 ring-emerald-500/20"
                  >
                    <PhoneCall className="w-5 h-5 text-white animate-bounce shrink-0" />
                    <span className="truncate">
                      {currentLang === 'en' ? 'Dial USSD Code Now' : 'Hamagara USSD Nonaha'}: <span className="underline font-mono">{activeUssdCode}</span>
                    </span>
                  </a>
                  <p className="text-[11px] text-slate-500 text-center mt-2.5 leading-relaxed">
                    {currentLang === 'en'
                      ? 'Tapping this opens your native phone dialer with the code pre-filled. Select SIM 1 or SIM 2 and enter your secret Mobile Money PIN.'
                      : 'Gukanda hano bifungura dialer ya telefoni yawe kode yuzuye. Hitamo Sim 1 cyangwa Sim 2 maze ushyiremo PIN y\'ibanga.'}
                  </p>
                </div>
              </div>

              {/* 4-Step Visual Payment Instructions */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  {currentLang === 'en' ? 'How to complete payment on your phone:' : 'Intambwe zo kwishyura kuri telefoni yawe:'}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span className="text-slate-600 text-[11px]">
                      {currentLang === 'en'
                        ? `Dialer opens with pre-filled code (${activeUssdCode}).`
                        : `Telefoni ifungura kode ya USSD yahise yuzura (${activeUssdCode}).`}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span className="text-slate-600 text-[11px]">
                      {currentLang === 'en'
                        ? 'Press Call on your MTN or Airtel SIM card.'
                        : 'Kanda Guhamagara ukoresheje SIM card ya MTN cyangwa Airtel.'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span className="text-slate-600 text-[11px]">
                      {currentLang === 'en'
                        ? 'Enter your secret Mobile Money PIN to authorize transfer.'
                        : 'Shyiramo PIN yawe y\'ibanga y\'amafaranga wemeze transfer.'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span className="text-slate-600 text-[11px]">
                      {currentLang === 'en'
                        ? 'Click "I Have Already Paid" below to submit transaction ID.'
                        : 'Kanda "Narangije Kwishyura" hasi wohereze SMS ya confirmation.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions: "I Have Already Paid" */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleAlreadyPaid}
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base bg-[#FF5500] hover:bg-[#E54D00] text-white shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer transform active:scale-98"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>
                    {currentLang === 'en'
                      ? 'I Have Already Paid (Submit SMS Confirmation)'
                      : 'Narangije Kwishyura (Ohereza Nimero ya Transaction)'}
                  </span>
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Contact Payment Support on WhatsApp (+250 780 022 600)</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
