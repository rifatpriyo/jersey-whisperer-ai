import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "./types";
import { seedProducts } from "./seed-data";

const STORAGE_KEY = "jerseybecho_products_v1";

interface Ctx {
  products: Product[];
  setProducts: (p: Product[]) => void;
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProductsState] = useState<Product[]>(seedProducts);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProductsState(JSON.parse(raw));
    } catch {}
  }, []);

  const setProducts = (p: Product[]) => {
    setProductsState(p);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
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
