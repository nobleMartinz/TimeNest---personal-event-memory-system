const DEFAULT_CURRENCY = 'NGN';

const CURRENCIES = Object.freeze([
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' }
]);

const CURRENCY_CODES = new Set(CURRENCIES.map((currency) => currency.code));

function isSupportedCurrency(code) {
  return CURRENCY_CODES.has(code);
}

function currencySymbol(code) {
  return CURRENCIES.find((currency) => currency.code === code)?.symbol || '';
}

// Amounts are stored as plain numbers, so the symbol is only ever a display
// detail. The symbol comes from the table above rather than from the browser,
// because a browser without full currency data falls back to the code and
// would print "NGN 4,200.50" instead of "₦4,200.50".
function formatAmount(value, currency = DEFAULT_CURRENCY) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const number = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeAmount);
  const entry = CURRENCIES.find((item) => item.code === currency);
  return entry ? `${entry.symbol}${number}` : number;
}

export {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  currencySymbol,
  formatAmount,
  isSupportedCurrency
};
