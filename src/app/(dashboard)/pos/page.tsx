import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PosTerminal } from "@/components/PosTerminal";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const products = await db.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, salePrice: true, stock: true },
  });

  return (
    <div>
      <PageHeader title="Kassa (POS)" subtitle="Sotuv oynasi — ombor avtomatik kamayadi, mijoz ball to'playdi" />
      <PosTerminal
        products={products.map((p) => ({
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
