import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge, TrendBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bdt, computeProfitMargin } from "@/lib/inventory-utils";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ProductForm = lazy(() =>
  import("@/components/ProductForm").then((module) => ({ default: module.ProductForm })),
);

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory - JerseyBecho AI" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const { products, deleteProduct, resetDemo, updateProduct } = useStore();
  const [q, setQ] = useState("");
  const [edition, setEdition] = useState("all");
  const [mfg, setMfg] = useState("all");
  const [source, setSource] = useState("all");
  const [size, setSize] = useState("all");
  const [status, setStatus] = useState("all");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const rows = useMemo(() => {
    const out: Array<{ p: Product; v: Product["variants"][number] }> = [];
    for (const product of products) {
      for (const variant of product.variants) {
        out.push({ p: product, v: variant });
      }
    }

    return out.filter(({ p, v }) => {
      if (q) {
        const term = q.toLowerCase();
        if (
          !p.product_name.toLowerCase().includes(term) &&
          !p.team_country_club.toLowerCase().includes(term) &&
          !(p.player_name || "").toLowerCase().includes(term) &&
          !(p.font_name || "").toLowerCase().includes(term)
        ) {
          return false;
        }
      }
      if (edition !== "all" && p.edition_type !== edition) return false;
      if (mfg !== "all" && p.manufacturing_type !== mfg) return false;
      if (source !== "all" && p.source_country !== source) return false;
      if (size !== "all" && v.size !== size) return false;
      if (status !== "all" && v.status !== status) return false;
      return true;
    });
  }, [edition, mfg, products, q, size, source, status]);

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${rows.length} variants across ${products.length} products`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetDemo();
                toast.success("Demo data reset");
              }}
            >
              <RotateCcw className="mr-1 h-4 w-4" /> Reset demo
            </Button>
            <Button asChild size="sm">
              <Link to="/add-product">+ Add product</Link>
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-2 p-4 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search product / team / font / print"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <Select value={edition} onValueChange={setEdition}>
            <SelectTrigger><SelectValue placeholder="Edition" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All editions</SelectItem>
              <SelectItem value="Player Edition">Player Edition</SelectItem>
              <SelectItem value="Fan Edition">Fan Edition</SelectItem>
              <SelectItem value="Retro Kit">Retro Kit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mfg} onValueChange={setMfg}>
            <SelectTrigger><SelectValue placeholder="Manufacturing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All manufacturing</SelectItem>
              <SelectItem value="Imported">Imported</SelectItem>
              <SelectItem value="BD-made">BD-made</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="China">China</SelectItem>
              <SelectItem value="Thailand">Thailand</SelectItem>
              <SelectItem value="Bangladesh">Bangladesh</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Available">Available</SelectItem>
              <SelectItem value="Low Stock">Low Stock</SelectItem>
              <SelectItem value="Out of Stock">Out of Stock</SelectItem>
              <SelectItem value="Preorder">Preorder</SelectItem>
            </SelectContent>
          </Select>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger><SelectValue placeholder="Size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sizes</SelectItem>
              {["S", "M", "L", "XL", "XXL"].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Font / Print</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Kit</TableHead>
                <TableHead>Edition</TableHead>
                <TableHead>Mfg</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Buy</TableHead>
                <TableHead className="text-right">Sell</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Restock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ p, v }) => (
                <TableRow key={`${p.id}-${v.id}`}>
                  <TableCell>
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                      {p.product_image_url ? (
                        <img
                          src={p.product_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            (event.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">JRSY</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate font-medium">{p.product_name}</TableCell>
                  <TableCell>{p.team_country_club}</TableCell>
                  <TableCell>{p.font_name || p.player_name || "-"}</TableCell>
                  <TableCell>{p.season_year}</TableCell>
                  <TableCell>{p.kit_type}</TableCell>
                  <TableCell>{p.edition_type}</TableCell>
                  <TableCell>{p.manufacturing_type}</TableCell>
                  <TableCell>{p.source_country}</TableCell>
                  <TableCell className="font-mono">{v.size}</TableCell>
                  <TableCell className="text-right font-mono">{v.stock_quantity}</TableCell>
                  <TableCell className="text-right font-mono">{bdt(v.buy_price)}</TableCell>
                  <TableCell className="text-right font-mono">{bdt(v.selling_price)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {computeProfitMargin(v.buy_price, v.selling_price)}%
                  </TableCell>
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                  <TableCell><TrendBadge trend={p.trend_signal} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.supplier_name || "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.possible_restock_date || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingProduct(p)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete ${p.product_name}?`)) {
                            deleteProduct(p.id);
                            toast.success("Product deleted");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={19} className="py-12 text-center text-muted-foreground">
                    No items match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingProduct)} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update pricing, stock, sizing, trend signal, and supplier details for this product.
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading editor...</div>}>
              <ProductForm
                key={editingProduct.id}
                initial={editingProduct}
                submitLabel="Save Changes"
                onSubmit={(product) => {
                  updateProduct(product);
                  setEditingProduct(null);
                  toast.success("Product updated");
                }}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
