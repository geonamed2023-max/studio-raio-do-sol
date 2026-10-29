const { Pool } = require('pg');

const SUPABASE_URI = 'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

const localPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'George03#',
    database: 'raiodosol'
});

const remotePool = new Pool({
    connectionString: SUPABASE_URI,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('🚀 Iniciando configuração do Supabase...');
    const remoteClient = await remotePool.connect();
    const localClient = await localPool.connect();

    try {
        // 1. Criar Tabelas
        console.log('📦 1. Criando tabelas no Supabase...');
        await remoteClient.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                role VARCHAR(20) NOT NULL DEFAULT 'funcionario',
                status VARCHAR(20) NOT NULL DEFAULT 'pendente',
                percentual INTEGER DEFAULT 35,
                specialty VARCHAR(100),
                color VARCHAR(20),
                initials VARCHAR(5),
                avatar TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS services (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                price NUMERIC(10, 2) NOT NULL,
                duration INTEGER NOT NULL DEFAULT 60,
                niche VARCHAR(50) NOT NULL DEFAULT 'Cabelo',
                professionals JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clients (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                level VARCHAR(20) NOT NULL DEFAULT 'Freguês',
                avatar TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS stock (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                qty INTEGER NOT NULL DEFAULT 0,
                min_qty INTEGER NOT NULL DEFAULT 5,
                category VARCHAR(50) NOT NULL DEFAULT 'Geral',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id VARCHAR(50) PRIMARY KEY,
                professional_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
                professional_name VARCHAR(100) NOT NULL,
                professional_initials VARCHAR(5),
                professional_color VARCHAR(20),
                client VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                service_id VARCHAR(50) REFERENCES services(id) ON DELETE SET NULL,
                service_name VARCHAR(100) NOT NULL,
                service_price NUMERIC(10, 2) NOT NULL,
                date VARCHAR(10) NOT NULL,
                time_start VARCHAR(5) NOT NULL,
                time_end VARCHAR(5) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Agendado',
                payout_invoiced BOOLEAN DEFAULT FALSE,
                created_by VARCHAR(100),
                is_mutual BOOLEAN DEFAULT FALSE,
                professional2_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
                professional2_name VARCHAR(100),
                professional2_initials VARCHAR(5),
                professional2_color VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS payouts (
                id VARCHAR(50) PRIMARY KEY,
                date VARCHAR(10) NOT NULL,
                prof_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
                prof_name VARCHAR(100) NOT NULL,
                period VARCHAR(20) NOT NULL,
                gross_billing NUMERIC(10, 2) NOT NULL,
                commission_value NUMERIC(10, 2) NOT NULL,
                studio_share NUMERIC(10, 2) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pago',
                services JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS massage_packages (
                id VARCHAR(50) PRIMARY KEY,
                client_name VARCHAR(100) NOT NULL,
                client_phone VARCHAR(20),
                massage_type VARCHAR(100) NOT NULL,
                session_duration INTEGER NOT NULL DEFAULT 60,
                total_sessions INTEGER NOT NULL DEFAULT 1,
                completed_sessions INTEGER NOT NULL DEFAULT 0,
                price NUMERIC(10, 2) NOT NULL DEFAULT 0,
                payment_status VARCHAR(20) NOT NULL DEFAULT 'pendente',
                status VARCHAR(20) NOT NULL DEFAULT 'ativo',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS massage_sessions (
                id VARCHAR(50) PRIMARY KEY,
                package_id VARCHAR(50) NOT NULL REFERENCES massage_packages(id) ON DELETE CASCADE,
                session_date VARCHAR(10) NOT NULL,
                observations TEXT,
                satisfaction INTEGER DEFAULT 5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS massage_body_tracking (
                id VARCHAR(50) PRIMARY KEY,
                package_id VARCHAR(50) NOT NULL REFERENCES massage_packages(id) ON DELETE CASCADE,
                measure_date VARCHAR(10) NOT NULL,
                weight NUMERIC(5, 2),
                height NUMERIC(5, 2),
                waist NUMERIC(5, 1),
                abdomen NUMERIC(5, 1),
                hip NUMERIC(5, 1),
                thigh_r NUMERIC(5, 1),
                thigh_l NUMERIC(5, 1),
                arm_r NUMERIC(5, 1),
                arm_l NUMERIC(5, 1),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS vales (
                id VARCHAR(50) PRIMARY KEY,
                professional_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
                professional_name VARCHAR(100) NOT NULL,
                value NUMERIC(10, 2) NOT NULL,
                date VARCHAR(10) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'pendente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS gastos (
                id VARCHAR(50) PRIMARY KEY,
                description VARCHAR(150) NOT NULL,
                value NUMERIC(10, 2) NOT NULL,
                date VARCHAR(10) NOT NULL,
                category VARCHAR(50) DEFAULT 'Outros',
                payment_method VARCHAR(50) DEFAULT 'Pix',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS material_withdrawals (
                id VARCHAR(50) PRIMARY KEY,
                professional_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
                professional_name VARCHAR(100) NOT NULL,
                material_id VARCHAR(50),
                material_name VARCHAR(100) NOT NULL,
                qty INTEGER NOT NULL DEFAULT 1,
                date VARCHAR(10) NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('   ✅ Tabelas criadas com sucesso!');

        // 2. Migrar Usuários
        console.log('\n👥 2. Migrando usuários locais para o Supabase...');
        const localUsers = await localClient.query('SELECT * FROM users');
        for (const u of localUsers.rows) {
            await remoteClient.query(`
                INSERT INTO users (id, name, email, password, phone, role, status, percentual, specialty, color, initials, avatar)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                ON CONFLICT (id) DO UPDATE SET
                    name=EXCLUDED.name, email=EXCLUDED.email, password=EXCLUDED.password,
                    role=EXCLUDED.role, status=EXCLUDED.status, percentual=EXCLUDED.percentual,
                    specialty=EXCLUDED.specialty, color=EXCLUDED.color, initials=EXCLUDED.initials, avatar=EXCLUDED.avatar
            `, [u.id, u.name, u.email, u.password, u.phone, u.role, u.status, u.percentual, u.specialty, u.color, u.initials, u.avatar]);
        }
        console.log(`   ✅ ${localUsers.rows.length} usuários migrados!`);

        // 3. Migrar Serviços
        console.log('\n💅 3. Migrando serviços...');
        const localServices = await localClient.query('SELECT * FROM services');
        for (const s of localServices.rows) {
            await remoteClient.query(`
                INSERT INTO services (id, name, price, duration, niche, professionals)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (id) DO UPDATE SET
                    name=EXCLUDED.name, price=EXCLUDED.price, duration=EXCLUDED.duration, niche=EXCLUDED.niche, professionals=EXCLUDED.professionals
            `, [s.id, s.name, s.price, s.duration, s.niche, JSON.stringify(s.professionals || [])]);
        }
        console.log(`   ✅ ${localServices.rows.length} serviços migrados!`);

        // 4. Migrar Clientes
        console.log('\n👩 4. Migrando clientes...');
        const localClients = await localClient.query('SELECT * FROM clients');
        for (const c of localClients.rows) {
            await remoteClient.query(`
                INSERT INTO clients (id, name, phone, level, avatar)
                VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT (id) DO UPDATE SET
                    name=EXCLUDED.name, phone=EXCLUDED.phone, level=EXCLUDED.level, avatar=EXCLUDED.avatar
            `, [c.id, c.name, c.phone, c.level, c.avatar]);
        }
        console.log(`   ✅ ${localClients.rows.length} clientes migrados!`);

        // 5. Migrar Agendamentos Históricos
        console.log('\n📅 5. Migrando agendamentos locais...');
        const localAppts = await localClient.query('SELECT * FROM appointments');
        for (const a of localAppts.rows) {
            await remoteClient.query(`
                INSERT INTO appointments (
                    id, professional_id, professional_name, professional_initials, professional_color,
                    client, phone, service_id, service_name, service_price,
                    date, time_start, time_end, status, payout_invoiced, created_by, is_mutual,
                    professional2_id, professional2_name, professional2_initials, professional2_color
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
                ON CONFLICT (id) DO NOTHING
            `, [
                a.id, a.professional_id, a.professional_name, a.professional_initials, a.professional_color,
                a.client, a.phone, a.service_id, a.service_name, a.service_price,
                a.date, a.time_start, a.time_end, a.status, a.payout_invoiced, a.created_by, a.is_mutual,
                a.professional2_id, a.professional2_name, a.professional2_initials, a.professional2_color
            ]);
        }
        console.log(`   ✅ ${localAppts.rows.length} agendamentos históricos migrados!`);

        // 6. Inserir Agendamentos Resgatados dos Prints
        console.log('\n📸 6. Inserindo agendamentos resgatados dos prints de setembro/outubro...');
        
        // Mapeamento de profissionais (por nome normalizado)
        const profMap = {};
        for (const u of localUsers.rows) {
            profMap[u.name.toLowerCase()] = u;
        }

        const getProf = (name) => {
            const n = name.toLowerCase();
            for (const k of Object.keys(profMap)) {
                if (k.includes(n) || n.includes(k)) return profMap[k];
            }
            return { id: null, name, initials: '', color: '#C9A84C' };
        };

        const rescuedAppts = [
            // SEXTA-FEIRA 11/09/2026
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Clara', service: 'Pe', start: '09:00', end: '09:30', price: 30 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Aline', service: 'Pe e Mao', start: '10:00', end: '10:30', price: 60 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Vilma', service: 'Mao', start: '10:30', end: '11:00', price: 30 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Vilma', service: 'Mao', start: '11:00', end: '11:30', price: 30 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Baby', service: 'Pe e Mao', start: '12:00', end: '13:00', price: 60 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Adriana leal', service: 'Pe e Mao', start: '13:00', end: '14:00', price: 60 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Adriana leal', service: 'Pe e Mao', start: '14:00', end: '15:00', price: 60 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Carmelita', service: 'Pe', start: '15:00', end: '15:30', price: 30 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Vanessa', service: 'Pe e Mao', start: '15:30', end: '16:30', price: 60 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Val', service: 'Pe e Mao', start: '16:30', end: '17:30', price: 60 },
            { date: '2026-09-11', prof: 'Adriana Cruz', client: 'Cecilia alcantara', service: 'Pe', start: '17:30', end: '18:00', price: 30 },

            { date: '2026-09-11', prof: 'Aline Marques', client: 'Neivinha', service: 'Decote total', start: '12:30', end: '13:15', price: 50 },
            { date: '2026-09-11', prof: 'Aline Marques', client: 'Camila', service: 'Decote total', start: '17:00', end: '17:45', price: 50 },

            { date: '2026-09-11', prof: 'Elane Bispo', client: 'Elaine teles', service: 'Manutenção', start: '11:00', end: '12:15', price: 80 },
            { date: '2026-09-11', prof: 'Elane Bispo', client: 'Carmelita', service: 'Esmaltação', start: '15:00', end: '15:45', price: 40 },
            { date: '2026-09-11', prof: 'Elane Bispo', client: 'Taty', service: 'Esmaltação', start: '16:00', end: '16:45', price: 40 },

            { date: '2026-09-11', prof: 'Francine Oliveira', client: 'Solange Rodrigues', service: 'Pe', start: '08:00', end: '08:30', price: 30 },
            { date: '2026-09-11', prof: 'Francine Oliveira', client: 'Lucidele', service: 'Massagem', start: '08:30', end: '09:30', price: 100 },
            { date: '2026-09-11', prof: 'Francine Oliveira', client: 'Vilma', service: 'Mao', start: '10:30', end: '11:00', price: 30 },
            { date: '2026-09-11', prof: 'Francine Oliveira', client: 'Lucidele', service: 'Liberação miofascial', start: '11:00', end: '12:00', price: 120 },
            { date: '2026-09-11', prof: 'Francine Oliveira', client: 'Vanuza', service: 'Massagem', start: '16:00', end: '17:00', price: 100 },
            { date: '2026-09-11', prof: 'Francine Oliveira', client: 'Celma', service: 'Massagem', start: '17:00', end: '18:00', price: 100 },

            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Solange Rodrigues', service: 'Manutenção', start: '08:00', end: '09:15', price: 80 },
            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Leilane', service: 'Manutenção', start: '09:30', end: '10:30', price: 80 },
            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Karine', service: 'Manutenção', start: '10:30', end: '11:30', price: 80 },
            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Gabriela', service: 'Unha em gel', start: '11:30', end: '13:00', price: 120 },
            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Natalia verjas', service: 'Manutenção', start: '13:00', end: '14:15', price: 80 },
            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Luana', service: 'Manutenção', start: '14:30', end: '15:30', price: 80 },
            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Nubia', service: 'Manutenção', start: '15:30', end: '16:30', price: 80 },
            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Taty', service: 'Manutenção', start: '16:30', end: '17:30', price: 80 },
            { date: '2026-09-11', prof: 'Nazaré Santos', client: 'Cecilia alcantara', service: 'Manutenção', start: '17:30', end: '18:45', price: 80 },

            { date: '2026-09-11', prof: 'Rafaela Silva', client: 'Deusa', service: 'Pe e Mao', start: '09:00', end: '10:00', price: 60 },
            { date: '2026-09-11', prof: 'Rafaela Silva', client: 'Glauce', service: 'Pe e Mao', start: '10:00', end: '11:00', price: 60 },
            { date: '2026-09-11', prof: 'Rafaela Silva', client: 'BLOQUEIO Médico', service: 'Bloqueio Médico', start: '12:30', end: '14:30', price: 0, status: 'Bloqueado' },

            { date: '2026-09-11', prof: 'Milena Lima', client: 'Barbara cristina', service: 'Designer de Sobrancelha', start: '11:30', end: '13:00', price: 50 },
            { date: '2026-09-11', prof: 'Milena Lima', client: 'Lais cerv', service: 'Designer de Sobrancelha', start: '16:00', end: '16:45', price: 50 },

            { date: '2026-09-11', prof: 'Lais Santos', client: 'Lais cery', service: 'Pe e Mao', start: '15:00', end: '16:00', price: 60 },
            { date: '2026-09-11', prof: 'Lais Santos', client: 'Isabel alecar', service: 'Pe e Mao', start: '16:00', end: '17:00', price: 60 },

            { date: '2026-09-11', prof: 'Eduardo Sanches', client: 'Clara', service: 'Progressiva', start: '09:00', end: '11:00', price: 150 },
            { date: '2026-09-11', prof: 'Eduardo Sanches', client: 'Val', service: 'Escova', start: '17:00', end: '18:00', price: 60 },

            // SÁBADO 12/09/2026
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Nicole', service: 'Pe e Mao', start: '09:00', end: '10:00', price: 60 },
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Dona...', service: 'Pe e Mao', start: '10:00', end: '10:30', price: 60 },
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Cecilia', service: 'Pe', start: '10:30', end: '11:00', price: 30 },
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Tasila', service: 'Pe e Mao', start: '11:00', end: '12:00', price: 60 },
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Francine', service: 'Pe', start: '12:30', end: '13:00', price: 30 },
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Amanda Santos', service: 'Pe', start: '13:00', end: '13:30', price: 30 },
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Ana Claudia', service: 'Pe e Mao', start: '13:30', end: '14:30', price: 60 },
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Iasmin', service: 'Pe e Mao', start: '14:30', end: '15:00', price: 60 },
            { date: '2026-09-12', prof: 'Adriana Cruz', client: 'Lu', service: 'Pe e Mao', start: '15:00', end: '16:00', price: 60 },

            { date: '2026-09-12', prof: 'Aline Marques', client: 'Cida', service: 'Decote total', start: '08:30', end: '09:15', price: 50 },

            { date: '2026-09-12', prof: 'Nazaré Santos', client: 'Mãe Luciana', service: 'Banho em gel', start: '08:00', end: '09:00', price: 90 },
            { date: '2026-09-12', prof: 'Nazaré Santos', client: 'Sandra', service: 'Manutenção', start: '09:00', end: '10:30', price: 80 },
            { date: '2026-09-12', prof: 'Nazaré Santos', client: 'Cecilia alcantara', service: 'Manutenção', start: '11:00', end: '12:00', price: 80 },
            { date: '2026-09-12', prof: 'Nazaré Santos', client: 'Francine', service: 'Manutenção', start: '12:30', end: '13:30', price: 80 },
            { date: '2026-09-12', prof: 'Nazaré Santos', client: 'Amanda Santos', service: 'Manutenção', start: '13:30', end: '14:45', price: 80 },
            { date: '2026-09-12', prof: 'Nazaré Santos', client: 'Ariane', service: 'Manutenção', start: '15:00', end: '16:00', price: 80 },
            { date: '2026-09-12', prof: 'Nazaré Santos', client: 'Criz', service: 'Manutenção', start: '16:00', end: '17:00', price: 80 },
            { date: '2026-09-12', prof: 'Nazaré Santos', client: 'Neusa ribeiro', service: 'Manutenção', start: '17:00', end: '18:15', price: 80 },

            { date: '2026-09-12', prof: 'Rafaela Silva', client: 'Ana paula', service: 'Pe e Mao', start: '10:00', end: '11:00', price: 60 },
            { date: '2026-09-12', prof: 'Rafaela Silva', client: 'Tia Barbara', service: 'Mao', start: '11:00', end: '11:30', price: 30 },
            { date: '2026-09-12', prof: 'Rafaela Silva', client: 'Rita leone', service: 'Pe e Mao', start: '12:00', end: '13:00', price: 60 },
            { date: '2026-09-12', prof: 'Rafaela Silva', client: 'Manu', service: 'Pe e Mao', start: '16:00', end: '17:00', price: 60 },

            { date: '2026-09-12', prof: 'Renata Silva', client: 'Jasmini', service: 'Manutenção', start: '15:30', end: '16:45', price: 80 },

            { date: '2026-09-12', prof: 'Milena Lima', client: 'Tacila', service: 'Maquiagem', start: '09:00', end: '10:00', price: 100 },

            { date: '2026-09-12', prof: 'Eduardo Sanches', client: 'Jeane', service: 'Maquiagem', start: '08:30', end: '10:00', price: 100 },
            { date: '2026-09-12', prof: 'Eduardo Sanches', client: 'Yasmin', service: 'Escova', start: '14:00', end: '15:15', price: 60 },

            // TERÇA-FEIRA 15/09/2026
            { date: '2026-09-15', prof: 'Nazaré Santos', client: 'Edilene', service: 'Manutenção', start: '08:00', end: '09:00', price: 80 },
            { date: '2026-09-15', prof: 'Nazaré Santos', client: 'Gabriela Dias', service: 'Manutenção', start: '09:00', end: '10:15', price: 80 },
            { date: '2026-09-15', prof: 'Nazaré Santos', client: 'Francisca', service: 'Banho em gel', start: '10:30', end: '12:00', price: 90 },
            { date: '2026-09-15', prof: 'Nazaré Santos', client: 'Amanda Moura', service: 'Manutenção', start: '13:00', end: '14:30', price: 80 },
            { date: '2026-09-15', prof: 'Nazaré Santos', client: 'Claudia Fonseca', service: 'Manutenção', start: '15:00', end: '16:00', price: 80 },
            { date: '2026-09-15', prof: 'Nazaré Santos', client: 'Wiiane', service: 'Unha em gel', start: '16:00', end: '17:30', price: 120 },
            { date: '2026-09-15', prof: 'Nazaré Santos', client: 'Trancado 🔒', service: 'Banho em gel', start: '17:30', end: '19:00', price: 90 },

            // QUARTA-FEIRA 16/09/2026
            { date: '2026-09-16', prof: 'Eduardo Sanches', client: 'Vilma', service: 'Cilios fio a fio', start: '09:00', end: '11:30', price: 120 },
            { date: '2026-09-16', prof: 'Eduardo Sanches', client: 'Cris Gonçalves', service: 'Cilios fio a fio', start: '11:30', end: '14:00', price: 120 },
            { date: '2026-09-16', prof: 'Nazaré Santos', client: 'Vanessa', service: 'Manutenção', start: '08:00', end: '09:15', price: 80 },
            { date: '2026-09-16', prof: 'Nazaré Santos', client: 'Diana almeida', service: 'Manutenção', start: '15:00', end: '16:00', price: 80 },
            { date: '2026-09-16', prof: 'Nazaré Santos', client: 'Reni', service: 'Manutenção', start: '16:00', end: '17:15', price: 80 },
            { date: '2026-09-16', prof: 'Nazaré Santos', client: 'Trancado 🔒', service: 'Banho em gel', start: '17:30', end: '19:00', price: 90 },
            { date: '2026-09-16', prof: 'Rafaela Silva', client: 'Nicole', service: 'Pe e Mao', start: '09:00', end: '10:00', price: 60 },
            { date: '2026-09-16', prof: 'Rafaela Silva', client: 'Sinara', service: 'Esmaltação', start: '15:00', end: '15:45', price: 40 },
            { date: '2026-09-16', prof: 'Rafaela Silva', client: 'Telma Magalhães', service: 'Manutenção', start: '16:00', end: '17:00', price: 80 },
            { date: '2026-09-16', prof: 'Renata Silva', client: 'Jamily', service: 'Manutenção', start: '09:00', end: '10:15', price: 80 },
            { date: '2026-09-16', prof: 'Renata Silva', client: 'Rafaela Malaquias', service: 'Manutenção', start: '17:30', end: '18:45', price: 80 },

            // QUINTA-FEIRA 17/09/2026
            { date: '2026-09-17', prof: 'Nazaré Santos', client: 'Lucimara', service: 'Banho em gel', start: '14:00', end: '15:30', price: 90 },
            { date: '2026-09-17', prof: 'Nazaré Santos', client: 'Trancado 🔒', service: 'Banho em gel', start: '17:30', end: '19:00', price: 90 },

            // SEXTA-FEIRA 18/09/2026
            { date: '2026-09-18', prof: 'Adriana Cruz', client: 'Sandra', service: 'Pe e Mao', start: '09:00', end: '10:00', price: 60 },
            { date: '2026-09-18', prof: 'Adriana Cruz', client: 'Vilma', service: 'Mao', start: '11:00', end: '11:30', price: 30 },
            { date: '2026-09-18', prof: 'Adriana Cruz', client: 'Sinara', service: 'Pe', start: '15:00', end: '15:30', price: 30 },
            { date: '2026-09-18', prof: 'Adriana Cruz', client: 'Telma Magalhães', service: 'Manutenção', start: '16:00', end: '17:15', price: 80 },

            // SÁBADO 19/09/2026
            { date: '2026-09-19', prof: 'Adriana Cruz', client: 'Lorena', service: 'Pe', start: '09:30', end: '10:00', price: 30 },
            { date: '2026-09-19', prof: 'Adriana Cruz', client: 'Carol Psicologa', service: 'Pe', start: '16:00', end: '16:30', price: 30 },
            { date: '2026-09-19', prof: 'Aline Marques', client: 'Carol Psicologa', service: 'Decote total', start: '15:00', end: '15:45', price: 50 },
            { date: '2026-09-19', prof: 'Nazaré Santos', client: 'Lorena', service: 'Manutenção', start: '09:30', end: '10:45', price: 80 },
            { date: '2026-09-19', prof: 'Nazaré Santos', client: 'Ludimila', service: 'Manutenção', start: '15:00', end: '16:00', price: 80 },
            { date: '2026-09-19', prof: 'Nazaré Santos', client: 'Carol Psicologa', service: 'Manutenção', start: '16:00', end: '17:00', price: 80 },
            { date: '2026-09-19', prof: 'Nazaré Santos', client: 'Lurdes', service: 'Manutenção', start: '17:00', end: '18:15', price: 80 },
            { date: '2026-09-19', prof: 'Rafaela Silva', client: 'Iana Bomfim', service: 'Pe e Mao', start: '10:00', end: '11:00', price: 60 },
            { date: '2026-09-19', prof: 'Renata Silva', client: 'Aila', service: 'Manutenção', start: '09:00', end: '10:15', price: 80 },
            { date: '2026-09-19', prof: 'Renata Silva', client: 'Barbara', service: 'Manutenção', start: '14:30', end: '15:45', price: 80 },
            { date: '2026-09-19', prof: 'Renata Silva', client: 'Deja', service: 'Manutenção', start: '16:30', end: '17:45', price: 80 },
            { date: '2026-09-19', prof: 'Milena Lima', client: 'Carol Psicologa', service: 'Designer de Sobrancelha', start: '15:30', end: '16:15', price: 50 },

            // TERÇA-FEIRA 22/09/2026
            { date: '2026-09-22', prof: 'Nazaré Santos', client: 'Gabriela Dias', service: 'Manutenção', start: '13:00', end: '14:15', price: 80 },

            // QUINTA-FEIRA 24/09/2026
            { date: '2026-09-24', prof: 'Renata Silva', client: 'Patricia Sabt', service: 'Manutenção', start: '17:30', end: '18:45', price: 80 },

            // SÁBADO 26/09/2026
            { date: '2026-09-26', prof: 'Nazaré Santos', client: 'Geisa/Ludimila', service: 'Manutenção', start: '08:00', end: '09:15', price: 80 },
            { date: '2026-09-26', prof: 'Nazaré Santos', client: 'Gleide', service: 'Unha em gel', start: '09:30', end: '11:30', price: 120 },

            // TERÇA-FEIRA 29/09/2026
            { date: '2026-09-29', prof: 'Nazaré Santos', client: 'Nildalia', service: 'Manutenção', start: '09:30', end: '10:45', price: 80 },
            { date: '2026-09-29', prof: 'Nazaré Santos', client: 'Diana', service: 'Manutenção', start: '12:00', end: '13:15', price: 80 },
            { date: '2026-09-29', prof: 'Nazaré Santos', client: 'Iana Bomfim', service: 'Manutenção', start: '16:30', end: '17:30', price: 80 },
            { date: '2026-09-29', prof: 'Nazaré Santos', client: 'Trancado 🔒', service: 'Banho em gel', start: '17:30', end: '19:00', price: 90 },
            { date: '2026-09-29', prof: 'Rafaela Silva', client: 'Iana Bomfim', service: 'Pe', start: '15:30', end: '16:00', price: 30 },

            // QUARTA-FEIRA 30/09/2026
            { date: '2026-09-30', prof: 'Nazaré Santos', client: 'Suzana Anjos', service: 'Manutenção', start: '08:00', end: '09:00', price: 80 },
            { date: '2026-09-30', prof: 'Nazaré Santos', client: 'Clara Bárbara', service: 'Manutenção', start: '09:00', end: '10:15', price: 80 },
            { date: '2026-09-30', prof: 'Nazaré Santos', client: 'Leilane', service: 'Manutenção', start: '10:30', end: '11:45', price: 80 },

            // SÁBADO 03/10/2026
            { date: '2026-10-03', prof: 'Nazaré Santos', client: 'Pamela', service: 'Manutenção', start: '10:00', end: '11:00', price: 80 },
            { date: '2026-10-03', prof: 'Nazaré Santos', client: 'Daniela', service: 'Manutenção', start: '11:00', end: '12:15', price: 80 },
            { date: '2026-10-03', prof: 'Rafaela Silva', client: 'Daniela', service: 'Pe', start: '11:00', end: '11:30', price: 30 },

            // SÁBADO 10/10/2026
            { date: '2026-10-10', prof: 'Nazaré Santos', client: 'Helena', service: 'Banho em gel', start: '09:30', end: '11:00', price: 90 },
            { date: '2026-10-10', prof: 'Renata Silva', client: 'Julian', service: 'Manutenção', start: '09:00', end: '10:15', price: 80 }
        ];

        let countRescued = 0;
        for (const item of rescuedAppts) {
            const p = getProf(item.prof);
            const id = 'ap_rescued_' + item.date.replace(/-/g, '') + '_' + item.start.replace(/:/g, '') + '_' + Math.random().toString(36).substr(2, 4);
            await remoteClient.query(`
                INSERT INTO appointments (
                    id, professional_id, professional_name, professional_initials, professional_color,
                    client, phone, service_id, service_name, service_price,
                    date, time_start, time_end, status, payout_invoiced, created_by, is_mutual
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
                ON CONFLICT (id) DO NOTHING
            `, [
                id, p.id, p.name, p.initials || '', p.color || '#C9A84C',
                item.client, '', null, item.service, item.price,
                item.date, item.start, item.end, item.status || 'Agendado', false, 'Backup Prints', false
            ]);
            countRescued++;
        }
        console.log(`   ✅ ${countRescued} agendamentos futuros inseridos com sucesso!`);

        console.log('\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO TOTAL!');
    } catch (err) {
        console.error('❌ Erro na migração:', err);
    } finally {
        remoteClient.release();
        localClient.release();
        await remotePool.end();
        await localPool.end();
    }
}

runMigration();
