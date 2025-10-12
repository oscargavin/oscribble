# Voice-to-Tasks Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add speech-to-text voice input that transcribes audio with OpenAI and formats tasks with Claude

**Architecture:** Browser MediaRecorder captures audio → OpenAI transcribes → Claude formats with voice-aware prompting → Tasks appear in list. Hold-to-record UI with pulsing red mic indicator.

**Tech Stack:** OpenAI Audio API (gpt-4o-mini-transcribe), MediaRecorder API, React hooks, Electron IPC

---

## Task 1: Add OpenAI API Key Storage

**Files:**
- Modify: `src/types/index.ts:36-40`
- Modify: `src/components/Settings.tsx` (entire file)
- Modify: `src/index.ts` (IPC handlers section)

**Step 1: Add openai_api_key to AppSettings type**

In `src/types/index.ts`, update AppSettings:

```typescript
export interface AppSettings {
  auth_method: 'api_key' | 'subscription';
  current_project?: string;
  api_key?: string; // Anthropic API key
  openai_api_key?: string; // OpenAI API key
}
```

**Step 2: Update Settings component to handle both API keys**

Read `src/components/Settings.tsx` to understand current structure, then add OpenAI API key input field below the existing Anthropic one. Use same styling pattern. Add state for `openaiApiKey` and update the save handler to persist both keys.

**Step 3: Update IPC handler to store OpenAI key**

In `src/index.ts`, ensure the `save-settings` IPC handler persists the `openai_api_key` field from AppSettings to storage.

**Step 4: Test API key persistence**

Run: `npm start`
- Open Settings
- Add a test OpenAI key
- Save and reload app
- Verify key persists

**Step 5: Commit**

```bash
git add src/types/index.ts src/components/Settings.tsx src/index.ts
git commit -m "feat: add OpenAI API key storage to settings"
```

---

## Task 2: Create OpenAI Service

**Files:**
- Create: `src/services/openai.ts`

**Step 1: Create OpenAI service class**

Create `src/services/openai.ts`:

```typescript
import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
    });
  }

  /**
   * Transcribe audio to text using OpenAI Whisper
   * @param audioBlob - WebM audio blob from MediaRecorder
   * @returns Transcribed text
   */
  async transcribe(audioBlob: Blob): Promise<string> {
    try {
      // Convert blob to File object (OpenAI SDK expects File)
      const audioFile = new File([audioBlob], 'audio.webm', {
        type: 'audio/webm',
      });

      const transcription = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: 'gpt-4o-mini-transcribe',
        response_format: 'text',
        prompt: 'The following is a developer dictating a task list. Transcribe accurately, preserving technical terms and task structure.',
      });

      return transcription;
    } catch (error) {
      console.error('OpenAI transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }
}
```

**Step 2: Install OpenAI SDK**

Run: `npm install openai`

**Step 3: Commit**

```bash
git add src/services/openai.ts package.json package-lock.json
git commit -m "feat: add OpenAI service for audio transcription"
```

---

## Task 3: Add OpenAI Service to Main Process

**Files:**
- Modify: `src/index.ts` (add OpenAI service initialization and IPC handler)
- Modify: `src/preload.ts` (expose transcribe IPC)

**Step 1: Initialize OpenAI service in main process**

In `src/index.ts`, add OpenAI service state near ClaudeService:

```typescript
import { OpenAIService } from './services/openai';

// Near line 30 where claudeService is declared
let openaiService: OpenAIService | null = null;
```

**Step 2: Create init-openai IPC handler**

Add handler after `init-claude`:

```typescript
ipcMain.handle('init-openai', async (_event, apiKey: string) => {
  try {
    openaiService = new OpenAIService(apiKey);
    return { success: true };
  } catch (error) {
    console.error('Failed to initialize OpenAI:', error);
    return { success: false, error: error.message };
  }
});
```

**Step 3: Create transcribe-audio IPC handler**

Add handler that receives audio buffer and returns transcript:

```typescript
ipcMain.handle('transcribe-audio', async (_event, audioBuffer: ArrayBuffer) => {
  try {
    if (!openaiService) {
      return { success: false, error: 'OpenAI not initialized' };
    }

    // Convert ArrayBuffer to Blob
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    const transcript = await openaiService.transcribe(audioBlob);

    return { success: true, data: transcript };
  } catch (error) {
    console.error('Transcription error:', error);
    return { success: false, error: error.message };
  }
});
```

**Step 4: Expose transcribe in preload script**

In `src/preload.ts`, add to electronAPI:

```typescript
initOpenAI: (apiKey: string) => ipcRenderer.invoke('init-openai', apiKey),
transcribeAudio: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer),
```

**Step 5: Update TypeScript declarations**

Add types to the `ElectronAPI` interface in `src/preload.ts`:

```typescript
interface ElectronAPI {
  // ... existing methods
  initOpenAI: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; data?: string; error?: string }>;
}
```

**Step 6: Commit**

```bash
git add src/index.ts src/preload.ts
git commit -m "feat: add OpenAI transcription IPC handlers"
```

---

## Task 4: Update Claude Service for Voice Input

**Files:**
- Modify: `src/services/claude.ts:4-44` (system prompt)
- Modify: `src/services/claude.ts:58-80` (formatTasks method signature)

**Step 1: Add voice input parameter to formatTasks**

Update the `formatTasks` method signature:

```typescript
async formatTasks(
  rawText: string,
  contextStr: string,
  isVoiceInput: boolean = false
): Promise<ClaudeFormatResponse> {
```

**Step 2: Update system prompt to handle voice input**

Update SYSTEM_PROMPT to include voice-specific instructions:

```typescript
const SYSTEM_PROMPT = `You are a task analysis assistant for software developers.

Given raw bullet-point tasks and code context, you should:
1. Parse tasks into structured categories (CRITICAL, PERFORMANCE, FEATURES)
2. Identify dependencies and blockers
3. Detect missing tasks based on code context
4. Suggest reordering for logical execution
5. Flag potential issues
6. Extract deadlines, effort estimates, and tags from task descriptions

When input is from speech-to-text (isVoiceInput=true):
- Be lenient with grammar, filler words, and conversational patterns
- Extract discrete tasks from run-on sentences and natural speech
- Ignore filler words like "um", "uh", "like", "you know"
- Convert conversational language to concise task descriptions
- Example: "So um I need to like fix the login bug and then uh also we should add the dark mode"
  becomes two tasks: "Fix login bug" and "Add dark mode feature"

Output JSON with STRUCTURED ARRAYS (not comma-separated strings):
// ... rest of system prompt unchanged
`;
```

**Step 3: Pass isVoiceInput flag to prompt**

Update the user prompt to include the flag:

```typescript
const prompt = `Raw tasks${isVoiceInput ? ' (from voice transcription)' : ''}:
${rawText}

Context:
${contextStr}

Analyze and structure these tasks.`;
```

**Step 4: Commit**

```bash
git add src/services/claude.ts
git commit -m "feat: add voice input awareness to Claude service"
```

---

## Task 5: Create Voice Recording Hook

**Files:**
- Create: `src/hooks/useVoiceRecording.ts`

**Step 1: Create useVoiceRecording hook**

Create `src/hooks/useVoiceRecording.ts`:

```typescript
import { useState, useRef, useCallback } from 'react';

interface UseVoiceRecordingResult {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
}

export function useVoiceRecording(): UseVoiceRecordingResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Error starting recording:', err);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Stop all tracks to release microphone
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        setIsRecording(false);
        resolve(audioBlob);
      };

      mediaRecorder.stop();
    });
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useVoiceRecording.ts
git commit -m "feat: add voice recording hook with MediaRecorder"
```

---

## Task 6: Add Voice Button to RawInput Component

**Files:**
- Modify: `src/components/RawInput.tsx` (add voice button and wire up recording)
- Create: `src/styles/voice-button.css` (pulsing animation)

**Step 1: Read RawInput to understand current structure**

Run: Read `src/components/RawInput.tsx` to see current button layout and format handler

**Step 2: Import voice recording hook**

Add to imports:

```typescript
import { useVoiceRecording } from '../hooks/useVoiceRecording';
```

**Step 3: Add voice recording state and handlers**

Add after existing state declarations:

```typescript
const { isRecording, startRecording, stopRecording, error: recordingError } = useVoiceRecording();
const [isProcessing, setIsProcessing] = useState(false);

const handleVoiceStart = async () => {
  await startRecording();
};

const handleVoiceStop = async () => {
  setIsProcessing(true);
  try {
    const audioBlob = await stopRecording();
    if (!audioBlob) {
      throw new Error('No audio recorded');
    }

    // Convert blob to ArrayBuffer for IPC
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Transcribe with OpenAI
    const transcriptResult = await window.electronAPI.transcribeAudio(arrayBuffer);
    if (!transcriptResult.success) {
      throw new Error(transcriptResult.error || 'Transcription failed');
    }

    const transcript = transcriptResult.data;

    // Gather context (check for @mentions in transcript)
    const contextResult = await window.electronAPI.gatherContext(projectRoot, transcript);
    const contextStr = contextResult.success
      ? Object.values(contextResult.data || {})
          .map((ctx: any) => `File: ${ctx.path}\n${ctx.content}`)
          .join('\n\n')
      : '';

    // Format with Claude (with voice input flag)
    await onFormat(transcript, contextStr, true);
  } catch (error) {
    console.error('Voice processing error:', error);
    alert(`Voice processing failed: ${error.message}`);
  } finally {
    setIsProcessing(false);
  }
};
```

**Step 4: Add voice button to UI**

Add voice button next to Format button in the JSX. Find the Format button and add voice button before it:

```typescript
<button
  onMouseDown={handleVoiceStart}
  onMouseUp={handleVoiceStop}
  onMouseLeave={handleVoiceStop}
  disabled={loading || isProcessing}
  className={`px-6 py-3 font-mono text-sm uppercase tracking-wider transition-none ${
    isRecording
      ? 'bg-red-600 text-white border-red-600 animate-pulse'
      : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-white/20 hover:border-[#FF4D00] hover:text-[#FF4D00]'
  } border disabled:opacity-50 disabled:cursor-not-allowed`}
  title="Hold to record voice input"
>
  {isProcessing ? '⏳ Processing...' : isRecording ? '🔴 Recording...' : '🎤 Voice'}
</button>
```

**Step 5: Update onFormat prop signature**

The `onFormat` callback needs to accept an optional third parameter. Update the component's props interface:

```typescript
interface RawInputProps {
  initialValue: string;
  projectName: string;
  projectRoot: string;
  onFormat: (rawText: string, contextStr: string, isVoiceInput?: boolean) => Promise<void>;
}
```

**Step 6: Commit**

```bash
git add src/components/RawInput.tsx
git commit -m "feat: add voice recording button to RawInput"
```

---

## Task 7: Update App.tsx to Handle Voice Input

**Files:**
- Modify: `src/App.tsx:327-417` (handleFormat function)
- Modify: `src/App.tsx:32-59` (initialization to init OpenAI)

**Step 1: Initialize OpenAI on app mount**

In the `checkSetup` useEffect (around line 32), add OpenAI initialization after Anthropic:

```typescript
// After Claude initialization
if (settings?.openai_api_key) {
  const openaiInitResult = await window.electronAPI.initOpenAI(
    settings.openai_api_key
  );
  if (!openaiInitResult.success) {
    console.error(
      "Failed to initialize OpenAI:",
      openaiInitResult.error
    );
  }
}
```

**Step 2: Update handleFormat to accept isVoiceInput parameter**

Update the function signature:

```typescript
const handleFormat = async (
  rawText: string,
  contextStr: string,
  isVoiceInput: boolean = false
) => {
```

**Step 3: Pass isVoiceInput to Claude when voice transcription**

When calling `formatWithClaude` IPC, the handler needs to pass the flag. We need to update the IPC handler first. Actually, wait - we need to update the IPC to accept this parameter.

Go back to `src/index.ts` and update the `format-with-claude` handler:

```typescript
ipcMain.handle(
  'format-with-claude',
  async (_event, rawText: string, contextStr: string, isVoiceInput: boolean = false) => {
    try {
      if (!claudeService) {
        return { success: false, error: 'Claude not initialized' };
      }

      const response = await claudeService.formatTasks(rawText, contextStr, isVoiceInput);
      return { success: true, data: response };
    } catch (error) {
      console.error('Claude format error:', error);
      return { success: false, error: error.message };
    }
  }
);
```

**Step 4: Update preload.ts to pass isVoiceInput**

In `src/preload.ts`, update the formatWithClaude signature:

```typescript
formatWithClaude: (rawText: string, contextStr: string, isVoiceInput?: boolean) =>
  ipcRenderer.invoke('format-with-claude', rawText, contextStr, isVoiceInput),
```

**Step 5: Update App.tsx to use new parameter**

In `handleFormat`, update the IPC call:

```typescript
const result = await window.electronAPI.formatWithClaude(
  diffText,
  contextStr,
  isVoiceInput
);
```

**Step 6: Skip diff logic for voice input**

Voice transcriptions should be formatted entirely, not diffed. Update the diff logic:

```typescript
const handleFormat = async (
  rawText: string,
  contextStr: string,
  isVoiceInput: boolean = false
) => {
  try {
    let textToFormat = rawText;

    // Only apply diff logic for manual text input (not voice)
    if (!isVoiceInput) {
      // Compute diff: only format what's new or changed
      const currentLines = rawText.split("\n").filter((line) => line.trim());
      const lastLines = lastFormattedRaw
        .split("\n")
        .filter((line) => line.trim());

      // Find new/changed lines
      const lastLinesSet = new Set(lastLines);
      const newLines = currentLines.filter((line) => !lastLinesSet.has(line));

      // If nothing new, don't call Claude
      if (newLines.length === 0) {
        alert("No new changes to format");
        return;
      }

      textToFormat = newLines.join("\n");
    }

    // Format the text
    const result = await window.electronAPI.formatWithClaude(
      textToFormat,
      contextStr,
      isVoiceInput
    );

    // ... rest of function unchanged
```

**Step 7: Commit**

```bash
git add src/App.tsx src/index.ts src/preload.ts
git commit -m "feat: wire up voice input flag through IPC to Claude"
```

---

## Task 8: Add Keyboard Shortcut for Voice

**Files:**
- Modify: `src/components/RawInput.tsx` (add keyboard listener)

**Step 1: Add keyboard event handler**

In RawInput component, add a useEffect for keyboard shortcuts:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // CMD+SHIFT+V or CTRL+SHIFT+V to start recording
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'v') {
      e.preventDefault();
      if (!isRecording && !loading && !isProcessing) {
        handleVoiceStart();
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // Release CMD+SHIFT+V to stop recording
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'v') {
      e.preventDefault();
      if (isRecording) {
        handleVoiceStop();
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
  };
}, [isRecording, loading, isProcessing]);
```

**Step 2: Update button title to mention keyboard shortcut**

```typescript
title="Hold to record voice input (Cmd+Shift+V)"
```

**Step 3: Commit**

```bash
git add src/components/RawInput.tsx
git commit -m "feat: add CMD+SHIFT+V keyboard shortcut for voice recording"
```

---

## Task 9: Initialize OpenAI on Settings Update

**Files:**
- Modify: `src/components/Settings.tsx` (reinit OpenAI when API key changes)

**Step 1: Call initOpenAI when saving settings**

In the Settings component's save handler, add OpenAI initialization:

```typescript
const handleSave = async () => {
  // ... existing Anthropic init code

  // Initialize OpenAI if key provided
  if (openaiApiKey.trim()) {
    const openaiInitResult = await window.electronAPI.initOpenAI(openaiApiKey);
    if (!openaiInitResult.success) {
      alert(`Failed to initialize OpenAI: ${openaiInitResult.error}`);
      return;
    }
  }

  // ... rest of save logic
};
```

**Step 2: Test OpenAI key persistence**

Run: `npm start`
- Add OpenAI API key in Settings
- Try voice recording
- Reload app
- Verify voice recording still works

**Step 3: Commit**

```bash
git add src/components/Settings.tsx
git commit -m "feat: initialize OpenAI service when settings are saved"
```

---

## Task 10: Handle Missing OpenAI API Key

**Files:**
- Modify: `src/components/RawInput.tsx` (check for OpenAI key before recording)

**Step 1: Add API key check**

Update `handleVoiceStart`:

```typescript
const handleVoiceStart = async () => {
  // Check if OpenAI is configured
  const settings = await window.electronAPI.getSettings();
  if (!settings?.openai_api_key) {
    alert('OpenAI API key required for voice input. Please add it in Settings.');
    return;
  }

  await startRecording();
};
```

**Step 2: Test missing key scenario**

Run: `npm start`
- Remove OpenAI key from Settings
- Try to use voice button
- Verify error message appears

**Step 3: Commit**

```bash
git add src/components/RawInput.tsx
git commit -m "feat: validate OpenAI API key before voice recording"
```

---

## Task 11: End-to-End Testing

**Files:**
- Test in browser

**Step 1: Test full voice flow with valid keys**

Run: `npm start`

1. Add both Anthropic and OpenAI API keys in Settings
2. Navigate to raw input view
3. Hold voice button (or CMD+SHIFT+V)
4. Speak: "Add login validation and fix the header styling bug"
5. Release button
6. Verify processing indicator appears
7. Verify tasks appear in task list with proper formatting

Expected: Two tasks created, properly categorized

**Step 2: Test hold-to-record behavior**

1. Hold voice button for 5 seconds
2. Speak continuously
3. Release button
4. Verify recording stops immediately
5. Verify transcription processes

**Step 3: Test keyboard shortcut**

1. Hold CMD+SHIFT+V
2. Speak test phrase
3. Release keys
4. Verify same behavior as button

**Step 4: Test with @mentions in speech**

1. Hold voice button
2. Speak: "Update the authentication in @src/services/claude.ts and add tests"
3. Release
4. Verify context is gathered for mentioned file
5. Verify Claude receives file context

**Step 5: Test error scenarios**

- No OpenAI key: Verify error message
- Microphone denied: Verify permission error
- Network error: Verify graceful failure

**Step 6: Verify UI states**

- Idle: Gray mic icon "🎤 Voice"
- Recording: Red pulsing "🔴 Recording..."
- Processing: "⏳ Processing..."
- Disabled: Grayed out when loading

**Step 7: If all tests pass, commit**

```bash
git add .
git commit -m "feat: voice-to-tasks complete - OpenAI transcription + Claude formatting"
```

---

## Task 12: Update Documentation

**Files:**
- Modify: `CLAUDE.md` (document voice feature)
- Modify: `README.md` (add voice feature to features list)

**Step 1: Document voice feature in CLAUDE.md**

Add to the "## Key Features" section:

```markdown
### Voice Input

Hold the microphone button (or CMD+SHIFT+V) to record task dictation:
- Audio → OpenAI transcription (gpt-4o-mini-transcribe)
- Transcript → Claude formatting with voice-aware prompting
- Tasks appear directly in task list

Requires both Anthropic and OpenAI API keys in Settings.
```

**Step 2: Update README.md features**

Add to features list:

```markdown
- **Voice Input**: Hold-to-record dictation with OpenAI transcription
```

**Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document voice-to-tasks feature"
```

---

## Completion Checklist

- [ ] OpenAI API key storage in settings
- [ ] OpenAI service with transcription
- [ ] IPC handlers for OpenAI initialization and transcription
- [ ] Claude service accepts isVoiceInput flag
- [ ] Voice recording hook with MediaRecorder
- [ ] Voice button in RawInput with pulsing animation
- [ ] Keyboard shortcut CMD+SHIFT+V
- [ ] Full flow: record → transcribe → format → tasks appear
- [ ] Error handling for missing keys and permissions
- [ ] End-to-end testing
- [ ] Documentation updated

---

## Notes for Implementation

- Voice button appears ONLY in raw input view (not in tasks view)
- Button is hold-to-record (not toggle)
- Red pulsing animation during recording
- Processing indicator while transcribing/formatting
- Voice transcripts skip the diff logic (always format full transcript)
- @mentions in voice transcription are supported (context gathering works)
- Requires both API keys (Anthropic for formatting, OpenAI for transcription)
