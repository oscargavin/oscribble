import React, { useState } from 'react';
import { MODELS, ModelId, DEFAULT_MODEL } from '../config/models';

interface SettingsProps {
  currentApiKey?: string;
  currentOpenAIApiKey?: string;
  currentUserContext?: string;
  currentModel?: ModelId;
  currentLocation?: {
    city?: string;
    region?: string;
    country?: string;
  };
  currentAnalysisStyle?: 'minimal' | 'contextual' | 'analytical' | 'prescriptive';
  currentSuggestSolutions?: boolean;
  currentAutoDetectMissingTasks?: boolean;
  currentEnableWebSearch?: boolean;
  currentTheme?: 'dark' | 'light';
  currentAccentColor?: string;
  currentReduceMotion?: boolean;
  onSave: (
    apiKey: string,
    openaiApiKey?: string,
    userContext?: string,
    model?: ModelId,
    location?: { city?: string; region?: string; country?: string },
    analysisStyle?: 'minimal' | 'contextual' | 'analytical' | 'prescriptive',
    suggestSolutions?: boolean,
    autoDetectMissingTasks?: boolean,
    enableWebSearch?: boolean,
    theme?: 'dark' | 'light',
    accentColor?: string,
    reduceMotion?: boolean
  ) => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  currentApiKey,
  currentOpenAIApiKey,
  currentUserContext,
  currentModel,
  currentLocation,
  currentAnalysisStyle,
  currentSuggestSolutions,
  currentAutoDetectMissingTasks,
  currentEnableWebSearch,
  currentTheme,
  currentAccentColor,
  currentReduceMotion,
  onSave,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState(currentApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(currentOpenAIApiKey || '');
  const [userContext, setUserContext] = useState(currentUserContext || '');
  const [selectedModel, setSelectedModel] = useState<ModelId>(currentModel || DEFAULT_MODEL);
  const [locationCity, setLocationCity] = useState(currentLocation?.city || '');
  const [locationRegion, setLocationRegion] = useState(currentLocation?.region || '');
  const [locationCountry, setLocationCountry] = useState(currentLocation?.country || '');
  const [analysisStyle, setAnalysisStyle] = useState<'minimal' | 'contextual' | 'analytical' | 'prescriptive'>(currentAnalysisStyle || 'analytical');
  const [suggestSolutions, setSuggestSolutions] = useState(currentSuggestSolutions ?? true);
  const [autoDetectMissingTasks, setAutoDetectMissingTasks] = useState(currentAutoDetectMissingTasks ?? true);
  const [enableWebSearch, setEnableWebSearch] = useState(currentEnableWebSearch ?? true);
  const [theme, setTheme] = useState<'dark' | 'light'>(currentTheme || 'dark');
  const [accentColor, setAccentColor] = useState<string>(currentAccentColor || 'var(--accent-orange)');
  const [reduceMotion, setReduceMotion] = useState(currentReduceMotion ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [anthropicTestResult, setAnthropicTestResult] = useState<'success' | 'error' | null>(null);
  const [openaiTestResult, setOpenaiTestResult] = useState<'success' | 'error' | null>(null);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'api-keys' | 'model-profile' | 'task-generation' | 'appearance'>('api-keys');

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

      // Get current settings and update API keys, user context, model, location, task generation preferences, and theme
      const settings = await window.electronAPI.getSettings();
      await window.electronAPI.saveSettings({
        ...settings,
        api_key: apiKey,
        openai_api_key: openaiApiKey.trim() || undefined,
        user_context: userContext.trim() || undefined,
        preferred_model: selectedModel,
        user_location: location,
        analysis_style: analysisStyle,
        suggest_solutions: suggestSolutions,
        auto_detect_missing_tasks: autoDetectMissingTasks,
        enable_web_search: enableWebSearch,
        theme: theme,
        accent_color: accentColor,
        reduce_motion: reduceMotion,
      });

      onSave(apiKey, openaiApiKey, userContext, selectedModel, location, analysisStyle, suggestSolutions, autoDetectMissingTasks, enableWebSearch, theme, accentColor, reduceMotion);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)]/80 flex items-center justify-center z-50 no-drag" onClick={onClose}>
      <div className="bg-[var(--bg-primary)] border border-[var(--text-dim)] w-full max-w-md h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-[var(--text-dim)]">
          <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--accent-orange)] hover:opacity-100 opacity-70 transition-opacity"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--text-dim)] no-drag">
          <button
            type="button"
            onClick={() => setActiveTab('api-keys')}
            className={`flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'api-keys'
                ? 'bg-[var(--text-dim)]/10 text-[var(--accent-orange)] border-b-2 border-[var(--accent-orange)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            }`}
          >
            KEYS & MODEL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('model-profile')}
            className={`flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'model-profile'
                ? 'bg-[var(--text-dim)]/10 text-[var(--accent-orange)] border-b-2 border-[var(--accent-orange)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('task-generation')}
            className={`flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'task-generation'
                ? 'bg-[var(--text-dim)]/10 text-[var(--accent-orange)] border-b-2 border-[var(--accent-orange)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            }`}
          >
            GENERATION
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'appearance'
                ? 'bg-[var(--text-dim)]/10 text-[var(--accent-orange)] border-b-2 border-[var(--accent-orange)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            }`}
          >
            Appearance
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* API Keys Tab */}
          {activeTab === 'api-keys' && (
            <>
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
                  className="flex-1 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-orange)] text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-dim)] border border-[var(--text-dim)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors text-xs uppercase tracking-wider"
                  title={showAnthropicKey ? "Hide key" : "Show key"}
                >
                  {showAnthropicKey ? "HIDE" : "SHOW"}
                </button>
                <button
                  type="button"
                  onClick={handleTestAnthropic}
                  disabled={testingAnthropic || !apiKey}
                  className="px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-dim)] border border-[var(--text-dim)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wider"
                  title="Test connection"
                >
                  {testingAnthropic ? '...' : 'TEST'}
                </button>
              </div>
              {(anthropicTestResult === 'success' || anthropicTestResult === 'error') && (
                <div className="flex gap-2">
                  {anthropicTestResult === 'success' && (
                    <span className="flex items-center text-xs text-green-500 font-mono">
                      ✓ CONNECTED
                    </span>
                  )}
                  {anthropicTestResult === 'error' && (
                    <span className="flex items-center text-xs text-[var(--accent-orange)] font-mono">
                      ✕ FAILED
                    </span>
                  )}
                </div>
              )}
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
                  className="text-[var(--accent-orange)] hover:opacity-70"
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
                  className="flex-1 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-orange)] text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  className="px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-dim)] border border-[var(--text-dim)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors text-xs uppercase tracking-wider"
                  title={showOpenAIKey ? "Hide key" : "Show key"}
                >
                  {showOpenAIKey ? "HIDE" : "SHOW"}
                </button>
                <button
                  type="button"
                  onClick={handleTestOpenAI}
                  disabled={testingOpenAI || !openaiApiKey.trim()}
                  className="px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-dim)] border border-[var(--text-dim)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wider"
                  title="Test connection"
                >
                  {testingOpenAI ? '...' : 'TEST'}
                </button>
              </div>
              {(openaiTestResult === 'success' || openaiTestResult === 'error') && (
                <div className="flex gap-2">
                  {openaiTestResult === 'success' && (
                    <span className="flex items-center text-xs text-green-500 font-mono">
                      ✓ CONNECTED
                    </span>
                  )}
                  {openaiTestResult === 'error' && (
                    <span className="flex items-center text-xs text-[var(--accent-orange)] font-mono">
                      ✕ FAILED
                    </span>
                  )}
                </div>
              )}
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
                  className="text-[var(--accent-orange)] hover:opacity-70"
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
                  className={`w-full px-4 py-3 bg-[var(--bg-primary)] border transition-all text-left ${
                    selectedModel === model.id
                      ? 'border-[var(--accent-orange)]'
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
                      <span className="text-[var(--accent-orange)] text-xs">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
            </>
          )}

          {/* Model & Profile Tab */}
          {activeTab === 'model-profile' && (
            <>
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
                className="w-full px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-orange)] text-sm font-mono"
              />
              <input
                type="text"
                value={locationRegion}
                onChange={(e) => setLocationRegion(e.target.value)}
                placeholder="State/Region (e.g., California, Leinster)"
                className="w-full px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-orange)] text-sm font-mono"
              />
              <input
                type="text"
                value={locationCountry}
                onChange={(e) => setLocationCountry(e.target.value)}
                placeholder="Country code (e.g., US, IE, GB)"
                className="w-full px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-orange)] text-sm font-mono"
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
                className="w-full px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-orange)] text-sm font-mono resize-y"
              />
              <p className="text-xs text-[var(--text-dim)] mt-1">
                this information helps Claude better understand your needs when organizing life admin tasks
              </p>
            </div>
          </div>
            </>
          )}

          {/* Task Generation Tab */}
          {activeTab === 'task-generation' && (
            <>
          {/* Task Generation Preferences Section */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">
              Task Generation Preferences
            </label>
            <div className="space-y-4">
              {/* Analysis Style */}
              <div>
                <label className="block text-[10px] text-[var(--text-dim)] mb-2 uppercase tracking-wider">
                  Analysis Style
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'minimal', label: 'Minimal', desc: 'Just parse and structure tasks' },
                    { value: 'contextual', label: 'Contextual', desc: 'Add file references for agent workflows' },
                    { value: 'analytical', label: 'Analytical', desc: 'Full analysis with insights (default)' },
                    { value: 'prescriptive', label: 'Prescriptive', desc: 'Include solution suggestions' }
                  ].map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => setAnalysisStyle(style.value as any)}
                      className={`w-full px-3 py-2 bg-[var(--bg-primary)] border transition-all text-left ${
                        analysisStyle === style.value
                          ? 'border-[var(--accent-orange)]'
                          : 'border-[var(--text-dim)] hover:border-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-[var(--text-primary)] font-mono">
                            {style.label}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                            {style.desc}
                          </div>
                        </div>
                        {analysisStyle === style.value && (
                          <span className="text-[var(--accent-orange)] text-xs">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle: Suggest Solutions */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-xs text-[var(--text-primary)] font-mono">
                    Suggest Solutions
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Include implementation approaches in task notes
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSuggestSolutions(!suggestSolutions)}
                  className={`w-12 h-6 border transition-colors ${
                    suggestSolutions
                      ? 'bg-[var(--accent-orange)] border-[var(--accent-orange)]'
                      : 'bg-[var(--bg-primary)] border-[var(--text-dim)]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 transition-transform ${
                      suggestSolutions ? 'bg-[var(--bg-primary)] translate-x-7' : 'bg-[var(--text-dim)] translate-x-1'
                    }`}
                  />
                </button>
              </label>

              {/* Toggle: Auto-detect Missing Tasks */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-xs text-[var(--text-primary)] font-mono">
                    Auto-detect Missing Tasks
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Suggest additional tasks based on context
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoDetectMissingTasks(!autoDetectMissingTasks)}
                  className={`w-12 h-6 border transition-colors ${
                    autoDetectMissingTasks
                      ? 'bg-[var(--accent-orange)] border-[var(--accent-orange)]'
                      : 'bg-[var(--bg-primary)] border-[var(--text-dim)]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 transition-transform ${
                      autoDetectMissingTasks ? 'bg-[var(--bg-primary)] translate-x-7' : 'bg-[var(--text-dim)] translate-x-1'
                    }`}
                  />
                </button>
              </label>

              {/* Toggle: Enable Web Search */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-xs text-[var(--text-primary)] font-mono">
                    Enable Web Search (Life Admin)
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Search for current info, costs, and deadlines
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableWebSearch(!enableWebSearch)}
                  className={`w-12 h-6 border transition-colors ${
                    enableWebSearch
                      ? 'bg-[var(--accent-orange)] border-[var(--accent-orange)]'
                      : 'bg-[var(--bg-primary)] border-[var(--text-dim)]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 transition-transform ${
                      enableWebSearch ? 'bg-[var(--bg-primary)] translate-x-7' : 'bg-[var(--text-dim)] translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
            </>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <>
          {/* Theme Selection */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">
              Theme
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`w-full px-4 py-3 bg-[var(--bg-primary)] border transition-all text-left ${
                  theme === 'dark'
                    ? 'border-[var(--accent-orange)]'
                    : 'border-[var(--text-dim)] hover:border-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Dark
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                      Default dark theme
                    </div>
                  </div>
                  {theme === 'dark' && (
                    <span className="text-[var(--accent-orange)] text-xs">✓</span>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`w-full px-4 py-3 bg-[var(--bg-primary)] border transition-all text-left ${
                  theme === 'light'
                    ? 'border-[var(--accent-orange)]'
                    : 'border-[var(--text-dim)] hover:border-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Light
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                      Light theme
                    </div>
                  </div>
                  {theme === 'light' && (
                    <span className="text-[var(--accent-orange)] text-xs">✓</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Accent Color Selection */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">
              Accent Color
            </label>

            {/* Preset Colors */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { name: 'Orange', color: '#FF4D00' },
                { name: 'Red', color: '#E63946' },
                { name: 'Yellow', color: '#FFB700' },
                { name: 'Green', color: '#00CC66' },
                { name: 'Cyan', color: '#00B4D8' },
                { name: 'Blue', color: '#0066FF' },
                { name: 'Purple', color: '#9D4EDD' },
                { name: 'Pink', color: '#FF006E' },
              ].map((colorOption) => (
                <button
                  key={colorOption.name}
                  type="button"
                  onClick={() => setAccentColor(colorOption.color)}
                  className={`aspect-square border-2 transition-all ${
                    accentColor === colorOption.color
                      ? 'border-[var(--accent-orange)]'
                      : 'border-[var(--text-dim)] hover:border-[var(--text-primary)]'
                  }`}
                  style={{ backgroundColor: colorOption.color }}
                  title={colorOption.name}
                />
              ))}
            </div>

            {/* Hue Slider for Custom Colors */}
            <div className="space-y-2">
              <label className="block text-[9px] text-[var(--text-dim)] uppercase tracking-wider">
                Custom Hue
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={(() => {
                  // Convert current accent color to hue
                  const hex = accentColor.replace('#', '');
                  const r = parseInt(hex.substring(0, 2), 16) / 255;
                  const g = parseInt(hex.substring(2, 4), 16) / 255;
                  const b = parseInt(hex.substring(4, 6), 16) / 255;

                  const max = Math.max(r, g, b);
                  const min = Math.min(r, g, b);
                  const delta = max - min;

                  if (delta === 0) return 0;

                  let h = 0;
                  if (max === r) {
                    h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                  } else if (max === g) {
                    h = ((b - r) / delta + 2) / 6;
                  } else {
                    h = ((r - g) / delta + 4) / 6;
                  }

                  return Math.round(h * 360);
                })()}
                onChange={(e) => {
                  const hue = parseInt(e.target.value);
                  // Convert HSL to RGB with fixed saturation (90%) and lightness (50%)
                  const s = 0.9;
                  const l = 0.5;

                  const c = (1 - Math.abs(2 * l - 1)) * s;
                  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
                  const m = l - c / 2;

                  let r = 0, g = 0, b = 0;

                  if (hue >= 0 && hue < 60) {
                    r = c; g = x; b = 0;
                  } else if (hue >= 60 && hue < 120) {
                    r = x; g = c; b = 0;
                  } else if (hue >= 120 && hue < 180) {
                    r = 0; g = c; b = x;
                  } else if (hue >= 180 && hue < 240) {
                    r = 0; g = x; b = c;
                  } else if (hue >= 240 && hue < 300) {
                    r = x; g = 0; b = c;
                  } else {
                    r = c; g = 0; b = x;
                  }

                  const toHex = (val: number) => {
                    const hex = Math.round((val + m) * 255).toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                  };

                  const color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                  setAccentColor(color);
                }}
                className="w-full h-8 appearance-none cursor-pointer hue-slider"
                style={{
                  background: 'linear-gradient(to right, #E60012 0%, #F5A300 16.67%, #D5D500 33.33%, #00CC66 50%, #00B4D8 66.67%, #0066FF 83.33%, #9D4EDD 100%)',
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <div
                  className="w-12 h-12 border-2 border-[var(--text-dim)]"
                  style={{ backgroundColor: accentColor }}
                />
                <div className="flex-1 text-[10px] text-[var(--text-dim)] font-mono uppercase">
                  {accentColor}
                </div>
              </div>
            </div>
          </div>

          {/* Motion Preferences */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">
              Motion
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-xs text-[var(--text-primary)] font-mono">
                  Reduce Motion
                </div>
                <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                  Disable animations when tasks load
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReduceMotion(!reduceMotion)}
                className={`w-12 h-6 border transition-colors ${
                  reduceMotion
                    ? 'bg-[var(--accent-orange)] border-[var(--accent-orange)]'
                    : 'bg-[var(--bg-primary)] border-[var(--text-dim)]'
                }`}
              >
                <div
                  className={`w-4 h-4 transition-transform ${
                    reduceMotion ? 'bg-[var(--bg-primary)] translate-x-7' : 'bg-[var(--text-dim)] translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>
            </>
          )}
          </div>

          <div className="px-6 py-4 border-t border-[var(--text-dim)] space-y-4">
            {error && (
              <div className="p-3 bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)] text-xs text-[var(--accent-orange)]">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[var(--accent-orange)] text-black border border-[var(--accent-orange)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity font-bold text-xs uppercase tracking-wider"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-dim)] hover:border-[var(--text-primary)] transition-colors text-xs uppercase tracking-wider"
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
