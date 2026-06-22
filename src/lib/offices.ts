/**
 * Offices data hook – DB first, static fallback
 * C3 – unified source of truth
 */
import { useEffect, useState } from 'react';
import { api } from './api';
import type { Office } from '../data/offices';
import { OFFICES as FALLBACK_OFFICES, officeById as staticOfficeById } from '../data/offices';

let cache: Office[] | null = null;
let cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;

export function useOffices() {
  const [offices, setOffices] = useState<Office[]>(cache ?? FALLBACK_OFFICES);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    if (cache && now - cacheAt < CACHE_MS) {
      setOffices(cache);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getOffices().then(list => {
      if (cancelled) return;
      cache = list;
      cacheAt = Date.now();
      setOffices(list);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return { offices, loading, officeById: (id: string) => offices.find(o => o.id === id) ?? staticOfficeById(id) };
}

// synchronous fallback for places that can't use hooks yet
export function getOfficesSync(): Office[] {
  return cache ?? FALLBACK_OFFICES;
}
export { officeById as staticOfficeById } from '../data/offices';
