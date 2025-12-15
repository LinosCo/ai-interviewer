'use client';

import { useState, useEffect, use } from 'react';
import { claimReward, getRewardDetails } from '@/app/actions/reward';
import { Gift, CheckCircle, Copy, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ClaimRewardPage({ params }: { params: Promise<{ conversationId: string }> }) {
    // Unwrap the promise using React.use()
    const resolvedParams = use(params);
    const { conversationId } = resolvedParams;

    // Rest of your component logic...
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rewardData, setRewardData] = useState<any>(null);
    const [error, setError] = useState('');
    const [claimedCode, setClaimedCode] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getRewardDetails(conversationId);
                if (!data) {
                    setError('Invalid reward link or reward expired.');
                } else {
                    setRewardData(data);
                    if (data.isClaimed && data.claimedCode) {
                        setClaimedCode(data.claimedCode);
                    }
                }
            } catch (e) {
                setError('Failed to load reward details.');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [conversationId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await claimReward(conversationId, email, name);
            if (res.success) {
                setClaimedCode(res.code);
            }
        } catch (e) {
            alert('Failed to claim reward. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = () => {
        if (claimedCode) {
            navigator.clipboard.writeText(claimedCode);
            alert('Code copied to clipboard!');
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
    }

    if (error || !rewardData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <div className="text-red-500 mb-4 mx-auto w-12 h-12 flex items-center justify-center bg-red-100 rounded-full">!</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Unavailable</h2>
                    <p className="text-gray-600">{error || 'This reward is no longer available.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white text-center">
                    <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <Gift size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Claim Your Reward</h1>
                    <p className="text-indigo-100">Thank you for participating in the interview with {rewardData.botName}!</p>
                </div>

                <div className="p-8">
                    {claimedCode ? (
                        <div className="text-center space-y-6">
                            <div className="flex flex-col items-center justify-center text-green-600 mb-4">
                                <CheckCircle size={48} className="mb-2" />
                                <span className="font-semibold text-lg">Reward Unlocked!</span>
                            </div>

                            <p className="text-gray-600">Here is your reward details:</p>

                            <div className="bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-between group relative">
                                <code className="font-mono text-xl font-bold text-gray-800 break-all">
                                    {claimedCode}
                                </code>
                                <button
                                    onClick={copyToClipboard}
                                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                                    title="Copy to clipboard"
                                >
                                    <Copy size={20} className="text-gray-500" />
                                </button>
                            </div>

                            {rewardData.rewardType === 'redirect' && (
                                <a
                                    href={claimedCode}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                                >
                                    Go to Reward <ArrowRight size={18} />
                                </a>
                            )}

                            <p className="text-sm text-gray-500 mt-4">
                                Make sure to save this code/link now.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-semibold text-gray-800">{rewardData.rewardText}</h3>
                                <p className="text-sm text-gray-500">Enter your details to receive your reward.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Optional)</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Your Name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="you@example.com"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">We'll only use this to send you the reward.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-70 flex items-center justify-center"
                            >
                                {isSubmitting ? 'Unlocking...' : 'Unlock Reward'}
                            </button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
