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
