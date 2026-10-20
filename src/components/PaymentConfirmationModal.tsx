import React, { useState } from 'react';
import { X, ShieldCheck, MessageCircle, AlertCircle, CheckCircle2, Upload, Phone, PhoneCall, Copy, Check } from 'lucide-react';
import { Order, PaymentMethod, PaymentConfirmation } from '../types.ts';
import { Language, translations } from '../translations.ts';
import { buildUssdCode, formatUssdTelUri, autoTriggerUssd } from '../utils/ussd.ts';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onConfirmationSuccess: (confirmation: PaymentConfirmation, updatedOrder: Order) => void;
  currentLang: Language;
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  isOpen,
  onClose,
  order,
  onConfirmationSuccess,
  currentLang
}) => {
  const t = translations[currentLang];

  const [customerName, setCustomerName] = useState(order?.customerName || '');
  const [paymentPhone, setPaymentPhone] = useState(order?.customerPhone || '');
  const [orderNumber, setOrderNumber] = useState(order?.orderNumber || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order?.paymentMethod || 'MTN Mobile Money');
  const [amountPaid, setAmountPaid] = useState<number>(order?.totalAmount || 0);
  const [transactionId, setTransactionId] = useState('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ confirmation: PaymentConfirmation; order: Order } | null>(null);

  if (!isOpen) return null;

  // File upload to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file is too large. Please select an image under 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orderNumber.trim() || !paymentPhone.trim() || !transactionId.trim() || !amountPaid) {
      setError('Please provide your order reference, payment phone number, amount paid, and transaction ID.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          customerName: customerName.trim(),
          paymentPhone: paymentPhone.trim(),
          paymentMethod,
          amountPaid: Number(amountPaid),
          transactionId: transactionId.trim(),
          screenshotUrl: screenshotData || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit payment confirmation.');
      }

      const data = await response.json();
      setSuccessResult(data);
      onConfirmationSuccess(data.confirmation, data.order);
    } catch (err: any) {
      setError(err.message || 'Error submitting payment confirmation.');
    } finally {
      setLoading(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hello ContactReach Support, I have submitted payment confirmation for Order Reference: ${orderNumber} for amount ${amountPaid.toLocaleString()} FRW (Transaction ID: ${transactionId || 'Pending'}).`
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center p-0.5">
              <img
                src="/logo.png"
                alt="ContactReach Market Logo"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-slate-900">
                {t.paymentConfirmationTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Submit your mobile money receipt or transaction ID
              </p>
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
          {successResult ? (
            /* Success confirmation screen */
            <div className="text-center py-6 space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="font-extrabold text-xl text-slate-900">
                  Payment Submitted for Review
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 max-w-sm mx-auto">
                  Your confirmation for order <strong className="text-slate-900">{successResult.order.orderNumber}</strong> has been logged. Our administrative team will verify your transaction shortly.
                </p>
              </div>

              {/* Status Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 text-left space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Current Status: Payment Under Review</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Note: Submitting this form does not automatically mark the order as paid. Once verified by our payment administrator, your order will transition to <strong>Payment Confirmed</strong> and begin preparation.
                </p>
              </div>

              {/* WhatsApp direct contact */}
              <div className="pt-2 space-y-2">
                <a
                  href={`https://wa.me/250780022600?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Notify Ruth on WhatsApp (+250 780 022 600)</span>
                </a>

                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  Close & View Order Details
                </button>
              </div>
            </div>
          ) : (
            /* Confirmation Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {amountPaid > 0 && (() => {
                const quickUssd = buildUssdCode(paymentMethod, amountPaid, '078002260', '078002');
                const quickTel = formatUssdTelUri(quickUssd);
                return (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between gap-2 text-xs shadow-2xs">
                    <div>
                      <span className="font-bold text-amber-950 block">Need to dial USSD code first?</span>
                      <span className="font-mono text-amber-800 text-[11px] font-semibold">{quickUssd}</span>
                    </div>
                    <a
                      href={quickTel}
                      onClick={() => autoTriggerUssd(quickUssd)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
                      <span>Dial Now</span>
                    </a>
                  </div>
                );
              })()}

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g. CRM-78291"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full name as used on payment"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number Used to Pay *
                  </label>
                  <input
                    type="tel"
                    required
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    placeholder="078... / 073..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Provider *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50/50"
                  >
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Airtel Money">Airtel Money</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount Paid (FRW) *
                  </label>
                  <input
                    type="number"
                    required
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transaction ID / Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. TXN-192847581 from SMS"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Optional Screenshot Attachment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Screenshot / Payment SMS Proof (Optional)
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50/60 transition-colors">
                  <input
                    type="file"
                    id="receipt-file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="receipt-file"
                    className="flex flex-col items-center justify-center cursor-pointer gap-1.5"
                  >
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">
                      {screenshotData ? 'Change uploaded receipt photo' : 'Click to select payment screenshot'}
                    </span>
                    <span className="text-[10px] text-slate-400">PNG, JPG up to 5MB</span>
                  </label>

                  {screenshotData && (
                    <div className="mt-3 relative inline-block">
                      <img
                        src={screenshotData}
                        alt="Receipt preview"
                        className="h-20 w-auto rounded-lg object-contain border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshotData(null)}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Support Note */}
              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 flex items-center justify-between">
                <span>Receiver: <strong>Ruth (078002260)</strong></span>
                <a
                  href={`https://wa.me/250780022600?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Help</span>
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-xl font-extrabold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{loading ? t.submitting : t.submitConfirmation}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
