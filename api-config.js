// Configuração do Backend API do Studio Raio do Sol
// Se estiver rodando pelo servidor Node (porta 3000), usa caminho relativo
// Se estiver em outro host, usa o IP do servidor
const hostname = window.location.hostname || 'localhost';
const port = window.location.port;
export const API_BASE_URL = (port === '3000' || port === '') 
    ? '/api'
    : `http://${hostname}:3000/api`;

/**
 * Auxiliar para realizar requisições HTTP para a API própria
 * @param {string} endpoint – Ex: '/auth/login', '/services/sync'
 * @param {RequestInit} options – Opções padrão do fetch
 */
export async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Configurar cabeçalhos padrões e evitar cache do navegador para dados dinâmicos
    options.headers = options.headers || {};
    options.cache = options.cache || 'no-store';
    
    // Obter o token JWT da sessão
    const token = sessionStorage.getItem('raiosol_token');
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Configurar tipo de conteúdo padrão como JSON (objeto ou array)
    if (options.body !== undefined && options.body !== null && !(options.body instanceof FormData) && typeof options.body !== 'string') {
        options.body = JSON.stringify(options.body);
        options.headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await fetch(url, options);
        
        // Se o token for inválido ou expirado, deslogar e redirecionar (exceto na rota de login/cadastro)
        if ((response.status === 401 || response.status === 403) && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
            sessionStorage.removeItem('raiosol_session');
            sessionStorage.removeItem('raiosol_token');
            // Só redireciona se não estiver na index
            if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
                window.location.href = 'index.html';
            }
            throw new Error('Sessão expirada. Faça login novamente.');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição.');
        }
        
        return data;
    } catch (error) {
        console.error(`Erro na requisição para ${endpoint}:`, error);
        throw error;
    }
}
