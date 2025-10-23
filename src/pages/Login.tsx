import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Loader2 } from 'lucide-react';
import { useUserStore } from '../stores/userStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useHistoryStore } from '../stores/historyStore';
import { useTempQueueStore } from '../stores/tempQueueStore';
import { useScriptCounterStore } from '../stores/scriptCounterStore';
import { loadUserData } from '../services/userDataSync';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function Login() {
  const navigate = useNavigate();
  const login = useUserStore((state) => state.login);

  // Get store setters for loading data
  const { updateSettings } = useSettingsStore();
  const { restoreHistory } = useHistoryStore();
  const { clearQueue, addToQueue } = useTempQueueStore();
  const { setCounter } = useScriptCounterStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-login`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Login failed');
      }

      // Save user to store
      login(data.user);

      // Load user data from database
      console.log('📥 Loading user data from database...');
      const userData = await loadUserData(data.user.id);

      if (userData.success && userData.data) {
        // Load settings
        if (userData.data.settings) {
          console.log('✓ Loading settings from database');
          updateSettings(userData.data.settings);
        }

        // Load history
        if (userData.data.history && userData.data.history.length > 0) {
          console.log(`✓ Loading ${userData.data.history.length} history items`);
          restoreHistory(userData.data.history);
        }

        // Load queue
        if (userData.data.queue && userData.data.queue.length > 0) {
          console.log(`✓ Loading ${userData.data.queue.length} queue items`);
          clearQueue();
          userData.data.queue.forEach((item: any) => {
            addToQueue(
              item.content,
              item.modelName,
              item.counter,
              item.videoTitle,
              item.videoUrl,
              item.generatedTitle
            );
          });
        }

        // Load counter
        if (userData.data.counter) {
          console.log(`✓ Loading counter: ${userData.data.counter}`);
          setCounter(userData.data.counter);
        }

        console.log('✅ All user data loaded successfully!');
      }

      // Redirect to home
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-gray-700">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Sign in to your account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Signup Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign up
            </Link>
          </p>
        </div>

        {/* Default Credentials Helper */}
        <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
          <p className="text-xs text-gray-400 text-center">
            <strong className="text-gray-300">Default admin:</strong> username: <code className="text-blue-400">admin</code>, password: <code className="text-blue-400">admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
