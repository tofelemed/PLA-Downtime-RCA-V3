// Event Bus Architecture for real-time event handling
// This can be easily replaced with backend services later

export interface EventHandler {
  (event: Event): void;
}

export interface Event {
  id: string;
  topic: string;
  data: any;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

export interface Subscription {
  id: string;
  topic: string;
  handler: EventHandler;
  active: boolean;
  createdAt: Date;
  lastEvent?: Date;
  eventCount: number;
}

export interface EventBusConfig {
  maxSubscriptions?: number;
  maxEventHistory?: number;
  enableEventHistory?: boolean;
  enableMetrics?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface EventMetrics {
  totalEvents: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  eventsPerSecond: number;
  averageLatency: number;
  lastEventTime?: Date;
  topics: Record<string, number>;
}

export interface EventFilter {
  topic?: string | RegExp;
  source?: string | RegExp;
  data?: (data: any) => boolean;
  timestamp?: {
    after?: Date;
    before?: Date;
  };
  metadata?: Record<string, any>;
}

export class EventBus {
  private subscriptions: Map<string, Subscription> = new Map();
  private eventHistory: Event[] = [];
  private config: EventBusConfig;
  private metrics: EventMetrics;
  private eventCounters: Map<string, number> = new Map();
  private lastEventTime?: Date;
  private isDestroyed: boolean = false;

  constructor(config: EventBusConfig = {}) {
    this.config = {
      maxSubscriptions: 1000,
      maxEventHistory: 10000,
      enableEventHistory: true,
      enableMetrics: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.metrics = {
      totalEvents: 0,
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      eventsPerSecond: 0,
      averageLatency: 0,
      topics: {}
    };

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  // Subscribe to events
  subscribe(topic: string, handler: EventHandler): Subscription {
    if (this.isDestroyed) {
      throw new Error('EventBus has been destroyed');
    }

    if (this.subscriptions.size >= (this.config.maxSubscriptions || 1000)) {
      throw new Error('Maximum number of subscriptions reached');
    }

    const subscriptionId = this.generateSubscriptionId();
    const subscription: Subscription = {
      id: subscriptionId,
      topic,
      handler,
      active: true,
      createdAt: new Date(),
      eventCount: 0
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.totalSubscriptions++;
    this.metrics.activeSubscriptions++;

    // Update topic counter
    this.eventCounters.set(topic, (this.eventCounters.get(topic) || 0) + 1);

    console.log(`📡 Subscribed to topic: ${topic} (ID: ${subscriptionId})`);

    return subscription;
  }

  // Unsubscribe from events
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.active = false;
    this.subscriptions.delete(subscriptionId);
    this.metrics.activeSubscriptions--;

    // Update topic counter
    const topic = subscription.topic;
    const currentCount = this.eventCounters.get(topic) || 0;
    if (currentCount > 1) {
      this.eventCounters.set(topic, currentCount - 1);
    } else {
      this.eventCounters.delete(topic);
    }

    console.log(`🔌 Unsubscribed from topic: ${topic} (ID: ${subscriptionId})`);
    return true;
  }

  // Publish an event
  async publish(topic: string, data: any, source: string = 'system', metadata?: Record<string, any>): Promise<string> {
    if (this.isDestroyed) {
      throw new Error('EventBus has been destroyed');
    }

    const event: Event = {
      id: this.generateEventId(),
      topic,
      data,
      timestamp: new Date(),
      source,
      metadata,
      correlationId: metadata?.correlationId
    };

    // Store in history if enabled
    if (this.config.enableEventHistory) {
      this.addToHistory(event);
    }

    // Update metrics
    this.updateMetrics(event);

    // Find all matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.active && this.topicMatches(sub.topic, topic));

    // Publish to all matching subscriptions
    const publishPromises = matchingSubscriptions.map(subscription => 
      this.deliverEvent(subscription, event)
    );

    // Wait for all deliveries to complete
    await Promise.allSettled(publishPromises);

    console.log(`📢 Published event to ${matchingSubscriptions.length} subscribers: ${topic}`);
    return event.id;
  }

  // Publish multiple events
  async publishBatch(events: Array<{ topic: string; data: any; source?: string; metadata?: Record<string, any> }>): Promise<string[]> {
    const eventIds: string[] = [];
    
    for (const eventData of events) {
      const eventId = await this.publish(
        eventData.topic,
        eventData.data,
        eventData.source || 'system',
        eventData.metadata
      );
      eventIds.push(eventId);
    }

    return eventIds;
  }

  // Get all active subscriptions
  getSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.active);
  }

  // Get subscriptions for a specific topic
  getSubscriptionsForTopic(topic: string): Subscription[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.active && this.topicMatches(sub.topic, topic));
  }

  // Get event history
  getEventHistory(filter?: EventFilter, limit?: number): Event[] {
    if (!this.config.enableEventHistory) {
      return [];
    }

    let filteredEvents = this.eventHistory;

    if (filter) {
      filteredEvents = this.applyEventFilter(filteredEvents, filter);
    }

    if (limit) {
      filteredEvents = filteredEvents.slice(-limit);
    }

    return filteredEvents;
  }

  // Get metrics
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  // Clear event history
  clearEventHistory(): void {
    this.eventHistory = [];
    console.log('🗑️ Event history cleared');
  }

  // Get active topics
  getActiveTopics(): string[] {
    return Array.from(this.eventCounters.keys());
  }

  // Check if topic has active subscriptions
  hasSubscribers(topic: string): boolean {
    return Array.from(this.subscriptions.values())
      .some(sub => sub.active && this.topicMatches(sub.topic, topic));
  }

  // Wait for an event (useful for testing or synchronization)
  async waitForEvent(topic: string, timeout: number = 5000): Promise<Event> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for event on topic: ${topic}`));
      }, timeout);

      const subscription = this.subscribe(topic, (event) => {
        clearTimeout(timeoutId);
        this.unsubscribe(subscription.id);
        resolve(event);
      });
    });
  }

  // Destroy the event bus
  destroy(): void {
    this.isDestroyed = true;
    this.subscriptions.clear();
    this.eventHistory = [];
    this.eventCounters.clear();
    console.log('🗑️ EventBus destroyed');
  }

  // Private methods

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private topicMatches(subscriptionTopic: string, eventTopic: string): boolean {
    // Simple exact match for now, can be extended with wildcard support
    return subscriptionTopic === eventTopic;
  }

  private addToHistory(event: Event): void {
    this.eventHistory.push(event);
    
    // Maintain history size limit
    if (this.eventHistory.length > (this.config.maxEventHistory || 10000)) {
      this.eventHistory = this.eventHistory.slice(-(this.config.maxEventHistory || 10000));
    }
  }

  private updateMetrics(event: Event): void {
    this.metrics.totalEvents++;
    this.lastEventTime = event.timestamp;

    // Update topic counter
    const topicCount = this.metrics.topics[event.topic] || 0;
    this.metrics.topics[event.topic] = topicCount + 1;
  }

  private async deliverEvent(subscription: Subscription, event: Event): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Call the handler
      subscription.handler(event);
      
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Update subscription metrics
      subscription.lastEvent = new Date();
      subscription.eventCount++;

      // Update global metrics
      this.updateLatencyMetrics(latency);

    } catch (error) {
      console.error(`❌ Error delivering event to subscription ${subscription.id}:`, error);
      
      // Emit error event
      this.emitErrorEvent(subscription, event, error);
    }
  }

  private updateLatencyMetrics(latency: number): void {
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = latency;
    } else {
      // Exponential moving average
      this.metrics.averageLatency = this.metrics.averageLatency * 0.9 + latency * 0.1;
    }
  }

  private emitErrorEvent(subscription: Subscription, event: Event, error: any): void {
    // Create error event
    const errorEvent: Event = {
      id: this.generateEventId(),
      topic: 'eventbus.error',
      data: {
        originalEvent: event,
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      timestamp: new Date(),
      source: 'eventbus',
      correlationId: event.correlationId
    };

    // Add to history
    if (this.config.enableEventHistory) {
      this.addToHistory(errorEvent);
    }

    // Update metrics
    this.updateMetrics(errorEvent);
  }

  private applyEventFilter(events: Event[], filter: EventFilter): Event[] {
    return events.filter(event => {
      // Topic filter
      if (filter.topic) {
        if (filter.topic instanceof RegExp) {
          if (!filter.topic.test(event.topic)) return false;
        } else {
          if (event.topic !== filter.topic) return false;
        }
      }

      // Source filter
      if (filter.source) {
        if (filter.source instanceof RegExp) {
          if (!filter.source.test(event.source)) return false;
        } else {
          if (event.source !== filter.source) return false;
        }
      }

      // Data filter
      if (filter.data && !filter.data(event.data)) {
        return false;
      }

      // Timestamp filter
      if (filter.timestamp) {
        if (filter.timestamp.after && event.timestamp < filter.timestamp.after) {
          return false;
        }
        if (filter.timestamp.before && event.timestamp > filter.timestamp.before) {
          return false;
        }
      }

      // Metadata filter
      if (filter.metadata) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          if (event.metadata?.[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  private startMetricsCollection(): void {
    // Update events per second every second
    setInterval(() => {
      if (this.lastEventTime) {
        const now = new Date();
        const timeDiff = (now.getTime() - this.lastEventTime.getTime()) / 1000;
        
        if (timeDiff > 0) {
          this.metrics.eventsPerSecond = this.metrics.totalEvents / timeDiff;
        }
      }
    }, 1000);
  }
}

// Singleton instance for global use
export const globalEventBus = new EventBus({
  maxSubscriptions: 1000,
  maxEventHistory: 10000,
  enableEventHistory: true,
  enableMetrics: true
});

// Export the singleton for easy access
export default globalEventBus;
