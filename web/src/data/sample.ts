// Illustrative data for screens whose backend step is not built yet.
// Prices are placeholders, not production values.
import type { Tone } from "../components/ui";

export interface Plan {
  code: string;
  name: string;
  days: number;
  lifetime?: boolean;
  price: number;
  period: string;
  perks: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  { code: "weekly", name: "Weekly", days: 7, price: 25000, period: "7 days", perks: ["Full access to Nahj app", "All learning content"] },
  { code: "monthly", name: "Monthly", days: 30, price: 49000, period: "30 days", perks: ["Full access to Nahj app", "All learning content", "Progress tracking"] },
  { code: "6month", name: "6-Month", days: 180, price: 249000, period: "180 days", perks: ["Everything in Monthly", "Better value"] },
  { code: "yearly", name: "Yearly", days: 365, price: 450000, period: "365 days", perks: ["Everything in Monthly", "Best value per month", "Continuous learning"], popular: true },
  { code: "lifetime", name: "Lifetime", days: 36500, lifetime: true, price: 1200000, period: "one-time", perks: ["VIP for as long as your account exists", "Learn without limits"] },
];

export const planBy = (code: string) => PLANS.find((p) => p.code === code) ?? PLANS[1]!;

export interface Seller {
  id: string;
  name: string;
  city: string;
  about: string;
  agentCode: string;
}

export const SELLERS: Seller[] = [
  { id: "dzaki-learning", name: "Dzaki Learning", city: "Jakarta", about: "Fun and structured learning with experienced teachers.", agentCode: "AGT-7K2M3P" },
  { id: "cerdas-bersama", name: "Cerdas Bersama", city: "Bandung", about: "Helping children grow through Islamic learning.", agentCode: "AGT-Q4R8TW" },
  { id: "anak-sholeh", name: "Anak Sholeh", city: "Surabaya", about: "Interactive and engaging Nahj learning for all ages.", agentCode: "AGT-H6N2XC" },
  { id: "rumah-ilmu", name: "Rumah Ilmu", city: "Yogyakarta", about: "Building strong character through knowledge.", agentCode: "AGT-B9D3KM" },
  { id: "mitra-nahj", name: "Mitra Nahj", city: "Bekasi", about: "Learn, practise and grow together.", agentCode: "AGT-P7V5ZJ" },
  { id: "sahabat-anak", name: "Sahabat Anak", city: "Medan", about: "Making Islamic learning enjoyable at home.", agentCode: "AGT-F3G8RY" },
];

export const sellerBy = (id: string) => SELLERS.find((s) => s.id === id);
export const CITIES = [...new Set(SELLERS.map((s) => s.city))].sort();

export type PaymentStatus = "paid" | "checking" | "awaiting" | "refunded";
export type DeliveryStatus = "activated" | "codes_ready" | "partially_refunded" | "activating" | "none";

export interface Purchase {
  ref: string;
  sellerId: string;
  plan: string;
  qty: number;
  amount: number;
  payment: PaymentStatus;
  delivery: DeliveryStatus;
  method: "QRIS" | "BCA VA" | "BNI VA";
  at: string;
  codes?: { masked: string; status: "ready" | "redeemed" | "refunded" }[];
}

export const PURCHASES: Purchase[] = [
  { ref: "NHO-261028-7K2M", sellerId: "rumah-ilmu", plan: "yearly", qty: 1, amount: 450000, payment: "paid", delivery: "activated", method: "QRIS", at: "2026-10-28T07:12:00Z" },
  {
    ref: "NHO-261021-Q4R8", sellerId: "cerdas-bersama", plan: "monthly", qty: 3, amount: 147000, payment: "paid", delivery: "codes_ready", method: "BCA VA", at: "2026-10-21T03:40:00Z",
    codes: [
      { masked: "NHJ-7K2M-****-9D4F", status: "ready" },
      { masked: "NHJ-P3L8-****-2A1C", status: "redeemed" },
      { masked: "NHJ-X5T2-****-8H3K", status: "ready" },
    ],
  },
  { ref: "NHO-261019-H6N2", sellerId: "anak-sholeh", plan: "monthly", qty: 1, amount: 49000, payment: "checking", delivery: "none", method: "QRIS", at: "2026-10-19T09:05:00Z" },
  {
    ref: "NHO-261002-B9D3", sellerId: "mitra-nahj", plan: "yearly", qty: 2, amount: 900000, payment: "paid", delivery: "partially_refunded", method: "BNI VA", at: "2026-10-02T11:30:00Z",
    codes: [
      { masked: "NHJ-R2W7-****-4M6P", status: "redeemed" },
      { masked: "NHJ-K8C3-****-7T2V", status: "refunded" },
    ],
  },
];

export const paymentPill: Record<PaymentStatus, [Tone, string]> = {
  paid: ["success", "Paid"],
  checking: ["warning", "Checking"],
  awaiting: ["info", "Awaiting payment"],
  refunded: ["danger", "Refunded"],
};

export const deliveryPill: Record<DeliveryStatus, [Tone, string]> = {
  activated: ["success", "Activated"],
  codes_ready: ["info", "Codes ready"],
  partially_refunded: ["danger", "Partially refunded"],
  activating: ["warning", "Activating"],
  none: ["neutral", "—"],
};

// ---- Seller ----
export interface SellerOrder {
  ref: string;
  customer: string;
  plan: string;
  qty: number;
  total: number;
  channel: "web" | "store";
  status: "paid_fulfilled" | "awaiting_payment" | "checking" | "refunded";
  codes?: { redeemed: number; unused: number };
  at: string;
}

export const SELLER_ORDERS: SellerOrder[] = [
  { ref: "NHO-261029-4F7A", customer: "nur***@gmail.com", plan: "monthly", qty: 1, total: 49000, channel: "web", status: "paid_fulfilled", at: "2026-10-29T06:20:00Z" },
  { ref: "NHO-261029-AGT1", customer: "rina***@gmail.com", plan: "yearly", qty: 1, total: 450000, channel: "store", status: "paid_fulfilled", at: "2026-10-29T02:05:00Z" },
  { ref: "NHO-261028-2C9D", customer: "ani***@gmail.com", plan: "monthly", qty: 1, total: 49000, channel: "web", status: "awaiting_payment", at: "2026-10-28T13:40:00Z" },
  { ref: "NHO-261027-8B1E", customer: "budi***@sekolah.id", plan: "yearly", qty: 10, total: 4500000, channel: "web", status: "paid_fulfilled", codes: { redeemed: 4, unused: 6 }, at: "2026-10-27T04:10:00Z" },
  { ref: "NHO-261025-6E3F", customer: "dewi***@gmail.com", plan: "monthly", qty: 1, total: 49000, channel: "web", status: "refunded", at: "2026-10-25T09:55:00Z" },
];

export const sellerOrderPill: Record<SellerOrder["status"], [Tone, string]> = {
  paid_fulfilled: ["success", "Paid · Fulfilled"],
  awaiting_payment: ["info", "Awaiting payment"],
  checking: ["warning", "Checking payment"],
  refunded: ["danger", "Refunded"],
};

export const WALLET = { available: 1250000, pending: 780000, held: 100000, withdrawn: 3400000, owed: 0 };

export const EARNINGS = [
  { at: "2026-10-29T06:20:00Z", ref: "NHO-261029-4F7A", plan: "monthly", amount: 4900, state: "Pending", release: "Releases 5 Nov" },
  { at: "2026-10-29T02:05:00Z", ref: "NHO-261029-AGT1", plan: "yearly", amount: 45000, state: "Pending", release: "App store · releases 1 Nov" },
  { at: "2026-10-27T04:10:00Z", ref: "NHO-261027-8B1E", plan: "yearly", amount: 180000, state: "Pending", release: "4 of 10 codes redeemed" },
  { at: "2026-10-12T10:00:00Z", ref: "NHO-261012-9K2L", plan: "yearly", amount: 45000, state: "Available", release: "Released 19 Oct" },
];

export const REFERRED = [
  { name: "Ahmad Rahman", joined: "2026-09-02T00:00:00Z", sales: 2400000, target: 3000000, state: "In progress" as const },
  { name: "Siti Nurhayati", joined: "2026-09-15T00:00:00Z", sales: 3150000, target: 3000000, state: "Target reached" as const },
  { name: "Budi Santoso", joined: "2026-10-01T00:00:00Z", sales: 320000, target: 3000000, state: "In progress" as const },
];

export const CONVERSATIONS = [
  { id: "c1", who: "Dewi Nur", topic: "Access to content", ref: "NHO-261029-4F7A", at: "2026-10-29T08:00:00Z", unread: true, messages: [
    { from: "them", text: "I bought the monthly plan but the lessons are still locked on my tablet." },
    { from: "me", text: "Thanks, I'm checking right away. Did you sign in with the same account?" },
  ] },
  { id: "c2", who: "Rizky Saputra", topic: "Codes for my class", ref: "NHO-261027-8B1E", at: "2026-10-27T05:00:00Z", unread: false, messages: [
    { from: "them", text: "Where can I find the codes for my students?" },
    { from: "me", text: "They are in My Purchases on nahj.ryam.app, under the order." },
  ] },
  { id: "c3", who: "Aisyah Lestari", topic: "Payment confirmation", ref: "NHO-261028-2C9D", at: "2026-10-28T14:00:00Z", unread: false, messages: [
    { from: "them", text: "I paid by BCA VA, is it confirmed?" },
  ] },
];

// ---- Admin ----
export const ATTENTION = [
  { issue: "Payment needs review", related: "Order NHO-261019-H6N2 · Anak Sholeh", age: "2h", owner: "Unassigned", status: ["warning", "Checking"] as [Tone, string], action: "Check status", to: "/admin/orders" },
  { issue: "Fulfillment retrying", related: "Order NHO-261029-9X2Q · Mitra Nahj", age: "35m", owner: "Operations", status: ["warning", "Recovery"] as [Tone, string], action: "View", to: "/admin/orders" },
  { issue: "Refund request", related: "Order NHO-261027-8B1E · 6 unused codes", age: "1d", owner: "Dimas", status: ["info", "Review"] as [Tone, string], action: "Review", to: "/admin/orders" },
  { issue: "Seller application", related: "Siti Rahma · Jakarta", age: "1d", owner: "Unassigned", status: ["warning", "Pending"] as [Tone, string], action: "Open", to: "/admin/sellers" },
  { issue: "Withdrawal above threshold", related: "WD-261028-001 · Rumah Ilmu", age: "2d", owner: "Rina", status: ["info", "Second approval"] as [Tone, string], action: "Review", to: "/admin/payouts" },
];

export const APPLICATIONS = [
  { name: "Siti Rahma", ref: "APP-261021", city: "Jakarta", applied: "2026-10-21T00:00:00Z", status: ["warning", "Under review"] as [Tone, string], reviewer: "Unassigned", phone: "+62 812 **** 7890", about: "Teacher sharing Islamic learning with parents in her neighbourhood." },
  { name: "Ahmad Fauzi", ref: "APP-261020", city: "Bandung", applied: "2026-10-20T00:00:00Z", status: ["info", "More info requested"] as [Tone, string], reviewer: "Dimas", phone: "+62 813 **** 1122", about: "Runs a small bookshop near three schools." },
  { name: "Toko Pintar", ref: "APP-261019", city: "Surabaya", applied: "2026-10-19T00:00:00Z", status: ["warning", "Under review"] as [Tone, string], reviewer: "Rina", phone: "+62 815 **** 4455", about: "Online store for children's learning products." },
  { name: "Budi Santoso", ref: "APP-261016", city: "Semarang", applied: "2026-10-16T00:00:00Z", status: ["danger", "Rejected"] as [Tone, string], reviewer: "Rina", phone: "+62 817 **** 9900", about: "—" },
];

export const ADMIN_ORDERS = [
  { ref: "NHO-261029-4F7A", channel: "web", customer: "Nur Aini", seller: "Dzaki Learning", at: "2026-10-29T06:20:00Z", total: 49000, payment: ["success", "Paid"] as [Tone, string], fulfillment: ["success", "Completed"] as [Tone, string], refund: "None" },
  { ref: "NHO-261029-AGT1", channel: "store", customer: "Rina Kusuma", seller: "Dzaki Learning", at: "2026-10-29T02:05:00Z", total: 450000, payment: ["success", "Paid (Google Play)"] as [Tone, string], fulfillment: ["success", "Completed"] as [Tone, string], refund: "None" },
  { ref: "NHO-261019-H6N2", channel: "web", customer: "Siti Amanah", seller: "Anak Sholeh", at: "2026-10-19T09:05:00Z", total: 49000, payment: ["warning", "Needs review"] as [Tone, string], fulfillment: ["neutral", "Not started"] as [Tone, string], refund: "None" },
  { ref: "NHO-261027-8B1E", channel: "web", customer: "Budi Hartono", seller: "Dzaki Learning", at: "2026-10-27T04:10:00Z", total: 4500000, payment: ["success", "Paid"] as [Tone, string], fulfillment: ["success", "Completed"] as [Tone, string], refund: "Requested (6 units)" },
  { ref: "NHO-261025-6E3F", channel: "web", customer: "Dewi Lestari", seller: "Cerdas Bersama", at: "2026-10-25T09:55:00Z", total: 49000, payment: ["success", "Paid"] as [Tone, string], fulfillment: ["success", "Completed"] as [Tone, string], refund: "Full" },
];

export const CUSTOMERS = [
  { name: "Siti Amanah", email: "siti.amanah@email.com", status: "Active", joined: "2026-01-12T00:00:00Z", vip: "Until 19 Nov 2026" },
  { name: "Budi Hartono", email: "budi.hartono@sekolah.id", status: "Active", joined: "2026-02-05T00:00:00Z", vip: "No active VIP" },
  { name: "Aisyah Putri", email: "aisyah.putri@email.com", status: "Active", joined: "2026-02-18T00:00:00Z", vip: "Lifetime · until 18 Feb 2126" },
  { name: "Rizky Maulana", email: "rizky.maulana@email.com", status: "Active", joined: "2026-03-01T00:00:00Z", vip: "Until 3 Mar 2027" },
  { name: "Dewi Lestari", email: "dewi.lestari@email.com", status: "Active", joined: "2026-03-12T00:00:00Z", vip: "No active VIP" },
];

export const PAYOUTS = [
  { ref: "WD-261028-001", seller: "Rumah Ilmu", at: "2026-10-28T03:24:00Z", gross: 2100000, fee: 2500, status: ["info", "Second approval"] as [Tone, string], reason: "Above threshold" },
  { ref: "WD-261027-003", seller: "Cerdas Bersama", at: "2026-10-27T08:10:00Z", gross: 850000, fee: 2500, status: ["warning", "Pending"] as [Tone, string], reason: "First withdrawal" },
  { ref: "WD-261026-002", seller: "Dzaki Learning", at: "2026-10-26T02:00:00Z", gross: 1250000, fee: 2500, status: ["info", "Processing"] as [Tone, string], reason: "—" },
  { ref: "WD-261020-001", seller: "Mitra Nahj", at: "2026-10-20T05:00:00Z", gross: 780000, fee: 2500, status: ["success", "Paid"] as [Tone, string], reason: "—" },
  { ref: "WD-261018-004", seller: "Sahabat Anak", at: "2026-10-18T05:00:00Z", gross: 920000, fee: 2500, status: ["danger", "Failed"] as [Tone, string], reason: "Account name mismatch" },
];

export const CASES = [
  { id: "CS-261029-001", who: "Dewi N.", topic: "Cannot access lessons", status: ["warning", "Waiting for customer"] as [Tone, string], age: "2h", order: "NHO-261029-4F7A", owner: "Sarah A." },
  { id: "CS-261028-003", who: "Budi H.", topic: "Refund of 6 unused codes", status: ["info", "Open"] as [Tone, string], age: "1d", order: "NHO-261027-8B1E", owner: "Unassigned" },
  { id: "CS-261027-002", who: "Siti L.", topic: "Question about Lifetime", status: ["info", "Open"] as [Tone, string], age: "2d", order: "—", owner: "Sarah A." },
  { id: "CS-261025-001", who: "Hendra S.", topic: "Change email address", status: ["success", "Resolved"] as [Tone, string], age: "4d", order: "—", owner: "Dimas" },
];
