import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool, Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export class DatabaseService {
  private pool: pg.Pool | null = null;
  private listenClient: pg.Client | null = null;
  private isListening = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    this.config = config || {
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/resumehack',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  public getPool(): pg.Pool {
    if (!this.pool) {
      this.pool = new Pool(this.config);
      this.pool.on('error', (err) => {
        console.error('[Database Pool] Unexpected idle client error:', err.message);
      });
    }
    return this.pool;
  }

  public setPool(customPool: pg.Pool): void {
    this.pool = customPool;
  }

  public async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const pool = this.getPool();
    const result = await pool.query(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  }

  /**
   * Run migrations from schema.sql
   */
  public async runMigrations(customSchemaSql?: string): Promise<void> {
    const schemaSql = customSchemaSql || fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(schemaSql);
      await client.query('COMMIT');
      console.log('[Database] Migrations executed successfully.');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[Database] Migration failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Execute callback inside an ACID transaction with automatic COMMIT / ROLLBACK
   */
  public async withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Dedicated resilient LISTEN connection for Postgres NOTIFY channels
   */
  public async listenToJobEvents(
    channel: string,
    onEvent: (payload: any) => void,
    onError?: (err: Error) => void
  ): Promise<void> {
    if (this.isListening && this.listenClient) {
      return;
    }

    const connectAndListen = async () => {
      try {
        if (this.listenClient) {
          try { await this.listenClient.end(); } catch {}
          this.listenClient = null;
        }

        const client = new Client(this.config);
        this.listenClient = client;

        client.on('error', (err) => {
          console.error(`[Postgres LISTEN] Connection error on channel '${channel}':`, err.message);
          onError?.(err);
          this.scheduleReconnect(channel, onEvent, onError);
        });

        client.on('notification', (msg) => {
          if (msg.channel === channel && msg.payload) {
            try {
              const parsed = JSON.parse(msg.payload);
              onEvent(parsed);
            } catch (parseErr) {
              console.warn('[Postgres LISTEN] Failed to parse notification JSON:', msg.payload);
            }
          }
        });

        await client.connect();
        await client.query(`LISTEN ${channel}`);
        this.isListening = true;
        console.log(`[Postgres LISTEN] Successfully subscribed to NOTIFY channel '${channel}'.`);

        // Setup periodic heartbeat ping to detect silent TCP half-open drops
        this.startHeartbeat();
      } catch (err: any) {
        console.error(`[Postgres LISTEN] Failed to connect to channel '${channel}':`, err.message);
        onError?.(err);
        this.scheduleReconnect(channel, onEvent, onError);
      }
    };

    await connectAndListen();
  }

  private scheduleReconnect(
    channel: string,
    onEvent: (payload: any) => void,
    onError?: (err: Error) => void
  ): void {
    this.isListening = false;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      console.warn(`[Postgres LISTEN] Attempting reconnection to channel '${channel}'...`);
      await this.listenToJobEvents(channel, onEvent, onError);
    }, 5000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      if (this.listenClient) {
        try {
          await this.listenClient.query('SELECT 1');
        } catch (err: any) {
          console.warn('[Postgres LISTEN] Heartbeat ping failed, triggering reconnect:', err.message);
          this.listenClient.emit('error', err);
        }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public async close(): Promise<void> {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.listenClient) {
      try {
        await this.listenClient.end();
      } catch {}
      this.listenClient = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.isListening = false;
  }
}

export const db = new DatabaseService();
