/**
 * Connection pool with backpressure — controls concurrency at the DB layer.
 *
 * When all pool connections are in use, requests are queued instead of failing.
 * This prevents connection storms and provides graceful degradation under load.
 */

const { Pool } = require('pg');
require('dotenv').config();

const MAX_POOL_SIZE = parseInt(process.env.POOL_MAX || '10', 10);

class BackpressurePool {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: MAX_POOL_SIZE,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.queue = [];
    this.activeCount = 0;
    this.maxSize = MAX_POOL_SIZE;



    this.pool.on('acquire', () => {
      this.activeCount++;
      this._logState();
    });

    this.pool.on('release', () => {
      this.activeCount--;
      this._processQueue();
      this._logState();
    });

    this.pool.on('error', (err) => {
      console.error('[Pool] Unexpected error on idle client:', err);
    });
  }

  _logState() {
    console.log(
      `[Pool] Active connections: ${this.activeCount} Queue depth: ${this.queue.length}`
    );
  }

  _processQueue() {
    while (this.queue.length > 0 && this.activeCount < this.maxSize) {
      const { resolve, reject } = this.queue.shift();
      this._getConnection().then(resolve).catch(reject);
    }
  }

  async _getConnection() {
    return this.pool.connect();
  }

  /**
   * Get a client from the pool.
   * If all connections are busy, the request is queued (backpressure).
   */
  async connect() {
    if (this.activeCount >= this.maxSize) {
      return new Promise((resolve, reject) => {
        this.queue.push({ resolve, reject });
        console.log(
          `[Pool] Backpressure queuing: ${this.queue.length} requests waiting`
        );
      });
    }
    return this._getConnection();
  }

  /**
   * Execute a query with the pool.
   */
  async query(text, params) {
    return this.pool.query(text, params);
  }

  /**
   * Get a client for transactions and return it after use.
   */
  async getClient() {
    const client = await this.connect();
    return client;
  }

  /**
   * Execute a callback within a single client transaction.
   * Handles BEGIN, COMMIT, and ROLLBACK automatically.
   */
  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

const backpressurePool = new BackpressurePool();

module.exports = backpressurePool;
module.exports.BackpressurePool = BackpressurePool;
