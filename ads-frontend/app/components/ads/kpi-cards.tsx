import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export interface KpiItem {
  label: string;
  value: string | null; // null means no delivery data yet
  hint?: string;
}

/** Summary cards above the table. Values come from the account report for the selected range. */
export function KpiCards({ items, loading }: { items: KpiItem[]; loading: boolean }) {
  return (
    <section aria-label="Summary for selected date range" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} size="sm" className="rounded-lg border-border shadow-none">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-7 w-20 animate-pulse rounded-md bg-muted" aria-hidden="true" />
            ) : item.value === null ? (
              <p className="text-base font-semibold text-muted-foreground">No data yet</p>
            ) : (
              <p className={cn("text-xl font-semibold tabular-nums tracking-tight text-foreground")}>{item.value}</p>
            )}
            {item.hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
