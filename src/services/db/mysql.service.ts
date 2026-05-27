import mysql from 'mysql2/promise';

/**
 * MySQL service for TCGen-Buddy.
 * Handles connections to the tcgen_buddy database.
 */
export class MySqlService {
    private static pool: mysql.Pool | null = null;

    private static getPool() {
        if (!this.pool) {
            this.pool = mysql.createPool({
                host: process.env.MYSQL_HOST || 'localhost',
                user: process.env.MYSQL_USER || 'root',
                password: process.env.MYSQL_PASSWORD || '',
                database: process.env.MYSQL_DATABASE || 'tcgen_buddy_enterprise',
                port: parseInt(process.env.MYSQL_PORT || '3306'),
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
            });
        }
        return this.pool;
    }

    /**
     * Executes a SQL query and returns the results.
     */
    static async query<T = any>(sql: string, params?: any[]): Promise<T> {
        const pool = this.getPool();
        const [results] = await pool.execute(sql, params);
        return results as T;
    }

    /**
     * Helper to insert a record into a table and get the inserted ID.
     */
    static async insert(table: string, data: Record<string, any>): Promise<number> {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        const result: any = await this.query(sql, values);
        return result.insertId;
    }

    /**
     * Helper to update a record.
     */
    static async update(table: string, id: number | string, data: Record<string, any>): Promise<boolean> {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        
        const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
        const result: any = await this.query(sql, [...values, id]);
        return result.affectedRows > 0;
    }

    /**
     * Helper to delete a record.
     */
    static async delete(table: string, id: number | string): Promise<boolean> {
        const sql = `DELETE FROM ${table} WHERE id = ?`;
        const result: any = await this.query(sql, [id]);
        return result.affectedRows > 0;
    }
}
