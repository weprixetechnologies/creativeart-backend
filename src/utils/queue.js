class LocalQueue {
  constructor() {
    this.handlers = {};
  }

  registerHandler(jobName, handlerFn) {
    this.handlers[jobName] = handlerFn;
  }

  async add(jobName, data) {
    console.log(`[LocalQueue] Enqueued job "${jobName}" with data:`, data);
    
    // Process asynchronously in the background
    setImmediate(async () => {
      const handler = this.handlers[jobName];
      if (!handler) {
        console.error(`[LocalQueue] No handler registered for job "${jobName}"`);
        return;
      }
      try {
        console.log(`[LocalQueue] Processing job "${jobName}"...`);
        await handler(data);
        console.log(`[LocalQueue] Job "${jobName}" completed successfully.`);
      } catch (err) {
        console.error(`[LocalQueue] Job "${jobName}" failed:`, err);
      }
    });
  }
}

module.exports = new LocalQueue();
