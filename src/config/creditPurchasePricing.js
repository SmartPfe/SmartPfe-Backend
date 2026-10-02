const DEFAULT_PURCHASE_CURRENCY = "TND";
const DEFAULT_PRICE_PER_CREDIT = 0.05;
const DEFAULT_PURCHASE_PACKAGES = Object.freeze([
  { key: "credits_100", label: "100 credits", credits: 100 },
  { key: "credits_250", label: "250 credits", credits: 250 },
  { key: "credits_500", label: "500 credits", credits: 500 },
]);

const toPositiveNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const parseConfiguredPackages = () => {
  if (!process.env.CREDIT_PURCHASE_PACKAGES) return DEFAULT_PURCHASE_PACKAGES;
  try {
    const parsed = JSON.parse(process.env.CREDIT_PURCHASE_PACKAGES);
    if (!Array.isArray(parsed)) return DEFAULT_PURCHASE_PACKAGES;
    const packages = parsed
      .map((item) => ({
        key: String(item.key || "").trim(),
        label: String(item.label || "").trim(),
        credits: Math.trunc(Number(item.credits) || 0),
      }))
      .filter((item) => item.key && item.label && item.credits > 0);
    return packages.length ? packages : DEFAULT_PURCHASE_PACKAGES;
  } catch {
    return DEFAULT_PURCHASE_PACKAGES;
  }
};

const getCreditPurchasePricing = () => {
  const pricePerCredit = toPositiveNumber(process.env.CREDIT_PURCHASE_PRICE_PER_CREDIT_TND, DEFAULT_PRICE_PER_CREDIT);
  const currency = String(process.env.CREDIT_PURCHASE_CURRENCY || DEFAULT_PURCHASE_CURRENCY).trim().toUpperCase() || DEFAULT_PURCHASE_CURRENCY;
  const packages = parseConfiguredPackages().map((item) => ({
    ...item,
    price: Math.round(item.credits * pricePerCredit * 100) / 100,
    currency,
  }));
  return { pricePerCredit, currency, packages };
};

module.exports = {
  getCreditPurchasePricing,
};
