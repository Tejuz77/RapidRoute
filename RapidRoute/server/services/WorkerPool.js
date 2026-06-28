/**
 * Worker Pool — Manages a pool of worker threads for CPU-bound tasks.
 *
 * Worker thread pool — offloads CPU-bound tasks from the main event loop to parallel threads.
 * Round-robin distribution ensures no single worker is overloaded.
 * Crashed workers are automatically restarted.
 */

const { Worker } = require('worker_threads');
const path = require('path');

class WorkerPool {
  constructor(size = 4) {
    this.size = size;
    this.workers = [];
    this.currentIndex = 0;
    this.taskQueue = [];
    this.stats = {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalDispatched: 0,
    };

    console.log(`[WorkerPool] Initializing pool with ${size} workers`);

    for (let i = 0; i < size; i++) {
      this._createWorker(i);
    }

    // Process queued tasks when a worker becomes available
    this._processQueue();
  }

  /**
   * Create a worker thread and set up event handlers.
   * @param {number} index - Worker index
   */
  _createWorker(index) {
    const workerPath = path.join(__dirname, '..', 'workers', 'bookingWorker.js');

    const worker = new Worker(workerPath, {
      workerData: { workerId: index },
    });

    worker.on('message', (msg) => {
      console.log(`[WorkerPool] Worker-${index} completed: ${msg.task || 'unknown'} — ${msg.result || 'done'}`);
      this.stats.tasksCompleted++;
      this._processQueue();
    });

    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker-${index} error: ${err.message}`);
      this.stats.tasksFailed++;
      this._restartWorker(index);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.log(`[WorkerPool] Worker-${index} exited with code ${code}. Restarting...`);
        this._restartWorker(index);
      }
    });

    this.workers[index] = worker;
    console.log(`[WorkerPool] Worker-${index} started`);
  }

  /**
   * Restart a crashed worker thread.
   */
  _restartWorker(index) {
    console.log(`[WorkerPool] Restarting worker-${index}...`);
    setTimeout(() => {
      this._createWorker(index);
    }, 1000);
  }

  /**
   * Process the task queue if a worker is available.
   */
  _processQueue() {
    if (this.taskQueue.length === 0) return;

    const availableIndex = this._getNextAvailableWorker();
    if (availableIndex === -1) {
      // All workers busy, queue depth will show in stats
      return;
    }

    const task = this.taskQueue.shift();
    this._sendToWorker(availableIndex, task);
  }

  /**
   * Get the next available worker index using round-robin.
   * @returns {number} Worker index, or -1 if all busy
   */
  _getNextAvailableWorker() {
    const startIndex = this.currentIndex;

    for (let i = 0; i < this.size; i++) {
      const index = (startIndex + i) % this.size;
      const worker = this.workers[index];
      if (worker && worker.threadId) {
        this.currentIndex = (index + 1) % this.size;
        return index;
      }
    }

    return -1;
  }

  /**
   * Send a task to a specific worker.
   * @param {number} index - Worker index
   * @param {object} task - Task to execute
   */
  _sendToWorker(index, task) {
    const worker = this.workers[index];
    if (!worker) {
      console.error(`[WorkerPool] Cannot dispatch to worker-${index}: not available`);
      this.stats.tasksFailed++;
      return;
    }

    console.log(
      `[WorkerPool] Task dispatched to worker-${index}: ${task.type} for booking ${task.bookingId || task.bookingId || 'unknown'}`
    );

    worker.postMessage(task);
  }

  /**
   * Dispatch a task to the worker pool.
   * Round-robin distribution ensures no single worker is overloaded.
   * @param {object} task - { type: string, bookingId: string, ... }
   */
  dispatch(task) {
    this.stats.totalDispatched++;

    const index = this._getNextAvailableWorker();

    if (index === -1) {
      // All workers busy — queue the task
      this.taskQueue.push(task);
      console.log(`[WorkerPool] All workers busy. Queue depth: ${this.taskQueue.length}`);
      return;
    }

    this._sendToWorker(index, task);
  }

  /**
   * Get pool statistics.
   */
  getStats() {
    const activeWorkers = this.workers.filter((w) => w && w.threadId).length;

    return {
      totalWorkers: this.size,
      activeWorkers,
      queueDepth: this.taskQueue.length,
      tasksCompleted: this.stats.tasksCompleted,
      tasksFailed: this.stats.tasksFailed,
      totalDispatched: this.stats.totalDispatched,
    };
  }

  /**
   * Gracefully terminate all workers.
   */
  async terminate() {
    console.log('[WorkerPool] Terminating all workers...');
    const promises = this.workers.map((worker, i) => {
      if (worker) {
        return worker.terminate().then(() => {
          console.log(`[WorkerPool] Worker-${i} terminated`);
        });
      }
      return Promise.resolve();
    });
    await Promise.all(promises);
    console.log('[WorkerPool] All workers terminated');
  }
}

module.exports = WorkerPool;
