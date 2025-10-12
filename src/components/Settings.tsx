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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="apiKey"
              className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
            >
              Anthropic API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              required
              className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
            />
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

          <div>
            <label
              htmlFor="openaiApiKey"
              className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
            >
              OpenAI API Key (Optional)
            </label>
            <input
              id="openaiApiKey"
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
            />
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
