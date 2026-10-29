import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { SessionProvider } from "./lib/session";
import { AdminShell } from "./shells/AdminShell";
import { CustomerShell } from "./shells/CustomerShell";
import { SellerShell } from "./shells/SellerShell";
import { Account } from "./pages/customer/Account";
import { Buy } from "./pages/customer/Buy";
import { FindSeller } from "./pages/customer/FindSeller";
import { Help } from "./pages/customer/Help";
import { Home } from "./pages/customer/Home";
import { PurchaseDetail } from "./pages/customer/PurchaseDetail";
import { Purchases } from "./pages/customer/Purchases";
import { Redeem } from "./pages/customer/Redeem";
import { SellerProfile } from "./pages/customer/SellerProfile";
import { SignIn } from "./pages/customer/SignIn";
import { Support } from "./pages/customer/Support";
import { SellerApply, SellerHome, SellerMore } from "./pages/seller/SellerHome";
import { CreateSale, SellerOrder, SellerOrders } from "./pages/seller/SellerSales";
import { SellerReferrals, SellerWallet } from "./pages/seller/SellerMoney";
import { SellerSettings, SellerSupport } from "./pages/seller/SellerAccount";
import { AdminCustomers, AdminHome, AdminOrders, AdminSellers } from "./pages/admin/AdminOps";
import { AdminPayouts, AdminSettings, AdminSupport } from "./pages/admin/AdminFinance";

function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        This page does not exist. <Link to="/">Go home</Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* Customer website: U01–U10, U27 */}
          <Route element={<CustomerShell />}>
            <Route index element={<Home />} />
            <Route path="signin" element={<SignIn />} />
            <Route path="help" element={<Help />} />
            <Route path="sellers" element={<FindSeller />} />
            <Route path="sellers/:id" element={<SellerProfile />} />
            <Route path="buy" element={<Buy />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="purchases/:ref" element={<PurchaseDetail />} />
            <Route path="account" element={<Account />} />
            <Route path="support" element={<Support />} />
            <Route path="redeem" element={<Redeem />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          {/* Seller app, mobile first: U11–U19 */}
          <Route path="seller" element={<SellerShell />}>
            <Route index element={<SellerHome />} />
            <Route path="apply" element={<SellerApply />} />
            <Route path="create" element={<CreateSale />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="orders/:ref" element={<SellerOrder />} />
            <Route path="wallet" element={<SellerWallet />} />
            <Route path="referrals" element={<SellerReferrals />} />
            <Route path="settings" element={<SellerSettings />} />
            <Route path="support" element={<SellerSupport />} />
            <Route path="more" element={<SellerMore />} />
          </Route>
          {/* Admin workspace: U20–U26 */}
          <Route path="admin" element={<AdminShell />}>
            <Route index element={<AdminHome />} />
            <Route path="sellers" element={<AdminSellers />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
