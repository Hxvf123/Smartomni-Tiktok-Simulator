import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ComingSoon } from './components/ComingSoon';
import { RequireRole } from './components/RequireRole';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { LegacyLayout } from './layouts/LegacyLayout';
import { SellerLayout } from './layouts/SellerLayout';
import { ShopLayout } from './layouts/ShopLayout';
import { AuthProvider } from './lib/auth';
import { AuthorizePage } from './pages/AuthorizePage';
import { ConsolePage } from './pages/ConsolePage';
import { LoginPage } from './pages/LoginPage';
import { SellerHome } from './pages/seller-center/SellerHome';
import { SellerOrderDetail } from './pages/seller-center/SellerOrderDetail';
import { SellerMessages } from './pages/seller-center/SellerMessages';
import { SellerOrders } from './pages/seller-center/SellerOrders';
import { SellerProducts } from './pages/seller-center/SellerProducts';
import { SellerReturns } from './pages/seller-center/SellerReturns';
import { SellerVouchers } from './pages/seller-center/SellerVouchers';
import { CartPage } from './pages/shop/CartPage';
import { CheckoutPage } from './pages/shop/CheckoutPage';
import { MessagesPage } from './pages/shop/MessagesPage';
import { HomePage } from './pages/shop/HomePage';
import { OrdersPage } from './pages/shop/OrdersPage';
import { ProductPage } from './pages/shop/ProductPage';

/** Old marketplace product links (/buyer/product/<id>, e.g. from SmartOmni) open the new product page. */
function LegacyProductLink() {
  const { id = '' } = useParams();
  return <Navigate to={`/product/${encodeURIComponent(id)}`} replace />;
}

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
              <Route path="account/messages" element={<MessagesPage />} />
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
            <Route index element={<SellerHome />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="orders/:id" element={<SellerOrderDetail />} />
            <Route path="returns" element={<SellerReturns />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="vouchers" element={<SellerVouchers />} />
            <Route path="messages" element={<SellerMessages />} />
            <Route path="shop" element={<ComingSoon title="Shop" />} />
          </Route>

          {/* links to the removed /buyer and /seller pages */}
          <Route path="buyer/product/:id" element={<LegacyProductLink />} />
          <Route path="buyer/*" element={<Navigate to="/" replace />} />
          <Route path="seller/*" element={<Navigate to="/seller-center" replace />} />

          {/* Test Console and the OAuth consent page keep the simulator layout */}
          <Route element={<LegacyLayout />}>
            <Route path="seller/authorize" element={<AuthorizePage />} />
            <Route path="console/*" element={<ConsolePage />} />
            <Route path="*" element={<div className="state state-empty">Page not found.</div>} />
          </Route>
        </Routes>
        <Toaster position="top-center" />
      </TooltipProvider>
    </AuthProvider>
  );
}
