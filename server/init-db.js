const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

async function initializeDatabase() {
    console.log("Iniciando a criação das tabelas no PostgreSQL...");
    
    try {
        // 1. Ler e executar o arquivo schema.sql
        const sqlPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await db.query(sql);
        console.log("Estrutura do banco de dados inicializada com sucesso!");
        
        // 2. Verificar se o admin padrão já existe
        const res = await db.query("SELECT * FROM users WHERE id = $1", ['admin']);
        
        if (res.rows.length === 0) {
            console.log("Admin padrão não encontrado. Criando admin inicial...");
            
            // Hash da senha deise.com
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('deise.com', salt);
            
            await db.query(
                `INSERT INTO users (id, name, email, password, role, status, color, initials) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    'admin',
                    'Deise Rose',
                    'deise.com',
                    hashedPassword,
                    'admin',
                    'ativo',
                    '#C9A84C',
                    'DR'
                ]
            );
            console.log("Administrador inicial criado com sucesso!");
            console.log("E-mail: deise.com");
            console.log("Senha: deise.com");
        } else {
            console.log("Administrador inicial já existe no banco de dados.");
        }
        
    } catch (err) {
        console.error("Erro crítico ao inicializar o banco de dados:", err);
    } finally {
        // Encerrar o pool de conexões para que o script termine
        await db.pool.end();
        console.log("Conexão encerrada.");
    }
}

initializeDatabase();
