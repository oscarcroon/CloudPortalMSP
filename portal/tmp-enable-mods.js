const Database=require('better-sqlite3');const db=new Database('.data/dev.db');db.prepare('UPDATE modules SET enabled=1').run();console.log(db.prepare('SELECT key,enabled FROM modules').all());
