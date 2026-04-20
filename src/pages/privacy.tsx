import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { config } from "@/lib/config";

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <main className="flex-1 min-h-screen bg-black">
          <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
            <div className="flex items-center gap-4 px-5 py-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-violet-400 to-fuchsia-400">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Privacy Policy</h1>
                  <p className="text-xs text-gray-400">Last updated: {config.legal.lastUpdated}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-8 pb-20 max-w-3xl mx-auto">
            <div className="space-y-6 text-sm text-gray-300">
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
                <p className="leading-relaxed">
                  Guffi respects your privacy and is committed to protecting your personal data. This policy explains how we collect,
                  use, and protect data across posts, chat, anonymous content, and notifications.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Account info: username, full name, country, encrypted password</li>
                  <li>Recovery key used for account recovery</li>
                  <li>Profile data: avatar, display name, bio</li>
                  <li>User content: posts, images, comments, replies, chat messages, likes</li>
                  <li>Interaction data: follows, notifications, read status</li>
                  <li>Technical data: browser, operating system, device identifiers</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Data</h2>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Provide and improve platform features</li>
                  <li>Authenticate users and secure sessions</li>
                  <li>Deliver real-time chat and notifications</li>
                  <li>Analyze performance and usage patterns</li>
                  <li>Prevent abuse and enforce platform rules</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">4. Data Security</h2>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Passwords are hashed using industry standards</li>
                  <li>Secure sessions and encrypted transport</li>
                  <li>Input validation and abuse detection systems</li>
                </ul>
                <p className="leading-relaxed mt-2">
                  No electronic system is perfectly secure, but we apply reasonable safeguards to protect your data.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">5. Anonymous Posting</h2>
                <p className="leading-relaxed">
                  Anonymous posts hide your identity from other users. Internal safety controls still apply to maintain platform integrity.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">6. Data Sharing</h2>
                <p className="leading-relaxed mb-2">We do not sell personal data. We only share where necessary for:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Infrastructure and service operation</li>
                  <li>Legal compliance and safety requirements</li>
                  <li>Business transfers (with notice where required)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">7. Retention and Rights</h2>
                <p className="leading-relaxed">
                  Data is retained as needed for service delivery, legal compliance, and security. You may request access,
                  correction, export, or deletion where applicable.
                </p>
              </section>
 {/*
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
                <p className="leading-relaxed">
                  For privacy requests or questions, contact <span className="text-violet-400">{config.legal.privacyEmail}</span>.
                </p>
              </section>
              */}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

