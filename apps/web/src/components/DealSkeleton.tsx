export default function DealSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-card animate-pulse">
      {/* Image area */}
      <div className="w-full h-48 bg-slate-100" />
      {/* Body */}
      <div className="p-3 flex flex-col gap-2.5">
        {/* Title lines */}
        <div className="h-3.5 bg-slate-100 rounded-full w-11/12" />
        <div className="h-3.5 bg-slate-100 rounded-full w-3/4" />
        {/* Stars */}
        <div className="flex gap-1 mt-0.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-3 h-3 bg-slate-100 rounded-sm" />
          ))}
        </div>
        {/* Price */}
        <div className="h-6 bg-slate-100 rounded-full w-2/5" />
        <div className="h-3 bg-slate-100 rounded-full w-1/3" />
        {/* Button */}
        <div className="h-10 bg-slate-100 rounded-xl mt-1" />
      </div>
    </div>
  );
}
