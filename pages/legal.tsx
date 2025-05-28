// pages/legal.tsx
import Link from 'next/link';

export default function Legal() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Legal Disclaimer</h1>
      <div className="prose prose-lg text-gray-600 space-y-6">
        <p>
          Use of this tool is at your own risk. We make no warranty, express or implied, about
          the suitability of refactor suggestions or analysis. No responsibility is taken for any data loss.
        </p>
        <p>
          No user data is stored; all analysis is ephemeral and private.
        </p>
        <div className="mt-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
