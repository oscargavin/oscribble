import React, { useState } from 'react';

interface SettingsProps {
  currentApiKey?: string;
  currentOpenAIApiKey?: string;
  onSave: (apiKey: string, openaiApiKey?: string) => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  currentApiKey,
  currentOpenAIApiKey,
  onSave,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState(currentApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(currentOpenAIApiKey || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [anthropicTestResult, setAnthropicTestResult] = useState<'success' | 'error' | null>(null);
  const [openaiTestResult, setOpenaiTestResult] = useState<'success' | 'error' | null>(null);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);

  const maskApiKey = (key: string): string => {
    if (!key || key.length < 8) return key;
    const prefix = key.substring(0, 7);
    const suffix = key.substring(key.length - 4);
    return `${prefix}...${suffix}`;
  };

  const handleTestAnthropic = async () => {
    setTestingAnthropic(true);
    setAnthropicTestResult(null);
    setError('');

    try {
      const result = await window.electronAPI.initClaude(apiKey);
      if (result.success) {
        setAnthropicTestResult('success');
      } else {
        setAnthropicTestResult('error');
        setError(result.error || 'Failed to validate Anthropic API key');
      }
    } catch (err) {
      setAnthropicTestResult('error');
      setError(err.message || 'Failed to test Anthropic connection');
    } finally {
      setTestingAnthropic(false);
    }
  };

  const handleTestOpenAI = async () => {
    if (!openaiApiKey.trim()) {
      setError('Please enter an OpenAI API key to test');
      return;
    }

    setTestingOpenAI(true);
    setOpenaiTestResult(null);
    setError('');

    try {
      const result = await window.electronAPI.initOpenAI(openaiApiKey);
      if (result.success) {
        setOpenaiTestResult('success');
      } else {
        setOpenaiTestResult('error');
        setError(result.error || 'Failed to validate OpenAI API key');
      }
    } catch (err) {
      setOpenaiTestResult('error');
      setError(err.message || 'Failed to test OpenAI connection');
    } finally {
      setTestingOpenAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Test the API key by initializing Claude
      const result = await window.electronAPI.initClaude(apiKey);
      if (!result.success) {
        throw new Error(result.error || 'Invalid API key');
      }

      // Initialize OpenAI if key provided
      if (openaiApiKey.trim()) {
        const openaiInitResult = await window.electronAPI.initOpenAI(openaiApiKey);
        if (!openaiInitResult.success) {
          throw new Error(`Failed to initialize OpenAI: ${openaiInitResult.error}`);
        }
      }

      // Get current settings and update API keys
      const settings = await window.electronAPI.getSettings();
      await window.electronAPI.saveSettings({
        ...settings,
        api_key: apiKey,
        openai_api_key: openaiApiKey.trim() || undefined,
      });

      onSave(apiKey, openaiApiKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-drag">
      <div className="bg-black border border-[var(--text-dim)] w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[#FF4D00] hover:opacity-100 opacity-70 transition-opacity"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Anthropic API Key Section */}
          <div>
            <label
              htmlFor="apiKey"
              className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
            >
              Anthropic API Key
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  id="apiKey"
                  type={showAnthropicKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setAnthropicTestResult(null);
                  }}
                  placeholder="sk-ant-..."
                  required
                  className="flex-1 px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="px-3 py-2 bg-black text-[var(--text-dim)] border border-[var(--text-dim)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors text-xs uppercase tracking-wider"
                  title={showAnthropicKey ? "Hide key" : "Show key"}
                >
                  {showAnthropicKey ? "HIDE" : "SHOW"}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestAnthropic}
                  disabled={testingAnthropic || !apiKey}
                  className="px-3 py-1.5 bg-black text-[var(--text-dim)] border border-[var(--text-dim)] hover:border-[#FF4D00] hover:text-[#FF4D00] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wider"
                >
                  {testingAnthropic ? 'TESTING...' : 'TEST CONNECTION'}
                </button>
                {anthropicTestResult === 'success' && (
                  <span className="flex items-center text-xs text-green-500 font-mono">
                    ✓ CONNECTED
                  </span>
                )}
                {anthropicTestResult === 'error' && (
                  <span className="flex items-center text-xs text-[#FF4D00] font-mono">
                    ✕ FAILED
                  </span>
                )}
              </div>
              {currentApiKey && !showAnthropicKey && (
                <p className="text-xs text-[var(--text-dim)] font-mono">
                  Current: {maskApiKey(currentApiKey)}
                </p>
              )}
              <p className="text-xs text-[var(--text-dim)] mt-1">
                get your api key from{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF4D00] hover:opacity-70"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
          </div>

          {/* OpenAI API Key Section */}
          <div>
            <label
              htmlFor="openaiApiKey"
              className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
            >
              OpenAI API Key (Optional)
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  id="openaiApiKey"
                  type={showOpenAIKey ? "text" : "password"}
                  value={openaiApiKey}
                  onChange={(e) => {
                    setOpenaiApiKey(e.target.value);
                    setOpenaiTestResult(null);
                  }}
                  placeholder="sk-..."
                  className="flex-1 px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  className="px-3 py-2 bg-black text-[var(--text-dim)] border border-[var(--text-dim)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors text-xs uppercase tracking-wider"
                  title={showOpenAIKey ? "Hide key" : "Show key"}
                >
                  {showOpenAIKey ? "HIDE" : "SHOW"}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestOpenAI}
                  disabled={testingOpenAI || !openaiApiKey.trim()}
                  className="px-3 py-1.5 bg-black text-[var(--text-dim)] border border-[var(--text-dim)] hover:border-[#FF4D00] hover:text-[#FF4D00] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wider"
                >
                  {testingOpenAI ? 'TESTING...' : 'TEST CONNECTION'}
                </button>
                {openaiTestResult === 'success' && (
                  <span className="flex items-center text-xs text-green-500 font-mono">
                    ✓ CONNECTED
                  </span>
                )}
                {openaiTestResult === 'error' && (
                  <span className="flex items-center text-xs text-[#FF4D00] font-mono">
                    ✕ FAILED
                  </span>
                )}
              </div>
              {currentOpenAIApiKey && !showOpenAIKey && (
                <p className="text-xs text-[var(--text-dim)] font-mono">
                  Current: {maskApiKey(currentOpenAIApiKey)}
                </p>
              )}
              <p className="text-xs text-[var(--text-dim)] mt-1">
                required for voice input transcription{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF4D00] hover:opacity-70"
                >
                  platform.openai.com
                </a>
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#FF4D00]/10 border border-[#FF4D00] text-xs text-[#FF4D00]">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-[#FF4D00] text-black border border-[#FF4D00] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity font-bold text-xs uppercase tracking-wider"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] hover:border-[var(--text-primary)] transition-colors text-xs uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
