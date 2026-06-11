-- Criação das tabelas para o Studio Raio do Sol

-- 1. Tabela de Usuários / Profissionais
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

-- 2. Tabela de Serviços
CREATE TABLE IF NOT EXISTS services (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    duration INTEGER NOT NULL DEFAULT 60,
    niche VARCHAR(50) NOT NULL DEFAULT 'Cabelo',
    professionals JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Clientes
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    level VARCHAR(20) NOT NULL DEFAULT 'Freguês',
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Estoque
CREATE TABLE IF NOT EXISTS stock (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    min_qty INTEGER NOT NULL DEFAULT 5,
    category VARCHAR(50) NOT NULL DEFAULT 'Geral',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabela de Agendamentos
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
    date VARCHAR(10) NOT NULL, -- Formato YYYY-MM-DD
    time_start VARCHAR(5) NOT NULL, -- Formato HH:MM
    time_end VARCHAR(5) NOT NULL, -- Formato HH:MM
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

-- 6. Tabela de Histórico de Faturamento / Payouts
CREATE TABLE IF NOT EXISTS payouts (
    id VARCHAR(50) PRIMARY KEY,
    date VARCHAR(10) NOT NULL, -- Formato YYYY-MM-DD
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
