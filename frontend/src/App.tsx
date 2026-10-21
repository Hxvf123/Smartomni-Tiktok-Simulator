import { Route, Routes } from 'react-router-dom';
import { ComingSoon } from './components/ComingSoon';
import { RequireRole } from './components/RequireRole';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { LegacyLayout } from './layouts/LegacyLayout';
import { SellerLayout } from './layouts/SellerLayout';
import { ShopLayout } from './layouts/ShopLayout';
import { AuthProvider } from './lib/auth';
import { AuthorizePage } from './pages/AuthorizePage';
import { BuyerPage } from './pages/BuyerPage';
import { ConsolePage } from './pages/ConsolePage';
import { LoginPage } from './pages/LoginPage';
import { SellerPage } from './pages/SellerPage';
import { CartPage } from './pages/shop/CartPage';
import { CheckoutPage } from './pages/shop/CheckoutPage';
import { HomePage } from './pages/shop/HomePage';
import { OrdersPage } from './pages/shop/OrdersPage';
import { ProductPage } from './pages/shop/ProductPage';

export function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Routes>
          {/* Tiptop Shop (buyer) */}
          <Route element={<ShopLayout />}>
            <Route index element={<HomePage />} />
            <Route path="product/:id" element={<ProductPage />} />
            <Route element={<RequireRole role="BUYER" />}>
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="account/orders" element={<OrdersPage />} />
            </Route>
          </Route>
          <Route path="login" element={<LoginPage />} />

          {/* Seller Center */}
          <Route
            path="seller-center"
            element={
              <RequireRole role="SELLER">
                <SellerLayout />
              </RequireRole>
            }
          >
            <Route index element={<ComingSoon title="Seller Center home" />} />
            <Route path="orders" element={<ComingSoon title="Manage orders" />} />
            <Route path="orders/:id" element={<ComingSoon title="Order detail" />} />
            <Route path="returns" element={<ComingSoon title="Returns & refunds" />} />
            <Route path="products" element={<ComingSoon title="Products" />} />
            <Route path="vouchers" element={<ComingSoon title="Vouchers" />} />
            <Route path="messages" element={<ComingSoon title="Messages" />} />
            <Route path="shop" element={<ComingSoon title="Shop" />} />
          </Route>

          {/* Legacy simulator pages, kept until Step 13 */}
          <Route element={<LegacyLayout />}>
            <Route path="seller/authorize" element={<AuthorizePage />} />
            <Route path="seller/*" element={<SellerPage />} />
            <Route path="buyer/*" element={<BuyerPage />} />
            <Route path="console/*" element={<ConsolePage />} />
            <Route path="*" element={<div className="state state-empty">Page not found.</div>} />
          </Route>
        </Routes>
        <Toaster position="top-center" />
      </TooltipProvider>
    </AuthProvider>
  );
}
