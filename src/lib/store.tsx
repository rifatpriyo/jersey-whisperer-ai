import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "./types";
import { seedProducts } from "./seed-data";

const STORAGE_KEY = "jerseybecho_products_v3";

interface Ctx {
  products: Product[];
  setProducts: (p: Product[]) => void;
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  incrementQueryCount: (id: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<Ctx | null>(null);

function sanitize(list: any): Product[] {
  if (!Array.isArray(list)) return seedProducts;
  return list.map((p) => ({
    ...p,
    trend_signal: p?.trend_signal ?? "None",
    trend_reason: p?.trend_reason ?? "",
    query_count: Number.isFinite(p?.query_count) ? p.query_count : 0,
    variants: Array.isArray(p?.variants) ? p.variants : [],
  })) as Product[];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProductsState] = useState<Product[]>(seedProducts);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProductsState(sanitize(JSON.parse(raw)));
    } catch {}
  }, []);

  const setProducts = (p: Product[]) => {
    const clean = sanitize(p);
    setProductsState(clean);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {}
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        setProducts,
        addProduct: (p) => setProducts([p, ...products]),
        updateProduct: (p) => setProducts(products.map((x) => (x.id === p.id ? p : x))),
        deleteProduct: (id) => setProducts(products.filter((x) => x.id !== id)),
        incrementQueryCount: (id) =>
          setProducts(
            products.map((x) =>
              x.id === id ? { ...x, query_count: (x.query_count || 0) + 1 } : x,
            ),
          ),
        resetDemo: () => setProducts(seedProducts),
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}
