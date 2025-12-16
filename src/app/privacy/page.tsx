export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
                <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

                <div className="prose prose-blue max-w-none space-y-6 text-gray-700">
                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Transparency & Data Controller</h2>
                        <p>
                            This platform ("voler.AI Interviewer") facilitates automated qualitative research interviews.
                            The specific <strong>Data Controller</strong> for any personal data collected during an interview is the organization or individual who created and distributed the specific bot you are interacting with.
                        </p>
                        <p>
                            voler.AI acts as the <strong>Data Processor</strong>, providing the technical infrastructure to conduct these interviews securely.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Data Collection</h2>
                        <p>We may collect:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Conversation Data:</strong> The text of your responses during the interview.</li>
                            <li><strong>Metadata:</strong> Technical logs such as connection time, duration, and approximate location (if enabled by the Data Controller).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">3. AI Interaction</h2>
                        <p>
                            You are interacting with an automated Artificial Intelligence system. Your responses are processed by third-party Large Language Model providers (e.g., OpenAI, Anthropic) solely for the purpose of conducting this conversation and generating insights for the researcher.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Your Rights (GDPR)</h2>
                        <p>Under the GDPR, you have the right to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Access your data.</li>
                            <li>Request rectification or detailed deletion of your data.</li>
                            <li>Withdraw consent at any time.</li>
                        </ul>
                        <p className="mt-4">
                            To exercise these rights, please contact the organization that invited you to this interview directly, or contact us at <a href="mailto:privacy@voler.ai" className="text-blue-600 hover:underline">privacy@voler.ai</a> to be redirected to the relevant Data Controller.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
