import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PosTerminal } from "@/components/PosTerminal";
import { isFaptekaSku } from "@/lib/integrations/fapteka/mapping";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const products = await db.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, salePrice: true, stock: true, sku: true },
  });
  const localProducts = products.filter((product) => !isFaptekaSku(product.sku));

  return (
    <div>
      <PageHeader title="Kassa (POS)" subtitle="ERP ichki savdosi. F-Apteka savdolari integratsiya orqali keladi" />
      <PosTerminal
        products={localProducts.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          salePrice: Number(p.salePrice),
          stock: p.stock,
        }))}
      />
    </div>
  );
}
