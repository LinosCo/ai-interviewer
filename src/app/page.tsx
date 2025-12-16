import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-4">voler.AI Interviewer Platform</h1>
      </div>
      <div className="flex gap-4">
        <Link href="/dashboard" className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition">
          Go to Dashboard
        </Link>
        <Link href="/login" className="px-6 py-3 border border-gray-300 bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition">
          Login
        </Link>
      </div>
    </main>
  );
}
