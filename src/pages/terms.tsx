import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { config } from "@/lib/config";

export default function TermsPage() {
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
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Terms of Service</h1>
                  <p className="text-xs text-gray-400">Last updated: {config.legal.lastUpdated}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-8 pb-20 max-w-3xl mx-auto">
            <div className="space-y-6 text-sm text-gray-300">
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
                <p className="leading-relaxed">
                  By accessing or using Guffie ("the Platform"), you agree to be bound by these Terms of Service.
                  If you do not agree to these terms, do not use the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
                <p className="leading-relaxed mb-2">Guffie is a social media platform that allows users to:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Share posts with images, text, and media</li>
                  <li>Engage through likes, comments, and replies</li>
                  <li>Chat with other users in real-time messaging</li>
                  <li>Post content anonymously</li>
                  <li>Follow and connect with other users</li>
                  <li>Receive notifications for interactions</li>
                </ul>
                <p className="leading-relaxed mt-2">
                  We reserve the right to modify, suspend, or discontinue any part of the service at any time without prior notice.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">3. User Accounts</h2>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Maintain account and recovery key security</li>
                  <li>Provide accurate registration information</li>
                  <li>Take responsibility for activity under your account</li>
                  <li>Report unauthorized access immediately</li>
                </ul>
                <p className="leading-relaxed mt-2">
                  Store your recovery key securely. <strong className="text-white">We cannot recover your account without it.</strong>
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">4. User Content</h2>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>You retain ownership of your content</li>
                  <li>You grant us a non-exclusive license to display and distribute content on the platform</li>
                  <li>You confirm you have rights to all uploaded content</li>
                  <li>You are responsible for legal compliance of posted content</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">5. Acceptable Use</h2>
                <p className="leading-relaxed mb-2">You agree not to:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Post illegal, harmful, threatening, or abusive content</li>
                  <li>Harass, bully, or impersonate others</li>
                  <li>Spam or manipulate engagement</li>
                  <li>Attempt unauthorized access to platform systems</li>
                  <li>Abuse anonymous features to evade moderation</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">6. Anonymous Posting</h2>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Identity is hidden from other users during anonymous posting</li>
                  <li>Anonymous content is still subject to moderation</li>
                  <li>Abuse can result in suspension or termination</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">7. Messaging and Chat</h2>
                <p className="leading-relaxed">
                  Real-time chat must be used respectfully. Spam, malware, and harmful links are prohibited.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">8. Moderation and Enforcement</h2>
                <p className="leading-relaxed">
                  We may remove content and suspend accounts that violate these terms, and cooperate with legal processes where required.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
                <p className="leading-relaxed">
                  The Platform is provided "as is" without warranties. Guffie is not liable for indirect or consequential damages.
                </p>
              </section>

            {/* <section>
                <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
                <p className="leading-relaxed">
                  For questions about these terms, contact <span className="text-violet-400">{config.legal.supportEmail}</span>.
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

