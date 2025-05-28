// pages/privacy.tsx - separate file
import Link from 'next/link';

export default function Privacy() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
      <div className="prose prose-lg text-gray-600 space-y-6">
        <p>
          <strong>No code or project data is ever stored or shared.</strong> All uploads and analysis happen in memory
          and are deleted when your session ends. No user accounts or persistent logs are kept.
          Malware and abuse prevention is enforced for your security.
        </p>
        <p>
          <strong>Abuse/Legal contact:</strong> abuse@example.com
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
