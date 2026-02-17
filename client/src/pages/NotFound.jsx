export default function NotFound() {
  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
      </div>
    </main>
  );
}
