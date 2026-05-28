import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, TrendBadge } from "@/components/Badges";
import { bdt, computeProfitMargin } from "@/lib/inventory-utils";
import { Search, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — JerseyBecho AI" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const { products, deleteProduct, resetDemo } = useStore();
  const [q, setQ] = useState("");
  const [edition, setEdition] = useState("all");
  const [mfg, setMfg] = useState("all");
  const [source, setSource] = useState("all");
  const [size, setSize] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const out: any[] = [];
    for (const p of products) {
      for (const v of p.variants) {
        out.push({ p, v });
      }
    }
    return out.filter(({ p, v }) => {
      if (q) {
        const t = q.toLowerCase();
        if (
          !p.product_name.toLowerCase().includes(t) &&
          !p.team_country_club.toLowerCase().includes(t) &&
          !(p.player_name || "").toLowerCase().includes(t)
        )
          return false;
      }
      if (edition !== "all" && p.edition_type !== edition) return false;
      if (mfg !== "all" && p.manufacturing_type !== mfg) return false;
      if (source !== "all" && p.source_country !== source) return false;
      if (size !== "all" && v.size !== size) return false;
      if (status !== "all" && v.status !== status) return false;
      return true;
    });
  }, [products, q, edition, mfg, source, size, status]);

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${rows.length} variants across ${products.length} products`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { resetDemo(); toast.success("Demo data reset"); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset demo
            </Button>
            <Link to="/add-product">
              <Button size="sm">+ Add product</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 grid md:grid-cols-6 gap-2">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search product / team / player" value={q} onChange={(e) => setQ(e.target.value)} />
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
              {["S","M","L","XL","XXL"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Player</TableHead>
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
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ p, v }) => (
                <TableRow key={`${p.id}-${v.id}`}>
                  <TableCell className="font-medium max-w-[220px] truncate">{p.product_name}</TableCell>
                  <TableCell>{p.team_country_club}</TableCell>
                  <TableCell>{p.player_name || "—"}</TableCell>
                  <TableCell>{p.season_year}</TableCell>
                  <TableCell>{p.kit_type}</TableCell>
                  <TableCell>{p.edition_type}</TableCell>
                  <TableCell>{p.manufacturing_type}</TableCell>
                  <TableCell>{p.source_country}</TableCell>
                  <TableCell className="font-mono">{v.size}</TableCell>
                  <TableCell className="text-right font-mono">{v.stock_quantity}</TableCell>
                  <TableCell className="text-right font-mono">{bdt(v.buy_price)}</TableCell>
                  <TableCell className="text-right font-mono">{bdt(v.selling_price)}</TableCell>
                  <TableCell className="text-right font-mono">{computeProfitMargin(v.buy_price, v.selling_price)}%</TableCell>
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                  <TableCell><TrendBadge trend={p.trend_signal} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.supplier_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.possible_restock_date || "—"}</TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={18} className="text-center py-12 text-muted-foreground">
                    No items match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
