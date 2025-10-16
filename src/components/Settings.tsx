import React, { useState } from 'react';
import { MODELS, ModelId, DEFAULT_MODEL } from '../config/models';

interface SettingsProps {
  currentApiKey?: string;
  currentOpenAIApiKey?: string;
  currentUserContext?: string;
  currentModel?: ModelId;
  currentDisableAutocontext?: boolean;
  currentLocation?: {
    city?: string;
    region?: string;
    country?: string;
  };
  onSave: (
    apiKey: string,
    openaiApiKey?: string,
    userContext?: string,
    model?: ModelId,
    disableAutocontext?: boolean,
    location?: { city?: string; region?: string; country?: string }
  ) => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  currentApiKey,
  currentOpenAIApiKey,
  currentUserContext,
  currentModel,
  currentDisableAutocontext,
  currentLocation,
  onSave,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState(currentApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(currentOpenAIApiKey || '');
  const [userContext, setUserContext] = useState(currentUserContext || '');
  const [selectedModel, setSelectedModel] = useState<ModelId>(currentModel || DEFAULT_MODEL);
  const [disableAutocontext, setDisableAutocontext] = useState(currentDisableAutocontext || false);
  const [locationCity, setLocationCity] = useState(currentLocation?.city || '');
  const [locationRegion, setLocationRegion] = useState(currentLocation?.region || '');
  const [locationCountry, setLocationCountry] = useState(currentLocation?.country || '');
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

      // Build location object if any field is filled
      const location = (locationCity || locationRegion || locationCountry) ? {
        city: locationCity.trim() || undefined,
        region: locationRegion.trim() || undefined,
        country: locationCountry.trim() || undefined,
      } : undefined;

      // Get current settings and update API keys, user context, model, autocontext preference, and location
      const settings = await window.electronAPI.getSettings();
      await window.electronAPI.saveSettings({
        ...settings,
        api_key: apiKey,
        openai_api_key: openaiApiKey.trim() || undefined,
        user_context: userContext.trim() || undefined,
        preferred_model: selectedModel,
        disable_autocontext: disableAutocontext,
        user_location: location,
      });

      onSave(apiKey, openaiApiKey, userContext, selectedModel, disableAutocontext, location);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-drag">
      <div className="bg-black border border-[var(--text-dim)] w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-[var(--text-dim)]">
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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

          {/* Model Selection Section */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">
              Claude Model
            </label>
            <div className="space-y-2">
              {Object.values(MODELS).map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full px-4 py-3 bg-black border transition-all text-left ${
                    selectedModel === model.id
                      ? 'border-[#FF4D00]'
                      : 'border-[var(--text-dim)] hover:border-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: model.color }}
                      />
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                          {model.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                          {model.description}
                        </div>
                      </div>
                    </div>
                    {selectedModel === model.id && (
                      <span className="text-[#FF4D00] text-xs">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Disable Autocontext Toggle */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">
              Context Gathering
            </label>
            <button
              type="button"
              onClick={() => setDisableAutocontext(!disableAutocontext)}
              className={`w-full px-4 py-3 border transition-all text-left ${
                disableAutocontext
                  ? 'bg-[#FF4D00]/10 border-[#FF4D00]'
                  : 'bg-black border-[var(--text-dim)] hover:border-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {disableAutocontext ? 'AUTOCONTEXT DISABLED' : 'AUTOCONTEXT ENABLED'}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    {disableAutocontext
                      ? 'Format tasks instantly without analyzing project files'
                      : 'Automatically analyze project files for better context'}
                  </div>
                </div>
                <div className={`w-10 h-5 border rounded-full transition-colors relative ${
                  disableAutocontext ? 'bg-[#FF4D00] border-[#FF4D00]' : 'bg-black border-[var(--text-dim)]'
                }`}>
                  <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                    disableAutocontext ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </div>
              </div>
            </button>
            <p className="text-xs text-[var(--text-dim)] mt-2">
              when disabled, Claude will format your raw text into structured tasks without analyzing @mentions or discovering relevant files
            </p>
          </div>

          {/* Location Section */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">
              Location (Optional)
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="City (e.g., Dublin, San Francisco)"
                className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
              />
              <input
                type="text"
                value={locationRegion}
                onChange={(e) => setLocationRegion(e.target.value)}
                placeholder="State/Region (e.g., California, Leinster)"
                className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
              />
              <input
                type="text"
                value={locationCountry}
                onChange={(e) => setLocationCountry(e.target.value)}
                placeholder="Country code (e.g., US, IE, GB)"
                className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
              />
              <p className="text-xs text-[var(--text-dim)] mt-1">
                helps Claude search for location-specific information when organizing life admin tasks
              </p>
            </div>
          </div>

          {/* Personal Context Section */}
          <div>
            <label
              htmlFor="userContext"
              className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
            >
              Personal Context (Optional)
            </label>
            <div className="space-y-2">
              <textarea
                id="userContext"
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                placeholder="Add personal context to help Claude personalize your tasks...&#10;&#10;Examples:&#10;• Tax year: 2024&#10;• Work schedule: Mon-Fri 9-5&#10;• Preferences: prefer morning appointments&#10;• Current goals: organizing finances, job search&#10;• Any other relevant personal information"
                rows={6}
                className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono resize-y"
              />
              <p className="text-xs text-[var(--text-dim)] mt-1">
                this information helps Claude better understand your needs when organizing life admin tasks
              </p>
            </div>
          </div>
          </div>

          <div className="px-6 py-4 border-t border-[var(--text-dim)] space-y-4">
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
          </div>
        </form>
      </div>
    </div>
  );
};
