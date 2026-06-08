import type { UserProfile, ModelAdvice } from '../types';

export const formatCurrency = (cents: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cents / 100);

export const formatPercent = (bps: number) => `${(bps / 100).toFixed(2)}%`;
export const formatPercentValue = (value: number) => `${value.toFixed(0)}%`;
export const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const getFirstName = (user: UserProfile | null) => {
  const raw = user?.displayName?.trim() || user?.email?.trim() || 'there';
  return raw.split(/\s+/)[0] || 'there';
};

export const formatOrdinal = (value: number) => {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
};

export const formatConfidence = (confidence: ModelAdvice['confidence']) =>
  confidence.charAt(0).toUpperCase() + confidence.slice(1);

export const escapeAttribute = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export const slug = () => Math.random().toString(36).slice(2, 10);

export const centsToInput = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);

export const bpsToInput = (bps: number | null | undefined) =>
  bps === null || bps === undefined ? '' : (bps / 100).toFixed(2);