import { useState } from "react";
import type { Product, Variant, Size, EditionType, ManufacturingType, SourceCountry, KitType, TrendSignal } from "@/lib/types";
import { computeStatus, computeProfitMargin, defaultPrices } from "@/lib/inventory-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

const SIZES: Size[] = ["S", "M", "L", "XL", "XXL"];

interface Props {
  initial?: Product;
  onSubmit: (p: Product) => void;
  submitLabel?: string;
}

function emptyVariant(buy = 800, sell = 1099): Variant {
  return {
    id: crypto.randomUUID(),
    size: "M",
    stock_quantity: 10,
    low_stock_threshold: 3,
    buy_price: buy,
    selling_price: sell,
    status: "Available",
    stocked_date: new Date().toISOString().slice(0, 10),
    possible_restock_date: "",
    notes: "",
  };
}

export function ProductForm({ initial, onSubmit, submitLabel = "Save Product" }: Props) {
  const [form, setForm] = useState<Product>(
    initial || {
      id: crypto.randomUUID(),
      product_name: "",
      team_country_club: "",
      player_name: "",
      season_year: 2026,
      kit_type: "Home",
      edition_type: "Player Edition",
      manufacturing_type: "Imported",
      source_country: "Thailand",
      supplier_name: "",
      product_image_url: "",
      trend_signal: "Medium",
      trend_reason: "",
      popularity_score: 60,
      query_count: 0,
      created_at: new Date().toISOString(),
      variants: [emptyVariant(800, 1099)],
    },
  );

  const update = <K extends keyof Product>(k: K, v: Product[K]) => {
    const next = { ...form, [k]: v };
    if (k === "edition_type" || k === "manufacturing_type") {
      const dp = defaultPrices(next.edition_type, next.manufacturing_type);
      next.variants = next.variants.map((va) => ({
        ...va,
        buy_price: dp.buy,
        selling_price: dp.sell,
      }));
      if (k === "manufacturing_type") {
        if (v === "BD-made") next.source_country = "Bangladesh";
        else if (next.source_country === "Bangladesh") next.source_country = "Thailand";
      }
    }
    setForm(next);
  };

  const updateVariant = (id: string, patch: Partial<Variant>) => {
    setForm({
      ...form,
      variants: form.variants.map((v) => {
        if (v.id !== id) return v;
        const merged = { ...v, ...patch };
        merged.status = computeStatus(merged.stock_quantity, merged.low_stock_threshold, merged.status === "Preorder");
        return merged;
      }),
    });
  };

  const addVariant = () => {
    const dp = defaultPrices(form.edition_type, form.manufacturing_type);
    setForm({ ...form, variants: [...form.variants, emptyVariant(dp.buy, dp.sell)] });
  };
  const removeVariant = (id: string) =>
    setForm({ ...form, variants: form.variants.filter((v) => v.id !== id) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const sourceOptions: SourceCountry[] =
    form.manufacturing_type === "BD-made" ? ["Bangladesh"] : ["China", "Thailand"];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Product name</Label>
          <Input
            required
            value={form.product_name}
            onChange={(e) => update("product_name", e.target.value)}
            placeholder="e.g. Argentina Messi Home Kit 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Team / Country / Club</Label>
          <Input
            required
            value={form.team_country_club}
            onChange={(e) => update("team_country_club", e.target.value)}
            placeholder="Argentina"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Player name</Label>
          <Input
            value={form.player_name || ""}
            onChange={(e) => update("player_name", e.target.value)}
            placeholder="Messi"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Season / Year</Label>
          <Input
            type="number"
            value={form.season_year}
            onChange={(e) => update("season_year", parseInt(e.target.value) || 2026)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kit type</Label>
          <Select value={form.kit_type} onValueChange={(v) => update("kit_type", v as KitType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["Home", "Away", "Third", "Retro"] as KitType[]).map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Edition type</Label>
          <Select value={form.edition_type} onValueChange={(v) => update("edition_type", v as EditionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["Player Edition", "Fan Edition", "Retro Kit"] as EditionType[]).map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Manufacturing type</Label>
          <Select value={form.manufacturing_type} onValueChange={(v) => update("manufacturing_type", v as ManufacturingType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["Imported", "BD-made"] as ManufacturingType[]).map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Source country</Label>
          <Select value={form.source_country} onValueChange={(v) => update("source_country", v as SourceCountry)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {sourceOptions.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Supplier name</Label>
          <Input
            value={form.supplier_name || ""}
            onChange={(e) => update("supplier_name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Trend signal</Label>
          <Select value={form.trend_signal} onValueChange={(v) => update("trend_signal", v as TrendSignal)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["Low", "Medium", "High"] as TrendSignal[]).map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label>Trend reason</Label>
          <Textarea
            value={form.trend_reason || ""}
            onChange={(e) => update("trend_reason", e.target.value)}
            placeholder="World Cup 2026 hype, viral post, etc."
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Sizes & Stock</h3>
          <Button type="button" size="sm" variant="outline" onClick={addVariant}>
            <Plus className="h-4 w-4 mr-1" /> Add size
          </Button>
        </div>
        <div className="space-y-3">
          {form.variants.map((v) => (
            <div
              key={v.id}
              className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end p-3 rounded-lg border border-border bg-muted/30"
            >
              <div className="space-y-1">
                <Label className="text-xs">Size</Label>
                <Select value={v.size} onValueChange={(s) => updateVariant(v.id, { size: s as Size })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stock qty</Label>
                <Input type="number" value={v.stock_quantity}
                  onChange={(e) => updateVariant(v.id, { stock_quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Low threshold</Label>
                <Input type="number" value={v.low_stock_threshold}
                  onChange={(e) => updateVariant(v.id, { low_stock_threshold: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Buy ৳</Label>
                <Input type="number" value={v.buy_price}
                  onChange={(e) => updateVariant(v.id, { buy_price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sell ৳</Label>
                <Input type="number" value={v.selling_price}
                  onChange={(e) => updateVariant(v.id, { selling_price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Margin</Label>
                <div className="h-9 px-3 flex items-center text-sm rounded-md border border-input bg-background">
                  {computeProfitMargin(v.buy_price, v.selling_price)}%
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Restock date</Label>
                  <Input type="date" value={v.possible_restock_date || ""}
                    onChange={(e) => updateVariant(v.id, { possible_restock_date: e.target.value })} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(v.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="submit" size="lg">{submitLabel}</Button>
      </div>
    </form>
  );
}
