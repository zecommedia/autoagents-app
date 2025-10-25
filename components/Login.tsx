import React, { useState } from 'react';

// --- SVG ICONS ---

// Logo variants - Change the logoSrc below to switch between different logo styles
const LOGO_VARIANTS = {
    yellow: '/logo.svg',              // Original yellow logo
    gradient: '/logo-gradient.svg',    // Yellow gradient (amber tones)
    blue: '/logo-blue.svg',           // Blue gradient
    purple: '/logo-purple.svg',       // Purple gradient
    rainbow: '/logo-rainbow.svg',     // Multi-color rainbow
    default: '/logo-default.svg',     // Your custom default logo
};

// 🎨 CUSTOMIZE YOUR LOGO HERE:
// Change this value to switch between logo variants
// Options: 'yellow' | 'gradient' | 'blue' | 'purple' | 'rainbow' | 'default'
const SELECTED_LOGO = 'default';

const ZecomLogoIcon = () => (
    <img 
        src={LOGO_VARIANTS[SELECTED_LOGO as keyof typeof LOGO_VARIANTS]} 
        alt="Zecom Logo" 
        width="64" 
        height="64"
        className="select-none"
    />
);


const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
    </svg>
);

const SpinnerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// --- BACKGROUND ELEMENTS ---
const Star: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
    <div className="absolute animate-twinkle" style={style}>
        <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
    </div>
);

const StylizedStar = ({ className }: { className?: string }) => (
    <div className={`absolute ${className} w-10 h-10`}>
        <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'blur(1px)' }}>
            <defs>
                <radialGradient id="starGradient" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0%" stopColor="white" />
                    <stop offset="100%" stopColor="#60A5FA" />
                </radialGradient>
            </defs>
            <polygon points="50,0 61,39 100,39 69,61 82,100 50,75 18,100 31,61 0,39 39,39" fill="url(#starGradient)"/>
        </svg>
    </div>
);

// --- FORM COMPONENTS ---

interface FormProps {
    onLoginSuccess: () => void;
}

import authService from '../services/auth';

const SignUpForm: React.FC<FormProps & { onSwitchToLogin: () => void }> = ({ onLoginSuccess, onSwitchToLogin }) => {
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [firstName, setFirstName] = useState('Emily');
    const [lastName, setLastName] = useState('Jhonson');
    const [email, setEmail] = useState('emily@gmail.com');
    const [password, setPassword] = useState('••••••••••');
    const [country, setCountry] = useState('United States');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!termsAccepted) {
            setError("You must agree to the Terms of Service and Privacy policies.");
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ firstName, lastName, email, password, country }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Registration failed.');
            }

            // Save token and user then notify parent
            const data = await response.json();
            if (data.token) {
                authService.setToken(data.token);
            }
            if (data.user) {
                authService.setUser(data.user);
            }
            onLoginSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="flex flex-col items-center mb-8">
                <ZecomLogoIcon />
                <h1 className="text-3xl font-bold mt-4 text-center">Create Your Account</h1>
                <p className="text-zinc-400 text-center text-sm mt-2">
                    Join Zecom to start redesigning your world.
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex space-x-4">
                    <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full bg-black/30 border-none rounded-md px-4 py-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none" />
                    <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full bg-black/30 border-none rounded-md px-4 py-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-black/30 border-none rounded-md px-4 py-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none" />
                <div className="relative">
                    <input type={passwordVisible ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-black/30 border-none rounded-md px-4 py-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none" />
                    <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute inset-y-0 right-0 px-4 flex items-center text-zinc-400 hover:text-white"><EyeIcon /></button>
                </div>
                <div className="relative">
                    <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full bg-black/30 border-none rounded-md px-4 py-3 text-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none">
                        <option>Viet Nam</option>
                        <option>United States</option>
                        <option>Canada</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 px-4 flex items-center pointer-events-none text-zinc-400"><ChevronDownIcon /></div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                    <input type="checkbox" id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="w-4 h-4 bg-black/30 border-zinc-500 rounded text-blue-600 focus:ring-blue-500" />
                    <label htmlFor="terms" className="text-sm text-zinc-400">I agree to the <a href="#" className="text-white hover:underline">Terms of service</a> and <a href="#" className="text-white hover:underline">Privacy policies</a></label>
                </div>
                {error && <div className="text-red-400 text-sm text-center bg-red-900/30 border border-red-500/50 rounded-md p-2">{error}</div>}
                <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoading ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : 'SIGN UP'}
                </button>
            </form>
             <p className="text-center text-sm text-zinc-400 mt-6">
                Already have an account? <button onClick={onSwitchToLogin} className="font-semibold text-white hover:underline">Log In</button>
            </p>
        </>
    );
};

const LoginForm: React.FC<FormProps & { onSwitchToSignUp: () => void }> = ({ onLoginSuccess, onSwitchToSignUp }) => {
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [email, setEmail] = useState('emily@gmail.com');
    const [password, setPassword] = useState('••••••••••');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Login failed.');
            }

            const data = await response.json();
            if (data.token) {
                authService.setToken(data.token);
            }
            if (data.user) {
                authService.setUser(data.user);
            }
            onLoginSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="flex flex-col items-center mb-8">
                <ZecomLogoIcon />
                <h1 className="text-3xl font-bold mt-4 text-center">Welcome Back!</h1>
                <p className="text-zinc-400 text-center text-sm mt-2">
                    Log in to continue your creative journey.
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-black/30 border-none rounded-md px-4 py-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none" />
                <div className="relative">
                    <input type={passwordVisible ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-black/30 border-none rounded-md px-4 py-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none" />
                    <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute inset-y-0 right-0 px-4 flex items-center text-zinc-400 hover:text-white"><EyeIcon /></button>
                </div>
                 <div className="flex justify-end">
                    <a href="#" className="text-sm text-zinc-400 hover:text-white hover:underline">Forgot password?</a>
                </div>
                {error && <div className="text-red-400 text-sm text-center bg-red-900/30 border border-red-500/50 rounded-md p-2">{error}</div>}
                <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoading ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : 'LOG IN'}
                </button>
            </form>
            <p className="text-center text-sm text-zinc-400 mt-6">
                Don't have an account? <button onClick={onSwitchToSignUp} className="font-semibold text-white hover:underline">Sign Up</button>
            </p>
        </>
    );
};

// --- MAIN AUTHENTICATION SCREEN COMPONENT ---
interface LoginProps {
    onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [mode, setMode] = useState<'signup' | 'login'>('signup');

    return (
        <div className="min-h-screen w-full bg-indigo-950 text-white flex items-center justify-center p-4 overflow-hidden relative font-sans">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-900/40 to-transparent opacity-50"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-blue-900/30 rounded-full blur-3xl animate-pulse-glow"></div>

            {/* Stars */}
            <StylizedStar className="top-[15%] left-[10%]" />
            <StylizedStar className="top-[20%] right-[15%]" />
            <StylizedStar className="bottom-[10%] right-[10%]" />
            <StylizedStar className="bottom-[25%] left-[20%]" />
            {Array.from({ length: 150 }).map((_, i) => (
                <Star key={i} style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 8}s`,
                    animationDuration: `${2 + Math.random() * 4}s`
                }} />
            ))}
            
            <main className="relative z-10 w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                {mode === 'signup' ? (
                    <SignUpForm onLoginSuccess={onLoginSuccess} onSwitchToLogin={() => setMode('login')} />
                ) : (
                    <LoginForm onLoginSuccess={onLoginSuccess} onSwitchToSignUp={() => setMode('signup')} />
                )}
            </main>
        </div>
    );
};

export default Login;