/**
 * Bo'lim almashayotganda darhol chiqadigan skelet.
 *
 * Sahifalar ma'lumotni serverdan oladi va bu bir necha yuz ms davom etadi.
 * Busiz menyuda bosilgandan keyin ekran qotib turgandek ko'rinardi. Endi
 * bosilishi bilan yangi bo'lim ochiladi, raqamlar esa keyin to'ladi.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="mb-5 space-y-2">
        <div className="h-6 w-56 rounded-md bg-edge" />
        <div className="h-4 w-80 max-w-full rounded-md bg-edge/60" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-24 p-4">
            <div className="h-3 w-20 rounded bg-edge" />
            <div className="mt-3 h-6 w-28 rounded bg-edge" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card space-y-3 p-4">
            <div className="h-4 w-40 rounded bg-edge" />
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="h-3 rounded bg-edge/60" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
