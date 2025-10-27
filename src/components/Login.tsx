import React, { useState } from 'react';
import { cloudAuthService } from '../../lib/services/cloudAuthService';

interface LoginProps {
    onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [licenseKey, setLicenseKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (cloudAuthService.isAuthenticated() && !cloudAuthService.isTokenExpired()) {
            cloudAuthService.reAuthenticate().then(success => {
                if (success) {
                    console.log('Auto re-authenticated successfully');
                    onLoginSuccess();
                }
            }).catch(err => {
                console.error('Re-authentication failed:', err);
            });
        }
    }, [onLoginSuccess]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licenseKey.trim()) {
            setError('Please enter your license key');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await cloudAuthService.verifyLicense(licenseKey.trim());
            console.log('Authentication successful:', result.user);
            onLoginSuccess();
        } catch (err: any) {
            console.error('Login failed:', err);
            setError(err.message || 'Authentication failed. Please check your license key.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">AutoAgents AI</h1>
                        <p className="text-zinc-300 text-sm">Desktop Edition</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="licenseKey" className="block text-sm font-medium text-zinc-200 mb-2">License Key</label>
                            <input type="text" id="licenseKey" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-zinc-500 font-mono" placeholder="license-xxx-yyy-zzz" disabled={loading} />
                        </div>
                        {error && (<div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3"><p className="text-red-200 text-sm">{error}</p></div>)}
                        <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed">{loading ? 'Verifying License...' : 'Activate License'}</button>
                    </form>
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="text-center text-xs text-zinc-400">Need a license? Visit <a href="https://auto-agents.org" className="text-blue-400 hover:text-blue-300 underline">auto-agents.org</a></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
