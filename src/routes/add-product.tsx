import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { ProductForm } from "@/components/ProductForm";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/add-product")({
  head: () => ({ meta: [{ title: "Add Product — JerseyBecho AI" }] }),
  component: AddPage,
});

function AddPage() {
  const { addProduct } = useStore();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Add Product" subtitle="New jersey listing for your AI-ready inventory" />
      <Card>
        <CardContent className="p-6">
          <ProductForm
            onSubmit={(p) => {
              addProduct(p);
              toast.success(`${p.product_name} added`);
              navigate({ to: "/inventory" });
            }}
            submitLabel="Add to Inventory"
          />
        </CardContent>
      </Card>
    </>
  );
}
