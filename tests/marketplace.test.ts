import assert from 'assert';
import crypto from 'crypto';

// Comprehensive ContactReach Market Production Test Suite
// Testing: Authentication, RBAC, Cart/Checkout, Delivery, Coupons,
// Tracking privacy, Supplier commissions, Stock reservation, and Data integrity.

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting ContactReach Market Automated Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${err.message || err}`);
      failed++;
    }
  }

  // TEST 1: Public Storefront Endpoints Available
  await test('Public storefront endpoints return clean initial state', async () => {
    const res = await fetch(`${BASE_URL}/api/settings`);
    assert.strictEqual(res.status, 200, 'Settings endpoint should return 200');
    const settings = await res.json();
    assert.strictEqual(settings.marketName, 'ContactReach Market');
    assert.strictEqual(settings.email, 'contactreachmedialimited@gmail.com');

    const catRes = await fetch(`${BASE_URL}/api/categories`);
    assert.strictEqual(catRes.status, 200);
    const categories = await catRes.json();
    assert(Array.isArray(categories) && categories.length >= 10, 'Should return at least 10 official categories');

    const prodRes = await fetch(`${BASE_URL}/api/products`);
    assert.strictEqual(prodRes.status, 200);
    const products = await prodRes.json();
    assert(Array.isArray(products), 'Products should be an array');
  });

  // TEST 2: Admin Authentication Security & Bad Password Rejection
  await test('Admin auth rejects invalid passwords and prevents backdoors', async () => {
    const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'contactreachmedialimited@gmail.com', password: 'WrongPassword123' })
    });
    assert.strictEqual(badLogin.status, 401, 'Invalid password should be rejected with 401');

    const unauthorizedAccount = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'attacker@evil.com', password: 'CRM@2026' })
    });
    assert.strictEqual(unauthorizedAccount.status, 401, 'Unauthorized emails should be rejected');
  });

  // TEST 3: Admin Authentication Success with Authorized Credentials
  let adminToken = '';
  await test('Admin login succeeds with verified credentials and issues session token', async () => {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'contactreachmedialimited@gmail.com',
        password: process.env.ADMIN_PASSWORD || 'CRM@2026'
      })
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login should succeed');
    const data = await loginRes.json();
    assert(data.token, 'Session token should be returned');
    assert.strictEqual(data.admin.role, 'owner', 'Role should be owner');
    adminToken = data.token;
  });

  // TEST 4: Protected Admin Endpoints Guard
  await test('Protected admin endpoints require valid Bearer token', async () => {
    const unauth = await fetch(`${BASE_URL}/api/admin/stats`);
    assert.strictEqual(unauth.status, 401, 'Stats without token should be 401');

    const authRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(authRes.status, 200, 'Stats with token should be 200');
    const stats = await authRes.json();
    assert(typeof stats.totalOrders === 'number', 'totalOrders should be numeric');
  });

  // TEST 5: Coupon Validation Logic
  await test('Coupon validation accurately calculates percentage discount with bounds', async () => {
    const res = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME10', subtotal: 25000 })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.valid, true);
    assert.strictEqual(data.discountAmount, 2500, '10% of 25000 should be 2500');

    // Test under min amount
    const underMin = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME10', subtotal: 5000 })
    });
    assert.strictEqual(underMin.status, 400, 'Should reject order under 10000 min order threshold');
  });

  // TEST 6: Supplier Application Submission & Management
  let applicationId = '';
  await test('Supplier can apply and admin can review application', async () => {
    const applyRes = await fetch(`${BASE_URL}/api/supplier-applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Kigali Quality Audio Ltd',
        ownerName: 'Jean Paul',
        phone: '0788990011',
        email: 'jeanpaul@qualityaudio.rw',
        location: 'Downtown Kigali, Quartier Commercial',
        category: 'electronics',
        description: 'Authorized importer of sound systems and smart audio accessories.'
      })
    });
    assert.strictEqual(applyRes.status, 201, 'Application submission should be 201');
    const appData = await applyRes.json();
    applicationId = appData.application.id;

    // Admin view
    const adminAppsRes = await fetch(`${BASE_URL}/api/admin/supplier-applications`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminAppsRes.status, 200);
    const apps = await adminAppsRes.json();
    assert(apps.some((a: any) => a.id === applicationId), 'Submitted application should appear in admin list');

    // Admin approve
    const approveRes = await fetch(`${BASE_URL}/api/admin/supplier-applications/${applicationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Approved' })
    });
    assert.strictEqual(approveRes.status, 200);
    const approved = await approveRes.json();
    assert.strictEqual(approved.status, 'Approved');
  });

  // TEST 7: Product Creation with Supplier Association & Price in RWF
  let createdProductId = '';
  await test('Admin can add verified supplier product with inventory', async () => {
    const prodRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Wireless Studio Bluetooth Headphones',
        category: 'electronics',
        description: 'Crystal clear studio sound with deep bass and noise cancellation.',
        price: 35000,
        stock: 15,
        shopName: 'Kigali Quality Audio Ltd',
        status: 'Available'
      })
    });
    assert.strictEqual(prodRes.status, 201);
    const prod = await prodRes.json();
    assert.strictEqual(prod.name, 'Wireless Studio Bluetooth Headphones');
    assert.strictEqual(prod.price, 35000);
    assert.strictEqual(prod.stock, 15);
    createdProductId = prod.id;
  });

  // TEST 8: Order Placement, Commission Calculation, and Tracking Token
  let createdOrderNumber = '';
  let createdTrackingToken = '';
  await test('Customer order checkout calculates delivery fee, commissions, and generates tracking token', async () => {
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Aline Mugabo',
        customerPhone: '0788123456',
        deliveryLocation: 'Gasabo (Kimironko)',
        deliveryAddress: 'KG 15 Ave, Kimironko',
        items: [{ productId: createdProductId, quantity: 1 }],
        paymentMethod: 'MTN Mobile Money'
      })
    });
    assert.strictEqual(orderRes.status, 201);
    const order = await orderRes.json();
    assert(order.orderNumber, 'Order number should be generated');
    assert(order.trackingToken, 'Unguessable tracking token must be generated');
    assert.strictEqual(order.subtotal, 35000);
    assert.strictEqual(order.deliveryFee, 1500, 'Gasabo delivery fee should be 1500 FRW');
    assert.strictEqual(order.totalAmount, 36500, 'Total should be 35000 + 1500 = 36500');
    assert.strictEqual(order.commissionEarned, 3500, '10% marketplace commission on 35000 should be 3500');
    assert.strictEqual(order.supplierPayoutAmount, 31500, 'Supplier payout should be 31500');

    createdOrderNumber = order.orderNumber;
    createdTrackingToken = order.trackingToken;
  });

  // TEST 9: Order Tracking Privacy Guard
  await test('Order tracking enforces token/phone check and sanitizes public fields', async () => {
    // Attempt 1: tracking without credentials should be rejected
    const unauthenticated = await fetch(`${BASE_URL}/api/orders/${createdOrderNumber}`);
    assert.strictEqual(unauthenticated.status, 403, 'Public tracking without phone or token must be rejected with 403');

    // Attempt 2: tracking with correct token should succeed with sanitized data
    const tokenTrack = await fetch(`${BASE_URL}/api/orders/${createdOrderNumber}?token=${createdTrackingToken}`);
    assert.strictEqual(tokenTrack.status, 200, 'Tracking with valid trackingToken must succeed');
    const tokenData = await tokenTrack.json();
    assert.strictEqual(tokenData.orderNumber, createdOrderNumber);
    assert.strictEqual(tokenData.commissionEarned, undefined, 'Public tracking MUST NOT leak internal commission');
    assert.strictEqual(tokenData.supplierPayoutAmount, undefined, 'Public tracking MUST NOT leak supplier payouts');

    // Attempt 3: tracking with recipient phone number should succeed
    const phoneTrack = await fetch(`${BASE_URL}/api/orders/${createdOrderNumber}?phone=0788123456`);
    assert.strictEqual(phoneTrack.status, 200, 'Tracking with matching recipient phone must succeed');
  });

  // TEST 10: Payment Confirmation Submission & Administrative Verification
  let confirmationId = '';
  await test('Customer can submit payment confirmation and admin can approve', async () => {
    const confirmRes = await fetch(`${BASE_URL}/api/payments/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: createdOrderNumber,
        customerName: 'Aline Mugabo',
        paymentPhone: '0788123456',
        paymentMethod: 'MTN Mobile Money',
        amountPaid: 36500,
        transactionId: `TXN${Date.now()}`
      })
    });
    assert.strictEqual(confirmRes.status, 200);
    const confData = await confirmRes.json();
    assert.strictEqual(confData.confirmation.verificationStatus, 'Pending Review');
    assert.strictEqual(confData.order.paymentStatus, 'Pending Verification');
    confirmationId = confData.confirmation.id;

    // Admin verifies and approves payment
    const verifyRes = await fetch(`${BASE_URL}/api/admin/payments/${confirmationId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action: 'approve', adminNotes: 'Verified via MTN MoMo statement.' })
    });
    assert.strictEqual(verifyRes.status, 200);
    const verifiedData = await verifyRes.json();
    assert.strictEqual(verifiedData.order.paymentStatus, 'Paid');
    assert.strictEqual(verifiedData.order.status, 'Confirmed');
    assert.strictEqual(verifiedData.order.stockDeducted, true, 'Stock should be deducted upon verified payment');

    // Check product stock deduction
    const prodCheck = await fetch(`${BASE_URL}/api/products/${createdProductId}`);
    const updatedProd = await prodCheck.json();
    assert.strictEqual(updatedProd.stock, 14, 'Stock should decrease from 15 to 14');
  });

  // TEST 11: SEO and Structured Output Routes
  await test('Robots.txt and Sitemap.xml are dynamically served', async () => {
    const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
    assert.strictEqual(robotsRes.status, 200);
    const robotsText = await robotsRes.text();
    assert(robotsText.includes('Sitemap:'), 'Robots.txt must declare sitemap');

    const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
    assert.strictEqual(sitemapRes.status, 200);
    const sitemapText = await sitemapRes.text();
    assert(sitemapText.includes('<urlset'), 'Sitemap must contain XML urlset');
    assert(sitemapText.includes(createdProductId), 'Sitemap should include active product URLs');
  });

  // TEST 12: Buyer Exclusive Google Authentication & Rejection of Legacy Password Flows
  const buyerGoogleEmail = `buyer.shopper.${Date.now()}@gmail.com`;
  const buyerGoogleUid = `google_uid_${Date.now()}`;
  let registeredBuyerId = '';
  let buyerToken = '';

  await test('Buyer signs in exclusively with Google, and legacy password registration is rejected', async () => {
    // 1. Verify legacy password registration is rejected in favor of Google-only
    const legacyRegRes = await fetch(`${BASE_URL}/api/buyers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0789123456',
        password: '12345'
      })
    });
    assert.strictEqual(legacyRegRes.status, 400, 'Legacy password registration must be rejected');
    const legacyRegData = await legacyRegRes.json();
    assert.strictEqual(legacyRegData.useGoogleSignIn, true, 'Response must instruct to use Google Sign-In');

    // 2. Successful Buyer Google Sign-In
    const googleLoginRes = await fetch(`${BASE_URL}/api/buyers/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: buyerGoogleEmail,
        displayName: 'Gisele Uwase',
        uid: buyerGoogleUid,
        photoURL: 'https://lh3.googleusercontent.com/a/default-user',
        phoneNumber: '0789123456'
      })
    });
    assert.strictEqual(googleLoginRes.status, 200, 'Buyer Google login should return 200');
    const loginData = await googleLoginRes.json();
    assert(loginData.token, 'Session token should be returned');
    assert.strictEqual(loginData.user.email, buyerGoogleEmail);
    assert.strictEqual(loginData.user.name, 'Gisele Uwase');
    assert.strictEqual(loginData.user.authProvider, 'google');
    registeredBuyerId = loginData.user.id;
    buyerToken = loginData.token;

    // 3. Buyer can fetch profile with session token
    const meRes = await fetch(`${BASE_URL}/api/buyers/me`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.user.id, registeredBuyerId);
    assert.strictEqual(meData.user.email, buyerGoogleEmail);

    // 4. Buyer can update delivery details (address & courier phone)
    const updateRes = await fetch(`${BASE_URL}/api/buyers/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        deliveryAddress: 'Kigali, Kicukiro, Sonatubes',
        phone: '0789123456'
      })
    });
    assert.strictEqual(updateRes.status, 200);
    const updatedData = await updateRes.json();
    assert.strictEqual(updatedData.user.deliveryAddress, 'Kigali, Kicukiro, Sonatubes');
  });

  // TEST 13: Admin Can See Google-Authenticated Buyer Information
  await test('User information can be seen by admin with full Google profile and security status', async () => {
    const adminCustRes = await fetch(`${BASE_URL}/api/admin/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminCustRes.status, 200, 'Admin can view all customers');
    const allCustomers = await adminCustRes.json();
    const createdBuyer = allCustomers.find((c: any) => c.email === buyerGoogleEmail || c.id === registeredBuyerId);
    assert(createdBuyer, 'Created Google buyer must appear in admin customer directory');
    assert.strictEqual(createdBuyer.name, 'Gisele Uwase');
    assert.strictEqual(createdBuyer.isRegisteredBuyer, true, 'Admin can see that user has registered account');
    assert.strictEqual(createdBuyer.deliveryAddress, 'Kigali, Kicukiro, Sonatubes');

    // Admin can get detailed customer profile and associated orders
    const detailRes = await fetch(`${BASE_URL}/api/admin/customers/${registeredBuyerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(detailRes.status, 200, 'Admin can view individual customer profile');
    const detailData = await detailRes.json();
    assert.strictEqual(detailData.customer.id, registeredBuyerId);
    assert.strictEqual(detailData.customer.email, buyerGoogleEmail);
    assert(Array.isArray(detailData.orders), 'Orders list should be an array');
  });


  // TEST 14: Percentage Discount Calculation on Products
  await test('Admin product creation supports % percentage discount and auto-computes promo price', async () => {
    const prodWithDiscountRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Glow Facial Vitamin C Serum (20% OFF Special)',
        price: 25000,
        discountPercent: 20,
        category: 'hair-beauty',
        description: 'Brightening facial serum with 20% promotional discount.',
        stock: 40
      })
    });
    assert.strictEqual(prodWithDiscountRes.status, 201, 'Product with % discount should be created');
    const createdDiscountProd = await prodWithDiscountRes.json();
    assert.strictEqual(createdDiscountProd.price, 25000);
    assert.strictEqual(createdDiscountProd.discountPercent, 20, 'discountPercent must be 20%');
    assert.strictEqual(createdDiscountProd.discountPrice, 20000, '20% off 25,000 FRW must be 20,000 FRW');

    // Update discount to 30%
    const updateDiscountRes = await fetch(`${BASE_URL}/api/admin/products/${createdDiscountProd.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        discountPercent: 30
      })
    });
    assert.strictEqual(updateDiscountRes.status, 200);
    const updatedDiscountProd = await updateDiscountRes.json();
    assert.strictEqual(updatedDiscountProd.discountPercent, 30);
    assert.strictEqual(updatedDiscountProd.discountPrice, 17500, '30% off 25,000 FRW must be 17,500 FRW');
  });

  console.log('\n====================================================');
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
