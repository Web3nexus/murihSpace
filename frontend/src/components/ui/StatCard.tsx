import React from "react";

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  color: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 transition-all duration-300 hover:-translate-y-1 group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 transition-opacity group-hover:opacity-40 ${color}`}></div>
      <div className="relative z-10 flex flex-col gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} bg-opacity-10 text-opacity-100`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}
