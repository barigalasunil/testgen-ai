import { MySqlService } from './mysql.service';
import fs from 'fs';
import path from 'path';

async function migrate() {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    // Ensure migration tracking table exists
    await MySqlService.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            filename VARCHAR(255) PRIMARY KEY,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const executed: string[] = await MySqlService.query(
        'SELECT filename FROM _migrations'
    ).then((rows: any) => rows.map((r: any) => r.filename));

    for (const file of files) {
        if (executed.includes(file)) {
            console.log(`[SKIP] ${file} already executed`);
            continue;
        }

        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        console.log(`[RUN] ${file}...`);

        for (const statement of sql.split(';').filter(s => s.trim())) {
            await MySqlService.query(statement.trim() + ';');
        }

        await MySqlService.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
        console.log(`[DONE] ${file}`);
    }

    console.log('All migrations complete.');
    process.exit(0);
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
