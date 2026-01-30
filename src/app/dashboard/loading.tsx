export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-amber-200 rounded-full animate-spin border-t-amber-500" />
        </div>
        <p className="text-gray-500 text-sm font-medium">Caricamento...</p>
      </div>
    </div>
  );
}
