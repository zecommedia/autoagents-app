import axios from 'axios';

export interface TelemetryEvent {
  userId: string;
  sessionId: string;
  eventType: 'generation_complete' | 'error' | 'mode_switch' | 'feature_used' | 'session_start';
  feature?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export class TelemetryService {
  private readonly cloudApiUrl: string;
  private readonly userId: string;
  private readonly apiKey: string;
  private sessionId: string;
  private eventQueue: TelemetryEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(cloudApiUrl: string, userId: string, apiKey: string) {
    this.cloudApiUrl = cloudApiUrl;
    this.userId = userId;
    this.apiKey = apiKey;
    this.sessionId = this.generateSessionId();
    
    // Auto flush every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, 30000);
    
    // Send session start event
    this.track({ eventType: 'session_start', metadata: {} });
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async track(event: Omit<TelemetryEvent, 'userId' | 'sessionId' | 'timestamp'>) {
    this.eventQueue.push({
      ...event,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date()
    });
    
    // Flush immediately if queue is full or event is critical
    if (this.eventQueue.length >= 50 || event.eventType === 'error') {
      await this.flush();
    }
  }

  private async flush() {
    if (this.eventQueue.length === 0) return;
    
    const batch = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      await axios.post(`${this.cloudApiUrl}/telemetry/batch`, {
        events: batch
      }, {
        headers: { 'X-API-Key': this.apiKey },
        timeout: 10000
      });
      
      console.log(`📤 Sent ${batch.length} telemetry events`);
    } catch (error) {
      console.error('Failed to send telemetry:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...batch);
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush().catch(console.error);
  }
}
