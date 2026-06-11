const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'raiodosol_secret_token_key_2026';

// Middleware de Log simples
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// PREVENIR CACHE DE NAVEGADOR GLOBALMENTE (Essencial para garantir que o cliente pegue as correções)
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

// Servir arquivos estáticos do frontend (pasta pai do server/)
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));

// Habilitar CORS e Parser de JSON com limite de tamanho para receber fotos em base64
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware para verificar o token JWT nas requisições protegidas
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido ou expirado.' });
        }
        req.user = user;
        next();
    });
}

// ==========================================
// ROTAS DE AUTENTICAÇÃO
// ==========================================

// Login de Usuários
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Preencha todos os campos.' });
    }
    
    try {
        const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        
        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        }
        
        const user = userRes.rows[0];
        
        // Verificar status
        if (user.status === 'pendente') {
            return res.status(403).json({ error: 'Seu cadastro ainda está aguardando aprovação do administrador.' });
        }
        
        // Verificar senha
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        }
        
        // Gerar Token JWT
        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                percentual: user.percentual,
                specialty: user.specialty,
                color: user.color,
                initials: user.initials,
                avatar: user.avatar,
                status: user.status
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// Cadastro de Funcionários
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, phone, specialty, avatar } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Preencha os campos obrigatórios.' });
    }
    
    try {
        // Verificar se e-mail já existe
        const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
        }
        
        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Gerar um ID único simples
        const userId = 'u_' + Date.now() + Math.random().toString(36).substr(2, 5);
        
        // Iniciais e cor padrão do avatar
        const words = name.trim().split(' ');
        const initials = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
        const colors = ['#C9A84C', '#AB47BC', '#26A69A', '#42A5F5', '#FF9800', '#EC407A'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        await db.query(
            `INSERT INTO users (id, name, email, password, phone, role, status, percentual, specialty, color, initials, avatar) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                userId,
                name,
                email.toLowerCase().trim(),
                hashedPassword,
                phone || '',
                'funcionario',
                'pendente',
                35,
                specialty || 'Cabelo',
                randomColor,
                initials,
                avatar || null
            ]
        );
        
        res.status(201).json({ success: true, message: 'Cadastro realizado com sucesso! Aguarde aprovação.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno no servidor ao registrar.' });
    }
});

// Validar sessão atual
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const userRes = await db.query('SELECT id, name, email, role, phone, percentual, specialty, color, initials, avatar, status FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        res.json(userRes.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// ==========================================
// ROTAS DE USUÁRIOS (PROFISSIONAIS)
// ==========================================

// Listar profissionais
app.get('/api/users', authenticateToken, async (req, res) => {
    const { role, status } = req.query;
    let queryText = 'SELECT id, name, email, role, phone, percentual, specialty, color, initials, avatar, status FROM users';
    const params = [];
    
    if (role && status) {
        if (role === 'funcionario') {
            queryText += " WHERE (role = $1 OR id = 'u_17805878131343mz8f') AND status = $2";
            params.push(role, status);
        } else {
            queryText += ' WHERE role = $1 AND status = $2';
            params.push(role, status);
        }
    } else if (role) {
        if (role === 'funcionario') {
            queryText += " WHERE (role = $1 OR id = 'u_17805878131343mz8f')";
            params.push(role);
        } else {
            queryText += ' WHERE role = $1';
            params.push(role);
        }
    } else if (status) {
        queryText += ' WHERE status = $1';
        params.push(status);
    }
    
    queryText += ' ORDER BY name ASC';
    
    try {
        const usersRes = await db.query(queryText, params);
        res.json(usersRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao carregar profissionais.' });
    }
});

// Obter dados de um único usuário/funcionário
app.get('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const userRes = await db.query(
            'SELECT id, name, email, role, phone, percentual, specialty, color, initials, avatar, status FROM users WHERE id = $1',
            [id]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        res.json(userRes.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao obter dados do usuário.' });
    }
});

// Aprovar/Rejeitar solicitação ou alterar percentual/detalhes/senha do funcionário
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, status, percentual, specialty, color, initials, avatar, password } = req.body;
    
    try {
        // Verificar se usuário existe
        const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const existing = userCheck.rows[0];
        
        const updatedName = name !== undefined ? name : existing.name;
        const updatedEmail = email !== undefined ? email.toLowerCase().trim() : existing.email;
        const updatedPhone = phone !== undefined ? phone : existing.phone;
        const updatedStatus = status !== undefined ? status : existing.status;
        const updatedPercentual = percentual !== undefined ? parseInt(percentual) : existing.percentual;
        const updatedSpecialty = specialty !== undefined ? specialty : existing.specialty;
        const updatedColor = color !== undefined ? color : existing.color;
        const updatedInitials = initials !== undefined ? initials : existing.initials;
        const updatedAvatar = avatar !== undefined ? avatar : existing.avatar;

        let updatedPassword = existing.password;
        if (password !== undefined && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updatedPassword = await bcrypt.hash(password.trim(), salt);
        }
        
        await db.query(
            `UPDATE users 
             SET name = $1, email = $2, phone = $3, status = $4, percentual = $5, specialty = $6, color = $7, initials = $8, avatar = $9, password = $10
             WHERE id = $11`,
            [updatedName, updatedEmail, updatedPhone, updatedStatus, updatedPercentual, updatedSpecialty, updatedColor, updatedInitials, updatedAvatar, updatedPassword, id]
        );
        
        res.json({ success: true, message: 'Usuário atualizado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
});

// Excluir profissional
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true, message: 'Profissional excluído com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir profissional.' });
    }
});

// ==========================================
// ROTAS DE SERVIÇOS (SYNC E LISTAGEM)
// ==========================================

app.get('/api/services', authenticateToken, async (req, res) => {
    try {
        const servicesRes = await db.query('SELECT * FROM services ORDER BY name ASC');
        const mapped = servicesRes.rows.map(row => ({
            ...row,
            price: parseFloat(row.price)
        }));
        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar serviços.' });
    }
});

// Criar novo serviço
app.post('/api/services', authenticateToken, async (req, res) => {
    const { name, price, duration, niche, professionals } = req.body;
    if (!name || price === undefined || !duration || !niche) {
        return res.status(400).json({ error: 'Preencha todos os campos do serviço.' });
    }
    try {
        const serviceId = 's_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const result = await db.query(
            `INSERT INTO services (id, name, price, duration, niche, professionals)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [serviceId, name, parseFloat(price) || 0, parseInt(duration) || 60, niche, JSON.stringify(professionals || [])]
        );
        const row = result.rows[0];
        res.status(201).json({ ...row, price: parseFloat(row.price) });
    } catch (err) {
        console.error('Erro ao criar serviço:', err);
        res.status(500).json({ error: 'Erro ao criar serviço: ' + err.message });
    }
});

// Atualizar serviço existente
app.put('/api/services/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, price, duration, niche, professionals } = req.body;
    try {
        const check = await db.query('SELECT id FROM services WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Serviço não encontrado.' });
        }
        await db.query(
            `UPDATE services SET name = $1, price = $2, duration = $3, niche = $4, professionals = $5 WHERE id = $6`,
            [name, parseFloat(price) || 0, parseInt(duration) || 60, niche, JSON.stringify(professionals || []), id]
        );
        res.json({ success: true, message: 'Serviço atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar serviço:', err);
        res.status(500).json({ error: 'Erro ao atualizar serviço: ' + err.message });
    }
});

// Excluir serviço
app.delete('/api/services/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM services WHERE id = $1', [id]);
        res.json({ success: true, message: 'Serviço excluído com sucesso!' });
    } catch (err) {
        console.error('Erro ao excluir serviço:', err);
        res.status(500).json({ error: 'Erro ao excluir serviço: ' + err.message });
    }
});

// Manter compatibilidade: sync (NÃO apaga mais tudo, apenas faz upsert)
app.post('/api/services/sync', authenticateToken, async (req, res) => {
    const list = req.body;
    if (!Array.isArray(list)) {
        return res.status(400).json({ error: 'Payload deve ser uma lista de serviços.' });
    }
    try {
        for (const s of list) {
            const serviceId = s.id ? String(s.id) : 's_' + Date.now() + Math.random().toString(36).substr(2, 5);
            await db.query(
                `INSERT INTO services (id, name, price, duration, niche, professionals)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE
                 SET name = EXCLUDED.name, price = EXCLUDED.price, duration = EXCLUDED.duration, niche = EXCLUDED.niche, professionals = EXCLUDED.professionals`,
                [serviceId, s.name, parseFloat(s.price) || 0, parseInt(s.duration) || 60, s.niche || 'Geral', JSON.stringify(s.professionals || [])]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao sincronizar serviços:', err);
        res.status(500).json({ error: 'Erro ao sincronizar: ' + err.message });
    }
});

// ==========================================
// ROTAS DE CLIENTES
// ==========================================

app.get('/api/clients', authenticateToken, async (req, res) => {
    try {
        const clientsRes = await db.query('SELECT * FROM clients ORDER BY name ASC');
        res.json(clientsRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao carregar clientes.' });
    }
});

app.post('/api/clients/sync', authenticateToken, async (req, res) => {
    const list = req.body;
    if (!Array.isArray(list)) {
        return res.status(400).json({ error: 'Payload deve ser uma lista de clientes.' });
    }
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        const incomingIds = list.map(c => String(c.id)).filter(Boolean);
        
        if (incomingIds.length > 0) {
            await client.query(
                `DELETE FROM clients WHERE id NOT IN (${incomingIds.map((_, i) => '$' + (i + 1)).join(',')})`,
                incomingIds
            );
        } else {
            await client.query('DELETE FROM clients');
        }
        
        for (const c of list) {
            const clientId = c.id ? String(c.id) : 'c_' + Date.now() + Math.random().toString(36).substr(2, 5);
            await client.query(
                `INSERT INTO clients (id, name, phone, level, avatar) 
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE 
                 SET name = EXCLUDED.name, phone = EXCLUDED.phone, level = EXCLUDED.level, avatar = EXCLUDED.avatar`,
                [clientId, c.name, c.phone || '', c.level || 'Freguês', c.avatar || null]
            );
        }
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Clientes sincronizados!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Erro ao sincronizar clientes: ' + err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// ROTAS DE ESTOQUE (legado — mantido por compatibilidade)
// ==========================================

app.get('/api/stock', authenticateToken, async (req, res) => {
    try {
        const stockRes = await db.query('SELECT * FROM stock ORDER BY name ASC');
        const mapped = stockRes.rows.map(row => ({
            id: row.id,
            name: row.name,
            qty: row.qty,
            limit: row.min_qty,
            category: row.category
        }));
        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar estoque.' });
    }
});

app.post('/api/stock/sync', authenticateToken, async (req, res) => {
    const list = req.body;
    if (!Array.isArray(list)) {
        return res.status(400).json({ error: 'Payload deve ser uma lista de produtos.' });
    }
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const incomingIds = list.map(i => String(i.id)).filter(Boolean);
        if (incomingIds.length > 0) {
            await client.query(
                `DELETE FROM stock WHERE id NOT IN (${incomingIds.map((_, i) => '$' + (i + 1)).join(',')})`,
                incomingIds
            );
        } else {
            await client.query('DELETE FROM stock');
        }
        for (const item of list) {
            const stockId = item.id ? String(item.id) : 'st_' + Date.now() + Math.random().toString(36).substr(2, 5);
            await client.query(
                `INSERT INTO stock (id, name, qty, min_qty, category) 
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE 
                 SET name = EXCLUDED.name, qty = EXCLUDED.qty, min_qty = EXCLUDED.min_qty, category = EXCLUDED.category`,
                [stockId, item.name, parseInt(item.qty) || 0, parseInt(item.limit) || 5, item.category || 'Produtos']
            );
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Erro ao sincronizar estoque: ' + err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// ROTAS DE CONTROLE DE MATERIAIS
// ==========================================

// Auto-criação da tabela (executada assim que o módulo carrega)
(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS material_withdrawals (
                id         TEXT PRIMARY KEY,
                prof_id    TEXT NOT NULL,
                prof_name  TEXT NOT NULL,
                material   TEXT NOT NULL,
                qty        INTEGER NOT NULL DEFAULT 1,
                unit       TEXT NOT NULL DEFAULT 'un',
                date       TEXT NOT NULL,
                note       TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log(' [DB] Tabela material_withdrawals OK.');

        await db.query(`
            CREATE TABLE IF NOT EXISTS vales (
                id               VARCHAR(50) PRIMARY KEY,
                funcionario_id   VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
                funcionario_nome VARCHAR(100) NOT NULL,
                valor            NUMERIC(10, 2) NOT NULL,
                date             VARCHAR(10) NOT NULL,
                obs              TEXT,
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log(' [DB] Tabela vales OK.');

        await db.query(`
            CREATE TABLE IF NOT EXISTS gastos (
                id        VARCHAR(50) PRIMARY KEY,
                descricao VARCHAR(255) NOT NULL,
                categoria VARCHAR(100),
                valor     NUMERIC(10, 2) NOT NULL,
                date      VARCHAR(10) NOT NULL,
                obs       TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log(' [DB] Tabela gastos OK.');
    } catch (err) {
        console.error(' [DB] Erro ao criar tabelas adicionais:', err.message);
    }
})();

// Listar retiradas (todas ou filtradas por profissional)
app.get('/api/materials', authenticateToken, async (req, res) => {
    const { profId } = req.query;
    try {
        let queryText = 'SELECT * FROM material_withdrawals';
        const params = [];
        if (profId) {
            queryText += ' WHERE prof_id = $1';
            params.push(profId);
        }
        queryText += ' ORDER BY date DESC, created_at DESC';
        const result = await db.query(queryText, params);
        res.json(result.rows.map(row => ({
            id: row.id,
            profId: row.prof_id,
            profName: row.prof_name,
            material: row.material,
            qty: row.qty,
            unit: row.unit,
            date: row.date,
            note: row.note || '',
            createdAt: row.created_at
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar retiradas de materiais.' });
    }
});

// Registrar nova retirada
app.post('/api/materials', authenticateToken, async (req, res) => {
    const { profId, profName, material, qty, unit, date, note } = req.body;
    if (!profId || !profName || !material || !qty || !date) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }
    try {
        // Garante que a tabela existe mesmo em cold start
        await db.query(`
            CREATE TABLE IF NOT EXISTS material_withdrawals (
                id TEXT PRIMARY KEY, prof_id TEXT NOT NULL, prof_name TEXT NOT NULL,
                material TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1,
                unit TEXT NOT NULL DEFAULT 'un', date TEXT NOT NULL,
                note TEXT, created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        const withdrawalId = 'mw_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const result = await db.query(
            `INSERT INTO material_withdrawals (id, prof_id, prof_name, material, qty, unit, date, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [withdrawalId, profId, profName, material.trim(), parseInt(qty) || 1, unit || 'un', date, note || '']
        );
        const row = result.rows[0];
        res.status(201).json({
            id: row.id,
            profId: row.prof_id,
            profName: row.prof_name,
            material: row.material,
            qty: row.qty,
            unit: row.unit,
            date: row.date,
            note: row.note || '',
            createdAt: row.created_at
        });
    } catch (err) {
        console.error('[MATERIALS POST] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao registrar retirada: ' + err.message });
    }
});


// Excluir retirada
app.delete('/api/materials/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const check = await db.query('SELECT id FROM material_withdrawals WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Retirada não encontrada.' });
        }
        await db.query('DELETE FROM material_withdrawals WHERE id = $1', [id]);
        res.json({ success: true, message: 'Retirada excluída com sucesso.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir retirada: ' + err.message });
    }
});

// ==========================================
// ROTAS DE AGENDAMENTOS (APPOINTMENTS)
// ==========================================

app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const apptsRes = await db.query('SELECT * FROM appointments ORDER BY date ASC, time_start ASC');
        
        // Mapear colunas do Postgres de volta aos nomes que o frontend espera (camelCase)
        const mapped = apptsRes.rows.map(row => ({
            id: row.id,
            professionalId: row.professional_id,
            professionalName: row.professional_name,
            professionalInitials: row.professional_initials,
            professionalColor: row.professional_color,
            client: row.client,
            phone: row.phone,
            serviceId: row.service_id,
            serviceName: row.service_name,
            servicePrice: parseFloat(row.service_price),
            date: row.date,
            timeStart: row.time_start,
            timeEnd: row.time_end,
            status: row.status,
            payoutInvoiced: row.payout_invoiced,
            createdBy: row.created_by,
            isMutual: row.is_mutual || false,
            professionalId2: row.professional2_id || null,
            professionalName2: row.professional2_name || '',
            professionalInitials2: row.professional2_initials || '',
            professionalColor2: row.professional2_color || ''
        }));
        
        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao carregar agendamentos.' });
    }
});

app.post('/api/appointments/sync', authenticateToken, async (req, res) => {
    const list = req.body;
    if (!Array.isArray(list)) {
        return res.status(400).json({ error: 'Payload deve ser uma lista de agendamentos.' });
    }
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        const incomingIds = list.map(a => String(a.id)).filter(Boolean);
        
        if (incomingIds.length > 0) {
            await client.query(
                `DELETE FROM appointments WHERE id NOT IN (${incomingIds.map((_, i) => '$' + (i + 1)).join(',')})`,
                incomingIds
            );
        } else {
            await client.query('DELETE FROM appointments');
        }
        
        for (const a of list) {
            const apptId = a.id ? String(a.id) : 'ap_' + Date.now() + Math.random().toString(36).substr(2, 5);
            await client.query(
                `INSERT INTO appointments (
                    id, professional_id, professional_name, professional_initials, professional_color,
                    client, phone, service_id, service_name, service_price,
                    date, time_start, time_end, status, payout_invoiced, created_by,
                    is_mutual, professional2_id, professional2_name, professional2_initials, professional2_color
                ) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                 ON CONFLICT (id) DO UPDATE 
                 SET professional_id = EXCLUDED.professional_id, 
                     professional_name = EXCLUDED.professional_name, 
                     professional_initials = EXCLUDED.professional_initials, 
                     professional_color = EXCLUDED.professional_color,
                     client = EXCLUDED.client, 
                     phone = EXCLUDED.phone, 
                     service_id = EXCLUDED.service_id, 
                     service_name = EXCLUDED.service_name, 
                     service_price = EXCLUDED.service_price,
                     date = EXCLUDED.date, 
                     time_start = EXCLUDED.time_start, 
                     time_end = EXCLUDED.time_end, 
                     status = EXCLUDED.status, 
                     payout_invoiced = EXCLUDED.payout_invoiced,
                     created_by = EXCLUDED.created_by,
                     is_mutual = EXCLUDED.is_mutual,
                     professional2_id = EXCLUDED.professional2_id,
                     professional2_name = EXCLUDED.professional2_name,
                     professional2_initials = EXCLUDED.professional2_initials,
                     professional2_color = EXCLUDED.professional2_color`,
                [
                    apptId, 
                    (a.professionalId && String(a.professionalId).trim() !== '') ? String(a.professionalId) : null, 
                    a.professionalName, 
                    a.professionalInitials || '', 
                    a.professionalColor || '',
                    a.client, 
                    a.phone || '', 
                    (a.serviceId && String(a.serviceId).trim() !== '') ? String(a.serviceId) : null, 
                    a.serviceName, 
                    parseFloat(a.servicePrice) || 0,
                    a.date, a.timeStart, a.timeEnd, a.status || 'Agendado', a.payoutInvoiced || false,
                    a.createdBy || a.created_by || '',
                    a.isMutual || false,
                    (a.professionalId2 && String(a.professionalId2).trim() !== '') ? String(a.professionalId2) : null,
                    a.professionalName2 || '',
                    a.professionalInitials2 || '',
                    a.professionalColor2 || ''
                ]
            );
        }
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Erro ao sincronizar agendamentos: ' + err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// ROTAS DE FATURAMENTO / PAYOUTS
// ==========================================

app.get('/api/payouts', authenticateToken, async (req, res) => {
    try {
        const payoutsRes = await db.query('SELECT * FROM payouts ORDER BY created_at DESC');
        
        // Mapear de volta ao camelCase
        const mapped = payoutsRes.rows.map(row => ({
            id: row.id,
            date: row.date,
            profId: row.prof_id,
            profName: row.prof_name,
            period: row.period,
            grossBilling: parseFloat(row.gross_billing),
            commissionValue: parseFloat(row.commission_value),
            studioShare: parseFloat(row.studio_share),
            status: row.status,
            services: row.services
        }));
        
        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar faturas.' });
    }
});

app.post('/api/payouts/sync', authenticateToken, async (req, res) => {
    const list = req.body;
    if (!Array.isArray(list)) {
        return res.status(400).json({ error: 'Payload deve ser uma lista de faturamentos.' });
    }
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        const incomingIds = list.map(p => String(p.id)).filter(Boolean);
        
        if (incomingIds.length > 0) {
            await client.query(
                `DELETE FROM payouts WHERE id NOT IN (${incomingIds.map((_, i) => '$' + (i + 1)).join(',')})`,
                incomingIds
            );
        } else {
            await client.query('DELETE FROM payouts');
        }
        
        for (const p of list) {
            const payoutId = p.id ? String(p.id) : 'pay_' + Date.now() + Math.random().toString(36).substr(2, 5);
            await client.query(
                `INSERT INTO payouts (
                    id, date, prof_id, prof_name, period, 
                    gross_billing, commission_value, studio_share, status, services
                ) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (id) DO UPDATE 
                 SET date = EXCLUDED.date, 
                     prof_id = EXCLUDED.prof_id, 
                     prof_name = EXCLUDED.prof_name, 
                     period = EXCLUDED.period, 
                     gross_billing = EXCLUDED.gross_billing, 
                     commission_value = EXCLUDED.commission_value, 
                     studio_share = EXCLUDED.studio_share, 
                     status = EXCLUDED.status, 
                     services = EXCLUDED.services`,
                [
                    payoutId, p.date, p.profId, p.profName, p.period,
                    parseFloat(p.grossBilling) || 0, parseFloat(p.commissionValue) || 0, parseFloat(p.studioShare) || 0,
                    p.status || 'pago', JSON.stringify(p.services || [])
                ]
            );
        }
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Erro ao sincronizar faturas: ' + err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// ROTAS DE VALES E GASTOS (PERSISTÊNCIA POSTGRESQL)
// ==========================================

// --- ROTAS DE GASTOS ---
app.get('/api/gastos', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM gastos ORDER BY date DESC, created_at DESC');
        const mapped = result.rows.map(row => ({
            id: row.id,
            descricao: row.descricao,
            categoria: row.categoria,
            valor: parseFloat(row.valor),
            date: row.date,
            obs: row.obs || '',
            createdAt: row.created_at
        }));
        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar gastos.' });
    }
});

app.post('/api/gastos', authenticateToken, async (req, res) => {
    const { id, descricao, categoria, valor, date, obs } = req.body;
    if (!descricao || valor === undefined || !date) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }
    try {
        const gastoId = id || 'gasto_' + Date.now() + Math.random().toString(36).substr(2, 5);
        await db.query(
            `INSERT INTO gastos (id, descricao, categoria, valor, date, obs)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE
             SET descricao = EXCLUDED.descricao,
                 categoria = EXCLUDED.categoria,
                 valor = EXCLUDED.valor,
                 date = EXCLUDED.date,
                 obs = EXCLUDED.obs`,
            [gastoId, descricao.trim(), categoria || 'Geral', parseFloat(valor) || 0, date, obs || '']
        );
        res.status(201).json({ id: gastoId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar gasto: ' + err.message });
    }
});

app.delete('/api/gastos/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM gastos WHERE id = $1', [id]);
        res.json({ success: true, message: 'Gasto excluído com sucesso.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir gasto: ' + err.message });
    }
});

// --- ROTAS DE VALES ---
app.get('/api/vales', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM vales ORDER BY date DESC, created_at DESC');
        const mapped = result.rows.map(row => ({
            id: row.id,
            funcionarioId: row.funcionario_id,
            funcionarioNome: row.funcionario_nome,
            valor: parseFloat(row.valor),
            date: row.date,
            obs: row.obs || '',
            createdAt: row.created_at
        }));
        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar vales.' });
    }
});

app.post('/api/vales', authenticateToken, async (req, res) => {
    const { id, funcionarioId, funcionarioNome, valor, date, obs } = req.body;
    if (!funcionarioId || valor === undefined || !date) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }
    try {
        const valeId = id || 'vale_' + Date.now() + Math.random().toString(36).substr(2, 5);
        await db.query(
            `INSERT INTO vales (id, funcionario_id, funcionario_nome, valor, date, obs)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE
             SET funcionario_id = EXCLUDED.funcionario_id,
                 funcionario_nome = EXCLUDED.funcionario_nome,
                 valor = EXCLUDED.valor,
                 date = EXCLUDED.date,
                 obs = EXCLUDED.obs`,
            [valeId, funcionarioId, funcionarioNome, parseFloat(valor) || 0, date, obs || '']
        );
        res.status(201).json({ id: valeId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar vale: ' + err.message });
    }
});

app.delete('/api/vales/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM vales WHERE id = $1', [id]);
        res.json({ success: true, message: 'Vale excluído com sucesso.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir vale: ' + err.message });
    }
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const nets = os.networkInterfaces();
    let localIP = 'localhost';
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                localIP = net.address;
                break;
            }
        }
    }
    console.log(`=================================================`);
    console.log(` Studio Raio do Sol - Servidor rodando!`);
    console.log(` Acesso local:   http://localhost:${PORT}`);
    console.log(` Acesso celular: http://${localIP}:${PORT}`);
    console.log(`=================================================`);
});
