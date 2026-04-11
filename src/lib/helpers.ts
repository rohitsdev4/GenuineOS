// Currency formatter for Indian Rupee
export function formatCurrency(amount: number, currency: string = '₹'): string {
  return `${currency}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Format date
export function formatDate(date: string | Date, format: string = 'DD/MM/YYYY'): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD MMM YYYY':
      return `${day} ${d.toLocaleString('en', { month: 'short' })} ${year}`;
    case 'relative':
      return getRelativeDate(d);
    default:
      return `${day}/${month}/${year}`;
  }
}

function getRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// Parse Indian number formats
export function parseIndianNumber(str: string): number {
  if (!str) return 0;
  str = str.toLowerCase().trim();

  // Handle lakh/crore
  if (str.includes('crore')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return num * 10000000;
  }
  if (str.includes('lakh') || str.includes('lac')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return num * 100000;
  }

  // Remove commas and parse
  return parseFloat(str.replace(/,/g, '')) || 0;
}

// Priority colors
export const priorityColors: Record<string, string> = {
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-500 border-red-500/20',
};

// Status colors
export const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  completed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'in-progress': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  overdue: 'bg-red-500/10 text-red-500 border-red-500/20',
  partial: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  received: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'on-hold': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  inactive: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

// Expense categories (matching spreadsheet)
export const expenseCategories = [
  'Labour Payment', 'Travel', 'Daily Expense', 'Food',
  'Material Purchased', 'Other', 'general', 'materials', 'rent', 'salary',
  'fuel', 'maintenance', 'tools', 'equipment', 'electricity',
  'internet', 'phone', 'insurance', 'tax', 'Payment Received', 'N/A',
];

// Payment modes
export const paymentModes = ['cash', 'upi', 'bank', 'cheque', 'card', 'online'];

// Task priorities
export const taskPriorities = ['low', 'medium', 'high', 'urgent'];

// Task statuses
export const taskStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
