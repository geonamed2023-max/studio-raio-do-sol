import { apiRequest, API_BASE_URL } from "./api-config.js";

/* ============================================
   STUDIO RAIO DO SOL - Dashboard Interactivity
   Painel Administrativo do Salão de Beleza
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ===== Force clean old mock data (V2 migration) =====
    if (!localStorage.getItem('raiosol_cleaned_v2')) {
        localStorage.removeItem('raiosol_professionals');
        localStorage.removeItem('raiosol_services');
        localStorage.removeItem('raiosol_clients');
        localStorage.removeItem('raiosol_stock');
        localStorage.removeItem('raiosol_appointments');
        localStorage.removeItem('raiosol_imported_static');
        localStorage.removeItem('raiosol_users');
        localStorage.removeItem('raiosol_payouts');
        localStorage.setItem('raiosol_cleaned_v2', 'true');
    }

    // ===== Session Verification =====
    const session = JSON.parse(sessionStorage.getItem('raiosol_session'));
    if (!session) {
        // No session active, redirect to login
        window.location.href = 'index.html';
        return;
    }

    // ===== Sync admin profile from localStorage if admin =====
    if (session.role === 'admin') {
        const savedAdmin = JSON.parse(localStorage.getItem('raiosol_admin_profile') || 'null');
        if (savedAdmin) {
            session.name = savedAdmin.name || session.name;
            session.email = savedAdmin.email || session.email;
            session.foto = savedAdmin.foto || session.foto;
            sessionStorage.setItem('raiosol_session', JSON.stringify(session));
        }
    }

    // ===== Console Branding =====
    console.log(
        `%c✨ Studio Raio do Sol — Painel ${session.role === 'admin' ? 'Administrativo' : 'Profissional'}`,
        'color: #C9A84C; font-size: 18px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);'
    );
    console.log(
        `%cLogado como: ${session.name} (${session.role.toUpperCase()}) v1.0`,
        'color: #9E9E9E; font-size: 14px;'
    );

    // ============================================
    // SECTION 1: DATA & CONSTANTS
    // ============================================

    // --- Dynamic Professionals Helpers ---
    async function loadProfessionals() {
        try {
            return await apiRequest('/users?role=funcionario&status=ativo');
        } catch (e) {
            console.error("Erro ao carregar profissionais do backend:", e);
            return [];
        }
    }

    async function saveProfessionals(list) {
        professionals = list;
        initStatsAnimation();
        populateMainFilters();
    }

    /** Displays a modal that forces the employee to upload a profile photo before using the app */
    function showForceAvatarModal() {
        // Prevent duplicate creation
        if (document.getElementById('forceAvatarModal')) return;

        const modal = document.createElement('div');
        modal.id = 'forceAvatarModal';
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '9999';
        modal.style.backdropFilter = 'blur(12px)';
        modal.style.webkitBackdropFilter = 'blur(12px)';

        modal.innerHTML = `
            <div class="modal-card glass-card" style="max-width: 420px; padding: 28px; border: 1px solid var(--gold-border); text-align: center; box-shadow: var(--shadow-lg); background: #FFFDF9;">
                <h2 class="modal-title" style="color: var(--gold-600); margin-bottom: 12px; font-size: 20px; font-weight: 700; font-family: var(--font-body);">Foto de Perfil Obrigatória</h2>
                <p style="color: var(--dark-text); font-size: 14px; line-height: 1.5; margin-bottom: 20px; font-family: var(--font-body);">
                    Olá, <strong>${session.name}</strong>! Para continuar acessando o painel do Studio Raio do Sol, você precisa anexar uma foto profissional de si mesmo(a). Isso ajuda os clientes a te identificarem na agenda.
                </p>
                
                <div class="avatar-upload-zone" style="border: 2px dashed var(--gold-300); border-radius: var(--radius-md); padding: 24px; background: #fffcf7; cursor: pointer; transition: border-color 0.2s, background 0.2s; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                    <div class="avatar-preview-container" style="width: 120px; height: 120px; border-radius: 50%; overflow: hidden; background: var(--neutral-100); border: 2px solid var(--gold-border); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; flex-shrink: 0; box-shadow: var(--shadow-sm);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-400)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="upload-icon-svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <img class="upload-preview-img" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                    </div>
                    <span style="font-size: 14px; font-weight: 600; color: var(--gold-600);" class="upload-label-text">Clique para escolher sua foto</span>
                    <span style="font-size: 12px; color: var(--neutral-400);">PNG ou JPG (Máx. 5MB)</span>
                    <input type="file" class="avatar-file-input" accept="image/png, image/jpeg, image/jpg" style="display: none;">
                </div>
                
                <button class="mod-btn mod-btn--gold btn-save-avatar" disabled style="width: 100%; height: 46px; justify-content: center; font-weight: 700; box-shadow: 0 4px 12px rgba(201, 168, 76, 0.25); cursor: not-allowed; opacity: 0.6;">
                    SALVAR FOTO E ENTRAR
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        const uploadZone = modal.querySelector('.avatar-upload-zone');
        const fileInput = modal.querySelector('.avatar-file-input');
        const previewImg = modal.querySelector('.upload-preview-img');
        const iconSvg = modal.querySelector('.upload-icon-svg');
        const labelText = modal.querySelector('.upload-label-text');
        const saveBtn = modal.querySelector('.btn-save-avatar');
        let selectedBase64 = null;

        uploadZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('A foto não pode ter mais de 5MB.', 'warning');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                selectedBase64 = event.target.result;
                previewImg.src = selectedBase64;
                previewImg.style.display = 'block';
                iconSvg.style.display = 'none';
                labelText.textContent = 'Foto selecionada!';
                saveBtn.removeAttribute('disabled');
                saveBtn.style.cursor = 'pointer';
                saveBtn.style.opacity = '1';
            };
            reader.readAsDataURL(file);
        });

        saveBtn.addEventListener('click', async () => {
            if (!selectedBase64) return;

            saveBtn.setAttribute('disabled', 'true');
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.style.opacity = '0.6';
            saveBtn.textContent = 'SALVANDO FOTO...';

            try {
                // Update user avatar in DB
                const res = await apiRequest(`/users/${session.id}`, {
                    method: 'PUT',
                    body: { avatar: selectedBase64 }
                });

                if (res && res.success) {
                    // Update session
                    session.foto = selectedBase64;
                    sessionStorage.setItem('raiosol_session', JSON.stringify(session));

                    // Update professionals cache locally
                    const cachedProfs = JSON.parse(localStorage.getItem('raiosol_professionals') || '[]');
                    const targetProf = cachedProfs.find(p => String(p.id) === String(session.id));
                    if (targetProf) {
                        targetProf.avatar = selectedBase64;
                        localStorage.setItem('raiosol_professionals', JSON.stringify(cachedProfs));
                    }
                    
                    // Also update in professionals global array in dashboard.js
                    const globalProf = professionals.find(p => String(p.id) === String(session.id));
                    if (globalProf) {
                        globalProf.avatar = selectedBase64;
                    }

                    // Remove modal
                    modal.remove();

                    // Re-run setup views to apply new avatar to header/UI elements
                    await setupRoleBasedView();
                    renderCalendarGrid(document.getElementById('filterProfissional')?.value || null);

                    showToast('Sua foto de perfil foi salva com sucesso! Seja bem-vindo(a).', 'success');
                } else {
                    throw new Error('Falha ao atualizar o perfil.');
                }
            } catch (err) {
                console.error(err);
                showToast('Erro ao salvar sua foto. Tente novamente.', 'error');
                saveBtn.removeAttribute('disabled');
                saveBtn.style.cursor = 'pointer';
                saveBtn.style.opacity = '1';
                saveBtn.textContent = 'SALVAR FOTO E ENTRAR';
            }
        });
    }

    /** Professional staff data (dynamic) */
    let professionals = [];
    let renderTimeSlotsDropdown = null;

    /** Dynamic Services Helpers */
    async function loadServices() {
        try {
            return await apiRequest('/services');
        } catch (e) {
            console.error("Erro ao carregar serviços do backend:", e);
            return [];
        }
    }

    async function saveServices(list) {
        // Mantido para compatibilidade - faz upsert de toda a lista
        services = list;
        try {
            await apiRequest('/services/sync', {
                method: 'POST',
                body: list
            });
            populateMainFilters();
        } catch (e) {
            console.error('Erro ao salvar serviços no backend:', e);
            showToast('Erro ao salvar serviço: ' + e.message, 'error');
        }
    }

    async function createService(serviceData) {
        try {
            const saved = await apiRequest('/services', {
                method: 'POST',
                body: serviceData
            });
            // Use the ID returned by the server
            return saved;
        } catch (e) {
            console.error('Erro ao criar serviço:', e);
            throw e;
        }
    }

    async function updateService(id, serviceData) {
        try {
            await apiRequest(`/services/${id}`, {
                method: 'PUT',
                body: serviceData
            });
        } catch (e) {
            console.error('Erro ao atualizar serviço:', e);
            throw e;
        }
    }

    async function deleteService(id) {
        try {
            await apiRequest(`/services/${id}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.error('Erro ao excluir serviço:', e);
            throw e;
        }
    }

    function populateMainFilters() {
        const filterProf = document.getElementById('filterProfissional');
        if (filterProf) {
            const currentVal = filterProf.value;
            filterProf.innerHTML = '<option value="">Todos os Profissionais</option>' +
                professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            if (currentVal !== undefined && currentVal !== null) {
                filterProf.value = currentVal;
            } else {
                filterProf.value = "";
            }
        }

        const filterSvc = document.getElementById('filterServico');
        if (filterSvc) {
            const currentVal = filterSvc.value;
            filterSvc.innerHTML = '<option value="">Serviço</option>' +
                services.map(s => `<option value="${s.name.toLowerCase()}">${s.name}</option>`).join('');
            if (currentVal) filterSvc.value = currentVal;
        }
    }

    /** Dynamic Clients Helpers */
    async function loadClients() {
        try {
            return await apiRequest('/clients');
        } catch (e) {
            console.error("Erro ao carregar clientes do backend:", e);
            return [];
        }
    }

    async function saveClients(list) {
        clients = list;
        try {
            await apiRequest('/clients/sync', {
                method: 'POST',
                body: list
            });
        } catch (e) {
            console.error("Erro ao salvar clientes no backend:", e);
        }
    }

    function getClientLevel(clientName) {
        if (!clientName) return 'Novo';
        const clientAppts = appointments.filter(a => a.client.toLowerCase().trim() === clientName.toLowerCase().trim());
        const visits = clientAppts.length;
        if (visits >= 10) return 'VIP';
        if (visits >= 3) return 'Freguês';
        return 'Novo';
    }

    function recalculateClientLevels() {
        clients.forEach(c => {
            c.level = getClientLevel(c.name);
        });
    }

    /** Dynamic Stock Helpers */
    async function loadStock() {
        try {
            return await apiRequest('/stock');
        } catch (e) {
            console.error("Erro ao carregar estoque do backend:", e);
            return [];
        }
    }

    async function saveStock(list) {
        try {
            await apiRequest('/stock/sync', {
                method: 'POST',
                body: list
            });
        } catch (e) {
            console.error("Erro ao salvar estoque no backend:", e);
        }
    }

    /** Material Withdrawals API Helpers */
    async function loadMaterials(profId) {
        try {
            const url = profId ? `/materials?profId=${encodeURIComponent(profId)}` : '/materials';
            return await apiRequest(url);
        } catch (e) {
            console.error("Erro ao carregar materiais:", e);
            return [];
        }
    }

    async function saveMaterial(data) {
        return await apiRequest('/materials', { method: 'POST', body: data });
    }

    async function deleteMaterial(id) {
        return await apiRequest(`/materials/${id}`, { method: 'DELETE' });
    }


    /** Available services with prices (dynamic) */
    let services = [];

    /** Sample notifications */
    const notifications = [
        { id: 1, message: 'Novo agendamento de Maria Silva para amanhã às 10h.', time: '5 min atrás', read: false },
        { id: 2, message: 'Carla D. cancelou o horário das 14h.', time: '20 min atrás', read: false },
        { id: 3, message: 'Pagamento confirmado — R$ 350,00 (Mechas/Luzes).', time: '1h atrás', read: false },
        { id: 4, message: 'Novo cadastro profissional aguardando aprovação.', time: '3h atrás', read: true },
    ];

    /** Stats target values are calculated dynamically using getStatsConfig() */

    /** Business hours range */
    const BUSINESS_START = 8;  // 08:00
    const BUSINESS_END   = 20; // 20:00

    /** Current week date tracking */
    let currentWeekOffset = 0;

    /** Currently selected date for appointment filtering */
    let currentDate = new Date();
    if (currentDate.getDay() === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
    }

    /** Appointments storage (in-memory, persisted to localStorage) */
    let appointments = [];
    let displayProfs = [];
    let knownNotifIds = null;

    /** Clients storage (persisted to localStorage) */
    let clients = [];

    // ============================================
    // SECTION 2: DATE / TIME HELPERS
    // ============================================

    /**
     * Format a Date object to Brazilian format DD/MM/YYYY
     * @param {Date} date
     * @returns {string}
     */
    function formatDateBR(date) {
        const day   = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year  = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Format a number to Brazilian Real currency
     * @param {number} value
     * @returns {string}
     */
    function formatCurrencyBRL(value) {
        return value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });
    }

    /**
     * Get a deterministic avatar background color based on the client's name
     * @param {string} clientName
     * @returns {string} hex color
     */
    function getClientAvatarColor(clientName) {
        const colors = ['#C9A84C', '#42A5F5', '#AB47BC', '#26A69A', '#EF5350', '#FFA726', '#5C6BC0', '#66BB6A', '#EC407A', '#8D6E63'];
        if (!clientName) return colors[0];
        let hash = 0;
        for (let i = 0; i < clientName.length; i++) {
            hash = clientName.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Get the start (Monday) and end (Sunday) of the current week
     * with an optional offset in weeks.
     * @param {number} weekOffset – number of weeks from current week
     * @returns {{ start: Date, end: Date, days: Date[] }}
     */
    function getWeekRange(weekOffset = 0) {
        const now   = new Date();
        const day   = now.getDay(); // 0 = Sunday
        const diff  = (day === 0 ? -6 : 1) - day; // offset to Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() + diff + (weekOffset * 7));
        monday.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push(d);
        }

        const sunday = new Date(days[6]);
        sunday.setHours(23, 59, 59, 999);

        return { start: monday, end: sunday, days };
    }

    /**
     * Format date to YYYY-MM-DD (for input[type=date] value)
     * @param {Date} date
     * @returns {string}
     */
    function toISODateString(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Dynamically calculate dashboard metrics for the salon overview
     * @returns {Array<{ selector: string, target: number|string, type: string }>}
     */
    function getStatsConfig() {
        const todayStr = toISODateString(new Date());
        const selectedYear = currentDate.getFullYear();
        const selectedMonth = currentDate.getMonth() + 1; // 1-indexed

        const isApptInSelectedMonth = (appt) => {
            if (!appt.date) return false;
            const [y, m] = appt.date.split('-').map(Number);
            return y === selectedYear && m === selectedMonth;
        };

        if (session && session.role === 'funcionario' && employeeProf) {
            const myAppts = appointments.filter(a => 
                String(a.professionalId) === String(employeeProf.id) ||
                (a.isMutual && String(a.professionalId2) === String(employeeProf.id))
            );
            const myTodayAppts = myAppts.filter(a => a.date === todayStr && a.status !== 'Cancelado');
            const myActiveAppts = myAppts.filter(a => isApptInSelectedMonth(a) && a.status !== 'Cancelado');
            const myCompleted = myAppts.filter(a => isApptInSelectedMonth(a) && a.status === 'Concluído');
            
            const commissionPercent = employeeProf.percentual || 30;
            let totalBilling = 0;
            let totalCommission = 0;
            myCompleted.forEach(appt => {
                const price = parseFloat(appt.servicePrice) || 0;
                if (appt.isMutual) {
                    totalBilling += price / 2;
                    totalCommission += price * 0.25;
                } else {
                    totalBilling += price;
                    totalCommission += price * (commissionPercent / 100);
                }
            });

            let myReceitaEstimada = 0;
            myActiveAppts.forEach(appt => {
                const price = parseFloat(appt.servicePrice) || 0;
                if (appt.isMutual) {
                    myReceitaEstimada += price / 2;
                } else {
                    myReceitaEstimada += price;
                }
            });

            return [
                { selector: '[data-stat="agendamentos"]',  target: myTodayAppts.length,      type: 'number' },
                { selector: '[data-stat="profissionais"]',  target: totalCommission,           type: 'currency' },
                { selector: '[data-stat="servicos"]',       target: myActiveAppts.length,      type: 'number' },
                { selector: '[data-stat="receita"]',        target: myReceitaEstimada,         type: 'currency' },
            ];
        }

        // Admin view
        const activeApptsToday = appointments.filter(a => a.date === todayStr && a.status !== 'Cancelado');
        const totalActiveAppts = appointments.filter(a => isApptInSelectedMonth(a) && a.status !== 'Cancelado').length;
        
        // Sum price of active appointments in system for selected month
        const receitaEstimada = appointments
            .filter(a => isApptInSelectedMonth(a) && a.status !== 'Cancelado')
            .reduce((sum, a) => sum + (parseFloat(a.servicePrice) || 0), 0);

        // Sync active professionals count
        const activeProfsCount = professionals.length;

        return [
            { selector: '[data-stat="agendamentos"]',  target: activeApptsToday.length,      type: 'number' },
            { selector: '[data-stat="profissionais"]',  target: `${activeProfsCount}/${professionals.length}`, type: 'fraction' },
            { selector: '[data-stat="servicos"]',       target: totalActiveAppts,     type: 'number' },
            { selector: '[data-stat="receita"]',        target: receitaEstimada, type: 'currency' },
        ];
    }

    /**
     * Get weekday name abbreviation in Portuguese
     * @param {Date} date
     * @returns {string}
     */
    function getWeekdayShort(date) {
        const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return names[date.getDay()];
    }

    /**
     * Get weekday full name in Portuguese
     * @param {Date} date
     * @returns {string}
     */
    function getWeekdayFull(date) {
        const names = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        return names[date.getDay()];
    }

    // ============================================
    // SECTION 3: LOCAL STORAGE HELPERS
    // ============================================

    async function loadAppointments() {
        try {
            const data = await apiRequest('/appointments');
            appointments = data;
            resolveOverlappingAppointments();
            return appointments;
        } catch (e) {
            console.error("Erro ao carregar agendamentos do backend:", e);
            return [];
        }
    }

    async function saveAppointments() {
        resolveOverlappingAppointments();
        try {
            await apiRequest('/appointments/sync', {
                method: 'POST',
                body: appointments
            });
            // Recalculate client levels when appointments history changes
            recalculateClientLevels();
            await saveClients(clients);
            
            initStatsAnimation();
            rebuildNotifications();
            showToast("Agendamentos salvos com sucesso!", "success");
        } catch (e) {
            console.error("Erro ao salvar agendamentos no backend:", e);
            showToast("Erro ao salvar no banco de dados: " + e.message, "error");
        }
    }

    function resolveOverlappingAppointments() {
        // Group appointments by date and professional
        const groups = {};
        appointments.forEach(appt => {
            if (appt.status === 'Cancelado') return;
            const key = `${appt.date}_${appt.professionalId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(appt);
        });

        // Resolve overlaps per group
        for (const key in groups) {
            const list = groups[key];
            // Sort by start time, then by duration descending
            list.sort((a, b) => {
                const [hA, mA] = a.timeStart.split(':').map(Number);
                const [hB, mB] = b.timeStart.split(':').map(Number);
                const startA = hA * 60 + mA;
                const startB = hB * 60 + mB;
                if (startA !== startB) return startA - startB;
                
                const [ehA, emA] = a.timeEnd.split(':').map(Number);
                const [ehB, emB] = b.timeEnd.split(':').map(Number);
                const durationA = (ehA * 60 + emA) - startA;
                const durationB = (ehB * 60 + emB) - startB;
                return durationB - durationA;
            });

            for (let i = 0; i < list.length - 1; i++) {
                const current = list[i];
                const next = list[i + 1];

                const [ch, cm] = current.timeStart.split(':').map(Number);
                const [ceh, cem] = current.timeEnd.split(':').map(Number);
                const currentStart = ch * 60 + cm;
                const currentEnd = ceh * 60 + cem;

                const [nh, nm] = next.timeStart.split(':').map(Number);
                const nextStart = nh * 60 + nm;

                if (currentEnd > nextStart) {
                    const newEndMins = Math.max(currentStart + 10, nextStart);
                    const newEndH = Math.floor(newEndMins / 60);
                    const newEndM = newEndMins % 60;
                    current.timeEnd = String(newEndH).padStart(2, '0') + ':' + String(newEndM).padStart(2, '0');
                }
            }
        }
    }


    // ============================================
    // SECTION 4: TOAST NOTIFICATION SYSTEM
    // ============================================

    /**
     * Show a toast notification
     * @param {string} message – text to display
     * @param {'success'|'error'|'info'|'warning'} type
     * @param {number} duration – auto-dismiss in ms (default 4000)
     */
    function showToast(message, type = 'info', duration = 4000) {
        // Remove any existing toast
        const existing = document.querySelector('.dashboard-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `dashboard-toast toast-${type}`;

        // SVG icons per type
        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="Fechar">&times;</button>
        `;

        document.body.appendChild(toast);

        // Close button handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('toast-visible');
            setTimeout(() => toast.remove(), 400);
        });

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('toast-visible');
            });
        });

        // Auto-dismiss
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('toast-visible');
                setTimeout(() => toast.remove(), 400);
            }
        }, duration);
    }

    // Inject toast styles
    const toastStyles = document.createElement('style');
    toastStyles.textContent = `
        .dashboard-toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(120px);
            padding: 14px 24px;
            border-radius: 10px;
            font-family: 'Inter', sans-serif;
            font-size: 0.9375rem;
            font-weight: 500;
            color: #FFFFFF;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
            opacity: 0;
            max-width: 90%;
            white-space: nowrap;
        }
        .dashboard-toast.toast-visible {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        .toast-success { background: #4CAF50; }
        .toast-error   { background: #EF5350; }
        .toast-info    { background: #42A5F5; }
        .toast-warning { background: #FF9800; }
        .toast-icon { display: flex; align-items: center; flex-shrink: 0; }
        .toast-message { flex: 1; }
        .toast-close {
            background: none; border: none; color: rgba(255,255,255,0.8);
            font-size: 1.3rem; cursor: pointer; padding: 0 0 0 8px; line-height: 1;
        }
        .toast-close:hover { color: #fff; }
    `;
    document.head.appendChild(toastStyles);

    /**
     * Show a premium confirmation dialog matching the gold-cream theme
     * @param {Object} options
     * @param {string} options.title - Header text
     * @param {string} options.message - Detailed explanation
     * @param {string} [options.confirmText] - Label for confirmation button
     * @param {string} [options.cancelText] - Label for cancellation button
     * @param {Function} options.onConfirm - Callback when confirmed
     */
    function showConfirmDialog({ title, message, confirmText = 'Sim, Excluir', cancelText = 'Cancelar', onConfirm }) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '9999';

        overlay.innerHTML = `
            <div class="modal-novo-agendamento modal-confirm-dialog" style="max-width: 400px; padding: 28px 24px; text-align: center; font-family: var(--font-body); border: 1.5px solid var(--gold-300);">
                <div style="font-size: 44px; margin-bottom: 16px; color: var(--error); display: flex; align-items: center; justify-content: center; animation: pulse 2s infinite;">⚠️</div>
                <h3 style="font-family: var(--font-display); font-size: 1.45rem; color: var(--neutral-900); margin-bottom: 12px; font-weight: 700;">${title}</h3>
                <p style="color: var(--neutral-600); font-size: 0.9375rem; line-height: 1.5; margin-bottom: 24px; padding: 0 8px;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn btn-secondary btn-cancel-confirm" style="padding: 10px 20px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: 1.5px solid var(--neutral-200); background: #fff; color: var(--neutral-700); font-size: 0.85rem; transition: all 0.2s ease;">${cancelText}</button>
                    <button class="btn btn-primary btn-do-confirm" style="padding: 10px 20px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; background: var(--error); color: #fff; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(239, 83, 80, 0.3); transition: all 0.2s ease;">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Force reflow and activate transitions
        setTimeout(() => overlay.classList.add('active'), 20);

        const close = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 350);
        };

        const cancelBtn = overlay.querySelector('.btn-cancel-confirm');
        const confirmBtn = overlay.querySelector('.btn-do-confirm');

        cancelBtn.addEventListener('click', close);
        cancelBtn.addEventListener('mouseover', () => {
            cancelBtn.style.borderColor = 'var(--neutral-400)';
            cancelBtn.style.background = 'var(--neutral-50)';
        });
        cancelBtn.addEventListener('mouseout', () => {
            cancelBtn.style.borderColor = 'var(--neutral-200)';
            cancelBtn.style.background = '#fff';
        });

        confirmBtn.addEventListener('click', () => {
            onConfirm();
            close();
        });
        confirmBtn.addEventListener('mouseover', () => {
            confirmBtn.style.background = '#d32f2f';
        });
        confirmBtn.addEventListener('mouseout', () => {
            confirmBtn.style.background = 'var(--error)';
        });

        // Close on ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // ============================================
    // SECTION 5: SIDEBAR NAVIGATION
    // ============================================

    const sidebar       = document.querySelector('.sidebar');
    const sidebarNav    = document.querySelector('.sidebar-nav');
    const sidebarOverlay = createSidebarOverlay();

    /** Set active nav item via event delegation */
    if (sidebarNav) {
        sidebarNav.addEventListener('click', (e) => {
            const navItem = e.target.closest('.sidebar-nav-item');
            if (!navItem) return;

            e.preventDefault();

            // Remove active from all siblings
            sidebarNav.querySelectorAll('.sidebar-nav-item').forEach(item => {
                item.classList.remove('active');
            });

            // Set active on clicked item
            navItem.classList.add('active');

            const pageId = navItem.dataset.page;

            const targetPageId = pageId;

            // Switch sub-pages visually
            document.querySelectorAll('.dashboard-page').forEach(page => {
                if (page.id === `page-${targetPageId}`) {
                    page.classList.remove('hidden');
                } else {
                    page.classList.add('hidden');
                }
            });

            // Trigger dynamic page loading
            if (pageId === 'agenda') {
                const filterProf = document.getElementById('filterProfissional');
                renderCalendarGrid(filterProf ? filterProf.value : null);
                renderAppointments();
                initStatsAnimation();
                // Scroll to agenda
                const agendaSec = document.getElementById('agendaSection');
                if (agendaSec) agendaSec.scrollIntoView({ behavior: 'smooth' });
            } else if (pageId === 'profissionais') {
                renderProfessionalsPage();
            } else if (pageId === 'servicos') {
                renderServicesPage();
            } else if (pageId === 'clientes') {
                renderClientsPage();
            } else if (pageId === 'relatorios') {
                renderReportsPage();
            } else if (pageId === 'estoque') {
                renderMaterialsPage();
            } else if (pageId === 'gastos') {
                renderGastosPage();
            } else if (pageId === 'vales') {
                renderValesPage();
            } else if (pageId === 'configuracoes') {
                renderConfiguracoesPage();
            } else if (pageId === 'pagamentos') {
                renderPaymentsPage();
            } else if (pageId === 'massagem') {
                renderMassagemPage();
            }

            // On mobile, close sidebar after selection
            if (window.innerWidth <= 768 && sidebar) {
                closeSidebar();
            }
        });
    }

    /** Create mobile overlay for sidebar */
    function createSidebarOverlay() {
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }
        overlay.addEventListener('click', closeSidebar);
        return overlay;
    }

    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('sidebar-open');
        sidebarOverlay.classList.add('overlay-visible');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('sidebar-open');
        sidebarOverlay.classList.remove('overlay-visible');
        document.body.style.overflow = '';
    }

    // Inject sidebar responsive styles
    const sidebarStyles = document.createElement('style');
    sidebarStyles.textContent = `
        .sidebar-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(2px);
            z-index: 99;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
        }
        .sidebar-overlay.overlay-visible {
            opacity: 1;
            pointer-events: auto;
        }
        .hamburger-btn {
            display: none;
            position: fixed;
            top: 16px; left: 16px;
            z-index: 101;
            width: 42px; height: 42px;
            border-radius: 10px;
            background: #2A2A2A;
            border: 1px solid rgba(201,168,76,0.3);
            color: #C9A84C;
            cursor: pointer;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: background 0.2s;
        }
        .hamburger-btn:hover { background: #333; }
        .hamburger-btn svg { width: 22px; height: 22px; }
        @media (max-width: 768px) {
            .hamburger-btn { display: flex; }
            .sidebar {
                transform: translateX(-100%);
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                position: fixed !important;
                z-index: 100;
            }
            .sidebar.sidebar-open {
                transform: translateX(0);
            }
        }
    `;
    document.head.appendChild(sidebarStyles);

    // ============================================
    // SECTION 6: HAMBURGER MENU (MOBILE)
    // ============================================

    const hamburgerBtn = document.createElement('button');
    hamburgerBtn.className = 'hamburger-btn';
    hamburgerBtn.setAttribute('aria-label', 'Abrir menu');
    hamburgerBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
    `;
    hamburgerBtn.addEventListener('click', () => {
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });
    document.body.appendChild(hamburgerBtn);

    // ============================================
    // SECTION 7: SEARCH FUNCTIONALITY
    // ============================================

    const searchInput = document.querySelector('.search-input, #dashboardSearch, #globalSearch, .topbar-search-input, [data-search]');
    let searchDebounceTimer = null;

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                filterAppointmentsBySearch(e.target.value.trim());
            }, 300);
        });
    }

    /**
     * Filter and highlight appointments in the calendar grid
     * @param {string} query – search text
     */
    function filterAppointmentsBySearch(query) {
        const allAppointments = document.querySelectorAll('.appointment, .calendar-appointment, [data-appointment]');
        const lowerQuery = query.toLowerCase();

        allAppointments.forEach(appt => {
            // Remove previous highlights
            appt.classList.remove('search-highlight', 'search-hidden');

            if (!query) return; // Reset all if query is empty

            const text = appt.textContent.toLowerCase();
            if (text.includes(lowerQuery)) {
                appt.classList.add('search-highlight');
            } else {
                appt.classList.add('search-hidden');
            }
        });
    }

    // Inject search highlight styles
    const searchStyles = document.createElement('style');
    searchStyles.textContent = `
        .search-highlight {
            outline: 2px solid #C9A84C !important;
            outline-offset: 2px;
            box-shadow: 0 0 12px rgba(201,168,76,0.35) !important;
            z-index: 2;
            position: relative;
        }
        .search-hidden {
            opacity: 0.2;
            pointer-events: none;
            transition: opacity 0.3s ease;
        }
    `;
    document.head.appendChild(searchStyles);

    // ============================================
    // SECTION 8: STATS CARDS ANIMATION
    // ============================================

    /**
     * Animate a number counting up from 0 to target using requestAnimationFrame
     * @param {HTMLElement} element
     * @param {number|string} target
     * @param {'number'|'fraction'|'currency'} type
     * @param {number} duration – ms
     */
    function animateStatCounter(element, target, type, duration = 1500) {
        if (!element) return;

        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic for a premium feel
            const eased = 1 - Math.pow(1 - progress, 3);

            switch (type) {
                case 'number': {
                    const current = Math.round(eased * target);
                    element.textContent = current;
                    break;
                }
                case 'fraction': {
                    // e.g. '18/20'
                    const parts = target.split('/');
                    const num = Math.round(eased * parseInt(parts[0]));
                    element.textContent = `${num}/${parts[1]}`;
                    break;
                }
                case 'currency': {
                    const current = eased * target;
                    element.textContent = formatCurrencyBRL(current);
                    break;
                }
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        // Initialize display to zero/empty
        switch (type) {
            case 'number':   element.textContent = '0'; break;
            case 'fraction': element.textContent = '0/' + target.split('/')[1]; break;
            case 'currency': element.textContent = formatCurrencyBRL(0); break;
        }

        requestAnimationFrame(update);
    }

    /** Initialize stats counter animation on page load */
    function initStatsAnimation() {
        if (session && session.role === 'funcionario' && employeeProf) {
            updateEmployeeStatsCards();
        } else {
            updateAdminStatsCards();
        }
        const statsConfig = getStatsConfig();
        statsConfig.forEach((stat, index) => {
            const el = document.querySelector(stat.selector);
            if (!el) return;

            // Stagger start by 100ms per card
            setTimeout(() => {
                animateStatCounter(el, stat.target, stat.type, 1500);
            }, index * 100);
        });
    }

    // ============================================
    // SECTION 9: FILTER DROPDOWNS & CLICK FILTERING
    // ============================================

    const filterProfissional = document.querySelector('#filterProfissional, [data-filter="profissional"]');
    const filterServico      = document.querySelector('#filterServico, [data-filter="servico"]');

    /**
     * Filters the calendar grid and appointments to show only a single professional,
     * while keeping the filter select dropdown and right-sidebar highlighting in sync.
     */
    window.filterCalendarByProfessional = function(profId) {
        // 1. Update the filter dropdown value
        const dropdown = document.getElementById('filterProfissional');
        if (dropdown) {
            dropdown.value = profId || "";
        }

        // 2. Re-render calendar grid (shows either 1 column or all 18)
        renderCalendarGrid(profId);

        // 3. Re-render appointments for the filtered grid
        renderAppointments();

        // 4. Update the highlight state in the Right Sidebar
        const items = document.querySelectorAll('.right-sidebar .professional-item');
        items.forEach(item => {
            const nameEl = item.querySelector('.professional-name');
            if (nameEl) {
                const name = nameEl.textContent.trim();
                const prof = professionals.find(p => p.name === name);
                if (prof && String(prof.id) === String(profId)) {
                    item.classList.add('professional-item--selected');
                } else {
                    item.classList.remove('professional-item--selected');
                }
            }
        });
    };

    /** Filter by Professional select change event */
    if (filterProfissional) {
        filterProfissional.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            filterCalendarByProfessional(selectedId);
        });
    }

    /** Attach click event listeners to the Right Sidebar professional items (via delegation) */
    const rightSidebarList = document.querySelector('.right-sidebar .professionals-list');
    if (rightSidebarList) {
        rightSidebarList.addEventListener('click', (e) => {
            const item = e.target.closest('.professional-item');
            if (!item) return;

            // Find professional name
            const nameEl = item.querySelector('.professional-name');
            if (!nameEl) return;

            const name = nameEl.textContent.trim();
            const prof = professionals.find(p => p.name === name);
            if (!prof) return;

            // Toggle filter: if already selected, clear filter; otherwise filter by selected
            const currentFilter = document.getElementById('filterProfissional')?.value;
            if (currentFilter === String(prof.id)) {
                filterCalendarByProfessional(""); // Toggle off
            } else {
                filterCalendarByProfessional(prof.id); // Toggle on
            }
        });
    }

    /** Filter by Service — highlight matching appointments */
    if (filterServico) {
        filterServico.addEventListener('change', (e) => {
            const selectedService = e.target.value.toLowerCase();
            const allAppts = document.querySelectorAll('.appointment, .calendar-appointment, [data-appointment]');

            allAppts.forEach(appt => {
                appt.classList.remove('service-highlight', 'service-dimmed');

                if (!selectedService || selectedService === 'todos') return;

                const serviceName = (appt.dataset.service || appt.textContent).toLowerCase();
                if (serviceName.includes(selectedService)) {
                    appt.classList.add('service-highlight');
                } else {
                    appt.classList.add('service-dimmed');
                }
            });
        });
    }

    // Inject filter styles
    const filterStyles = document.createElement('style');
    filterStyles.textContent = `
        .service-highlight {
            outline: 2px solid #C9A84C;
            outline-offset: 1px;
            box-shadow: 0 0 8px rgba(201,168,76,0.3);
        }
        .service-dimmed {
            opacity: 0.25;
            transition: opacity 0.3s ease;
        }
    `;
    document.head.appendChild(filterStyles);

    // ============================================
    // DATE NAVIGATION
    // ============================================

    /** Update the date display and agenda title */
    function updateDateDisplay() {
        const weekdayEl = document.getElementById('dateWeekday');
        const dateEl = document.getElementById('dateFull');
        const picker = document.getElementById('datePicker');
        const titleEl = document.getElementById('agendaTitle');

        if (weekdayEl) weekdayEl.textContent = getWeekdayFull(currentDate);
        if (dateEl) dateEl.textContent = formatDateBR(currentDate);
        if (picker) picker.value = toISODateString(currentDate);

        const week = getWeekRangeFromDate(currentDate);
        if (titleEl) {
            titleEl.textContent = `Agenda Global — ${formatDateBR(week.start)} a ${formatDateBR(week.end)}`;
        }
    }

    /** Calculate week offset from a given date */
    function getWeekOffsetFromDate(date) {
        const now = new Date();
        const diffDays = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
        return Math.round(diffDays / 7);
    }

    /** Get week range for a specific date (week containing that date) */
    function getWeekRangeFromDate(date) {
        const day = date.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        const monday = new Date(date);
        monday.setDate(date.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push(d);
        }
        const sunday = new Date(days[6]);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday, days };
    }

    /** Navigate to a specific date */
    function goToDate(date) {
        currentDate = new Date(date);
        currentDate.setHours(0, 0, 0, 0);
        if (currentDate.getDay() === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        currentWeekOffset = getWeekOffsetFromDate(currentDate);
        updateDateDisplay();
        updateCalendarWeek(currentWeekOffset);
        renderAppointments();
        initStatsAnimation();
    }

    /** Go to previous day */
    function goToPrevDay() {
        const prev = new Date(currentDate);
        prev.setDate(prev.getDate() - 1);
        if (prev.getDay() === 0) {
            prev.setDate(prev.getDate() - 1);
        }
        goToDate(prev);
    }

    /** Go to next day */
    function goToNextDay() {
        const next = new Date(currentDate);
        next.setDate(next.getDate() + 1);
        if (next.getDay() === 0) {
            next.setDate(next.getDate() + 1);
        }
        goToDate(next);
    }

    /** Automatically advance the calendar date to tomorrow if today's last appointment has passed, or if it passes 20:00 */
    function checkAutoAdvanceDate(isPeriodic = false) {
        // Only run if the calendar is currently showing "today"
        const today = new Date();
        const todayStr = toISODateString(today);
        const currentDateStr = toISODateString(currentDate);
        
        if (todayStr !== currentDateStr) return; // Only auto-advance if showing today
        
        // Find all appointments for today (excluding cancelled ones)
        const todayAppts = appointments.filter(a => a.date === todayStr && a.status !== 'Cancelado');
        
        // Default limit if there are no appointments today
        let maxTimeStr = '20:00'; 
        
        if (todayAppts.length > 0) {
            maxTimeStr = '00:00';
            todayAppts.forEach(a => {
                const t = a.timeEnd || a.timeStart || '00:00';
                if (t > maxTimeStr) {
                    maxTimeStr = t;
                }
            });
        }
        
        if (maxTimeStr === '00:00') maxTimeStr = '20:00';
        
        // Parse maxTimeStr (HH:MM)
        const [maxHours, maxMins] = maxTimeStr.split(':').map(Number);
        
        const now = new Date();
        const nowHours = now.getHours();
        const nowMins = now.getMinutes();
        
        // Check if current time is past the max time of today (by at least 1 minute)
        if (nowHours > maxHours || (nowHours === maxHours && nowMins > maxMins)) {
            console.log(`[Auto-Advance] Limite de horário (${maxTimeStr}) passou. Avançando agenda para amanhã.`);
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Advance the date cleanly and update UI
            goToDate(tomorrow);
            
            if (isPeriodic) {
                showToast('Agenda avançada automaticamente para o próximo dia!', 'info');
            }
        }
    }

    // Wire up date navigation controls
    const prevBtn = document.getElementById('prevDateBtn');
    const nextBtn = document.getElementById('nextDateBtn');
    const dateDisplay = document.getElementById('dateDisplay');
    const datePicker = document.getElementById('datePicker');

    if (prevBtn) prevBtn.addEventListener('click', goToPrevDay);
    if (nextBtn) nextBtn.addEventListener('click', goToNextDay);

    if (dateDisplay && datePicker) {
        datePicker.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        dateDisplay.addEventListener('click', () => {
            if (typeof datePicker.showPicker === 'function') {
                datePicker.showPicker();
            } else {
                datePicker.focus();
                datePicker.click();
            }
        });
        datePicker.addEventListener('change', (e) => {
            if (e.target.value) {
                const targetDate = new Date(e.target.value + 'T00:00:00');
                if (targetDate.getDay() === 0) {
                    showToast('O estúdio não abre aos domingos.', 'warning');
                    targetDate.setDate(targetDate.getDate() + 1);
                }
                goToDate(targetDate);
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.key === 'ArrowLeft') { goToPrevDay(); e.preventDefault(); }
        if (e.key === 'ArrowRight') { goToNextDay(); e.preventDefault(); }
    });

    /** Update the calendar header to reflect the given week */
    function updateCalendarWeek(weekOffset) {
        const week = getWeekRange(weekOffset);
        const headerCells = document.querySelectorAll('.calendar-day-header, .day-header');

        headerCells.forEach((cell, idx) => {
            if (idx < week.days.length) {
                const d = week.days[idx];
                const dayNum = cell.querySelector('.day-number, .header-date');
                const dayName = cell.querySelector('.day-name, .header-weekday');
                if (dayNum) dayNum.textContent = d.getDate();
                if (dayName) dayName.textContent = getWeekdayShort(d);
            }
        });

        const weekLabel = document.querySelector('.week-range, .calendar-week-label, [data-week-range]');
        if (weekLabel) {
            weekLabel.textContent = `${formatDateBR(week.start)} — ${formatDateBR(week.end)}`;
        }
    }

    // ============================================
    // SECTION 10: NEW APPOINTMENT MODAL
    // ============================================

    const newApptBtn     = document.querySelector('.btn-novo-agendamento, #btnNovoAgendamento, [data-action="novo-agendamento"]');
    let appointmentModal = document.querySelector('#appointmentModal, .appointment-modal');

    // Create modal if it doesn't exist in the DOM
    if (!appointmentModal) {
        appointmentModal = createAppointmentModal();
    }

    /** Build the new appointment modal dynamically */
    function createAppointmentModal() {
        const modal = document.createElement('div');
        modal.id = 'appointmentModal';
        modal.className = 'modal-overlay';

        // Build professional options
        const profOptions = professionals
            .map(p => `<option value="${p.id}">${p.name}</option>`)
            .join('');

        // Build service options grouped by category (niche)
        const servicesByNiche = {};
        services.forEach(s => {
            const niche = s.niche || 'Outros';
            if (!servicesByNiche[niche]) servicesByNiche[niche] = [];
            servicesByNiche[niche].push(s);
        });

        let serviceOptions = '';
        for (const [niche, list] of Object.entries(servicesByNiche)) {
            serviceOptions += `<optgroup label="${niche}">`;
            serviceOptions += list.map(s => {
                const priceText = parseFloat(s.price) === 0 ? 'A combinar' : formatCurrencyBRL(parseFloat(s.price));
                return `<option value="${s.id}">${s.name} (${priceText})</option>`;
            }).join('');
            serviceOptions += `</optgroup>`;
        }

        modal.innerHTML = `
            <div class="modal-card glass-card appt-modal-card">
                <div class="appt-modal-header">
                    <h2 class="modal-title">Novo Agendamento</h2>
                    <button class="appt-modal-close" aria-label="Fechar">&times;</button>
                </div>
                <form id="newAppointmentForm" class="appt-form" novalidate>
                    <div class="form-group">
                        <label for="apptProfessional" class="form-label">Profissional</label>
                        <select id="apptProfessional" class="form-input appt-select" required>
                            <option value="">Selecione um profissional</option>
                            ${profOptions}
                        </select>
                        <span class="form-error" id="apptProfessionalError"></span>
                    </div>

                    <div class="form-group" id="apptMutualCheckboxContainer" style="margin-top: 4px;">
                        <label class="switch-toggle-label" for="apptIsMutual">
                            <div class="switch-toggle-wrapper">
                                <input type="checkbox" id="apptIsMutual" class="switch-toggle-input">
                                <span class="switch-toggle-slider"></span>
                            </div>
                            <span class="switch-toggle-text">
                                Trabalho Mútuo 
                                <span class="switch-toggle-text-desc">(Executado por 2 pessoas)</span>
                            </span>
                        </label>
                    </div>

                    <div class="form-group" id="apptProfessional2Container" style="display: none;">
                        <label for="apptProfessional2" class="form-label">Segundo Profissional</label>
                        <select id="apptProfessional2" class="form-input appt-select">
                            <option value="">Selecione o segundo profissional</option>
                            ${profOptions}
                        </select>
                        <span class="form-error" id="apptProfessional2Error"></span>
                    </div>

                    <div class="form-group">
                        <label for="apptClient" class="form-label">Cliente</label>
                        <div class="client-autocomplete-container">
                            <input type="text" id="apptClient" class="form-input" placeholder="Pesquise ou digite o nome do cliente" required autocomplete="off">
                            <div class="client-autocomplete-dropdown" id="apptClientAutocomplete"></div>
                        </div>
                        
                        <!-- Premium Selected Client Preview Card -->
                        <div class="appt-client-preview-card" id="apptClientPreviewCard">
                            <div class="autocomplete-avatar" id="apptClientPreviewAvatar"></div>
                            <div class="autocomplete-info">
                                <span class="autocomplete-name" id="apptClientPreviewName"></span>
                                <span class="autocomplete-phone" id="apptClientPreviewPhone"></span>
                            </div>
                            <span class="autocomplete-tag" id="apptClientPreviewTag"></span>
                            <button type="button" id="btnRemoveClientPreview" style="background: none; border: none; color: var(--neutral-400); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; margin-left: auto; transition: color 0.2s;" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--neutral-400)'" title="Remover cliente">&times;</button>
                        </div>
                        <span class="form-error" id="apptClientError"></span>
                    </div>

                    <div class="form-group" style="position: relative;">
                        <label class="form-label">Serviço</label>
                        <select id="apptService" class="form-input appt-select" required style="display: none;">
                            <option value="">Selecione um serviço</option>
                            ${serviceOptions}
                        </select>
                        <div class="appt-input-wrapper">
                            <div class="appt-icon" style="z-index: 3;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><path d="M8.12 8.12L12 12"></path><path d="M20 4L8.12 15.88"></path><circle cx="6" cy="18" r="3"></circle><path d="M14.8 14.8L20 20"></path></svg>
                            </div>
                            <button type="button" class="form-input appt-select" id="apptServiceBtn" style="padding-left: 44px !important; text-align: left; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background-color: #FFFDF9; border-color: #E2D7C0; height: 46px; width: 100%;">
                                <span id="apptServiceBtnLabel">Selecione um serviço</span>
                            </button>
                        </div>
                        <div class="custom-select-dropdown" id="apptServiceDropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid var(--gold-border); border-radius: 10px; box-shadow: 0 10px 30px rgba(154,123,31,0.15); z-index: 5001; max-height: 250px; overflow-y: auto; margin-top: 4px; padding: 6px 0;">
                            <!-- Dropdown Tree will be rendered here -->
                        </div>
                        <span class="form-error" id="apptServiceError"></span>
                    </div>

                    <div class="form-group" id="apptPriceGroup">
                        <label for="apptPrice" class="form-label">Preço do Serviço (R$)</label>
                        <div class="appt-input-wrapper">
                            <div class="appt-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            </div>
                            <input type="text" id="apptPrice" class="form-input" placeholder="A combinar" autocomplete="off" style="padding-left: 44px !important;">
                        </div>
                        <span class="form-error" id="apptPriceError"></span>
                    </div>

                    <div class="form-group">
                        <label for="apptDate" class="form-label">Data</label>
                        <div class="appt-date-nav-wrapper" style="display: flex; gap: 8px; align-items: center; width: 100%;">
                            <button type="button" class="appt-date-nav-btn" id="btnPrevDate" title="Dia Anterior" style="background: none; border: 1px solid var(--neutral-300); border-radius: var(--radius-sm); padding: 8px; color: var(--gold-700); cursor: pointer; display: flex; align-items: center; justify-content: center; height: 46px; width: 40px; transition: all 0.2s;" onmouseover="this.style.background='var(--gold-50)'" onmouseout="this.style.background='none'">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <div class="appt-input-wrapper" style="flex: 1;">
                                <div class="appt-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                </div>
                                <input type="date" id="apptDate" class="form-input" required>
                            </div>
                            <button type="button" class="appt-date-nav-btn" id="btnNextDate" title="Próximo Dia" style="background: none; border: 1px solid var(--neutral-300); border-radius: var(--radius-sm); padding: 8px; color: var(--gold-700); cursor: pointer; display: flex; align-items: center; justify-content: center; height: 46px; width: 40px; transition: all 0.2s;" onmouseover="this.style.background='var(--gold-50)'" onmouseout="this.style.background='none'">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                        <span class="form-error" id="apptDateError"></span>
                    </div>

                    <div class="form-row" style="display: flex; gap: 12px; width: 100%;">
                        <div class="form-group" style="flex: 1; min-width: 0;">
                            <label for="apptTimeStart" class="form-label">Horário Início</label>
                            <div class="appt-input-wrapper">
                                <div class="appt-icon" style="z-index: 3;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </div>
                                <input type="text" class="form-input appt-select" id="apptTimeStartBtn" placeholder="Selecione ou digite" style="padding-left: 44px !important; text-align: left; display: flex; align-items: center; cursor: text; background-color: #FFFDF9; border-color: #E2D7C0; height: 46px; width: 100%;" maxlength="5">
                                <input type="hidden" id="apptTimeStart" required>
                                <div class="appt-time-dropdown" id="apptTimeStartDropdown"></div>
                            </div>
                            <span class="form-error" id="apptTimeStartError"></span>
                        </div>
                        <div class="form-group" style="flex: 1; min-width: 0;">
                            <label for="apptTimeEnd" class="form-label">Horário Término</label>
                            <div class="appt-input-wrapper">
                                <div class="appt-icon" style="z-index: 3;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </div>
                                <input type="text" class="form-input appt-select" id="apptTimeEndBtn" placeholder="Selecione ou digite" style="padding-left: 44px !important; text-align: left; display: flex; align-items: center; cursor: text; background-color: #FFFDF9; border-color: #E2D7C0; height: 46px; width: 100%;" maxlength="5">
                                <input type="hidden" id="apptTimeEnd" required>
                                <div class="appt-time-dropdown" id="apptTimeEndDropdown"></div>
                            </div>
                            <span class="form-error" id="apptTimeEndError"></span>
                        </div>
                    </div>

                    <!-- Dynamic Duration & End Time Preview Card -->
                    <div class="appt-duration-info-card" id="apptDurationInfoCard" style="display: none;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-700)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="appt-duration-card-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <div class="appt-duration-text-group">
                            <span class="appt-duration-label" id="apptDurationCardLabel">Duração estimada</span>
                            <span class="appt-duration-value" id="apptDurationCardValue">Carregando término...</span>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary appt-cancel-btn">CANCELAR</button>
                        <button type="submit" class="btn btn-primary appt-submit-btn">
                            <span class="btn-text">AGENDAR</span>
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Inject modal-specific styles
        const modalStyles = document.createElement('style');
        modalStyles.textContent = `
            .appt-modal-card {
                max-width: 500px;
                width: 90%;
                text-align: left;
                padding: 36px;
                background: linear-gradient(135deg, #ffffff 0%, #FFFDF9 100%);
                border: 1px solid var(--gold-border);
                border-left: 4px solid var(--gold-500) !important;
                border-radius: var(--radius-lg);
                box-shadow: 0 24px 80px rgba(154, 123, 31, 0.12);
                transform: translateY(20px) scale(0.96);
                opacity: 0;
                transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease;
            }
            .modal-overlay {
                backdrop-filter: blur(8px);
                background: rgba(26, 26, 26, 0.4) !important;
            }
            .modal-overlay.active .appt-modal-card {
                transform: translateY(0) scale(1);
                opacity: 1;
            }
            .appt-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 26px;
            }
            .appt-modal-header .modal-title {
                font-family: 'Playfair Display', serif;
                font-size: 1.6rem;
                font-weight: 700;
                color: var(--neutral-900);
                margin: 0;
                letter-spacing: 0.2px;
            }
            .appt-modal-close {
                background: none; border: none;
                font-size: 1.8rem; color: var(--medium-text);
                cursor: pointer; line-height: 1;
                padding: 4px; border-radius: 50%;
                width: 32px; height: 32px;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s ease;
            }
            .appt-modal-close:hover {
                color: var(--error); background: rgba(239,83,80,0.08);
                transform: rotate(90deg);
            }
            .appt-form {
                display: flex; flex-direction: column; gap: 18px;
            }
            .appt-form .form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .appt-form .form-label {
                font-family: 'Inter', sans-serif;
                font-size: 14px;
                font-weight: 600;
                color: var(--gold-700);
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .appt-form .form-row {
                display: flex; gap: 16px;
            }
            .appt-form .form-row .form-group { flex: 1; }
            .appt-form .form-input,
            .appt-form .appt-select {
                padding: 12px 16px;
                font-family: 'Inter', sans-serif;
                font-size: 0.92rem;
                border: 1px solid #E5DDCB;
                background-color: #FAFAF9;
                border-radius: 10px;
                width: 100%;
                color: var(--neutral-800);
                transition: all 0.25s ease;
                outline: none;
            }
            .appt-form .form-input:focus,
            .appt-form .appt-select:focus {
                background-color: #ffffff;
                border-color: var(--gold-500);
                box-shadow: 0 0 0 4px rgba(201, 168, 76, 0.15);
            }
            .appt-form .appt-select {
                appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23C9A84C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 16px center;
                padding-right: 38px;
                cursor: pointer;
            }
            .appt-form .form-error {
                font-size: 14px;
                color: #EF5350;
                display: none;
                margin-top: 4px;
            }
            .appt-form .form-error.visible {
                display: block;
            }
            .appt-form .form-input.error,
            .appt-form .appt-select.error {
                border-color: #EF5350;
                background-color: #FFEBEE;
            }
            .appt-form .modal-actions {
                margin-top: 16px;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            .appt-form .btn {
                padding: 12px 24px;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: 'Inter', sans-serif;
                letter-spacing: 0.8px;
                text-transform: uppercase;
            }
            .appt-form .btn-secondary {
                background: transparent;
                border: 1px solid var(--gold-400);
                color: var(--gold-700);
            }
            .appt-form .btn-secondary:hover {
                background: var(--gold-50);
                border-color: var(--gold-500);
                color: var(--gold-900);
                transform: translateY(-1px);
            }
            .appt-form .btn-primary {
                background: linear-gradient(135deg, var(--gold-500) 0%, var(--gold-600) 100%);
                border: none;
                color: #ffffff;
                box-shadow: 0 4px 12px rgba(201, 168, 76, 0.25);
            }
            .appt-form .btn-primary:hover {
                background: linear-gradient(135deg, var(--gold-400) 0%, var(--gold-500) 100%);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(201, 168, 76, 0.35);
            }
            .appt-form .btn-primary:active {
                transform: translateY(0);
            }
            .custom-select-dropdown {
                font-family: 'Inter', sans-serif;
            }
            .niche-group {
                border-bottom: 1px solid rgba(229, 221, 203, 0.4);
            }
            .niche-group:last-child {
                border-bottom: none;
            }
            .niche-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 18px;
                font-size: 14px;
                font-weight: 700;
                color: var(--gold-700);
                text-transform: uppercase;
                letter-spacing: 0.8px;
                background-color: #FAF9F6;
                cursor: pointer;
                user-select: none;
                transition: background-color 0.2s;
            }
            .niche-header:hover {
                background-color: #F5F3EC;
            }
            .niche-header-chevron {
                transition: transform 0.2s ease;
                display: flex;
                align-items: center;
                color: var(--gold-500);
            }
            .niche-group.niche-open .niche-header-chevron {
                transform: rotate(90deg);
            }
            .niche-options {
                display: none;
                flex-direction: column;
                background: #fff;
            }
            .niche-group.niche-open .niche-options {
                display: flex;
            }
            .custom-option-item {
                padding: 10px 24px 10px 32px;
                font-size: 0.9375rem;
                color: var(--neutral-700);
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .custom-option-item:hover {
                background-color: var(--gold-50);
                color: var(--gold-900);
                padding-left: 36px;
            }
            .custom-option-item.selected {
                background-color: rgba(201, 168, 76, 0.08);
                color: var(--gold-900);
                font-weight: 600;
            }
            .custom-option-price {
                font-weight: 600;
                color: var(--gold-600);
                font-size: 0.85rem;
            }
            @media (max-width: 480px) {
                .appt-modal-card { padding: 24px; }
                .appt-form .form-row { flex-direction: column; gap: 16px; }
            }
        `;
        document.head.appendChild(modalStyles);

        // Filter services dynamically when professional selection changes
        const profSelect = modal.querySelector('#apptProfessional');
        if (profSelect) {
            profSelect.addEventListener('change', () => {
                renderCustomServiceDropdown(modal);
            });
        }

        return modal;
    }

    /** Render custom collapsible services select dropdown tree */
    function renderCustomServiceDropdown(modalElement = document) {
        const dropdown = modalElement.querySelector('#apptServiceDropdown');
        const serviceSelect = modalElement.querySelector('#apptService');
        const serviceBtnLabel = modalElement.querySelector('#apptServiceBtnLabel');
        const serviceBtn = modalElement.querySelector('#apptServiceBtn');
        const profSelect = modalElement.querySelector('#apptProfessional');
        
        if (!dropdown || !serviceSelect) return;

        const selectedProfId = profSelect ? profSelect.value : '';
        let filteredServices = services;
        if (selectedProfId) {
            const prof = professionals.find(p => String(p.id) === String(selectedProfId));
            const profSpecialties = prof && prof.specialty 
                ? prof.specialty.split(',').map(sp => sp.trim().toLowerCase()) 
                : [];
            
            filteredServices = services.filter(s => {
                const isExplicit = Array.isArray(s.professionals) && s.professionals.includes(selectedProfId);
                const hasNiche = s.niche && profSpecialties.includes(s.niche.toLowerCase());
                return isExplicit || hasNiche;
            });
            // Fallback in case the selected professional has no associated services
            if (filteredServices.length === 0) {
                filteredServices = services;
            }
        }

        // Group services by niche (category)
        const servicesByNiche = {};
        filteredServices.forEach(s => {
            const niche = s.niche || 'Outros';
            if (!servicesByNiche[niche]) servicesByNiche[niche] = [];
            servicesByNiche[niche].push(s);
        });

        // 1. Re-populate the hidden native select options (for HTML5 validation/submits)
        let selectHTML = '<option value="">Selecione um serviço</option>';
        for (const [niche, list] of Object.entries(servicesByNiche)) {
            selectHTML += `<optgroup label="${niche}">`;
            selectHTML += list.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            selectHTML += `</optgroup>`;
        }
        serviceSelect.innerHTML = selectHTML;

        // 2. Build custom tree list (collapsed by default)
        let dropdownHTML = '';
        for (const [niche, list] of Object.entries(servicesByNiche)) {
            dropdownHTML += `
                <div class="niche-group" data-niche="${niche}">
                    <div class="niche-header">
                        <span>${niche}</span>
                        <span class="niche-header-chevron">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </span>
                    </div>
                    <div class="niche-options">
                        ${list.map(s => {
                            const priceText = parseFloat(s.price) === 0 ? 'A combinar' : formatCurrencyBRL(parseFloat(s.price));
                            return `
                                <div class="custom-option-item ${String(serviceSelect.value) === String(s.id) ? 'selected' : ''}" data-value="${s.id}">
                                    <span>${s.name}</span>
                                    <span class="custom-option-price">${priceText}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        dropdown.innerHTML = dropdownHTML;

        // 3. Set the button label text
        if (!serviceSelect.value) {
            if (serviceBtnLabel) serviceBtnLabel.textContent = 'Selecione um serviço';
        } else {
            const selectedSvc = filteredServices.find(s => String(s.id) === String(serviceSelect.value));
            if (selectedSvc) {
                if (serviceBtnLabel) {
                    const priceText = parseFloat(selectedSvc.price) === 0 ? 'A combinar' : formatCurrencyBRL(parseFloat(selectedSvc.price));
                    serviceBtnLabel.textContent = `${selectedSvc.name} (${priceText})`;
                }
            } else {
                // Currently selected service is not in filtered list, reset it
                serviceSelect.value = '';
                if (serviceBtnLabel) serviceBtnLabel.textContent = 'Selecione um serviço';
                
                // Clear price and duration preview
                const apptPrice = modalElement.querySelector('#apptPrice');
                if (apptPrice) apptPrice.value = '';
                
                const durationCard = modalElement.querySelector('#apptDurationInfoCard');
                if (durationCard) durationCard.style.display = 'none';
            }
        }

        // 4. Click handlers for category headers
        const groups = dropdown.querySelectorAll('.niche-group');
        groups.forEach(group => {
            const header = group.querySelector('.niche-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = group.classList.contains('niche-open');
                // Optional: close other groups to keep it neat
                groups.forEach(g => g.classList.remove('niche-open'));
                if (!isOpen) {
                    group.classList.add('niche-open');
                }
            });
        });

        // 5. Click handlers for option items
        const items = dropdown.querySelectorAll('.custom-option-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = item.dataset.value;
                serviceSelect.value = value;
                
                const selectedSvc = services.find(s => String(s.id) === String(value));
                if (selectedSvc && serviceBtnLabel) {
                    const priceText = parseFloat(selectedSvc.price) === 0 ? 'A combinar' : formatCurrencyBRL(parseFloat(selectedSvc.price));
                    serviceBtnLabel.textContent = `${selectedSvc.name} (${priceText})`;
                }
                
                items.forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                
                dropdown.style.display = 'none';

                // Dispatch events on the native hidden select to trigger duration and price calculation
                serviceSelect.dispatchEvent(new Event('input', { bubbles: true }));
                serviceSelect.dispatchEvent(new Event('change', { bubbles: true }));

                // Clear validation error on the button
                if (serviceBtn) {
                    serviceBtn.classList.remove('error');
                    const errEl = serviceBtn.closest('.form-group')?.querySelector('.form-error');
                    if (errEl) {
                        errEl.textContent = '';
                        errEl.classList.remove('visible');
                    }
                }
            });
        });
    }

    /** Open the new/edit appointment modal */
    let isOpeningModal = false;
    let editingApptId = null;
    async function openAppointmentModal(preselectedDate = null, preselectedClientObj = null, preselectedProfId = null, preselectedTime = null, editApptId = null) {
        if (!appointmentModal || isOpeningModal) return;
        
        isOpeningModal = true;
        document.body.style.cursor = 'wait';
        editingApptId = editApptId;

        // If editing an existing appointment, override inputs with database values
        let appt = null;
        if (editingApptId) {
            appt = appointments.find(a => String(a.id) === String(editingApptId));
            if (appt) {
                preselectedDate = appt.date;
                preselectedProfId = appt.professionalId;
                preselectedTime = appt.timeStart;
                
                const clientObj = clients.find(c => c.name.toLowerCase().trim() === appt.client.toLowerCase().trim());
                preselectedClientObj = clientObj || { name: appt.client, phone: appt.phone || '', level: 'Novo' };
            }
        }

        try {
            // Ensure we have fresh data before opening the modal
            try {
            const [freshProfs, freshSvcs, freshClis] = await Promise.all([
                loadProfessionals(), 
                loadServices(),
                loadClients()
            ]);
            professionals = freshProfs;
            services = freshSvcs;
            clients = freshClis;
            
            // Sync employees to get correct initials and colors for the dropdowns
            await syncRegisteredEmployees();
            populateMainFilters();
        } catch(e) {
            console.warn('Aviso ao carregar dados frescos para o agendamento:', e.message);
        }

        // Re-populate professional dropdown
        const profSelect = appointmentModal.querySelector('#apptProfessional');
        if (profSelect) {
            const currentSession = JSON.parse(sessionStorage.getItem('raiosol_session') || '{}');
            if (currentSession.role === 'funcionario') {
                const employeeProf = professionals.find(p => p.name.toLowerCase() === currentSession.name.toLowerCase());
                if (employeeProf) {
                    profSelect.innerHTML = `<option value="${employeeProf.id}" selected>${employeeProf.name}</option>`;
                    profSelect.disabled = true;
                } else {
                    profSelect.innerHTML = '<option value="">Profissional logado não encontrado</option>';
                    profSelect.disabled = true;
                }
            } else {
                // Admin view
                profSelect.disabled = false;
                profSelect.innerHTML = '<option value="">Selecione um profissional</option>' + 
                    professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
                if (preselectedProfId) {
                    profSelect.value = preselectedProfId;
                }
            }
        }

        // Re-populate second professional dropdown
        const profSelect2 = appointmentModal.querySelector('#apptProfessional2');
        if (profSelect2) {
            profSelect2.innerHTML = '<option value="">Selecione o segundo profissional</option>' + 
                professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            profSelect2.value = '';
        }

        // Reset mutual checkbox and hidden container
        const isMutualCheckbox = appointmentModal.querySelector('#apptIsMutual');
        const prof2Container = appointmentModal.querySelector('#apptProfessional2Container');
        if (isMutualCheckbox) isMutualCheckbox.checked = false;
        if (prof2Container) prof2Container.style.display = 'none';

        // Re-populate service dropdown and render the custom tree dropdown
        renderCustomServiceDropdown(appointmentModal);

        // Set default date
        const dateInput = appointmentModal.querySelector('#apptDate');
        if (dateInput) {
            let today = new Date();
            if (today.getDay() === 0) {
                today.setDate(today.getDate() + 1); // If today is Sunday, default to Monday
            }
            const todayStr = toISODateString(today);
            dateInput.min = todayStr;
            
            let initialDate = preselectedDate ? preselectedDate : todayStr;
            if (preselectedDate && preselectedDate < todayStr) {
                initialDate = todayStr;
            }
            
            const initialDateObj = new Date(initialDate + 'T00:00:00');
            if (initialDateObj.getDay() === 0) {
                initialDateObj.setDate(initialDateObj.getDate() + 1); // If target date is Sunday, shift to Monday
                initialDate = toISODateString(initialDateObj);
            }
            
            dateInput.value = initialDate;
        }

        // Reset time inputs first
        const timeInput = appointmentModal.querySelector('#apptTimeStart');
        const timeBtn = appointmentModal.querySelector('#apptTimeStartBtn');
        const endTimeInput = appointmentModal.querySelector('#apptTimeEnd');
        const endTimeBtn = appointmentModal.querySelector('#apptTimeEndBtn');
        if (timeInput && timeBtn) {
            timeInput.value = '';
            timeBtn.value = '';
        }
        if (endTimeInput && endTimeBtn) {
            endTimeInput.value = '';
            endTimeBtn.value = '';
        }

        // Set preselected start time
        if (preselectedTime && timeInput && timeBtn) {
            timeInput.value = preselectedTime;
            timeBtn.value = preselectedTime;
            timeBtn.classList.remove('error');
        }

        // Re-render time slots based on selected date
        if (typeof renderTimeSlotsDropdown === 'function') {
            renderTimeSlotsDropdown();
        }

        // Pre-select client if provided
        const clientInput = appointmentModal.querySelector('#apptClient');
        const previewCard = appointmentModal.querySelector('#apptClientPreviewCard');
        if (preselectedClientObj && clientInput && previewCard) {
            const previewAvatar = appointmentModal.querySelector('#apptClientPreviewAvatar');
            const previewName = appointmentModal.querySelector('#apptClientPreviewName');
            const previewPhone = appointmentModal.querySelector('#apptClientPreviewPhone');
            const previewTag = appointmentModal.querySelector('#apptClientPreviewTag');

            clientInput.value = preselectedClientObj.name;
            
            const initials = preselectedClientObj.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const avatarColor = getClientAvatarColor(preselectedClientObj.name);
            
            if (preselectedClientObj.avatar) {
                previewAvatar.style.background = 'none';
                previewAvatar.style.border = 'none';
                previewAvatar.style.color = 'inherit';
                previewAvatar.innerHTML = `<img src="${preselectedClientObj.avatar}" alt="${preselectedClientObj.name}">`;
            } else {
                previewAvatar.style.background = avatarColor;
                previewAvatar.style.border = 'none';
                previewAvatar.style.color = '#ffffff';
                previewAvatar.innerHTML = `<span>${initials}</span>`;
            }
            
            previewName.textContent = preselectedClientObj.name;
            previewPhone.textContent = preselectedClientObj.phone || '';
            
            let tagClass = 'autocomplete-tag--fregues';
            const lvl = (preselectedClientObj.level || 'Novo').toUpperCase();
            if (lvl === 'VIP') tagClass = 'autocomplete-tag--vip';
            else if (lvl === 'NOVO') tagClass = 'autocomplete-tag--novo';
            
            previewTag.className = 'autocomplete-tag ' + tagClass;
            previewTag.textContent = preselectedClientObj.level === 'Freguês (Regular)' ? 'Freguês' : (preselectedClientObj.level || 'Regular');
            
            // Transition states: hide input container, show preview card
            clientInput.parentElement.style.display = 'none';
            previewCard.style.display = 'flex';
        } else {
            if (clientInput) {
                clientInput.value = '';
                clientInput.parentElement.style.display = 'block';
            }
            if (previewCard) {
                previewCard.style.display = 'none';
            }
        }

        // Edit Mode Pre-populations & UI changes
        if (appt) {
            // Set preselected end time
            if (appt.timeEnd && endTimeInput && endTimeBtn) {
                endTimeInput.value = appt.timeEnd;
                endTimeBtn.value = appt.timeEnd;
                endTimeBtn.classList.remove('error');
            }

            // Select service
            const serviceSelect = appointmentModal.querySelector('#apptService');
            if (serviceSelect) {
                serviceSelect.value = appt.serviceId;
                renderCustomServiceDropdown(appointmentModal);
            }

            // Set price
            const apptPriceInput = appointmentModal.querySelector('#apptPrice');
            if (apptPriceInput) {
                apptPriceInput.value = formatCurrencyBRL(appt.servicePrice);
            }

            // Mutual work setup
            if (appt.isMutual) {
                if (isMutualCheckbox) isMutualCheckbox.checked = true;
                if (prof2Container) prof2Container.style.display = 'block';
                if (profSelect2) profSelect2.value = appt.professionalId2;
            }

            // Calculate & display duration preview card
            if (typeof updateEstimatedEndTime === 'function') {
                updateEstimatedEndTime();
            }
        }

        // Update titles & buttons based on mode
        const modalTitle = appointmentModal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = editingApptId ? 'Editar Agendamento' : 'Novo Agendamento';
        }
        const submitBtnText = appointmentModal.querySelector('.appt-submit-btn .btn-text');
        if (submitBtnText) {
            submitBtnText.textContent = editingApptId ? 'SALVAR ALTERAÇÕES' : 'AGENDAR';
        }

        appointmentModal.classList.add('active');
    } finally {
        document.body.style.cursor = '';
        isOpeningModal = false;
    }
}

/** Close the new appointment modal */
function closeAppointmentModal() {
    if (!appointmentModal) return;
    appointmentModal.classList.remove('active');
    editingApptId = null;

        // Reset form and errors
        const form = appointmentModal.querySelector('#newAppointmentForm');
        if (form) form.reset();

        const prof2Container = appointmentModal.querySelector('#apptProfessional2Container');
        if (prof2Container) prof2Container.style.display = 'none';

        appointmentModal.querySelectorAll('.form-error').forEach(err => {
            err.textContent = '';
            err.classList.remove('visible');
        });
        appointmentModal.querySelectorAll('.form-input').forEach(inp => {
            inp.classList.remove('error');
        });

        // Hide dynamic preview and autocomplete lists
        const durationCard = appointmentModal.querySelector('#apptDurationInfoCard');
        if (durationCard) durationCard.style.display = 'none';
        const clientDropdown = appointmentModal.querySelector('#apptClientAutocomplete');
        if (clientDropdown) clientDropdown.style.display = 'none';

        // Reset custom Selected Client Preview Card
        const clientInput = appointmentModal.querySelector('#apptClient');
        const previewCard = appointmentModal.querySelector('#apptClientPreviewCard');
        if (clientInput) {
            clientInput.value = '';
            clientInput.parentElement.style.display = 'block';
        }
        if (previewCard) {
            previewCard.style.display = 'none';
        }

        // Reset custom Time Dropdown
        const timeBtn = appointmentModal.querySelector('#apptTimeStartBtn');
        const timeInput = appointmentModal.querySelector('#apptTimeStart');
        const timeDropdown = appointmentModal.querySelector('#apptTimeStartDropdown');
        if (timeBtn) {
            timeBtn.value = '';
            timeBtn.classList.remove('error');
        }
        if (timeInput) timeInput.value = '';
        if (timeDropdown) {
            timeDropdown.style.display = 'none';
            timeDropdown.querySelectorAll('.time-slot-item').forEach(el => el.classList.remove('active'));
        }

        // Reset custom Service Dropdown
        const serviceBtn = appointmentModal.querySelector('#apptServiceBtn');
        const serviceBtnLabel = appointmentModal.querySelector('#apptServiceBtnLabel');
        const serviceInput = appointmentModal.querySelector('#apptService');
        const serviceDropdown = appointmentModal.querySelector('#apptServiceDropdown');
        if (serviceBtn) {
            serviceBtn.classList.remove('error');
        }
        if (serviceBtnLabel) {
            serviceBtnLabel.textContent = 'Selecione um serviço';
        }
        if (serviceInput) serviceInput.value = '';
        const apptPriceInput = appointmentModal.querySelector('#apptPrice');
        if (apptPriceInput) {
            apptPriceInput.value = '';
        }
        if (serviceDropdown) {
            serviceDropdown.style.display = 'none';
            serviceDropdown.querySelectorAll('.custom-option-item').forEach(el => el.classList.remove('selected'));
            serviceDropdown.querySelectorAll('.niche-group').forEach(el => el.classList.remove('niche-open'));
        }
    }

    // Button click to open
    if (newApptBtn) {
        newApptBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openAppointmentModal();
        });
    }

    // Close on overlay click
    if (appointmentModal) {
        appointmentModal.addEventListener('click', (e) => {
            if (e.target === appointmentModal) closeAppointmentModal();
        });

        // Close button
        const closeBtn = appointmentModal.querySelector('.appt-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeAppointmentModal);

        // Cancel button
        const cancelBtn = appointmentModal.querySelector('.appt-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeAppointmentModal);

        // Date navigation setas (Dia Anterior / Seguinte)
        const dateInput = appointmentModal.querySelector('#apptDate');
        const btnPrevDate = appointmentModal.querySelector('#btnPrevDate');
        const btnNextDate = appointmentModal.querySelector('#btnNextDate');

        if (dateInput && btnPrevDate && btnNextDate) {
            const shiftDate = (days) => {
                if (!dateInput.value) return;
                const currentDate = new Date(dateInput.value + 'T00:00:00');
                if (isNaN(currentDate.getTime())) return;
                currentDate.setDate(currentDate.getDate() + days);

                if (currentDate.getDay() === 0) { // Sunday
                    currentDate.setDate(currentDate.getDate() + (days > 0 ? 1 : -1));
                }
                
                const todayStr = toISODateString(new Date());
                const newDateStr = toISODateString(currentDate);
                if (newDateStr < todayStr) {
                    showToast('Não é possível selecionar uma data no passado.', 'warning');
                    return;
                }
                
                dateInput.value = newDateStr;
                dateInput.dispatchEvent(new Event('input'));
                dateInput.dispatchEvent(new Event('change'));
            };

            btnPrevDate.addEventListener('click', (e) => {
                e.stopPropagation();
                shiftDate(-1);
            });

            btnNextDate.addEventListener('click', (e) => {
                e.stopPropagation();
                shiftDate(1);
            });

            // Prevent manual input of past dates and update time slots
            dateInput.addEventListener('change', () => {
                const todayStr = toISODateString(new Date());
                if (dateInput.value && dateInput.value < todayStr) {
                    showToast('Não é possível selecionar uma data no passado.', 'warning');
                    dateInput.value = todayStr;
                }

                // If Sunday is selected, warn the user and adjust to Monday
                if (dateInput.value) {
                    const selDate = new Date(dateInput.value + 'T00:00:00');
                    if (selDate.getDay() === 0) {
                        showToast('O estúdio não abre aos domingos.', 'warning');
                        selDate.setDate(selDate.getDate() + 1);
                        dateInput.value = toISODateString(selDate);
                    }
                }

                if (typeof renderTimeSlotsDropdown === 'function') {
                    renderTimeSlotsDropdown();
                }
            });
        }

        // Toggle Segundo Profissional visibility on checkbox change
        const isMutualCheckbox = appointmentModal.querySelector('#apptIsMutual');
        const prof2Container = appointmentModal.querySelector('#apptProfessional2Container');
        const profSelect2 = appointmentModal.querySelector('#apptProfessional2');

        if (isMutualCheckbox && prof2Container) {
            isMutualCheckbox.addEventListener('change', () => {
                if (isMutualCheckbox.checked) {
                    prof2Container.style.display = 'flex';
                } else {
                    prof2Container.style.display = 'none';
                    if (profSelect2) profSelect2.value = '';
                }
            });
        }

        // Client Autocomplete Logic & Preview Card
        const clientInput = appointmentModal.querySelector('#apptClient');
        const dropdown = appointmentModal.querySelector('#apptClientAutocomplete');
        const previewCard = appointmentModal.querySelector('#apptClientPreviewCard');
        const previewAvatar = appointmentModal.querySelector('#apptClientPreviewAvatar');
        const previewName = appointmentModal.querySelector('#apptClientPreviewName');
        const previewPhone = appointmentModal.querySelector('#apptClientPreviewPhone');
        const previewTag = appointmentModal.querySelector('#apptClientPreviewTag');
        const btnRemovePreview = appointmentModal.querySelector('#btnRemoveClientPreview');

        let activeItemIndex = -1;

        if (clientInput && dropdown) {

            const normalizeString = (str) => {
                if (!str) return '';
                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            };

            const selectClient = (clientObj) => {
                clientInput.value = clientObj.name;
                
                const initials = clientObj.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const avatarColor = getClientAvatarColor(clientObj.name);
                
                if (clientObj.avatar) {
                    previewAvatar.style.background = 'none';
                    previewAvatar.style.border = 'none';
                    previewAvatar.style.color = 'inherit';
                    previewAvatar.innerHTML = `<img src="${clientObj.avatar}" alt="${clientObj.name}">`;
                } else {
                    previewAvatar.style.background = avatarColor;
                    previewAvatar.style.border = 'none';
                    previewAvatar.style.color = '#ffffff';
                    previewAvatar.innerHTML = `<span>${initials}</span>`;
                }
                
                previewName.textContent = clientObj.name;
                previewPhone.textContent = clientObj.phone || '';
                
                let tagClass = 'autocomplete-tag--fregues';
                const lvl = (clientObj.level || 'Novo').toUpperCase();
                if (lvl === 'VIP') tagClass = 'autocomplete-tag--vip';
                else if (lvl === 'NOVO') tagClass = 'autocomplete-tag--novo';
                
                previewTag.className = 'autocomplete-tag ' + tagClass;
                previewTag.textContent = clientObj.level === 'Freguês (Regular)' ? 'Freguês' : (clientObj.level || 'Regular');
                
                // Transition states: hide input container, show preview card
                clientInput.parentElement.style.display = 'none';
                previewCard.style.display = 'flex';
                dropdown.style.display = 'none';

                // Clear any validation errors
                clientInput.classList.remove('error');
                const errEl = clientInput.closest('.form-group')?.querySelector('.form-error');
                if (errEl) {
                    errEl.textContent = '';
                    errEl.classList.remove('visible');
                }
            };

            if (btnRemovePreview) {
                btnRemovePreview.addEventListener('click', (e) => {
                    e.stopPropagation();
                    clientInput.value = '';
                    previewCard.style.display = 'none';
                    clientInput.parentElement.style.display = 'block';
                    setTimeout(() => clientInput.focus(), 50);
                });
            }

            const renderAutocomplete = (query) => {
                const normalizedQuery = normalizeString(query);
                if (!normalizedQuery) {
                    dropdown.style.display = 'none';
                    return;
                }

                const matches = clients
                    .filter(c => normalizeString(c.name).includes(normalizedQuery))
                    .slice(0, 5);

                activeItemIndex = -1;

                if (matches.length === 0) {
                    dropdown.innerHTML = '<div style="padding: 10px 14px; font-size: 15px; color: var(--neutral-500); text-align: center;">Nenhum cliente com este nome</div>';
                    dropdown.style.display = 'block';
                    return;
                }

                dropdown.innerHTML = matches.map((c, index) => {
                    const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const avatarColor = getClientAvatarColor(c.name);
                    
                    const avatarHTML = c.avatar 
                        ? `<div class="autocomplete-avatar" style="background: none; border: none; color: inherit;"><img src="${c.avatar}" alt="${c.name}"></div>`
                        : `<div class="autocomplete-avatar" style="background: ${avatarColor}; border: none; color: #ffffff;"><span>${initials}</span></div>`;
                    
                    let tagClass = 'autocomplete-tag--fregues';
                    const lvl = (c.level || 'Novo').toUpperCase();
                    if (lvl === 'VIP') tagClass = 'autocomplete-tag--vip';
                    else if (lvl === 'NOVO') tagClass = 'autocomplete-tag--novo';

                    return `
                        <div class="autocomplete-item" data-name="${c.name}" data-index="${index}">
                            ${avatarHTML}
                            <div class="autocomplete-info">
                                <span class="autocomplete-name">${c.name}</span>
                                <span class="autocomplete-phone">${c.phone || ''}</span>
                            </div>
                            <span class="autocomplete-tag ${tagClass}">${c.level === 'Freguês (Regular)' ? 'Freguês' : (c.level || 'Regular')}</span>
                        </div>
                    `;
                }).join('');
                dropdown.style.display = 'block';

                // Bind click handlers
                dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const clientObj = matches[parseInt(item.dataset.index)];
                        if (clientObj) {
                            selectClient(clientObj);
                        }
                    });
                });
            };

            clientInput.addEventListener('input', (e) => {
                renderAutocomplete(clientInput.value);
            });

            clientInput.addEventListener('focus', (e) => {
                renderAutocomplete(clientInput.value);
            });

            clientInput.addEventListener('keydown', (e) => {
                const items = dropdown.querySelectorAll('.autocomplete-item');
                if (dropdown.style.display === 'block' && items.length > 0) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeItemIndex = (activeItemIndex + 1) % items.length;
                        items.forEach((item, idx) => {
                            if (idx === activeItemIndex) {
                                item.classList.add('active');
                                item.scrollIntoView({ block: 'nearest' });
                            } else {
                                item.classList.remove('active');
                            }
                        });
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeItemIndex = (activeItemIndex - 1 + items.length) % items.length;
                        items.forEach((item, idx) => {
                            if (idx === activeItemIndex) {
                                item.classList.add('active');
                                item.scrollIntoView({ block: 'nearest' });
                            } else {
                                item.classList.remove('active');
                            }
                        });
                    } else if (e.key === 'Enter') {
                        if (activeItemIndex !== -1) {
                            e.preventDefault();
                            const matches = clients.filter(c => normalizeString(c.name).includes(normalizeString(clientInput.value))).slice(0, 5);
                            const clientObj = matches[activeItemIndex];
                            if (clientObj) {
                                selectClient(clientObj);
                            }
                        }
                    } else if (e.key === 'Escape') {
                        dropdown.style.display = 'none';
                        clientInput.blur();
                    }
                }
            });

            // Click outside to close dropdown
            document.addEventListener('click', (e) => {
                if (!clientInput.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });
        }

        // Custom Time Dropdown Picker Logic
        const timeBtn = appointmentModal.querySelector('#apptTimeStartBtn');
        const timeInput = appointmentModal.querySelector('#apptTimeStart');
        const timeDropdown = appointmentModal.querySelector('#apptTimeStartDropdown');

        renderTimeSlotsDropdown = function() {
            if (!timeBtn || !timeInput || !timeDropdown) return;

            const morningSlots = [];
            for (let h = 8; h < 12; h++) {
                for (let m = 0; m < 60; m += 30) {
                    morningSlots.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
                }
            }

            const afternoonSlots = [];
            for (let h = 12; h < 18; h++) {
                for (let m = 0; m < 60; m += 30) {
                    afternoonSlots.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
                }
            }

            const eveningSlots = [];
            for (let h = 18; h < 20; h++) {
                for (let m = 0; m < 60; m += 30) {
                    eveningSlots.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
                }
            }

            const dateInput = appointmentModal.querySelector('#apptDate');
            const todayStr = toISODateString(new Date());
            const isToday = dateInput && dateInput.value === todayStr;

            // Get current time to compare
            const now = new Date();
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();

            const isSlotInPast = (slotStr) => {
                if (!isToday) return false;
                const [slotHour, slotMin] = slotStr.split(':').map(Number);
                if (slotHour < currentHour) return true;
                if (slotHour === currentHour && slotMin < currentMin) return true;
                return false;
            };

            // If the selected date is today and the currently selected time is in the past, reset it
            if (isToday && timeInput.value && isSlotInPast(timeInput.value)) {
                timeInput.value = '';
                timeBtn.value = '';
                if (typeof updateEstimatedEndTime === 'function') {
                    updateEstimatedEndTime();
                }
            }

            const mapSlotHtml = (slot) => {
                const inPast = isSlotInPast(slot);
                if (inPast) {
                    return `
                        <div class="time-slot-item disabled" style="opacity: 0.35; cursor: not-allowed; text-decoration: line-through; pointer-events: none;">
                            <span>${slot}</span>
                        </div>
                    `;
                }
                const isActive = timeInput.value === slot ? ' active' : '';
                return `
                    <div class="time-slot-item${isActive}" data-value="${slot}">
                        <span>${slot}</span>
                    </div>
                `;
            };

            timeDropdown.innerHTML = `
                <div class="time-picker-content">
                    <div class="time-picker-section">
                        <div class="time-picker-section-header">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; color: var(--gold-500);"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            <span>Manhã</span>
                        </div>
                        <div class="time-picker-grid">
                            ${morningSlots.map(mapSlotHtml).join('')}
                        </div>
                    </div>
                    <div class="time-picker-section">
                        <div class="time-picker-section-header">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; color: var(--gold-500);"><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.9 10.3A5 5 0 0 0 12 9a5 5 0 0 0-4 2.2M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-4.5s-4.5 0-5.5 1.5M5 15a4 4 0 0 0 0 8h10a4 4 0 0 0 0-8H5z"/></svg>
                            <span>Tarde</span>
                        </div>
                        <div class="time-picker-grid">
                            ${afternoonSlots.map(mapSlotHtml).join('')}
                        </div>
                    </div>
                    <div class="time-picker-section">
                        <div class="time-picker-section-header">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; color: var(--gold-500);"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            <span>Noite</span>
                        </div>
                        <div class="time-picker-grid">
                            ${eveningSlots.map(mapSlotHtml).join('')}
                        </div>
                    </div>
                </div>
            `;

            // Re-attach slot item click listeners
            timeDropdown.querySelectorAll('.time-slot-item:not(.disabled)').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const selectedSlot = item.dataset.value;
                    timeInput.value = selectedSlot;
                    timeBtn.value = selectedSlot;
                    
                    // Compute default end time based on selected start time and service
                    if (svcSelect.value) {
                        const svc = services.find(s => String(s.id) === String(svcSelect.value));
                        if (svc) {
                            const [startHour, startMin] = selectedSlot.split(':').map(Number);
                            const startTotalMins = startHour * 60 + startMin;
                            const endTotalMins = startTotalMins + svc.duration;
                            const endHour = Math.floor(endTotalMins / 60);
                            const endMin = endTotalMins % 60;
                            const formattedEndTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
                            endTimeInput.value = formattedEndTime;
                            endTimeBtn.value = formattedEndTime;
                        }
                    }
                    updateEstimatedEndTime();
                });
            });
        };

        if (timeBtn && timeInput && timeDropdown) {
            renderTimeSlotsDropdown();

            timeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                renderTimeSlotsDropdown();
                const isOpen = timeDropdown.style.display === 'block';
                timeDropdown.style.display = isOpen ? 'none' : 'block';
                if (endTimeDropdown) endTimeDropdown.style.display = 'none';
            });

            // Format typed input in real-time
            timeBtn.addEventListener('input', (e) => {
                let val = timeBtn.value.replace(/\D/g, '');
                if (val.length > 2) {
                    val = val.substring(0, 2) + ':' + val.substring(2, 4);
                }
                timeBtn.value = val;

                if (/^[0-2][0-9]:[0-5][0-9]$/.test(val)) {
                    timeInput.value = val;
                    timeBtn.classList.remove('error');
                    const errEl = timeBtn.closest('.form-group')?.querySelector('.form-error');
                    if (errEl) {
                        errEl.textContent = '';
                        errEl.classList.remove('visible');
                    }

                    // Auto-compute end time based on typed start time and service
                    const activeSvcSelect = appointmentModal.querySelector('#apptService');
                    if (activeSvcSelect && activeSvcSelect.value) {
                        const svc = services.find(s => String(s.id) === String(activeSvcSelect.value));
                        if (svc) {
                            const [startHour, startMin] = val.split(':').map(Number);
                            const startTotalMins = startHour * 60 + startMin;
                            const endTotalMins = startTotalMins + svc.duration;
                            const endHour = Math.floor(endTotalMins / 60);
                            const endMin = endTotalMins % 60;
                            const formattedEndTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
                            if (endTimeInput && endTimeBtn) {
                                endTimeInput.value = formattedEndTime;
                                endTimeBtn.value = formattedEndTime;
                            }
                        }
                    }

                    updateEstimatedEndTime();
                } else {
                    timeInput.value = '';
                }
            });

            document.addEventListener('click', (e) => {
                if (!timeBtn.contains(e.target) && !timeDropdown.contains(e.target)) {
                    timeDropdown.style.display = 'none';
                }
            });
        }

        // Setup price input formatting and behavior
        const apptPriceInput = appointmentModal.querySelector('#apptPrice');
        if (apptPriceInput) {
            apptPriceInput.value = '';
            
            apptPriceInput.addEventListener('input', (e) => {
                let val = e.target.value;
                if (val.toLowerCase().includes('combinar')) return;
                let cleanVal = val.replace(/[^\d]/g, '');
                if (!cleanVal) {
                    e.target.value = '';
                    return;
                }
                const num = parseFloat(cleanVal) / 100;
                e.target.value = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            });
            apptPriceInput.addEventListener('focus', (e) => {
                if (e.target.value === 'A combinar') {
                    e.target.value = '';
                }
            });
            apptPriceInput.addEventListener('blur', (e) => {
                if (e.target.value === 'R$\u00A00,00' || e.target.value === 'R$ 0,00' || !e.target.value) {
                    e.target.value = 'A combinar';
                }
            });
        }

        const endTimeBtn = appointmentModal.querySelector('#apptTimeEndBtn');
        const endTimeInput = appointmentModal.querySelector('#apptTimeEnd');
        const endTimeDropdown = appointmentModal.querySelector('#apptTimeEndDropdown');

        const renderEndTimeSlotsDropdown = function() {
            if (!endTimeBtn || !endTimeInput || !endTimeDropdown) return;

            const morningEndSlots = [];
            for (let h = 8; h < 12; h++) {
                for (let m = 30; m <= 60; m += 30) {
                    const hourStr = (m === 60 ? h + 1 : h);
                    const minStr = (m === 60 ? 0 : m);
                    morningEndSlots.push(String(hourStr).padStart(2, '0') + ':' + String(minStr).padStart(2, '0'));
                }
            }

            const afternoonEndSlots = [];
            for (let h = 12; h < 18; h++) {
                for (let m = 30; m <= 60; m += 30) {
                    const hourStr = (m === 60 ? h + 1 : h);
                    const minStr = (m === 60 ? 0 : m);
                    afternoonEndSlots.push(String(hourStr).padStart(2, '0') + ':' + String(minStr).padStart(2, '0'));
                }
            }

            const eveningEndSlots = [];
            for (let h = 18; h < 20; h++) {
                for (let m = 30; m <= 60; m += 30) {
                    const hourStr = (m === 60 ? h + 1 : h);
                    const minStr = (m === 60 ? 0 : m);
                    eveningEndSlots.push(String(hourStr).padStart(2, '0') + ':' + String(minStr).padStart(2, '0'));
                }
            }

            const mapEndSlotHtml = (slot) => {
                const isActive = endTimeInput.value === slot ? ' active' : '';
                return `
                    <div class="time-slot-item${isActive}" data-value="${slot}">
                        <span>${slot}</span>
                    </div>
                `;
            };

            endTimeDropdown.innerHTML = `
                <div class="time-picker-content">
                    <div class="time-picker-section">
                        <div class="time-picker-section-header"><span>Manhã</span></div>
                        <div class="time-picker-grid">
                            ${morningEndSlots.map(mapEndSlotHtml).join('')}
                        </div>
                    </div>
                    <div class="time-picker-section">
                        <div class="time-picker-section-header"><span>Tarde</span></div>
                        <div class="time-picker-grid">
                            ${afternoonEndSlots.map(mapEndSlotHtml).join('')}
                        </div>
                    </div>
                    <div class="time-picker-section">
                        <div class="time-picker-section-header"><span>Noite</span></div>
                        <div class="time-picker-grid">
                            ${eveningEndSlots.map(mapEndSlotHtml).join('')}
                        </div>
                    </div>
                </div>
            `;

            // Click listeners for end time slots
            endTimeDropdown.querySelectorAll('.time-slot-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const selectedSlot = item.dataset.value;
                    endTimeInput.value = selectedSlot;
                    endTimeBtn.value = selectedSlot;
                    endTimeDropdown.querySelectorAll('.time-slot-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    endTimeDropdown.style.display = 'none';

                    endTimeBtn.classList.remove('error');
                    const errEl = endTimeBtn.closest('.form-group')?.querySelector('.form-error');
                    if (errEl) {
                        errEl.textContent = '';
                        errEl.classList.remove('visible');
                    }

                    // Trigger estimated end time updates
                    updateEstimatedEndTime();
                });
            });
        };

        if (endTimeBtn && endTimeInput && endTimeDropdown) {
            renderEndTimeSlotsDropdown();

            endTimeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                renderEndTimeSlotsDropdown();
                const isOpen = endTimeDropdown.style.display === 'block';
                endTimeDropdown.style.display = isOpen ? 'none' : 'block';
                if (timeDropdown) timeDropdown.style.display = 'none';
            });

            // Format typed input in real-time
            endTimeBtn.addEventListener('input', (e) => {
                let val = endTimeBtn.value.replace(/\D/g, '');
                if (val.length > 2) {
                    val = val.substring(0, 2) + ':' + val.substring(2, 4);
                }
                endTimeBtn.value = val;

                if (/^[0-2][0-9]:[0-5][0-9]$/.test(val)) {
                    endTimeInput.value = val;
                    endTimeBtn.classList.remove('error');
                    const errEl = endTimeBtn.closest('.form-group')?.querySelector('.form-error');
                    if (errEl) {
                        errEl.textContent = '';
                        errEl.classList.remove('visible');
                    }
                    updateEstimatedEndTime();
                } else {
                    endTimeInput.value = '';
                }
            });

            document.addEventListener('click', (e) => {
                if (!endTimeBtn.contains(e.target) && !endTimeDropdown.contains(e.target)) {
                    endTimeDropdown.style.display = 'none';
                }
            });
        }

        // Custom Service Dropdown Picker Logic
        const serviceBtn = appointmentModal.querySelector('#apptServiceBtn');
        const serviceDropdown = appointmentModal.querySelector('#apptServiceDropdown');

        if (serviceBtn && serviceDropdown) {
            serviceBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = serviceDropdown.style.display === 'block';
                serviceDropdown.style.display = isOpen ? 'none' : 'block';
            });

            document.addEventListener('click', (e) => {
                if (!serviceBtn.contains(e.target) && !serviceDropdown.contains(e.target)) {
                    serviceDropdown.style.display = 'none';
                }
            });
        }

        // Dynamic End Time and Duration calculation
        const svcSelect = appointmentModal.querySelector('#apptService');
        const durationInfoCard = appointmentModal.querySelector('#apptDurationInfoCard');
        const cardValue = appointmentModal.querySelector('#apptDurationCardValue');
        const cardLabel = appointmentModal.querySelector('#apptDurationCardLabel');

        function updateEstimatedEndTime() {
            if (!svcSelect.value || !timeInput.value || !endTimeInput.value) {
                durationInfoCard.style.display = 'none';
                return;
            }

            const [startHour, startMin] = timeInput.value.split(':').map(Number);
            const [endHour, endMin] = endTimeInput.value.split(':').map(Number);
            
            const startTotalMins = startHour * 60 + startMin;
            const endTotalMins = endHour * 60 + endMin;
            const duration = endTotalMins - startTotalMins;

            const hours = Math.floor(duration / 60);
            const mins = duration % 60;
            const durationText = (hours > 0 ? `${hours}h ` : '') + (mins > 0 ? `${mins}min` : '');

            if (endTotalMins > 20 * 60) {
                durationInfoCard.classList.add('warning');
                cardLabel.textContent = 'Alerta de Expediente';
                cardValue.innerHTML = `${durationText} — <strong>Atenção: Excede o horário de encerramento do salão (20:00) às ${endTimeInput.value}!</strong>`;
            } else if (duration <= 0) {
                durationInfoCard.classList.add('warning');
                cardLabel.textContent = 'Aviso de Horário';
                cardValue.innerHTML = `<strong>Atenção: Horário de término deve ser posterior ao horário de início!</strong>`;
            } else {
                durationInfoCard.classList.remove('warning');
                cardLabel.textContent = 'Duração estimada';
                cardValue.textContent = `${durationText} (término às ${endTimeInput.value})`;
            }

            durationInfoCard.style.display = 'flex';
        }

        svcSelect.addEventListener('change', () => {
            const svc = services.find(s => String(s.id) === String(svcSelect.value));
            if (svc) {
                if (timeInput.value) {
                    const [startHour, startMin] = timeInput.value.split(':').map(Number);
                    const startTotalMins = startHour * 60 + startMin;
                    const endTotalMins = startTotalMins + svc.duration;
                    const endHour = Math.floor(endTotalMins / 60);
                    const endMin = endTotalMins % 60;
                    const formattedEndTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
                    endTimeInput.value = formattedEndTime;
                    endTimeBtn.value = formattedEndTime;
                }
                // Pre-populate price field
                const apptPriceInput = appointmentModal.querySelector('#apptPrice');
                if (apptPriceInput) {
                    const pVal = parseFloat(svc.price) || 0;
                    if (pVal === 0) {
                        apptPriceInput.value = 'A combinar';
                    } else {
                        apptPriceInput.value = formatCurrencyBRL(pVal);
                    }
                }
            }
            updateEstimatedEndTime();
        });
    }

    // ============================================
    // SECTION 11: APPOINTMENT FORM VALIDATION & SUBMISSION
    // ============================================

    const apptForm = document.querySelector('#newAppointmentForm');

    if (apptForm) {
        // Clear errors on input
        apptForm.querySelectorAll('.form-input, .appt-select').forEach(input => {
            input.addEventListener('input', () => {
                input.classList.remove('error');
                const errEl = input.closest('.form-group')?.querySelector('.form-error');
                if (errEl) {
                    errEl.textContent = '';
                    errEl.classList.remove('visible');
                }
            });
            input.addEventListener('change', () => {
                input.classList.remove('error');
                const errEl = input.closest('.form-group')?.querySelector('.form-error');
                if (errEl) {
                    errEl.textContent = '';
                    errEl.classList.remove('visible');
                }
            });
        });

        apptForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const professional = document.getElementById('apptProfessional');
            const client       = document.getElementById('apptClient');
            const service      = document.getElementById('apptService');
            const date         = document.getElementById('apptDate');
            const timeStart    = document.getElementById('apptTimeStart');

            let isValid = true;

            // Helper to show field error
            const showFieldError = (input, errorId, msg) => {
                input.classList.add('error');
                const errEl = document.getElementById(errorId);
                if (errEl) {
                    errEl.textContent = msg;
                    errEl.classList.add('visible');
                }
                isValid = false;
            };

            // Clear all errors
            apptForm.querySelectorAll('.form-error').forEach(err => {
                err.textContent = '';
                err.classList.remove('visible');
            });
            apptForm.querySelectorAll('.form-input').forEach(inp => inp.classList.remove('error'));

            // Validate Professional
            if (!professional.value) {
                showFieldError(professional, 'apptProfessionalError', 'Selecione um profissional');
            }

            // Validate Mutual Professional
            const isMutual = document.getElementById('apptIsMutual')?.checked || false;
            const professional2 = document.getElementById('apptProfessional2');
            
            if (isMutual) {
                if (!professional2.value) {
                    showFieldError(professional2, 'apptProfessional2Error', 'Selecione o segundo profissional');
                } else if (String(professional2.value) === String(professional.value)) {
                    showFieldError(professional2, 'apptProfessional2Error', 'O segundo profissional deve ser diferente do primeiro');
                }
            }

            // Validate Client
            if (!client.value.trim()) {
                showFieldError(client, 'apptClientError', 'Informe o nome do cliente');
            } else if (client.value.trim().length < 2) {
                showFieldError(client, 'apptClientError', 'Nome deve ter pelo menos 2 caracteres');
            }

            // Validate Service
            if (!service.value) {
                const serviceBtn = document.getElementById('apptServiceBtn');
                showFieldError(serviceBtn || service, 'apptServiceError', 'Selecione um serviço');
            }

            // Validate Date
            if (!date.value) {
                showFieldError(date, 'apptDateError', 'Informe a data');
            } else {
                const todayStr = toISODateString(new Date());
                if (date.value < todayStr) {
                    showFieldError(date, 'apptDateError', 'Não é possível agendar em datas passadas');
                } else {
                    const selectedDate = new Date(date.value + 'T00:00:00');
                    if (selectedDate.getDay() === 0) {
                        showFieldError(date, 'apptDateError', 'O estúdio não abre aos domingos');
                    }
                }
            }

            // Validate Time Start
            if (!timeStart.value) {
                const timeBtn = document.getElementById('apptTimeStartBtn');
                showFieldError(timeBtn || timeStart, 'apptTimeStartError', 'Informe o horário de início');
            } else {
                const todayStr = toISODateString(new Date());
                if (date.value === todayStr) {
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();
                    const [slotHour, slotMin] = timeStart.value.split(':').map(Number);
                    if (slotHour < currentHour || (slotHour === currentHour && slotMin < currentMin)) {
                        const timeBtn = document.getElementById('apptTimeStartBtn');
                        showFieldError(timeBtn || timeStart, 'apptTimeStartError', 'Não é possível agendar em horários passados');
                    }
                }
            }

            if (!isValid) return;

            // Build appointment object
            const prof = professionals.find(p => String(p.id) === String(professional.value));
            const svc  = services.find(s => String(s.id) === String(service.value));

            const timeEnd = document.getElementById('apptTimeEnd');

            // Validate Time End
            if (!timeEnd.value) {
                const timeBtn = document.getElementById('apptTimeEndBtn');
                showFieldError(timeBtn || timeEnd, 'apptTimeEndError', 'Informe o horário de término');
            } else if (timeStart.value) {
                const [startH, startM] = timeStart.value.split(':').map(Number);
                const [endH, endM] = timeEnd.value.split(':').map(Number);
                const startTotal = startH * 60 + startM;
                const endTotal = endH * 60 + endM;
                if (endTotal <= startTotal) {
                    const timeBtn = document.getElementById('apptTimeEndBtn');
                    showFieldError(timeBtn || timeEnd, 'apptTimeEndError', 'O horário de término deve ser após o início');
                } else if (endTotal > 20 * 60) {
                    const timeBtn = document.getElementById('apptTimeEndBtn');
                    showFieldError(timeBtn || timeEnd, 'apptTimeEndError', 'O horário excede o expediente (20:00)');
                }
            }

            if (!isValid) return;

            const prof2 = isMutual ? professionals.find(p => String(p.id) === String(professional2.value)) : null;

            const apptPriceInput = appointmentModal.querySelector('#apptPrice');
            let finalPrice = 0;
            if (apptPriceInput && apptPriceInput.value && apptPriceInput.value !== 'A combinar') {
                const rawPrice = apptPriceInput.value.replace(/[^\d]/g, '');
                finalPrice = parseFloat(rawPrice) / 100 || 0;
            } else {
                finalPrice = parseFloat(svc.price) || 0;
            }

            const newAppointment = {
                id: Date.now(),
                professionalId: prof.id,
                professionalName: prof.name,
                professionalInitials: prof.initials,
                professionalColor: prof.color,
                client: client.value.trim(),
                serviceId: svc.id,
                serviceName: svc.name,
                servicePrice: finalPrice,
                date: date.value,
                timeStart: timeStart.value,
                timeEnd: timeEnd.value,
                createdAt: new Date().toISOString(),
                createdBy: session ? session.name : '',
                isMutual: isMutual,
                professionalId2: prof2 ? prof2.id : null,
                professionalName2: prof2 ? prof2.name : '',
                professionalInitials2: prof2 ? prof2.initials : '',
                professionalColor2: prof2 ? prof2.color : ''
            };

            // Check if we are in Edit Mode
            if (editingApptId) {
                const apptIndex = appointments.findIndex(a => String(a.id) === String(editingApptId));
                if (apptIndex !== -1) {
                    const originalAppt = appointments[apptIndex];
                    
                    originalAppt.professionalId = prof.id;
                    originalAppt.professionalName = prof.name;
                    originalAppt.professionalInitials = prof.initials;
                    originalAppt.professionalColor = prof.color;
                    originalAppt.client = client.value.trim();
                    originalAppt.serviceId = svc.id;
                    originalAppt.serviceName = svc.name;
                    originalAppt.servicePrice = finalPrice;
                    originalAppt.date = date.value;
                    originalAppt.timeStart = timeStart.value;
                    originalAppt.timeEnd = timeEnd.value;
                    originalAppt.isMutual = isMutual;
                    originalAppt.professionalId2 = prof2 ? prof2.id : null;
                    originalAppt.professionalName2 = prof2 ? prof2.name : '';
                    originalAppt.professionalInitials2 = prof2 ? prof2.initials : '';
                    originalAppt.professionalColor2 = prof2 ? prof2.color : '';

                    // Auto-register client if not already in clients list (case-insensitive)
                    const clientNameClean = client.value.trim();
                    const clientExists = clients.some(c => c.name.toLowerCase().trim() === clientNameClean.toLowerCase());
                    if (!clientExists) {
                        const newClientObj = {
                            id: 'cli_' + Date.now() + Math.random().toString(36).substr(2, 5),
                            name: clientNameClean,
                            phone: '',
                            level: 'Novo',
                            avatar: null,
                            createdAt: new Date().toISOString()
                        };
                        clients.push(newClientObj);
                        console.log(`[Autoregister] Client "${clientNameClean}" auto-registered locally.`);
                    }

                    saveAppointments();
                    renderAppointments();
                    closeAppointmentModal();
                    showToast('Agendamento atualizado com sucesso!', 'success');
                    return;
                }
            }

            // Auto-register client if not already in clients list (case-insensitive)
            const clientNameClean = client.value.trim();
            const clientExists = clients.some(c => c.name.toLowerCase().trim() === clientNameClean.toLowerCase());
            if (!clientExists) {
                const newClientObj = {
                    id: 'cli_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    name: clientNameClean,
                    phone: '',
                    level: 'Novo',
                    avatar: null,
                    createdAt: new Date().toISOString()
                };
                clients.push(newClientObj);
                console.log(`[Autoregister] Client "${clientNameClean}" auto-registered locally.`);
            }

            // Save
            appointments.push(newAppointment);
            saveAppointments();

            // Add visually to the calendar grid
            addAppointmentToGrid(newAppointment);

            // Close modal and show success
            closeAppointmentModal();
            showToast(`Agendamento criado para ${newAppointment.client} com ${newAppointment.professionalName}`, 'success');
        });
    }

    /**
     * Dynamically renders the calendar grid container headers and cells
     */
    function renderCalendarGrid(filterProfId = null) {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;

        // Clear previous grid contents
        grid.innerHTML = '';

        // Determine professionals to show based on logged-in role
        displayProfs = [...professionals];
        const currentSession = JSON.parse(sessionStorage.getItem('raiosol_session') || '{}');
        
        if (currentSession.role === 'funcionario') {
            // Show only this employee
            const myProf = professionals.find(p => p.name.toLowerCase() === currentSession.name.toLowerCase());
            if (myProf) {
                displayProfs = [myProf];
            }
        } else if (filterProfId) {
            // Show only the filtered professional
            const targetProf = professionals.find(p => String(p.id) === String(filterProfId));
            if (targetProf) {
                displayProfs = [targetProf];
            }
        }

        const N = displayProfs.length;

        // Set grid columns template dynamically
        grid.style.gridTemplateColumns = `60px repeat(${N}, minmax(130px, 1fr))`;

        // 1. Render Header Row
        const timeHeader = document.createElement('div');
        timeHeader.className = 'calendar-header-cell calendar-time-header';
        timeHeader.textContent = 'Horário';
        grid.appendChild(timeHeader);

        displayProfs.forEach(p => {
            const cell = document.createElement('div');
            cell.className = 'calendar-header-cell';
            cell.dataset.profId = p.id;
            
            const avatarHTML = p.avatar 
                ? `<img src="${p.avatar}" alt="Foto ${p.name}" class="professional-avatar-img" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-bottom: 4px; border: 1px solid var(--gold-border);">`
                : `<div class="professional-avatar" style="background: ${p.color}; margin-bottom: 4px; width: 32px; height: 32px; font-size: 14px;">${p.initials}</div>`;
                
            cell.innerHTML = `
                ${avatarHTML}
                <div class="calendar-grid__prof-name" style="font-size: 14px; font-weight: 600;">${p.name}</div>
            `;
            grid.appendChild(cell);
        });

        // 2. Render 30-Minute Rows (08:00 to 19:30)
        let rowIndex = 0;
        for (let hour = BUSINESS_START; hour < BUSINESS_END; hour++) {
            for (let min = 0; min < 60; min += 30) {
                const hourStr = String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0');

                // Time Cell
                const timeCell = document.createElement('div');
                timeCell.className = 'calendar-time-cell';
                const timeLabel = document.createElement('span');
                timeLabel.className = 'calendar-time-text';
                timeLabel.textContent = hourStr;
                timeCell.appendChild(timeLabel);
                grid.appendChild(timeCell);

                // N professional cells for this slot
                displayProfs.forEach(p => {
                    const cell = document.createElement('div');
                    cell.className = 'calendar-cell';
                    cell.dataset.hour = hourStr;
                    cell.dataset.profId = p.id;
                    cell.style.zIndex = 100 - rowIndex;

                    // Clique na célula vazia abre modal de novo agendamento com pré-seleção se não estiver no passado
                    cell.addEventListener('click', (e) => {
                        if (e.target.closest('.appointment-block')) return;
                        e.stopPropagation();
                        const dateInput = document.getElementById('datePicker');
                        const selectedDate = dateInput ? dateInput.value : toISODateString(currentDate);
                        
                        const todayStr = toISODateString(new Date());
                        if (selectedDate < todayStr) {
                            showToast('Não é possível agendar em datas passadas.', 'warning');
                            return;
                        }
                        if (selectedDate === todayStr) {
                            const now = new Date();
                            const currentHour = now.getHours();
                            const currentMin = now.getMinutes();
                            const [slotHour, slotMin] = hourStr.split(':').map(Number);
                            if (slotHour < currentHour || (slotHour === currentHour && slotMin < currentMin)) {
                                showToast('Não é possível agendar em horários passados.', 'warning');
                                return;
                            }
                        }
                        
                        openAppointmentModal(selectedDate, null, p.id, hourStr);
                    });

                    grid.appendChild(cell);
                });
                rowIndex++;
            }
        }
    }

    /**
     * Render all appointments dynamically inside their respective data-attribute-matched cells
     */
    function renderAppointments() {
        // Clear previous appointments
        document.querySelectorAll('.calendar-grid .appointment-block').forEach(el => el.remove());

        const dateStr = toISODateString(currentDate);
        
        // Filter appointments to show (current selected date, excluding cancelled ones)
        let displayAppts = appointments.filter(a => a.date === dateStr && a.status !== 'Cancelado');

        const currentSession = JSON.parse(sessionStorage.getItem('raiosol_session') || '{}');
        if (currentSession.role === 'funcionario') {
            const employeeProf = professionals.find(p => p.name.toLowerCase() === currentSession.name.toLowerCase());
            if (employeeProf) {
                displayAppts = displayAppts.filter(a => 
                    String(a.professionalId) === String(employeeProf.id) ||
                    (a.isMutual && String(a.professionalId2) === String(employeeProf.id))
                );
            }
        }

        const apptColors = [
            { name: 'DarkOrange', bg: '#FF8C00', text: '#FFFFFF', border: '#E07C00' },
            { name: 'Orange', bg: '#FFA500', text: '#FFFFFF', border: '#E09200' },
            { name: 'Gold', bg: '#FFD700', text: '#3E2723', border: '#D0A800' },
            { name: 'Yellow', bg: '#FFFF00', text: '#3E2723', border: '#C0C000' },
            { name: 'Khaki', bg: '#F0E68C', text: '#3E2723', border: '#D0C66C' },
            { name: 'Goldenrod', bg: '#DAA520', text: '#FFFFFF', border: '#BA8500' },
            { name: 'DarkGoldenrod', bg: '#B8860B', text: '#FFFFFF', border: '#986600' },
            { name: 'Cornsilk', bg: '#FFF8DC', text: '#3E2723', border: '#DFD8BC' },
            { name: 'LightYellow', bg: '#FFFFE0', text: '#3E2723', border: '#DFDFBC' },
            { name: 'LemonChiffon', bg: '#FFFACD', text: '#3E2723', border: '#DFDABD' },
            { name: 'LightGoldenrodYellow', bg: '#FAFAD2', text: '#3E2723', border: '#DADAB2' }
        ];

        const getApptColor = (id) => {
            const str = String(id || '');
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % apptColors.length;
            return apptColors[index];
        };

        const roundToNearest30Min = (timeStr) => {
            if (!timeStr) return "08:00";
            const [h, m] = timeStr.split(':').map(Number);
            const roundedM = Math.round(m / 30) * 30;
            let newH = h;
            let newM = roundedM;
            if (newM === 60) {
                newM = 0;
                newH += 1;
            }
            return String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
        };

        const roundDownTo30Min = (timeStr) => {
            if (!timeStr) return "08:00";
            const [h, m] = timeStr.split(':').map(Number);
            const roundedM = m < 30 ? 0 : 30;
            return String(h).padStart(2, '0') + ':' + String(roundedM).padStart(2, '0');
        };

        // Calculate overlap column positions and render per professional
        displayProfs.forEach(p => {
            const profAppts = displayAppts.filter(a => 
                String(a.professionalId) === String(p.id) ||
                (a.isMutual && String(a.professionalId2) === String(p.id))
            );
            
            // Sort by start time, then by duration descending
            profAppts.sort((a, b) => {
                const [hA, mA] = a.timeStart.split(':').map(Number);
                const [hB, mB] = b.timeStart.split(':').map(Number);
                const startA = hA * 60 + mA;
                const startB = hB * 60 + mB;
                if (startA !== startB) return startA - startB;
                
                const [ehA, emA] = a.timeEnd.split(':').map(Number);
                const [ehB, emB] = b.timeEnd.split(':').map(Number);
                const durationA = (ehA * 60 + emA) - startA;
                const durationB = (ehB * 60 + emB) - startB;
                return durationB - durationA;
            });

            // Group into clusters of overlapping appointments
            const clusters = [];
            let currentCluster = [];
            let maxEnd = 0;

            profAppts.forEach(appt => {
                const [sh, sm] = appt.timeStart.split(':').map(Number);
                const [eh, em] = appt.timeEnd.split(':').map(Number);
                const apptStart = sh * 60 + sm;
                const apptEnd = eh * 60 + em;

                if (currentCluster.length === 0) {
                    currentCluster.push(appt);
                    maxEnd = apptEnd;
                } else if (apptStart < maxEnd) {
                    currentCluster.push(appt);
                    if (apptEnd > maxEnd) maxEnd = apptEnd;
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [appt];
                    maxEnd = apptEnd;
                }
            });
            if (currentCluster.length > 0) {
                clusters.push(currentCluster);
            }

            // Assign columns and totalCols per cluster
            clusters.forEach(cluster => {
                const columns = [];
                cluster.forEach(appt => {
                    const [sh, sm] = appt.timeStart.split(':').map(Number);
                    const [eh, em] = appt.timeEnd.split(':').map(Number);
                    const apptStart = sh * 60 + sm;
                    const apptEnd = eh * 60 + em;

                    let placed = false;
                    for (let i = 0; i < columns.length; i++) {
                        const hasOverlap = columns[i].some(other => {
                            const [osh, osm] = other.timeStart.split(':').map(Number);
                            const [oeh, oem] = other.timeEnd.split(':').map(Number);
                            const otherStart = osh * 60 + osm;
                            const otherEnd = oeh * 60 + oem;
                            return apptStart < otherEnd && otherStart < apptEnd;
                        });
                        if (!hasOverlap) {
                            columns[i].push(appt);
                            appt.col = i;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        columns.push([appt]);
                        appt.col = columns.length - 1;
                    }
                });

                const totalCols = columns.length;
                cluster.forEach(appt => {
                    appt.totalCols = totalCols;
                });
            });

            // Render appointments for this professional's column
            profAppts.forEach(appt => {
                const roundedTime = roundDownTo30Min(appt.timeStart);
                const targetCell = document.querySelector(`.calendar-cell[data-hour="${roundedTime}"][data-prof-id="${p.id}"]`);

                if (!targetCell) return;

                const serviceMap = {
                    'corte & escova': 'corte',
                    'coloração': 'coloracao',
                    'manicure': 'manicure',
                    'maquiagem': 'maquiagem',
                    'mechas/luzes': 'mechas',
                    'tratamento capilar': 'tratamento',
                    'hidratação': 'tratamento'
                };
                
                const sName = appt.serviceName.toLowerCase();
                let variant = 'corte';
                for (const [key, value] of Object.entries(serviceMap)) {
                    if (sName.includes(key)) {
                        variant = value;
                        break;
                    }
                }

                const apptBlock = document.createElement('div');
                apptBlock.className = `appointment-block appointment--${variant}`;
                apptBlock.dataset.appointment = appt.id;
                apptBlock.dataset.service = appt.serviceName;
                apptBlock.dataset.professional = appt.isMutual 
                    ? `${appt.professionalName} & ${appt.professionalName2} (Mútuo)`
                    : appt.professionalName;
                apptBlock.dataset.client = appt.client;
                apptBlock.dataset.time = `${appt.timeStart} - ${appt.timeEnd}`;
                apptBlock.dataset.price = parseFloat(appt.servicePrice) === 0 ? 'A combinar' : formatCurrencyBRL(appt.servicePrice);
                apptBlock.dataset.status = appt.status || 'Agendado';

                if (appt.status === 'Concluído') {
                    apptBlock.classList.add('appt-completed');
                }

                // Apply randomized theme color based on ID
                const theme = getApptColor(appt.id);
                apptBlock.style.backgroundColor = theme.bg;
                apptBlock.style.color = theme.text;
                apptBlock.style.borderLeft = `3px solid ${theme.border}`;
                apptBlock.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';

                // Absolute positioning to overflow multiple 30-minute cells dynamically (side-by-side overlap support)
                const col = appt.col || 0;
                const totalCols = appt.totalCols || 1;
                const colWidth = 100 / totalCols;

                apptBlock.style.position = 'absolute';
                const [startH, startM] = appt.timeStart.split(':').map(Number);
                const [cellH, cellM] = roundedTime.split(':').map(Number);
                const diffMins = (startH * 60 + startM) - (cellH * 60 + cellM);
                const offsetPx = diffMins * (40 / 30); // 40px per 30 minutes
                apptBlock.style.top = `${offsetPx}px`;
                apptBlock.style.left = `calc(${col * colWidth}% + 2px)`;
                apptBlock.style.width = `calc(${colWidth}% - 4px)`;
                apptBlock.style.zIndex = '5';

                // Calculate height based on duration
                const [endH, endM] = appt.timeEnd.split(':').map(Number);
                const durationMinutes = (endH - startH) * 60 + (endM - startM);
                const finalDuration = Math.max(15, durationMinutes);
                const cellHeight = 40; // 40px per cell
                const slotDuration = 30; // 30 minutes per cell
                const blockHeight = (finalDuration / slotDuration) * cellHeight;
                apptBlock.style.height = `${blockHeight}px`;

                const statusIndicator = appt.status === 'Concluído' ? '<span style="color: #2E7D32; font-weight: bold; margin-left: 4px;">✓</span>' : 
                                        appt.status === 'Cancelado' ? '<span style="color: #C2185B; font-weight: bold; margin-left: 4px;">✗</span>' : '';
                const mutualBadge = appt.isMutual ? '<span style="background: rgba(255,255,255,0.25); font-size: 11px; padding: 1px 4px; border-radius: 4px; font-weight: 700; margin-right: 4px; letter-spacing: 0.5px;">MÚTUO</span>' : '';

                // Adapt content and layout based on block height (duration)
                if (finalDuration <= 15) {
                    apptBlock.style.padding = '2px 6px';
                    apptBlock.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 4px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; color: inherit; height: 100%;">
                            <strong style="font-weight: 700; flex-shrink: 0; color: inherit; font-size: 13px;">${appt.timeStart}</strong>
                            <span style="font-weight: 600; text-overflow: ellipsis; overflow: hidden; flex-shrink: 1; color: inherit; font-size: 13px;">${mutualBadge}${appt.serviceName} ${statusIndicator}</span>
                            <span style="font-style: italic; opacity: 0.85; text-overflow: ellipsis; overflow: hidden; flex-shrink: 1; color: inherit !important; font-size: 13px;">(${appt.client})</span>
                        </div>
                    `;
                } else if (finalDuration <= 30) {
                    apptBlock.style.padding = '3px 8px';
                    apptBlock.innerHTML = `
                        <div style="display: flex; flex-direction: column; justify-content: center; gap: 1px; height: 100%; width: 100%;">
                            <span class="appointment-time" style="font-weight: 700; font-size: 14px; display: block; color: inherit; line-height: 1.1;">${appt.timeStart}–${appt.timeEnd}</span>
                            <span class="appointment-service" style="font-weight: 600; font-size: 13px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit; line-height: 1.1;">${mutualBadge}${appt.serviceName} ${statusIndicator} <span class="appointment-client" style="font-style: italic; font-weight: 400; opacity: 0.85; color: inherit !important; font-size: 13px;">(${appt.client})</span></span>
                        </div>
                    `;
                } else {
                    apptBlock.style.padding = '4px 8px';
                    apptBlock.innerHTML = `
                        <span class="appointment-time" style="font-weight: 700; font-size: 16px; display: block; color: inherit;">${appt.timeStart}–${appt.timeEnd}</span>
                        <span class="appointment-service" style="font-weight: 600; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit; font-size: 15px;">${mutualBadge}${appt.serviceName} ${statusIndicator}</span>
                        <span class="appointment-client" style="font-style: italic; font-size: 15px; opacity: 0.85; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit !important;">(${appt.client})</span>
                    `;
                }

                targetCell.appendChild(apptBlock);
            });
        });
    }

    /**
     * Add an appointment block to the calendar grid visually
     * @param {Object} appt – appointment data object
     */
    function addAppointmentToGrid(appt) {
        if (!appointments.find(a => a.id === appt.id)) {
            appointments.push(appt);
            saveAppointments();
        }
        renderAppointments();
    }

    // Inject appointment animation and completed states
    const apptAnimStyles = document.createElement('style');
    apptAnimStyles.textContent = `
        @keyframes apptSlideIn {
            from { opacity: 0; transform: translateY(-8px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .appt-completed {
            opacity: 0.65 !important;
            filter: grayscale(25%);
            background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.06), rgba(255,255,255,0.06) 10px, transparent 10px, transparent 20px) !important;
        }
        .appt-completed .appointment-service,
        .appt-completed .appointment-client {
            text-decoration: line-through !important;
            text-decoration-color: currentColor !important;
            text-decoration-thickness: 1.5px !important;
        }
    `;
    document.head.appendChild(apptAnimStyles);

    // ============================================
    // SECTION 12: APPOINTMENT INTERACTIONS (POPOVER)
    // ============================================

    let activePopover = null;

    /** Event delegation for appointment clicks */
    document.addEventListener('click', (e) => {
        const apptEl = e.target.closest('.appointment, .calendar-appointment, [data-appointment]');

        // Close any existing popover if clicking outside
        if (!apptEl && activePopover) {
            closePopover();
            return;
        }

        if (!apptEl) return;

        e.stopPropagation();

        // Close previous popover
        if (activePopover) closePopover();

        // Extract data
        const service      = apptEl.dataset.service      || 'Serviço';
        const client       = apptEl.dataset.client       || 'Cliente';
        const professional = apptEl.dataset.professional || 'Profissional';
        const time         = apptEl.dataset.time         || '--:-- - --:--';
        const price        = apptEl.dataset.price        || 'R$ 0,00';

        showAppointmentPopover(apptEl, { service, client, professional, time, price });
    });

    /**
     * Show a popover with appointment details
     * @param {HTMLElement} anchor
     * @param {Object} data
     */
    function showAppointmentPopover(anchor, data) {
        const popover = document.createElement('div');
        popover.className = 'appt-popover';

        popover.innerHTML = `
            <div class="popover-header">
                <span class="popover-service">${data.service}</span>
                <button class="popover-close" aria-label="Fechar">&times;</button>
            </div>
            <div class="popover-body">
                <div class="popover-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>${data.client}</span>
                </div>
                <div class="popover-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>${data.professional}</span>
                </div>
                <div class="popover-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>${data.time}</span>
                </div>
                <div class="popover-row popover-price">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span>${data.price}</span>
                </div>
            </div>
        `;

        document.body.appendChild(popover);

        // Position popover near the anchor
        const rect = anchor.getBoundingClientRect();
        const popRect = popover.getBoundingClientRect();

        let top  = rect.bottom + 8;
        let left = rect.left + (rect.width / 2) - (popRect.width / 2);

        // Keep within viewport
        if (left < 8) left = 8;
        if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
        if (top + popRect.height > window.innerHeight - 8) {
            top = rect.top - popRect.height - 8; // Position above
        }

        popover.style.top  = `${top}px`;
        popover.style.left = `${left}px`;

        // Animate in
        requestAnimationFrame(() => popover.classList.add('popover-visible'));

        // Close button
        popover.querySelector('.popover-close').addEventListener('click', closePopover);

        activePopover = popover;
    }

    function closePopover() {
        if (!activePopover) return;
        activePopover.classList.remove('popover-visible');
        const p = activePopover;
        setTimeout(() => p.remove(), 300);
        activePopover = null;
    }

    // Inject popover styles
    const popoverStyles = document.createElement('style');
    popoverStyles.textContent = `
        .appt-popover {
            position: fixed;
            z-index: 5000;
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.15);
            min-width: 240px;
            max-width: 320px;
            opacity: 0;
            transform: translateY(6px) scale(0.96);
            transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
            font-family: 'Inter', sans-serif;
        }
        .appt-popover.popover-visible {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        .popover-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 14px 16px 10px;
            border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .popover-service {
            font-weight: 700; font-size: 0.95rem; color: #212121;
            font-family: 'Playfair Display', serif;
        }
        .popover-close {
            background: none; border: none; font-size: 1.4rem;
            color: #9E9E9E; cursor: pointer; line-height: 1;
            padding: 2px; border-radius: 4px;
        }
        .popover-close:hover { color: #EF5350; }
        .popover-body { padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 8px; }
        .popover-row {
            display: flex; align-items: center; gap: 10px;
            font-size: 0.85rem; color: #616161;
        }
        .popover-row svg { color: #9E9E9E; flex-shrink: 0; }
        .popover-price span { font-weight: 600; color: #C9A84C; font-size: 0.95rem; }
    `;
    document.head.appendChild(popoverStyles);

    // ============================================
    // SECTION 13: NOTIFICATIONS
    // ============================================

    const notifBell  = document.querySelector('.notification-bell, #notifBell, #notificationsBtn, [data-notification-bell]');
    let notifDropdown = document.querySelector('.notification-dropdown, #notifDropdown');
    let notifData    = []; // Dynamic working copy

    if (notifBell && !notifDropdown) {
        notifDropdown = createNotificationsDropdown();
    }

    /** Helper to format YYYY-MM-DD date to DD/MM/YYYY */
    function formatStringDateBR(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    }

    /** Helper to format Date or ISO string to absolute BR date/time format (DD/MM/YYYY às HH:MM) */
    function formatDateTimeBR(dateParam) {
        if (!dateParam) return '';
        const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
        if (isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} às ${hours}:${minutes}`;
    }

    /** Plays a high-quality Web Audio API chime sound to alert user of real-time changes */
    function playNotificationSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const now = ctx.currentTime;
            
            // Double tone premium sound
            // Tone 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now); // D5
            osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
            gain1.gain.setValueAtTime(0.12, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.6);
            
            // Tone 2
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(440, now); // A4
            osc2.frequency.exponentialRampToValueAtTime(587.33, now + 0.15); // D5
            gain2.gain.setValueAtTime(0.08, now);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now);
            osc2.stop(now + 0.8);
        } catch (e) {
            console.warn('[AudioContext] Could not play notification chime:', e);
        }
    }

    /** Helper to get relative time string */
    function timeAgo(dateParam) {
        if (!dateParam) return 'agora mesmo';
        const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
        const today = new Date();
        const differenceInSeconds = Math.round((today - date) / 1000);
        if (differenceInSeconds < 60) {
            return 'agora mesmo';
        }
        const differenceInMinutes = Math.round(differenceInSeconds / 60);
        if (differenceInMinutes < 60) {
            return `${differenceInMinutes} min atrás`;
        }
        const differenceInHours = Math.round(differenceInMinutes / 60);
        if (differenceInHours < 24) {
            return `${differenceInHours}h atrás`;
        }
        const differenceInDays = Math.round(differenceInHours / 24);
        return `${differenceInDays}d atrás`;
    }

    /** Rebuild notifications dynamically from active appointments created by employees */
    function rebuildNotifications() {
        const currentSession = JSON.parse(sessionStorage.getItem('raiosol_session') || '{}');
        if (!currentSession || !currentSession.name) return;

        let filteredAppts = [];
        if (currentSession.role === 'admin') {
            // Only show notifications for bookings created by employees (not by the admin themselves)
            filteredAppts = appointments.filter(a => 
                a.createdBy && 
                a.createdBy.trim() !== '' && 
                a.createdBy !== currentSession.name &&
                a.status !== 'Cancelado'
            );
        } else {
            // Employees do not get alerts for other people's scheduling
            filteredAppts = [];
        }

        // Sort by creation date descending
        filteredAppts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const readNotifIds = JSON.parse(localStorage.getItem('raiosol_read_notifications') || '[]');

        // Track new dynamic notification alerts
        const currentUnreadIds = filteredAppts
            .filter(a => !readNotifIds.includes(String(a.id)))
            .map(a => String(a.id));

        if (knownNotifIds === null) {
            // First load: initialize known list
            knownNotifIds = [...currentUnreadIds];
        } else {
            // Subsequent loads: check for brand new unread notifications
            const newUnreadIds = currentUnreadIds.filter(id => !knownNotifIds.includes(id));
            if (newUnreadIds.length > 0) {
                newUnreadIds.forEach(id => {
                    const appt = filteredAppts.find(a => String(a.id) === id);
                    if (appt) {
                        const toastMsg = `${appt.createdBy} fez um agendamento...`;
                        showToast(toastMsg, 'info', 6000);
                    }
                });
                playNotificationSound();
                knownNotifIds = [...currentUnreadIds];
            }
        }

        notifData = filteredAppts.map(appt => {
            const dateStr = formatStringDateBR(appt.date);
            const msg = `${appt.createdBy} agendou ${appt.client} para ${appt.serviceName} em ${dateStr} às ${appt.timeStart}`;
            
            // Show both relative and absolute date/time
            const timeLabel = appt.createdAt 
                ? `${timeAgo(appt.createdAt)} (${formatDateTimeBR(appt.createdAt)})`
                : 'agora mesmo';

            return {
                id: appt.id,
                message: msg,
                time: timeLabel,
                read: readNotifIds.includes(String(appt.id))
            };
        });

        updateNotificationBadge();

        if (notifDropdown) {
            renderNotifications(notifDropdown);
        }

        renderSidebarNotifications();
    }

    /** Mark a notification as read and save to localStorage */
    function markNotificationAsRead(id) {
        const readNotifIds = JSON.parse(localStorage.getItem('raiosol_read_notifications') || '[]');
        const stringId = String(id);
        if (!readNotifIds.includes(stringId)) {
            readNotifIds.push(stringId);
            localStorage.setItem('raiosol_read_notifications', JSON.stringify(readNotifIds));
            rebuildNotifications();
        }
    }

    /** Render dynamic notifications in the right sidebar panel */
    function renderSidebarNotifications() {
        const sidebarList = document.querySelector('#panelNotificacoes .notifications-list');
        if (!sidebarList) return;

        if (notifData.length === 0) {
            sidebarList.innerHTML = '<li style="color:#999;font-size: 15px;padding:12px 0;text-align:center;">Nenhuma notificação</li>';
            return;
        }

        sidebarList.innerHTML = notifData.map(n => {
            return `
                <li class="notification-item ${n.read ? 'notif-read' : 'notif-unread'}" data-notif-id="${n.id}" style="padding: 12px; border-bottom: 1px solid var(--neutral-100); display: flex; align-items: start; gap: 10px; cursor: pointer; transition: background 0.2s; border-radius: 6px; margin-bottom: 4px;">
                    <div class="notif-dot ${n.read ? '' : 'dot-active'}" style="width: 8px; height: 8px; border-radius: 50%; background: ${n.read ? 'transparent' : '#C9A84C'}; margin-top: 5px; flex-shrink: 0;"></div>
                    <div style="flex: 1;">
                        <p style="margin: 0; font-size: 0.9375rem; line-height: 1.4; color: var(--neutral-800);">${n.message}</p>
                        <span style="font-size: 0.875rem; color: var(--neutral-400); display: block; margin-top: 4px;">${n.time}</span>
                    </div>
                </li>
            `;
        }).join('');

        sidebarList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.notifId;
                markNotificationAsRead(id);
            });
        });
    }

    /** Create the notifications dropdown */
    function createNotificationsDropdown() {
        const dropdown = document.createElement('div');
        dropdown.id = 'notifDropdown';
        dropdown.className = 'notif-dropdown';

        renderNotifications(dropdown);

        // Position relative to bell
        if (notifBell) {
            notifBell.style.position = 'relative';
            notifBell.parentElement.style.position = 'relative';
            notifBell.parentElement.appendChild(dropdown);
        }

        return dropdown;
    }

    /** Render notifications list */
    function renderNotifications(container) {
        if (!container) return;

        const unreadCount = notifData.filter(n => !n.read).length;

        container.innerHTML = `
            <div class="notif-header">
                <span class="notif-title">Notificações</span>
                ${unreadCount > 0 ? `<span class="notif-badge-count">${unreadCount} nova${unreadCount > 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="notif-list">
                ${notifData.length === 0 ? '<div class="notif-empty">Nenhuma notificação</div>' : ''}
                ${notifData.map(n => `
                    <div class="notif-item ${n.read ? 'notif-read' : 'notif-unread'}" data-notif-id="${n.id}">
                        <div class="notif-dot ${n.read ? '' : 'dot-active'}"></div>
                        <div class="notif-content">
                            <p class="notif-message">${n.message}</p>
                            <span class="notif-time">${n.time}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Click handler for each notification (mark as read)
        container.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.notifId;
                markNotificationAsRead(id);
            });
        });
    }

    /** Update the badge count on the bell icon */
    function updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge, .notif-badge, #notificationsBtn .topbar-badge, [data-notif-badge]');
        const unreadCount = notifData.filter(n => !n.read).length;

        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? '' : 'none';
        }
    }

    // Toggle dropdown on bell click
    if (notifBell) {
        notifBell.addEventListener('click', (e) => {
            e.stopPropagation();
            if (notifDropdown) {
                notifDropdown.classList.toggle('notif-open');
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== notifBell) {
            notifDropdown.classList.remove('notif-open');
        }
    });

    // Inject notification styles
    const notifStyles = document.createElement('style');
    notifStyles.textContent = `
        .notif-dropdown {
            position: absolute;
            top: calc(100% + 8px); right: 0;
            width: 340px;
            max-height: 420px;
            background: rgba(255,255,255,0.97);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.12);
            z-index: 4000;
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
            pointer-events: none;
            transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
            overflow: hidden;
            font-family: 'Inter', sans-serif;
        }
        .notif-dropdown.notif-open {
            opacity: 1; transform: translateY(0) scale(1); pointer-events: auto;
        }
        .notif-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px 18px 12px;
            border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .notif-title {
            font-weight: 700; font-size: 0.95rem; color: #212121;
            font-family: 'Playfair Display', serif;
        }
        .notif-badge-count {
            font-size: 0.875rem; font-weight: 600; color: #C9A84C;
            background: rgba(201,168,76,0.12); padding: 3px 10px;
            border-radius: 20px;
        }
        .notif-list {
            max-height: 340px; overflow-y: auto;
        }
        .notif-item {
            display: flex; gap: 12px; padding: 14px 18px;
            cursor: pointer; transition: background 0.2s;
            border-bottom: 1px solid rgba(0,0,0,0.03);
        }
        .notif-item:hover { background: rgba(201,168,76,0.04); }
        .notif-unread { background: rgba(201,168,76,0.06); }
        .notif-read { opacity: 0.65; }
        .notif-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #E0E0E0; margin-top: 6px; flex-shrink: 0;
        }
        .notif-dot.dot-active { background: #C9A84C; }
        .notif-content { flex: 1; }
        .notif-message { font-size: 0.9375rem; color: #424242; line-height: 1.45; margin: 0; }
        .notif-time { font-size: 0.875rem; color: #9E9E9E; margin-top: 4px; display: block; }
        .notif-empty {
            padding: 32px 18px; text-align: center;
            color: #9E9E9E; font-size: 0.85rem;
        }
    `;
    document.head.appendChild(notifStyles);

    // ============================================
    // SECTION 14: USER MENU & LOGOUT
    // ============================================

    const logoutBtn = document.querySelector('.btn-logout, #btnLogout, #logoutBtn, [data-action="logout"]');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showLogoutConfirmation();
        });
    }

    /** Show a confirmation dialog before logout */
    function showLogoutConfirmation() {
        // Create confirmation overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay logout-confirm-overlay';
        overlay.innerHTML = `
            <div class="modal-card glass-card" style="max-width: 380px; text-align: center; padding: 36px;">
                <div class="modal-icon" style="width: 64px; height: 64px; background: #FFEBEE; color: #EF5350; margin: 0 auto 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                </div>
                <h2 class="modal-title" style="font-family: 'Playfair Display', serif; margin-bottom: 8px;">Sair do Sistema</h2>
                <p class="modal-message" style="color: #757575; margin-bottom: 24px;">Tem certeza que deseja encerrar sua sessão?</p>
                <div class="modal-actions" style="display: flex; gap: 12px;">
                    <button class="btn btn-secondary logout-cancel" style="flex: 1;">CANCELAR</button>
                    <button class="btn btn-primary logout-confirm" style="flex: 1; background: linear-gradient(135deg, #EF5350, #E53935); box-shadow: 0 4px 15px rgba(239,83,80,0.3);">SAIR</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Cancel
        overlay.querySelector('.logout-cancel').addEventListener('click', () => {
            overlay.remove();
        });

        // Confirm logout
        overlay.querySelector('.logout-confirm').addEventListener('click', () => {
            sessionStorage.removeItem('raiosol_session');
            showToast('Encerrando sessão...', 'info');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 800);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // ============================================
    // SECTION 15: CURRENT TIME INDICATOR
    // ============================================

    let timeIndicator = null;

    function createTimeIndicator() {
        timeIndicator = document.createElement('div');
        timeIndicator.className = 'time-indicator';
        timeIndicator.innerHTML = '<div class="time-indicator-dot"></div><div class="time-indicator-line"></div>';

        const calendarBody = document.querySelector('.calendar-body, .calendar-grid, .agenda-grid, .calendar-slots');
        if (calendarBody) {
            calendarBody.style.position = 'relative';
            calendarBody.appendChild(timeIndicator);
        }
    }

    function updateTimeIndicator() {
        if (!timeIndicator) return;

        const now  = new Date();
        const hour = now.getHours();
        const min  = now.getMinutes();

        // Only visible during business hours
        if (hour < BUSINESS_START || hour >= BUSINESS_END) {
            timeIndicator.style.display = 'none';
            return;
        }

        timeIndicator.style.display = 'flex';

        // Calculate vertical position
        // Each hour = 240px (6 cells of 40px)
        const minutesSinceOpen = (hour - BUSINESS_START) * 60 + min;
        const pixelsPerMinute  = 4; // 4px per minute (40px per 10min slot)
        const topPosition      = minutesSinceOpen * pixelsPerMinute;

        timeIndicator.style.top = `${topPosition}px`;
    }

    // Inject time indicator styles
    const timeIndicatorStyles = document.createElement('style');
    timeIndicatorStyles.textContent = `
        .time-indicator {
            position: absolute;
            left: 0; right: 0;
            display: flex;
            align-items: center;
            z-index: 10;
            pointer-events: none;
        }
        .time-indicator-dot {
            width: 10px; height: 10px;
            background: #EF5350;
            border-radius: 50%;
            flex-shrink: 0;
            margin-left: -5px;
            box-shadow: 0 0 6px rgba(239,83,80,0.5);
        }
        .time-indicator-line {
            flex: 1;
            height: 2px;
            background: #EF5350;
            box-shadow: 0 0 4px rgba(239,83,80,0.3);
        }
    `;
    document.head.appendChild(timeIndicatorStyles);

    // Initialize time indicator
    createTimeIndicator();
    updateTimeIndicator();
    // Update every minute
    setInterval(updateTimeIndicator, 60000);

    // ============================================
    // SECTION 16: KEYBOARD SHORTCUTS
    // ============================================

    document.addEventListener('keydown', (e) => {
        // ESC — close any open modal or popover
        if (e.key === 'Escape') {
            // Close appointment modal
            if (appointmentModal && appointmentModal.classList.contains('active')) {
                closeAppointmentModal();
                return;
            }

            // Close popover
            if (activePopover) {
                closePopover();
                return;
            }

            // Close notifications
            if (notifDropdown && notifDropdown.classList.contains('notif-open')) {
                notifDropdown.classList.remove('notif-open');
                return;
            }

            // Close sidebar on mobile
            if (sidebar && sidebar.classList.contains('sidebar-open')) {
                closeSidebar();
                return;
            }

            // Close any logout modals
            const logoutOverlay = document.querySelector('.logout-confirm-overlay');
            if (logoutOverlay) {
                logoutOverlay.remove();
                return;
            }
        }

        // Ctrl+N — open new appointment modal
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openAppointmentModal();
        }
    });

    // ============================================
    // SECTION 17: PAGE LOAD ANIMATIONS
    // ============================================

    /** Staggered fade-in for stats cards */
    function animateStatsCards() {
        const cards = document.querySelectorAll('.stat-card, .stats-card, [data-stat-card]');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';

            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 150 + (index * 100));
        });
    }

    /** Smooth sidebar entrance from left */
    function animateSidebarEntrance() {
        if (!sidebar) return;
        // Only animate on desktop
        if (window.innerWidth > 768) {
            sidebar.style.opacity = '0';
            sidebar.style.transform = 'translateX(-30px)';
            sidebar.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';

            requestAnimationFrame(() => {
                sidebar.style.opacity = '1';
                sidebar.style.transform = 'translateX(0)';
            });
        }
    }

    /** Calendar grid fade-in */
    function animateCalendarGrid() {
        const grid = document.querySelector('.calendar-grid, .calendar-body, .agenda-grid, .calendar-container');
        if (!grid) return;

        grid.style.opacity = '0';
        grid.style.transition = 'opacity 0.8s ease';

        setTimeout(() => {
            grid.style.opacity = '1';
        }, 400);
    }

    // ============================================
    // SECTION 18: ROLE-BASED DYNAMIC SUB-PAGES & CONTROLS
    // ============================================

    let employeeProf = null;

    /** Dynamic User & Profile Rendering */
    function renderConfiguracoesPage() {
        const nameInput = document.getElementById('profileName');
        const emailInput = document.getElementById('profileEmail');
        const roleInput = document.getElementById('profileRole');
        const commissionInput = document.getElementById('profileCommission');

        if (nameInput) nameInput.value = session.name;
        if (emailInput) emailInput.value = session.email;
        if (roleInput) roleInput.value = session.role === 'admin' ? 'Administrador / Proprietário' : 'Profissional parceiro';
        
        if (commissionInput) {
            if (session.role === 'admin') {
                commissionInput.value = 'N/A (Proprietário)';
            } else {
                const userPercent = session.percentual || 30; // default 30% if not found
                commissionInput.value = `${userPercent}% de comissão`;
            }
        }
    }

    /** Re-map dynamic professionals in localStorage to sync registered employees */
    async function syncRegisteredEmployees() {
        try {
            const activeEmployees = await apiRequest('/users?role=funcionario&status=ativo');
            
            activeEmployees.forEach(emp => {
                if (!professionals.find(p => String(p.id) === String(emp.id) || p.name.toLowerCase() === emp.name.toLowerCase())) {
                    const colors = ['#C9A84C', '#42A5F5', '#EC407A', '#4CAF50', '#FF9800', '#AB47BC', '#26A69A', '#5C6BC0'];
                    const color = colors[professionals.length % colors.length];
                    const words = emp.name.split(' ');
                    const initials = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0,2).toUpperCase();
                    
                    const newProf = {
                        id: emp.id,
                        name: emp.name,
                        initials: emp.initials || initials,
                        color: emp.color || color,
                        percentual: emp.percentual || 35,
                        avatar: emp.avatar || emp.foto || null,
                        specialty: emp.specialty || 'Cabelo',
                        email: emp.email
                    };
                    professionals.push(newProf);
                }
            });
            await saveProfessionals(professionals);
        } catch (e) {
            console.error("Erro ao sincronizar funcionários do backend:", e);
        }
    }


    /** Setup and filter role-based dashboard view */
    async function setupRoleBasedView() {
        // Setup username and initials in Top Bar
        const topbarName = document.querySelector('.topbar-user-name');
        const topbarAvatar = document.querySelector('.topbar-user-avatar');
        
        if (topbarName) {
            topbarName.textContent = session.role === 'admin' ? `Adm. ${session.name}` : session.name;
        }
        if (topbarAvatar) {
            if (session.foto) {
                topbarAvatar.innerHTML = `<img src="${session.foto}" alt="Foto ${session.name}" class="topbar-user-avatar-img" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                topbarAvatar.style.display = 'block';
                topbarAvatar.style.background = 'none';
            } else if (session.role === 'admin') {
                // Keep the premium avatar image for the Admin
                topbarAvatar.innerHTML = `<img src="assets/admin-avatar.png" alt="Foto Adm. Deise Rose" class="topbar-user-avatar-img">`;
                topbarAvatar.style.display = 'block';
            } else {
                // Overwrite with initials for the Employee
                const words = session.name.split(' ');
                topbarAvatar.textContent = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
                // Apply fallback styling for Employee avatar text circle
                topbarAvatar.style.display = 'flex';
                topbarAvatar.style.alignItems = 'center';
                topbarAvatar.style.justifyContent = 'center';
                topbarAvatar.style.background = 'linear-gradient(135deg, var(--gold-400), var(--gold-600))';
                topbarAvatar.style.color = '#fff';
                topbarAvatar.style.fontWeight = 'bold';
                topbarAvatar.style.borderRadius = '50%';
                topbarAvatar.style.width = '36px';
                topbarAvatar.style.height = '36px';
                topbarAvatar.style.fontSize = '13px';
                topbarAvatar.style.boxShadow = '0 2px 6px rgba(201, 168, 76, 0.15)';
            }
        }

        // Show/hide service addition button based on admin status
        const btnAddService = document.getElementById('btnAdicionarServico');
        if (btnAddService) {
            btnAddService.style.display = session.role === 'admin' ? '' : 'none';
        }

        // Apply restrictions
        if (session.role === 'funcionario') {
            // Find employee profile
            employeeProf = professionals.find(p => String(p.id) === String(session.id) || p.name.toLowerCase() === session.name.toLowerCase());
            
            if (!employeeProf) {
                // Dynamic add if not present
                const colors = ['#C9A84C', '#42A5F5', '#EC407A', '#4CAF50', '#FF9800', '#AB47BC', '#26A69A', '#5C6BC0'];
                const color = colors[professionals.length % colors.length];
                const words = session.name.split(' ');
                const initials = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
                
                let percent = 30;
                try {
                    const userDoc = await apiRequest(`/users/${session.id}`);
                    if (userDoc) {
                        percent = userDoc.percentual || 30;
                    }
                } catch (e) {
                    console.error("Erro ao carregar comissão do funcionário do backend:", e);
                }
                
                employeeProf = {
                    id: session.id || Date.now(),
                    name: session.name,
                    initials: initials,
                    color: color,
                    percentual: percent
                };
                professionals.push(employeeProf);
                await saveProfessionals(professionals);
            }

            // Sync percentual from session if present
            if (session.percentual) {
                employeeProf.percentual = session.percentual;
            }

            // 1. Rename page title
            const mainTitle = document.querySelector('.page-title');
            if (mainTitle) mainTitle.textContent = `Agenda Global — ${session.name}`;

            // 2. Hide columns in calendar except time column and their column
            // (O renderCalendarGrid() cuida disso dinamicamente de acordo com o papel logado)

            // 3. Customize Stats Cards for Employee (Agendamentos, Comissão, Faturamento, Meu Percentual)
            updateEmployeeStatsCards();

            // 4. Lockdown Modal for Employee agendamentos
            const profSelect = document.getElementById('apptProfessional');
            if (profSelect) {
                profSelect.value = employeeProf.id;
                profSelect.setAttribute('disabled', 'true');
                // Create helper text
                const grp = profSelect.closest('.form-group');
                let hint = grp.querySelector('.form-hint');
                if (!hint) {
                    hint = document.createElement('span');
                    hint.className = 'form-hint';
                    hint.style.cssText = 'font-size: 14px; color: #9E9E9E; margin-top: 4px; display: block;';
                    hint.textContent = 'Você só pode criar agendamentos para si mesmo.';
                    grp.appendChild(hint);
                }
            }

            // Hide other tabs for employee that they shouldn't access
            const navItems = document.querySelectorAll('.sidebar-nav-item');
            const isGeorgiana = session.name && (
                session.name.toLowerCase().includes('georgiana') ||
                session.name.toLowerCase().includes('francine')
            );
            navItems.forEach(item => {
                const page = item.dataset.page;
                if (page === 'profissionais' || page === 'gastos' || page === 'vales') {
                    item.style.display = 'none'; // Employees don't manage team, expenses or advances
                }
                if (page === 'massagem' && !isGeorgiana) {
                    item.style.display = 'none'; // Only Georgiana Francine sees massage tab
                }
            });
        } else {
            // Admin View
            // Load pending requests badge count on "Profissionais" sidebar
            await updateAdminSidebarBadge();
        }
    }

    // restrictCalendarToProfessional is now obsolete and replaced by renderCalendarGrid()

    /** Update Sidebar badge for Admin showing pending approvals count */
    async function updateAdminSidebarBadge() {
        const badge = document.querySelector('[data-page="profissionais"] .sidebar-nav-badge');
        if (!badge) return;
        
        try {
            const pendingUsers = await apiRequest('/users?role=funcionario&status=pendente');
            const pendingCount = pendingUsers ? pendingUsers.length : 0;
            
            badge.textContent = `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}`;
            badge.style.background = pendingCount > 0 ? 'var(--error)' : 'rgba(201,168,76,0.15)';
            badge.style.color = pendingCount > 0 ? '#fff' : 'var(--gold-300)';
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        } catch (e) {
            console.error("Erro ao atualizar crachá do painel administrativo:", e);
        }
    }

    /** Update employee metrics on dashboard */
    function updateEmployeeStatsCards() {
        const todayStr = toISODateString(new Date());
        const selectedYear = currentDate.getFullYear();
        const selectedMonth = currentDate.getMonth() + 1; // 1-indexed

        const isApptInSelectedMonth = (appt) => {
            if (!appt.date) return false;
            const [y, m] = appt.date.split('-').map(Number);
            return y === selectedYear && m === selectedMonth;
        };

        const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        
        // Calculate employee-only metrics
        const myAppts = appointments.filter(a => 
            String(a.professionalId) === String(employeeProf.id) ||
            (a.isMutual && String(a.professionalId2) === String(employeeProf.id))
        );
        const myTodayAppts = myAppts.filter(a => a.date === todayStr && a.status !== 'Cancelado');
        const myActiveAppts = myAppts.filter(a => isApptInSelectedMonth(a) && a.status !== 'Cancelado');
        const myCompleted = myAppts.filter(a => isApptInSelectedMonth(a) && a.status === 'Concluído');
        
        const commissionPercent = employeeProf.percentual || 30;
        let totalBilling = 0;
        let totalCommission = 0;
        myCompleted.forEach(appt => {
            const price = parseFloat(appt.servicePrice) || 0;
            if (appt.isMutual) {
                totalBilling += price / 2;
                totalCommission += price * 0.25;
            } else {
                totalBilling += price;
                totalCommission += price * (commissionPercent / 100);
            }
        });

        let myReceitaEstimada = 0;
        myActiveAppts.forEach(appt => {
            const price = parseFloat(appt.servicePrice) || 0;
            if (appt.isMutual) {
                myReceitaEstimada += price / 2;
            } else {
                myReceitaEstimada += price;
            }
        });

        // Update Agendamentos card
        const valAgendamentos = document.querySelector('#statAgendamentos .stat-card-value');
        const lblAgendamentos = document.querySelector('#statAgendamentos .stat-card-label');
        if (valAgendamentos) valAgendamentos.textContent = myTodayAppts.length;
        if (lblAgendamentos) lblAgendamentos.textContent = 'Meus Agendamentos Hoje';

        // Update Profissionais card to "Minha Comissão"
        const valComissao = document.querySelector('#statProfissionais .stat-card-value');
        const lblComissao = document.querySelector('#statProfissionais .stat-card-label');
        const iconComissao = document.querySelector('#statProfissionais .stat-card-icon');
        if (valComissao) valComissao.textContent = formatCurrencyBRL(totalCommission);
        if (lblComissao) lblComissao.textContent = `Minha Comissão (${capitalizedMonth}) (${commissionPercent}%)`;
        if (iconComissao) {
            iconComissao.style.background = 'rgba(76,175,80,0.1)';
            iconComissao.style.color = '#4CAF50';
            iconComissao.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
        }

        // Update Serviços card
        const valServicos = document.querySelector('#statServicos .stat-card-value');
        const lblServicos = document.querySelector('#statServicos .stat-card-label');
        if (valServicos) valServicos.textContent = myActiveAppts.length;
        if (lblServicos) lblServicos.textContent = `Meus Serviços (${capitalizedMonth})`;

        // Update Receita card to personal estimated revenue
        const valReceita = document.querySelector('#statReceita .stat-card-value');
        const lblReceita = document.querySelector('#statReceita .stat-card-label');
        if (valReceita) valReceita.textContent = formatCurrencyBRL(myReceitaEstimada);
        if (lblReceita) lblReceita.textContent = `Minha Receita (${capitalizedMonth})`;
    }

    /** Update admin metrics labels and icons on dashboard */
    function updateAdminStatsCards() {
        const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        const lblAgendamentos = document.querySelector('#statAgendamentos .stat-card-label');
        if (lblAgendamentos) lblAgendamentos.textContent = 'Agendamentos Hoje:';

        const lblComissao = document.querySelector('#statProfissionais .stat-card-label');
        const iconComissao = document.querySelector('#statProfissionais .stat-card-icon');
        if (lblComissao) lblComissao.textContent = 'Profissionais Ativos:';
        if (iconComissao) {
            iconComissao.style.background = '';
            iconComissao.style.color = '';
            iconComissao.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
            `;
        }

        const lblServicos = document.querySelector('#statServicos .stat-card-label');
        if (lblServicos) lblServicos.textContent = `Serviços Agendados (${capitalizedMonth}):`;

        const lblReceita = document.querySelector('#statReceita .stat-card-label');
        if (lblReceita) lblReceita.textContent = `Receita Estimada (${capitalizedMonth}):`;
    }

    /** Professionals Page rendering (Active list + approvals) */
    async function renderProfessionalsPage() {
        const pendingList = document.getElementById('pendingApprovalsList');
        const pendingSection = document.getElementById('sectionPendingApprovals');
        const activeGrid = document.getElementById('activeProfessionalsGrid');
        const teamCount = document.getElementById('teamCount');
        const pendingBadge = document.getElementById('pendingBadge');

        // Sempre busca dados frescos do banco
        try {
            professionals = await loadProfessionals();
            await syncRegisteredEmployees();
        } catch(e) {
            console.warn('Aviso ao carregar profissionais:', e.message);
        }

        // Update team count
        if (teamCount) {
            teamCount.textContent = `${professionals.length} ${professionals.length === 1 ? 'profissional' : 'profissionais'}`;
        }

        
        // 1. Render Active List
        if (activeGrid) {
            activeGrid.innerHTML = professionals.map(p => {
                const avatarHTML = p.avatar 
                    ? `<img src="${p.avatar}" alt="Foto ${p.name}" class="active-prof-avatar-img" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1.5px solid var(--gold-border);">`
                    : `<div class="active-prof-avatar" style="background: ${p.color}">${p.initials}</div>`;
                
                const deleteBtnHTML = session.role === 'admin' 
                    ? `<button class="btn-delete-professional" data-prof-id="${p.id}" title="Excluir Funcionário" style="position: absolute; bottom: 10px; right: 12px; background: none; border: none; color: var(--neutral-400); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--neutral-400)'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                       </button>`
                    : '';

                return `
                    <div class="active-prof-card">
                        ${avatarHTML}
                        <div class="active-prof-info">
                            <span class="active-prof-name">${p.name}</span>
                            <span class="active-prof-role">Parceiro Profissional</span>
                        </div>
                        <span class="active-prof-badge">${p.percentual || 35}% Com.</span>
                        ${deleteBtnHTML}
                    </div>
                `;
            }).join('');

            // Attach delete click listeners (Admin only)
            if (session.role === 'admin') {
                activeGrid.querySelectorAll('.btn-delete-professional').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const profId = btn.dataset.profId;
                        const profObj = professionals.find(p => String(p.id) === String(profId));
                        if (!profObj) return;

                        showConfirmDialog({
                            title: 'Excluir Funcionário',
                            message: `Tem certeza que deseja excluir o(a) profissional <strong>${profObj.name}</strong>? Esta ação removerá seu cadastro e acesso de forma irreversível.`,
                            confirmText: 'Excluir',
                            onConfirm: () => {
                                // 1. Remove associated user from backend database
                                apiRequest('/users/' + profId, { method: 'DELETE' }).then(() => {
                                    // 2. Remove from professionals list
                                    professionals = professionals.filter(p => String(p.id) !== String(profId));
                                    saveProfessionals(professionals);

                                    showToast(`Profissional ${profObj.name} excluído(a) com sucesso!`, 'success');
                                    
                                    // Reload page to sync the whole UI state
                                    setTimeout(() => window.location.reload(), 1000);
                                }).catch(err => {
                                    console.error("Erro ao excluir funcionário do backend:", err);
                                    showToast("Erro ao excluir profissional.", "error");
                                });

                            }
                        });
                    });
                });

                // Attach active card click handlers for editing (Admin only)
                activeGrid.querySelectorAll('.active-prof-card').forEach(card => {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', (e) => {
                        // Ignore if click was on the delete button
                        if (e.target.closest('.btn-delete-professional')) return;
                        
                        const delBtn = card.querySelector('.btn-delete-professional');
                        if (delBtn) {
                            const profId = delBtn.dataset.profId;
                            if (profId) {
                                openProfessionalModal(profId);
                            }
                        }
                    });
                });
            }
        }

        // 2. Render Pending Requests (Admin only)
        if (session.role === 'funcionario') {
            if (pendingSection) pendingSection.style.display = 'none';
            return;
        }

        let pendingUsers = [];
        try {
            pendingUsers = await apiRequest('/users?role=funcionario&status=pendente');
        } catch (e) {
            console.error("Erro ao carregar funcionários pendentes:", e);
        }

        // Update pending badge
        if (pendingBadge) {
            pendingBadge.textContent = pendingUsers.length;
            pendingBadge.style.display = pendingUsers.length > 0 ? '' : 'none';
        }

        if (pendingUsers.length === 0) {
            if (pendingSection) pendingSection.style.display = 'none';
            return;
        }

        if (pendingSection) pendingSection.style.display = '';
        if (!pendingList) return;

        pendingList.innerHTML = pendingUsers.map(u => {
            const words = u.name.split(' ');
            const initials = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
            
            return `
                <div class="pending-item" data-user-email="${u.email}">
                    <div class="pending-avatar">${initials}</div>
                    <div class="pending-info">
                        <span class="pending-name">${u.name}</span>
                        <div class="pending-details">
                            <span>📧 ${u.email}</span>
                            <span>📱 ${u.phone}</span>
                            <span>📅 Cadastrado em: ${formatDateBR(new Date(u.createdAt))}</span>
                        </div>
                    </div>
                    <div class="pending-actions">
                        <div class="commission-input-wrapper">
                            <label>Comissão:</label>
                            <input type="number" class="commission-input" value="35" min="0" max="100" id="comm-${u.id}">
                            <span style="font-size: 15px; font-weight: 600; color: #616161;">%</span>
                        </div>
                        <button class="btn-approve" data-user-id="${u.id}">Aprovar</button>
                        <button class="btn-reject" data-user-id="${u.id}">Recusar</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach action click listeners
        pendingList.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                const commInput = document.getElementById(`comm-${userId}`);
                const percent = commInput ? parseInt(commInput.value) || 35 : 35;
                
                approveEmployee(userId, percent);
            });
        });

        pendingList.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                rejectEmployee(userId);
            });
        });
    }

    /** Approve pending employee request */
    async function approveEmployee(userId, percentual) {
        try {
            await apiRequest('/users/' + userId, {
                method: 'PUT',
                body: {
                    status: 'ativo',
                    percentual: percentual
                }
            });

            // Sync dynamic professionals
            await syncRegisteredEmployees();
            professionals = await loadProfessionals();

            showToast(`Acesso aprovado com ${percentual}% de comissão!`, 'success');
            
            // Refresh
            await renderProfessionalsPage();
            await updateAdminSidebarBadge();
            
            // Re-render columns in calendar headers (reloads page cell count)
            setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
            console.error("Erro ao aprovar funcionário:", e);
            showToast("Erro ao aprovar funcionário.", "error");
        }
    }

    /** Reject pending employee request */
    async function rejectEmployee(userId) {
        try {
            await apiRequest('/users/' + userId, { method: 'DELETE' });
            showToast(`Cadastro rejeitado e excluído.`, 'warning');
            
            // Refresh
            await renderProfessionalsPage();
            await updateAdminSidebarBadge();
        } catch (e) {
            console.error("Erro ao rejeitar funcionário:", e);
            showToast("Erro ao rejeitar funcionário.", "error");
        }
    }


    /** Services Page dynamic rendering */
    async function renderServicesPage() {
        const grid = document.getElementById('servicesListGrid');
        const servicesCount = document.getElementById('servicesCount');
        if (!grid) return;

        // Sempre busca dados frescos do banco ao entrar na página
        grid.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Carregando serviços...</div>';
        try {
            services = await loadServices();
        } catch(e) {
            grid.innerHTML = '<div style="text-align:center;padding:40px;color:#e74c3c;">Erro ao carregar serviços. Verifique a conexão.</div>';
            return;
        }

        if (servicesCount) {
            servicesCount.textContent = `${services.length} ${services.length === 1 ? 'serviço' : 'serviços'}`;
        }

        // Group services by niche
        const niches = {};
        services.forEach(s => {
            const nicheName = s.niche || 'Outros';
            if (!niches[nicheName]) niches[nicheName] = [];
            niches[nicheName].push(s);
        });

        let html = '';
        let index = 0;

        for (const [nicheName, nicheServices] of Object.entries(niches)) {
            // First accordion open by default
            const isActive = index === 0 ? ' active' : '';
            index++;

            // Find appropriate icon for default categories
            let iconSvg = '';
            const normalized = nicheName.toLowerCase();
            if (normalized.includes('cabelo')) {
                iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="6" cy="6" r="3"/>
                    <path d="M8.12 8.12L12 12"/>
                    <path d="M20 4L8.12 15.88"/>
                    <circle cx="6" cy="18" r="3"/>
                    <path d="M14.8 14.8L20 20"/>
                </svg>`;
            } else if (normalized.includes('manicure') || normalized.includes('unha') || normalized.includes('pedicure')) {
                iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/>
                    <path d="M7 10v6a5 5 0 0 0 10 0v-6"/>
                    <path d="M12 16v6"/>
                </svg>`;
            } else if (normalized.includes('maquiagem') || normalized.includes('make')) {
                iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>`;
            } else if (normalized.includes('estética') || normalized.includes('estetica') || normalized.includes('pele') || normalized.includes('facial') || normalized.includes('corporal')) {
                iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>`;
            } else if (normalized.includes('sobrancelha') || normalized.includes('olho') || normalized.includes('cílios') || normalized.includes('cilios')) {
                iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>`;
            } else {
                // Fallback elegant generic list icon
                iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>`;
            }

            html += `
                <div class="niche-card-accordion${isActive}" data-niche="${nicheName}">
                    <div class="niche-card-header">
                        <div class="niche-card-header-left">
                            <div class="niche-card-icon-wrapper">
                                ${iconSvg}
                            </div>
                            <div class="niche-card-title-group">
                                <h4 class="niche-card-title">${nicheName}</h4>
                                <span class="niche-card-subtitle">${nicheServices.length} ${nicheServices.length === 1 ? 'serviço cadastrado' : 'serviços cadastrados'}</span>
                            </div>
                        </div>
                        <div class="niche-card-chevron">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                    
                    <div class="niche-card-content">
                        <div class="services-subgrid">
                            ${nicheServices.map(s => {
                                const cardAttrs = session.role === 'admin' 
                                    ? `class="service-item-card btn-edit-service-trigger" data-service-id="${s.id}" style="cursor: pointer;"` 
                                    : `class="service-item-card"`;
                                return `
                                    <div ${cardAttrs}>
                                        <div class="service-item-header">
                                            <span class="service-item-name">${s.name}</span>
                                            <span class="service-item-price">${parseFloat(s.price) === 0 ? 'A combinar' : formatCurrencyBRL(s.price)}</span>
                                        </div>
                                        <p class="service-item-desc">Procedimento de excelência de ${nicheName.toLowerCase()} para sua beleza e bem-estar no Studio Raio do Sol.</p>
                                        <div class="service-item-meta">
                                            <span>⏱ ${s.duration} min</span>
                                            <span class="service-premium-badge">✓ Premium</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;

        // Attach click listeners to headers for toggling accordion
        grid.querySelectorAll('.niche-card-header').forEach(header => {
            header.addEventListener('click', () => {
                const parent = header.closest('.niche-card-accordion');
                parent.classList.toggle('active');
            });
        });

        // Click listeners to service cards for editing are handled via global event delegation.
    }

    let serviceModal = null;

    /** Populates the service category select dropdown with default and user-defined categories */
    function populateNicheDropdown() {
        if (!serviceModal) return;
        const nicheSelect = serviceModal.querySelector('#svcNiche');
        if (!nicheSelect) return;
        
        const defaultNiches = ['Cabelo', 'Manicure', 'Maquiagem', 'Estética', 'Sobrancelha'];
        // Scan current services in localStorage for custom categories
        const existingNiches = Array.from(new Set(services.map(s => s.niche).filter(Boolean)));
        
        const allNiches = [...defaultNiches];
        existingNiches.forEach(n => {
            if (!allNiches.some(existing => existing.toLowerCase() === n.toLowerCase())) {
                allNiches.push(n);
            }
        });
        
        const currentValue = nicheSelect.value;
        nicheSelect.innerHTML = `
            <option value="">Selecione um nicho</option>
            ${allNiches.map(n => `<option value="${n}">${n}</option>`).join('')}
            <option value="__NEW__">+ Adicionar Nova Categoria...</option>
        `;
        
        if (currentValue && Array.from(nicheSelect.options).some(o => o.value === currentValue)) {
            nicheSelect.value = currentValue;
        }
    }

    /** Open the service modal dynamically (creation or editing/deletion) */
    function openServiceModal(editServiceId = null) {
        const formatBRL = (val) => {
            if (val === undefined || val === null || val === '') return '';
            const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d]/g, '')) / 100;
            if (isNaN(num)) return '';
            return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        const isEdit = editServiceId !== null;
        const serviceObj = isEdit ? services.find(s => String(s.id) === String(editServiceId)) : null;

        // If editing but service doesn't exist, ignore
        if (isEdit && !serviceObj) return;

        // If the modal DOM element already exists, remove it first to rebuild it with correct context (edit vs create)
        const oldModal = document.getElementById('serviceModal');
        if (oldModal) oldModal.remove();

        serviceModal = document.createElement('div');
        serviceModal.id = 'serviceModal';
        serviceModal.className = 'modal-overlay';
        
        const titleText = isEdit ? 'Editar Serviço' : 'Novo Serviço';
        const submitText = isEdit ? 'SALVAR ALTERAÇÕES' : 'CRIAR SERVIÇO';
        
        const nameVal = isEdit ? serviceObj.name : '';
        const priceVal = isEdit ? formatBRL(serviceObj.price) : '';
        
        const deleteBtnHTML = isEdit 
            ? `<button type="button" class="btn btn-secondary btn-delete-modal-service" style="background: var(--error); border: none; color: #fff; margin-right: auto; box-shadow: 0 4px 12px rgba(239, 83, 80, 0.3);">EXCLUIR</button>`
            : '';

        serviceModal.innerHTML = `
            <div class="modal-card glass-card appt-modal-card">
                <div class="appt-modal-header">
                    <h2 class="modal-title">${titleText}</h2>
                    <button class="appt-modal-close" id="btnCloseServiceModal" aria-label="Fechar">&times;</button>
                </div>
                <form id="newServiceForm" class="appt-form" novalidate>
                    <div class="form-group">
                        <label for="svcName" class="form-label">Nome do Serviço</label>
                        <input type="text" id="svcName" class="form-input" value="${nameVal}" placeholder="Ex: Manicure Decorada" required autocomplete="off">
                        <span class="form-error" id="svcNameError"></span>
                    </div>

                    <div class="form-group">
                        <label for="svcNiche" class="form-label">Nicho / Categoria</label>
                        <select id="svcNiche" class="form-input appt-select" required>
                            <!-- Populated dynamically by populateNicheDropdown() -->
                        </select>
                        <span class="form-error" id="svcNicheError"></span>
                    </div>

                    <div class="form-group" id="svcNewNicheGroup" style="display: none; margin-top: 12px;">
                        <label for="svcNewNiche" class="form-label">Nome da Nova Categoria</label>
                        <input type="text" id="svcNewNiche" class="form-input" placeholder="Ex: Podologia" autocomplete="off">
                        <span class="form-error" id="svcNewNicheError"></span>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="svcPrice" class="form-label">Preço (R$)</label>
                            <input type="text" id="svcPrice" class="form-input" value="${priceVal}" placeholder="R$ 0,00" required autocomplete="off" style="text-align: left;">
                            <span class="form-error" id="svcPriceError"></span>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Duração</label>
                            <div style="display: flex; gap: 8px;">
                                <select id="svcDurationHours" class="form-input appt-select" style="flex: 1; min-width: 0; padding-right: 8px;">
                                    <!-- Populated dynamically -->
                                </select>
                                <select id="svcDurationMinutes" class="form-input appt-select" style="flex: 1; min-width: 0; padding-right: 8px;">
                                    <!-- Populated dynamically -->
                                </select>
                            </div>
                            <span class="form-error" id="svcDurationError"></span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 14px; position: relative;">
                        <label class="form-label" style="font-weight:600; color:var(--neutral-800); margin-bottom:8px; display:block;">Profissionais que realizam o serviço</label>
                        <div class="dropdown-select-container" style="position: relative;">
                            <button type="button" id="btnSelectProfsDropdown" class="form-input" style="display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid var(--neutral-300); text-align: left; cursor: pointer; width: 100%; height: auto; min-height: 42px; padding: 8px 12px; font-size: 0.9rem; color: var(--neutral-700); border-radius: var(--radius-md); box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); transition: all 0.2s;">
                                <span id="btnSelectProfsText">Selecionar Profissionais...</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 8px; transition: transform 0.2s; color: var(--gold-500);" class="chevron-icon">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            <div id="profsDropdownList" class="glass-card" style="display: none; position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 999; background: rgba(255, 255, 255, 0.98); border: 1px solid var(--gold-300); border-radius: var(--radius-md); box-shadow: 0 10px 25px rgba(0,0,0,0.1), 0 4px 12px rgba(201, 168, 76, 0.05); max-height: 220px; overflow-y: auto; padding: 8px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                        <div id="selectedProfsChips" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;">
                            <!-- Populated dynamically -->
                        </div>
                    </div>

                    <div class="modal-actions" style="display: flex; gap: 8px; align-items: center; width: 100%;">
                        ${deleteBtnHTML}
                        <button type="button" class="btn btn-secondary" id="btnCancelService">CANCELAR</button>
                        <button type="submit" class="btn btn-primary">
                            <span class="btn-text">${submitText}</span>
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(serviceModal);

        // Populate Hours & Minutes Dropdowns
        const durationTotal = isEdit ? serviceObj.duration : 60;
        const defaultHours = Math.floor(durationTotal / 60);
        const defaultMins = durationTotal % 60;

        const hoursSelect = serviceModal.querySelector('#svcDurationHours');
        const minsSelect = serviceModal.querySelector('#svcDurationMinutes');
        if (hoursSelect && minsSelect) {
            let hoursHTML = '';
            for (let h = 0; h <= 8; h++) {
                const selected = h === defaultHours ? 'selected' : '';
                hoursHTML += `<option value="${h}" ${selected}>${h}h</option>`;
            }
            hoursSelect.innerHTML = hoursHTML;

            let minsHTML = '';
            for (let m = 0; m < 60; m += 5) {
                const selected = m === defaultMins ? 'selected' : '';
                const mStr = String(m).padStart(2, '0');
                minsHTML += `<option value="${m}" ${selected}>${mStr}min</option>`;
            }
            minsSelect.innerHTML = minsHTML;
        }

        // Price currency masking
        const priceInput = serviceModal.querySelector('#svcPrice');
        if (priceInput) {
            priceInput.addEventListener('input', (e) => {
                let cleanVal = e.target.value.replace(/[^\d]/g, '');
                if (!cleanVal) {
                    e.target.value = '';
                    return;
                }
                const num = parseFloat(cleanVal) / 100;
                e.target.value = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            });
            // Focus out validation format check
            priceInput.addEventListener('blur', (e) => {
                if (e.target.value === 'R$\u00A00,00' || e.target.value === 'R$ 0,00') {
                    e.target.value = '';
                }
            });
        }

        // Add dropdown change listener to toggle custom category input field
        const nicheSelect = serviceModal.querySelector('#svcNiche');
        if (nicheSelect) {
            nicheSelect.addEventListener('change', (e) => {
                const newNicheGroup = serviceModal.querySelector('#svcNewNicheGroup');
                const newNicheInput = serviceModal.querySelector('#svcNewNiche');
                if (e.target.value === '__NEW__') {
                    newNicheGroup.style.display = 'block';
                    newNicheInput.focus();
                } else {
                    newNicheGroup.style.display = 'none';
                    newNicheInput.value = '';
                }
            });
        }

        // Setup multi-select professionals dropdown
        const btnDropdown = serviceModal.querySelector('#btnSelectProfsDropdown');
        const listDropdown = serviceModal.querySelector('#profsDropdownList');
        const chipsContainer = serviceModal.querySelector('#selectedProfsChips');
        const chevron = btnDropdown.querySelector('.chevron-icon');

        // Toggle dropdown open/close
        btnDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = listDropdown.style.display === 'block';
            listDropdown.style.display = isOpen ? 'none' : 'block';
            chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        });

        // Close dropdown when clicking outside
        const closeDropdownOnOutsideClick = (e) => {
            if (listDropdown && btnDropdown && !btnDropdown.contains(e.target) && !listDropdown.contains(e.target)) {
                listDropdown.style.display = 'none';
                chevron.style.transform = 'rotate(0deg)';
            }
        };
        document.addEventListener('click', closeDropdownOnOutsideClick);

        // Render the professionals list inside the dropdown
        if (listDropdown) {
            listDropdown.innerHTML = professionals.map(p => {
                const isChecked = isEdit && serviceObj.professionals && serviceObj.professionals.includes(p.id) ? 'checked' : '';
                const pInitials = p.initials || p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const avatarBg = p.color || 'var(--gold-500)';
                return `
                    <label class="dropdown-item-prof">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: ${avatarBg}; color: #fff; font-size: 14px; font-weight: 700;">
                                ${pInitials}
                            </span>
                            <span>${p.name}</span>
                        </div>
                        <input type="checkbox" class="svc-prof-checkbox" value="${p.id}" ${isChecked} style="accent-color: var(--gold-500); width: 16px; height: 16px; cursor: pointer;">
                    </label>
                `;
            }).join('');
        }

        // Render the selected professional chips and update the text of the button
        function updateSelectedProfsUI() {
            const checkedBoxes = Array.from(serviceModal.querySelectorAll('.svc-prof-checkbox:checked'));
            const selectedIds = checkedBoxes.map(cb => cb.value);

            // Update button label text
            const btnText = serviceModal.querySelector('#btnSelectProfsText');
            if (selectedIds.length === 0) {
                btnText.textContent = 'Selecionar Profissionais...';
            } else if (selectedIds.length === 1) {
                btnText.textContent = '1 profissional selecionado';
            } else {
                btnText.textContent = `${selectedIds.length} profissionais selecionados`;
            }

            // Render chips
            if (chipsContainer) {
                chipsContainer.innerHTML = selectedIds.map(id => {
                    const p = professionals.find(prof => prof.id === id);
                    if (!p) return '';
                    const pInitials = p.initials || p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const avatarBg = p.color || 'var(--gold-500)';
                    return `
                        <div class="selected-prof-chip" data-prof-id="${p.id}" style="display: flex; align-items: center; gap: 6px; background: var(--gold-50); border: 1px solid var(--gold-200); padding: 4px 10px; border-radius: 20px; font-size: 0.9375rem; color: var(--gold-800); font-weight: 500;">
                            <span style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: ${avatarBg}; color: #fff; font-size: 13px; font-weight: 700;">
                                ${pInitials}
                            </span>
                            <span>${p.name}</span>
                            <span class="btn-remove-chip" style="cursor: pointer; font-size: 16px; font-weight: 700; margin-left: 2px; color: var(--gold-600); display: flex; align-items: center;" data-prof-id="${p.id}">&times;</span>
                        </div>
                    `;
                }).join('');

                // Wire up click event for remove chips
                chipsContainer.querySelectorAll('.btn-remove-chip').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const profId = btn.dataset.profId;
                        const targetCheckbox = serviceModal.querySelector(`.svc-prof-checkbox[value="${profId}"]`);
                        if (targetCheckbox) {
                            targetCheckbox.checked = false;
                            updateSelectedProfsUI();
                        }
                    });
                });
            }
        }

        // Handle checkbox change in dropdown
        serviceModal.querySelectorAll('.svc-prof-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedProfsUI);
        });

        // Initialize UI
        updateSelectedProfsUI();

        populateNicheDropdown();

        // If editing, set the default niche value
        if (isEdit && nicheSelect) {
            nicheSelect.value = serviceObj.niche || '';
        }

        // Add close event listeners
        const closeBtn = serviceModal.querySelector('#btnCloseServiceModal');
        const cancelBtn = serviceModal.querySelector('#btnCancelService');
        const deleteSvcBtn = serviceModal.querySelector('.btn-delete-modal-service');
        
        const close = () => {
            document.removeEventListener('click', closeDropdownOnOutsideClick);
            serviceModal.classList.remove('active');
            setTimeout(() => {
                if (serviceModal) serviceModal.remove();
                serviceModal = null;
            }, 300);
        };
        
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (cancelBtn) cancelBtn.addEventListener('click', close);
        serviceModal.addEventListener('click', (e) => {
            if (e.target === serviceModal) {
                close();
            }
        });

        // Delete Service Action
        if (deleteSvcBtn) {
            deleteSvcBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirmDialog({
                    title: 'Excluir Serviço',
                    message: `Tem certeza que deseja excluir o serviço <strong>${serviceObj.name}</strong>? Esta ação removerá o serviço do catálogo de forma irreversível.`,
                    confirmText: 'Excluir',
                    onConfirm: async () => {
                        try {
                            await deleteService(String(editServiceId));
                            services = services.filter(s => String(s.id) !== String(editServiceId));
                            populateMainFilters();
                            showToast(`Serviço "${serviceObj.name}" excluído com sucesso!`, 'success');
                            close();
                            renderServicesPage();
                        } catch(e) {
                            showToast('Erro ao excluir serviço: ' + e.message, 'error');
                        }
                    }
                });
            });
        }

        // Form submission
        const form = serviceModal.querySelector('#newServiceForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = serviceModal.querySelector('#svcName');
            const niche = serviceModal.querySelector('#svcNiche');
            const price = serviceModal.querySelector('#svcPrice');
            const durationHours = serviceModal.querySelector('#svcDurationHours');
            const durationMins = serviceModal.querySelector('#svcDurationMinutes');
            const newNicheInput = serviceModal.querySelector('#svcNewNiche');

            let isValid = true;

            const showErr = (input, errId, msg) => {
                input.classList.add('error');
                const errEl = serviceModal.querySelector('#' + errId);
                if (errEl) {
                    errEl.textContent = msg;
                    errEl.classList.add('visible');
                }
                isValid = false;
            };

            // Clear errors
            serviceModal.querySelectorAll('.form-error').forEach(err => {
                err.textContent = '';
                err.classList.remove('visible');
            });
            serviceModal.querySelectorAll('.form-input').forEach(inp => inp.classList.remove('error'));

            if (!name.value.trim()) showErr(name, 'svcNameError', 'Informe o nome do serviço');
            
            let finalNiche = '';
            if (niche.value === '__NEW__') {
                if (!newNicheInput.value.trim()) {
                    showErr(newNicheInput, 'svcNewNicheError', 'Informe o nome da nova categoria');
                } else {
                    finalNiche = newNicheInput.value.trim();
                }
            } else if (!niche.value) {
                showErr(niche, 'svcNicheError', 'Selecione um nicho');
            } else {
                finalNiche = niche.value;
            }

            const rawPrice = price.value.replace(/[^\d]/g, '');
            const parsedPrice = rawPrice ? parseFloat(rawPrice) / 100 : 0;
            const parsedDuration = (parseInt(durationHours.value) * 60) + parseInt(durationMins.value);

            if (parsedPrice <= 0) showErr(price, 'svcPriceError', 'Informe um preço válido');
            if (parsedDuration < 5) {
                showErr(durationHours, 'svcDurationError', 'Informe uma duração válida');
                durationMins.classList.add('error');
            }

            if (!isValid) return;

            // Collect selected professionals
            const selectedProfs = Array.from(serviceModal.querySelectorAll('.svc-prof-checkbox:checked')).map(cb => String(cb.value));

            if (isEdit) {
                // Update existing service
                const svcIndex = services.findIndex(s => String(s.id) === String(editServiceId));
                if (svcIndex !== -1) {
                    const updatedData = {
                        name: name.value.trim(),
                        price: parsedPrice,
                        duration: parsedDuration,
                        niche: finalNiche,
                        professionals: selectedProfs
                    };
                    try {
                        await updateService(String(editServiceId), updatedData);
                        services[svcIndex] = { ...services[svcIndex], ...updatedData };
                        populateMainFilters();
                        showToast(`Serviço "${updatedData.name}" atualizado com sucesso!`, 'success');
                    } catch(e) {
                        showToast('Erro ao atualizar serviço: ' + e.message, 'error');
                    }
                }
            } else {
                // Create new service via API
                const newServiceData = {
                    name: name.value.trim(),
                    price: parsedPrice,
                    duration: parsedDuration,
                    niche: finalNiche,
                    professionals: selectedProfs
                };
                try {
                    const saved = await createService(newServiceData);
                    // Use server-generated ID
                    services.push(saved);
                    populateMainFilters();
                    showToast(`Serviço "${saved.name}" criado com sucesso!`, 'success');
                } catch(e) {
                    showToast('Erro ao criar serviço: ' + e.message, 'error');
                }
            }

            // Re-render services page list
            renderServicesPage();
            close();
        });

        // Trigger show transition
        setTimeout(() => {
            if (serviceModal) serviceModal.classList.add('active');
        }, 10);
    }


    // Attach click delegation for Adicionar Serviço, Adicionar Cliente, and service cards
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btnAdicionarServico')) {
            e.preventDefault();
            openServiceModal();
        }
        if (e.target.closest('#btnAdicionarCliente')) {
            e.preventDefault();
            openClientModal();
        }
        
        // Dynamic delegation for editing service cards (Admin only)
        const serviceCard = e.target.closest('.btn-edit-service-trigger');
        if (serviceCard) {
            e.preventDefault();
            e.stopPropagation();
            if (session.role !== 'admin') {
                showToast('Apenas administradores podem editar serviços.', 'warning');
                return;
            }
            const serviceId = serviceCard.dataset.serviceId;
            openServiceModal(serviceId);
        }
    });

    /** Clients Database Page rendering */
    async function renderClientsPage() {
        const tbody = document.getElementById('clientsTableBody');
        const clientsCount = document.getElementById('clientsCount');
        if (!tbody) return;

        clients = await loadClients();
        recalculateClientLevels();

        if (clientsCount) {
            clientsCount.textContent = `${clients.length} ${clients.length === 1 ? 'registro' : 'registros'}`;
        }

        // Adjust Table Header dynamically based on role (actions are available to both, but width differs)
        const headerRow = document.querySelector('#clientsTable thead tr');
        if (headerRow) {
            let actionsHeader = headerRow.querySelector('.th-actions-client');
            if (!actionsHeader) {
                const th = document.createElement('th');
                th.className = 'th-actions-client';
                th.style.width = session.role === 'admin' ? '100px' : '60px';
                th.style.textAlign = 'center';
                th.textContent = 'Ações';
                headerRow.appendChild(th);
            } else {
                actionsHeader.style.width = session.role === 'admin' ? '100px' : '60px';
            }
        }

        const totalColumns = 7;

        if (clients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${totalColumns}" class="clients-empty">Nenhum cliente cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = clients.map((c, idx) => {
            const clientAppts = appointments.filter(a => a.client.toLowerCase().trim() === c.name.toLowerCase().trim());
            const totalVisitas = clientAppts.length;

            let lastApptStr = 'Nenhum agendamento';
            if (totalVisitas > 0) {
                clientAppts.sort((a,b) => new Date(b.date + 'T' + b.timeStart) - new Date(a.date + 'T' + a.timeStart));
                const lastAppt = clientAppts[0];
                const dateObj = new Date(lastAppt.date + 'T00:00:00');
                lastApptStr = `${formatDateBR(dateObj)} às ${lastAppt.timeStart}`;
            }

            const level = (c.level || 'Novo').toUpperCase();
            let badgeClass = 'clients-badge--novo';
            let badgeText = 'Novo';
            if (level === 'VIP') {
                badgeClass = 'clients-badge--vip';
                badgeText = 'VIP';
            } else if (level === 'FREGUÊS' || level === 'FREGUES' || level === 'FREGUÊS (REGULAR)') {
                badgeClass = 'clients-badge--fregues';
                badgeText = 'Freguês';
            }

            const words = c.name.trim().split(/\s+/);
            const initials = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
            const avatarColor = getClientAvatarColor(c.name);

            let avatarContent = '';
            if (c.avatar) {
                avatarContent = `<img src="${c.avatar}" alt="${c.name}" class="clients-avatar-img">`;
            } else {
                avatarContent = `<div class="clients-avatar-initials">${initials}</div>`;
            }

            const scheduleButton = `
                <button class="btn-schedule-client" data-client-id="${c.id}" title="Agendar Horário" style="background: none; border: none; color: var(--neutral-400); cursor: pointer; padding: 6px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease; margin-right: 6px;" onmouseover="this.style.color='var(--gold-600)'" onmouseout="this.style.color='var(--neutral-400)'">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </button>
            `;
            
            const deleteButton = session.role === 'admin' ? `
                <button class="btn-delete-client" data-client-id="${c.id}" title="Excluir Cliente" style="background: none; border: none; color: var(--neutral-400); cursor: pointer; padding: 6px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--neutral-400)'">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            ` : '';

            const actionsCell = `<td class="clients-cell clients-cell--actions" style="text-align: center;">
                ${scheduleButton}
                ${deleteButton}
            </td>`;

            return `
                <tr class="clients-row tr-clickable"
                    data-client-id="${c.id}"
                    data-client-name="${c.name.replace(/"/g,"&quot;")}"
                    data-client-phone="${c.phone}"
                    data-badge-class="${badgeClass}"
                    data-badge-text="${badgeText}"
                    data-last-appt="${lastApptStr.replace(/"/g,"&quot;")}"
                    data-visits="${totalVisitas}"
                    data-avatar-color="${avatarColor}"
                    style="animation-delay: ${idx * 0.04}s">
                    <td class="clients-cell clients-cell--avatar">
                        <div class="clients-avatar" style="background:${avatarColor};" data-client-id="${c.id}" title="Clique para adicionar foto">
                            ${avatarContent}
                            <div class="clients-avatar-overlay">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            </div>
                        </div>
                    </td>
                    <td class="clients-cell clients-cell--name">${c.name}</td>
                    <td class="clients-cell clients-cell--phone">${c.phone}</td>
                    <td class="clients-cell clients-cell--badge"><span class="clients-badge ${badgeClass}">${badgeText}</span></td>
                    <td class="clients-cell clients-cell--last">${lastApptStr}</td>
                    <td class="clients-cell clients-cell--visits">${totalVisitas}</td>
                    ${actionsCell}
                </tr>
            `;
        }).join('');

        // Attach avatar click handlers
        tbody.querySelectorAll('.clients-avatar').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const clientId = el.dataset.clientId;
                if (clientId) {
                    openClientAvatarUpload(clientId);
                }
            });
        });

        // Attach schedule quick shortcut click handlers (Admin & Employee)
        tbody.querySelectorAll('.btn-schedule-client').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const clientId = btn.dataset.clientId;
                const clientObj = clients.find(c => String(c.id) === String(clientId));
                if (clientObj) {
                    openAppointmentModal(null, clientObj);
                }
            });
        });

        // Attach client delete click handlers (Admin only)
        if (session.role === 'admin') {
            tbody.querySelectorAll('.btn-delete-client').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const clientId = btn.dataset.clientId;
                    const clientObj = clients.find(c => String(c.id) === String(clientId));
                    if (!clientObj) return;

                    showConfirmDialog({
                        title: 'Excluir Cliente',
                        message: `Tem certeza que deseja excluir o(a) cliente <strong>${clientObj.name}</strong>? Esta ação é irreversível e removerá seu cadastro do banco.`,
                        confirmText: 'Excluir',
                        onConfirm: async () => {
                            const updatedClients = clients.filter(c => String(c.id) !== String(clientId));
                            await saveClients(updatedClients);
                            showToast(`Cliente ${clientObj.name} excluído(a) com sucesso!`, 'success');
                            await renderClientsPage();
                        }
                    });
                });
            });
        }

        // Attach row click handlers
        tbody.querySelectorAll('.clients-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Ignore clicks on avatar element or actions buttons
                if (e.target.closest('.clients-cell--avatar') || e.target.closest('.clients-cell--actions')) {
                    return;
                }

                const clientId = row.dataset.clientId;
                if (!clientId) return;

                // Mobile: abrir bottom sheet com todas as informações
                if (window.innerWidth <= 900) {
                    const clientObj = clients.find(c => String(c.id) === String(clientId));
                    const badgeClass = row.dataset.badgeClass || '';
                    const badgeText = row.dataset.badgeText || '';
                    const lastAppt = row.dataset.lastAppt || 'Nenhum';
                    const visits = row.dataset.visits || '0';
                    const avatarColor = row.dataset.avatarColor || '#C9A84C';

                    const avatarEl = row.querySelector('.clients-avatar');
                    let avatarHtml = '';
                    if (avatarEl) {
                        const img = avatarEl.querySelector('img');
                        if (img) {
                            avatarHtml = `<div class="mobile-sheet-avatar"><img src="${img.src}" alt="${row.dataset.clientName}"></div>`;
                        } else {
                            const initials = (row.dataset.clientName || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
                            avatarHtml = `<div class="mobile-sheet-avatar" style="background:${avatarColor};">${initials}</div>`;
                        }
                    }

                    const actions = [];
                    if (session.role === 'admin' || session.role === 'employee') {
                        actions.push({
                            label: 'Agendar',
                            style: 'mod-btn--primary',
                            icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
                            onClick: () => {
                                if (clientObj) openAppointmentModal(null, clientObj);
                            }
                        });
                    }
                    if (session.role === 'admin') {
                        actions.push({
                            label: 'Ver Perfil',
                            style: 'mod-btn--secondary',
                            icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
                            onClick: () => openClientModal(clientId)
                        });
                    }

                    showMobileDetailSheet({
                        title: row.dataset.clientName || 'Cliente',
                        subtitle: row.dataset.clientPhone || '',
                        avatarHtml,
                        sections: [
                            {
                                label: 'Informações',
                                fields: [
                                    { label: 'Telefone', value: row.dataset.clientPhone || '—', fullWidth: true },
                                    { label: 'Classificação', value: `<span class="clients-badge ${badgeClass}">${badgeText}</span>` },
                                    { label: 'Total de Visitas', value: `${visits} visita${Number(visits) !== 1 ? 's' : ''}` },
                                    { label: 'Último Agendamento', value: lastAppt, fullWidth: true },
                                ]
                            }
                        ],
                        actions
                    });
                } else {
                    // Desktop: abrir modal de edição
                    openClientModal(clientId);
                }
            });
        });
    }

    /** Hidden file input for avatar uploads */
    let avatarFileInput = null;
    let avatarUploadClientId = null;

    /** Open file picker to upload a client photo */
    function openClientAvatarUpload(clientId) {
        if (!avatarFileInput) {
            avatarFileInput = document.createElement('input');
            avatarFileInput.type = 'file';
            avatarFileInput.accept = 'image/*';
            avatarFileInput.style.display = 'none';
            document.body.appendChild(avatarFileInput);

            avatarFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file || !avatarUploadClientId) return;

                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const clientsList = await loadClients();
                    const target = clientsList.find(c => String(c.id) === String(avatarUploadClientId));
                    if (target) {
                        target.avatar = ev.target.result;
                        await saveClients(clientsList);
                        await renderClientsPage();
                        showToast('Foto do cliente atualizada!', 'success');
                    }
                    avatarUploadClientId = null;
                    avatarFileInput.value = '';
                };
                reader.readAsDataURL(file);
            });
        }

        avatarUploadClientId = clientId;
        avatarFileInput.value = '';
        avatarFileInput.click();
    }

    let clientModal = null;

    /** Open the client creation modal dynamically */
    function openClientModal(editClientId = null) {
        const isEdit = editClientId !== null;
        const clientObj = isEdit ? clients.find(c => String(c.id) === String(editClientId)) : null;

        // Recreate the modal overlay element to prefill and construct with correct state (create vs edit)
        const oldModal = document.getElementById('clientModal');
        if (oldModal) oldModal.remove();
        clientModal = null;

        clientModal = document.createElement('div');
        clientModal.id = 'clientModal';
        clientModal.className = 'modal-overlay';
        
        const titleText = isEdit ? 'Editar Cliente' : 'Novo Cliente';
        const submitText = isEdit ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR CLIENTE';
        
        const nameVal = isEdit ? clientObj.name : '';
        const phoneVal = isEdit ? clientObj.phone : '';
        const levelVal = isEdit ? getClientLevel(clientObj.name) : 'Novo';
        
        let clientPhotoData = isEdit ? clientObj.avatar : null;
        const photoPreviewContent = clientPhotoData 
            ? `<img src="${clientPhotoData}" alt="Foto" class="client-photo-img">`
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
        const photoBorder = clientPhotoData ? 'border: none;' : '';

        clientModal.innerHTML = `
            <div class="modal-card glass-card appt-modal-card">
                <div class="appt-modal-header">
                    <h2 class="modal-title">${titleText}</h2>
                    <button class="appt-modal-close" id="btnCloseClientModal" aria-label="Fechar">&times;</button>
                </div>
                <form id="newClientForm" class="appt-form" novalidate>
                    <div class="form-group">
                        <label for="clientNameInput" class="form-label">Nome Completo</label>
                        <input type="text" id="clientNameInput" class="form-input" value="${nameVal}" placeholder="Ex: Carolina Mendes" required autocomplete="off">
                        <span class="form-error" id="clientNameError"></span>
                    </div>

                    <div class="form-group">
                        <label for="clientPhoneInput" class="form-label">Número de Telefone</label>
                        <input type="text" id="clientPhoneInput" class="form-input" value="${phoneVal}" placeholder="Ex: (11) 99999-8888" required autocomplete="off">
                        <span class="form-error" id="clientPhoneError"></span>
                    </div>

                    <div class="form-group">
                        <label for="clientLevelInput" class="form-label">Classificação / Nível (Calculado Automático)</label>
                        <select id="clientLevelInput" class="form-input appt-select" disabled>
                            <option value="Novo" ${levelVal === 'Novo' ? 'selected' : ''}>Novo Cliente (0-2 visitas)</option>
                            <option value="Freguês" ${levelVal === 'Freguês' ? 'selected' : ''}>Freguês (Regular) (3-9 visitas)</option>
                            <option value="VIP" ${levelVal === 'VIP' ? 'selected' : ''}>VIP (10+ visitas)</option>
                        </select>
                        <span class="form-error" id="clientLevelError"></span>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Foto do Cliente</label>
                        <div class="client-photo-upload" id="clientPhotoUpload">
                            <div class="client-photo-preview" id="clientPhotoPreview" style="${photoBorder}">
                                ${photoPreviewContent}
                            </div>
                            <span class="client-photo-label">Clique para adicionar foto</span>
                            <input type="file" id="clientPhotoInput" accept="image/*" hidden>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" id="btnCancelClient">CANCELAR</button>
                        <button type="submit" class="btn btn-primary">
                            <span class="btn-text">${submitText}</span>
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(clientModal);

        // Photo upload handler
        const photoPreview = clientModal.querySelector('#clientPhotoPreview');
        const photoInput = clientModal.querySelector('#clientPhotoInput');
        const photoUpload = clientModal.querySelector('#clientPhotoUpload');

        if (photoUpload && photoInput) {
            photoUpload.addEventListener('click', () => photoInput.click());
            photoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    clientPhotoData = ev.target.result;
                    photoPreview.innerHTML = `<img src="${clientPhotoData}" alt="Foto" class="client-photo-img">`;
                    photoPreview.style.border = 'none';
                };
                reader.readAsDataURL(file);
            });
        }

        // Add close event listeners
        const closeBtn = clientModal.querySelector('#btnCloseClientModal');
        const cancelBtn = clientModal.querySelector('#btnCancelClient');
        
        const close = () => {
            clientModal.classList.remove('active');
            const form = clientModal.querySelector('#newClientForm');
            if (form) form.reset();

            clientModal.querySelectorAll('.form-error').forEach(err => {
                err.textContent = '';
                err.classList.remove('visible');
            });
            clientModal.querySelectorAll('.form-input').forEach(inp => inp.classList.remove('error'));

            // Reset photo
            clientPhotoData = null;
            if (photoPreview) {
                photoPreview.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
                photoPreview.style.border = '';
            }
            if (photoInput) photoInput.value = '';
        };
        
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (cancelBtn) cancelBtn.addEventListener('click', close);
        clientModal.addEventListener('click', (e) => {
            if (e.target === clientModal) close();
        });

        // Form submission
        const form = clientModal.querySelector('#newClientForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = clientModal.querySelector('#clientNameInput');
            const phone = clientModal.querySelector('#clientPhoneInput');
            const level = clientModal.querySelector('#clientLevelInput');

            let isValid = true;

            const showErr = (input, errId, msg) => {
                input.classList.add('error');
                const errEl = clientModal.querySelector('#' + errId);
                if (errEl) {
                    errEl.textContent = msg;
                    errEl.classList.add('visible');
                }
                isValid = false;
            };

            // Clear errors
            clientModal.querySelectorAll('.form-error').forEach(err => {
                err.textContent = '';
                err.classList.remove('visible');
            });
            clientModal.querySelectorAll('.form-input').forEach(inp => inp.classList.remove('error'));

            if (!name.value.trim()) showErr(name, 'clientNameError', 'Informe o nome completo do cliente');
            if (!phone.value.trim()) showErr(phone, 'clientPhoneError', 'Informe o número de telefone');

            if (!isValid) return;

            const clientName = name.value.trim();
            const computedLevel = getClientLevel(clientName);

            if (isEdit) {
                // Find and update client in array
                const cIndex = clients.findIndex(c => String(c.id) === String(editClientId));
                if (cIndex !== -1) {
                    clients[cIndex].name = clientName;
                    clients[cIndex].phone = phone.value.trim();
                    clients[cIndex].level = computedLevel;
                    if (clientPhotoData) {
                        clients[cIndex].avatar = clientPhotoData;
                    }
                    await saveClients(clients);
                    showToast(`Cliente "${clients[cIndex].name}" atualizado com sucesso!`, 'success');
                }
            } else {
                // Create new client
                const newClient = {
                    id: Date.now(),
                    name: clientName,
                    phone: phone.value.trim(),
                    level: computedLevel
                };

                if (clientPhotoData) {
                    newClient.avatar = clientPhotoData;
                }

                clients.push(newClient);
                await saveClients(clients);
                showToast(`Cliente "${newClient.name}" cadastrado com sucesso!`, 'success');
            }

            // Re-render clients table list
            await renderClientsPage();

            close();
        });

        // Re-trigger show transition
        setTimeout(() => clientModal.classList.add('active'), 10);
    }

    let profModal = null;

    /** Open the professional manage modal dynamically */
    async function openProfessionalModal(profId) {
        const profObj = professionals.find(p => String(p.id) === String(profId));
        if (!profObj) return;

        let uObj = {};
        try {
            const userSnap = await apiRequest(`/users/${profObj.id}`);
            if (userSnap) {
                uObj = userSnap;
            }
        } catch (e) {
            console.error("Erro ao carregar dados do profissional do backend:", e);
        }

        const emailVal = uObj.email || profObj.email || '';
        const phoneVal = uObj.phone || '';
        const passwordVal = uObj.password || '123456';
        const commissionVal = uObj.percentual || profObj.percentual || 35;
        const specialtyVal = uObj.specialty || profObj.specialty || 'Cabelo';

        // Load recent completed appointments for activity logs
        const recentAppts = appointments
            .filter(a => String(a.professionalId) === String(profObj.id) && a.status === 'Concluído')
            .sort((a,b) => new Date(b.date + 'T' + b.timeStart) - new Date(a.date + 'T' + a.timeStart))
            .slice(0, 5);

        // Calculate dynamic professional performance metrics
        const completedAppts = appointments.filter(a => String(a.professionalId) === String(profObj.id) && a.status === 'Concluído');
        const totalFaturamento = completedAppts.reduce((acc, a) => acc + a.servicePrice, 0);
        const comissao = totalFaturamento * (commissionVal / 100);
        const studioShare = totalFaturamento - comissao;
        const uniqueClients = new Set(completedAppts.map(a => a.client.trim().toLowerCase())).size;

        let profPhotoData = profObj.avatar || null;
        const photoPreviewContent = profPhotoData 
            ? `<img src="${profPhotoData}" alt="Foto" class="prof-photo-img">`
            : `<div class="active-prof-avatar" style="background: ${profObj.color}; width: 68px; height: 68px; font-size: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin: 0 auto;">${profObj.initials}</div>`;
        const photoBorder = profPhotoData ? 'border: none;' : '';

        // Always recreate the modal overlay element to prefill and construct with fresh state
        const oldModal = document.getElementById('profModal');
        if (oldModal) oldModal.remove();
        profModal = null;

        profModal = document.createElement('div');
        profModal.id = 'profModal';
        profModal.className = 'modal-overlay';

        profModal.innerHTML = `
            <div class="modal-card glass-card appt-modal-card" style="max-width: 780px; width: 90%; animation: serviceCardFadeIn 0.3s ease both;">
                <div class="appt-modal-header">
                    <h2 class="modal-title" style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; color: var(--gold-800);">Gerenciar Profissional</h2>
                    <button class="appt-modal-close" id="btnCloseProfModal" aria-label="Fechar">&times;</button>
                </div>
                <div class="prof-modal-grid">
                    <!-- Left Column: Edit Form -->
                    <form id="editProfForm" class="appt-form" novalidate style="margin: 0;">
                        <div class="form-group" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">
                            <label class="form-label" style="align-self: flex-start;">Foto do Profissional</label>
                            <div class="prof-photo-upload" id="profPhotoUpload" style="width: 100%; max-width: 220px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                <div class="prof-photo-preview" id="profPhotoPreview" style="${photoBorder}">
                                    ${photoPreviewContent}
                                </div>
                                <span class="prof-photo-label" style="font-size: 14px; color: var(--gold-600); font-weight: 600;">Alterar Foto</span>
                                <input type="file" id="profPhotoInput" accept="image/*" hidden>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="profNameInput" class="form-label">Nome Completo</label>
                            <input type="text" id="profNameInput" class="form-input" value="${profObj.name}" required autocomplete="off">
                            <span class="form-error" id="profNameError"></span>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="profEmailInput" class="form-label">E-mail</label>
                                <input type="email" id="profEmailInput" class="form-input" value="${emailVal}" required autocomplete="off">
                                <span class="form-error" id="profEmailError"></span>
                            </div>
                            <div class="form-group">
                                <label for="profPhoneInput" class="form-label">Telefone</label>
                                <input type="text" id="profPhoneInput" class="form-input" value="${phoneVal}" placeholder="Ex: (71) 98888-7777" required autocomplete="off">
                                <span class="form-error" id="profPhoneError"></span>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="profCommissionInput" class="form-label">Comissão (%)</label>
                                <input type="number" id="profCommissionInput" class="form-input" value="${commissionVal}" required min="0" max="100">
                                <span class="form-error" id="profCommissionError"></span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Especialidades (Categorias)</label>
                                <div class="specialties-chips-container" id="profSpecialtyChips"></div>
                                <input type="hidden" id="profSpecialtyInput" value="${specialtyVal}">
                                <span class="form-error" id="profSpecialtyError"></span>
                            </div>
                        </div>

                        <div class="form-group" style="position: relative;">
                            <label for="profPasswordInput" class="form-label">Senha de Acesso</label>
                            <div style="position: relative; display: flex; align-items: center;">
                                <input type="password" id="profPasswordInput" class="form-input" value="${passwordVal}" required autocomplete="off" style="padding-right: 44px; width: 100%;">
                                <button type="button" id="btnToggleProfPassword" style="position: absolute; right: 10px; background: none; border: none; color: var(--gold-600); cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                            <span class="form-error" id="profPasswordError"></span>
                        </div>

                        <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 8px;">
                            <button type="button" class="btn btn-secondary" id="btnCancelProf" style="margin: 0; flex: 1;">CANCELAR</button>
                            <button type="submit" class="btn btn-primary" style="margin: 0; flex: 1.5;">SALVAR</button>
                        </div>
                    </form>

                    <!-- Right Column: Performance Metrics, Activity Logs & Jump Actions -->
                    <div class="prof-modal-right-col">
                        
                        <!-- Performance Metrics Section -->
                        <div>
                            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--neutral-800); margin: 0 0 10px 0; font-family: var(--font-display);">Métricas de Desempenho</h4>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                <div style="background: rgba(201, 168, 76, 0.03); border: 1.5px solid rgba(201, 168, 76, 0.08); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 2px 8px rgba(154, 123, 31, 0.02);">
                                    <span style="font-size: 14px; text-transform: uppercase; color: var(--neutral-500); font-weight: 700; letter-spacing: 0.5px;">Serviços Realizados</span>
                                    <span style="font-size: 1.15rem; font-weight: 700; color: var(--neutral-800);">${completedAppts.length}</span>
                                </div>
                                <div style="background: rgba(201, 168, 76, 0.03); border: 1.5px solid rgba(201, 168, 76, 0.08); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 2px 8px rgba(154, 123, 31, 0.02);">
                                    <span style="font-size: 14px; text-transform: uppercase; color: var(--neutral-500); font-weight: 700; letter-spacing: 0.5px;">Faturamento</span>
                                    <span style="font-size: 1.15rem; font-weight: 700; color: var(--neutral-800);">${formatCurrencyBRL(totalFaturamento)}</span>
                                </div>
                                <div style="background: rgba(76, 175, 80, 0.02); border: 1.5px solid rgba(76, 175, 80, 0.08); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 2px 8px rgba(76, 175, 80, 0.01);">
                                    <span style="font-size: 14px; text-transform: uppercase; color: #388E3C; font-weight: 700; letter-spacing: 0.5px;">Comissão</span>
                                    <span style="font-size: 1.15rem; font-weight: 700; color: #388E3C;">${formatCurrencyBRL(comissao)}</span>
                                </div>
                                <div style="background: rgba(66, 165, 245, 0.02); border: 1.5px solid rgba(66, 165, 245, 0.08); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 2px 8px rgba(66, 165, 245, 0.01);">
                                    <span style="font-size: 14px; text-transform: uppercase; color: #1976D2; font-weight: 700; letter-spacing: 0.5px;">Lucro Studio</span>
                                    <span style="font-size: 1.15rem; font-weight: 700; color: #1976D2;">${formatCurrencyBRL(studioShare)}</span>
                                </div>
                                <div style="background: rgba(201, 168, 76, 0.03); border: 1.5px solid rgba(201, 168, 76, 0.08); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 4px; grid-column: span 2; box-shadow: 0 2px 8px rgba(154, 123, 31, 0.02);">
                                    <span style="font-size: 14px; text-transform: uppercase; color: var(--neutral-500); font-weight: 700; letter-spacing: 0.5px;">Clientes Atendidos</span>
                                    <span style="font-size: 1.05rem; font-weight: 700; color: var(--neutral-800);">${uniqueClients} ${uniqueClients === 1 ? 'cliente único' : 'clientes únicos'}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Activity Logs Section -->
                        <div>
                            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--neutral-800); margin: 0 0 10px 0; font-family: var(--font-display);">Serviços Recentes</h4>
                            <div id="profActivityLogs" style="display: flex; flex-direction: column; gap: 8px; max-height: 120px; overflow-y: auto; padding-right: 4px;">
                                ${recentAppts.length === 0 
                                    ? `<p style="color: var(--neutral-500); font-size: 0.9375rem; margin: 0; text-align: center; padding: 20px 0; background: rgba(0,0,0,0.01); border-radius: var(--radius-sm);">Nenhum serviço realizado ainda.</p>` 
                                    : recentAppts.map(a => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(201, 168, 76, 0.04); border: 1px solid rgba(201, 168, 76, 0.1); border-radius: var(--radius-sm); font-size: 0.9375rem;">
                                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                                <strong style="color: var(--neutral-800);">${a.serviceName}</strong>
                                                <span style="color: var(--neutral-600);">Cli: ${a.client} | ${formatDateBR(new Date(a.date + 'T00:00:00'))}</span>
                                            </div>
                                            <span style="font-weight: 600; color: var(--gold-700);">${formatCurrencyBRL(a.servicePrice)}</span>
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>

                        <!-- Actions Section -->
                        <div>
                            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--neutral-800); margin: 0 0 10px 0; font-family: var(--font-display);">Ações Rápidas</h4>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button type="button" class="mod-btn mod-btn--gold" id="btnJumpToReport" style="width: 100%; justify-content: center; height: 38px; box-shadow: 0 4px 10px rgba(201, 168, 76, 0.12); margin: 0;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                    Ver Relatório Individual
                                </button>
                                <button type="button" class="btn btn-secondary" id="btnDeleteProfFromModal" style="width: 100%; justify-content: center; height: 38px; background: var(--error); border: none; color: #fff; box-shadow: 0 4px 12px rgba(239, 83, 80, 0.15); margin: 0;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    Excluir Profissional
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(profModal);

        const close = () => {
            profModal.classList.remove('active');
            setTimeout(() => {
                if (profModal) profModal.remove();
                profModal = null;
            }, 300);
        };

        // Attach close listeners
        const closeBtn = profModal.querySelector('#btnCloseProfModal');
        const cancelBtn = profModal.querySelector('#btnCancelProf');
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (cancelBtn) cancelBtn.addEventListener('click', close);
        profModal.addEventListener('click', (e) => {
            if (e.target === profModal) close();
        });

        // Toggle password visibility
        const btnTogglePass = profModal.querySelector('#btnToggleProfPassword');
        const passInput = profModal.querySelector('#profPasswordInput');
        if (btnTogglePass && passInput) {
            btnTogglePass.addEventListener('click', (e) => {
                e.stopPropagation();
                const isPass = passInput.type === 'password';
                passInput.type = isPass ? 'text' : 'password';
                btnTogglePass.querySelector('svg').style.color = isPass ? 'var(--neutral-900)' : 'var(--gold-600)';
            });
        }

        // Jump to Relatório
        const btnJump = profModal.querySelector('#btnJumpToReport');
        if (btnJump) {
            btnJump.addEventListener('click', (e) => {
                e.stopPropagation();
                close();

                // Switch to reports page in sidebar
                const navItem = document.querySelector('.sidebar-nav-item[data-page="relatorios"]');
                if (navItem) {
                    navItem.click();
                }

                // Set reports filter to this professional
                const filterSelect = document.getElementById('filterReportProfissional');
                if (filterSelect) {
                    filterSelect.value = profObj.id;
                    filterSelect.dispatchEvent(new Event('change'));
                }
            });
        }

        // Professional Photo upload handler
        const profPhotoPreview = profModal.querySelector('#profPhotoPreview');
        const profPhotoInput = profModal.querySelector('#profPhotoInput');
        const profPhotoUpload = profModal.querySelector('#profPhotoUpload');

        if (profPhotoUpload && profPhotoInput) {
            profPhotoUpload.addEventListener('click', () => profPhotoInput.click());
            profPhotoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    profPhotoData = ev.target.result;
                    profPhotoPreview.innerHTML = `<img src="${profPhotoData}" alt="Foto" class="prof-photo-img">`;
                    profPhotoPreview.style.border = 'none';
                };
                reader.readAsDataURL(file);
            });
        }

        // Render specialty chips
        const chipsContainer = profModal.querySelector('#profSpecialtyChips');
        const hiddenSpecialtyInput = profModal.querySelector('#profSpecialtyInput');
        if (chipsContainer && hiddenSpecialtyInput) {
            const allSpecialties = ['Cabelo', 'Manicure', 'Maquiagem', 'Estética', 'Sobrancelha', 'Depilação', 'Cílios'];
            const activeSpecialties = specialtyVal.split(',').map(s => s.trim().toLowerCase());
            
            chipsContainer.innerHTML = allSpecialties.map(spec => {
                const isActive = activeSpecialties.includes(spec.toLowerCase()) || 
                                 (spec === 'Manicure' && activeSpecialties.includes('manicure / pedicure'));
                return `
                    <div class="specialty-chip ${isActive ? 'active' : ''}" data-value="${spec}">
                        <span>${spec}</span>
                        <svg class="chip-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                `;
            }).join('');

            // Click handlers for the chips
            const chips = chipsContainer.querySelectorAll('.specialty-chip');
            chips.forEach(chip => {
                chip.addEventListener('click', () => {
                    chip.classList.toggle('active');

                    // Update hidden input value
                    const selected = Array.from(chipsContainer.querySelectorAll('.specialty-chip.active'))
                        .map(c => c.dataset.value);
                    hiddenSpecialtyInput.value = selected.join(', ');
                });
            });
        }

        // Delete professional button inside modal
        const btnDeleteModal = profModal.querySelector('#btnDeleteProfFromModal');
        if (btnDeleteModal) {
            btnDeleteModal.addEventListener('click', (e) => {
                e.stopPropagation();
                close();
                // Trigger the existing delete click flow
                const activeGrid = document.getElementById('activeProfessionalsGrid');
                if (activeGrid) {
                    const existingDeleteBtn = activeGrid.querySelector(`.btn-delete-professional[data-prof-id="${profObj.id}"]`);
                    if (existingDeleteBtn) {
                        existingDeleteBtn.click();
                    }
                }
            });
        }

        // Submit form save logic
        const editForm = profModal.querySelector('#editProfForm');
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const pName = profModal.querySelector('#profNameInput');
            const pEmail = profModal.querySelector('#profEmailInput');
            const pPhone = profModal.querySelector('#profPhoneInput');
            const pCommission = profModal.querySelector('#profCommissionInput');
            const pSpecialty = profModal.querySelector('#profSpecialtyInput');
            const pPassword = profModal.querySelector('#profPasswordInput');

            let isValid = true;

            const showErr = (input, errId, msg) => {
                input.classList.add('error');
                const errEl = profModal.querySelector('#' + errId);
                if (errEl) {
                    errEl.textContent = msg;
                    errEl.classList.add('visible');
                }
                isValid = false;
            };

            // Clear errors
            profModal.querySelectorAll('.form-error').forEach(err => {
                err.textContent = '';
                err.classList.remove('visible');
            });
            profModal.querySelectorAll('.form-input').forEach(inp => inp.classList.remove('error'));

            const oldName = profObj.name;
            const newName = pName.value.trim();
            const newEmail = pEmail.value.trim();
            const newPhone = pPhone.value.trim();
            const newCommission = parseInt(pCommission.value);
            const newSpecialty = pSpecialty.value;
            const newPassword = pPassword.value.trim();

            if (!newName) showErr(pName, 'profNameError', 'Informe o nome completo');
            if (!newEmail || !newEmail.includes('@')) showErr(pEmail, 'profEmailError', 'Informe um e-mail válido');
            if (!newPhone) showErr(pPhone, 'profPhoneError', 'Informe o telefone');
            if (isNaN(newCommission) || newCommission < 0 || newCommission > 100) showErr(pCommission, 'profCommissionError', 'Informe um percentual de 0 a 100');
            if (!newPassword) showErr(pPassword, 'profPasswordError', 'Informe a senha de acesso');

            if (!isValid) return;

            try {
                // Update in backend
                await apiRequest(`/users/${profObj.id}`, {
                    method: 'PUT',
                    body: {
                        name: newName,
                        email: newEmail,
                        phone: newPhone,
                        percentual: newCommission,
                        specialty: newSpecialty,
                        password: newPassword,
                        avatar: profPhotoData || null
                    }
                });

                // Update in professionals local list if present
                const profIndex = professionals.findIndex(p => String(p.id) === String(profObj.id));
                if (profIndex !== -1) {
                    professionals[profIndex].name = newName;
                    professionals[profIndex].percentual = newCommission;
                    professionals[profIndex].specialty = newSpecialty;
                    professionals[profIndex].initials = newName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    professionals[profIndex].avatar = profPhotoData;
                }

                // Update session if it's the currently logged-in user
                const currentSession = JSON.parse(sessionStorage.getItem('raiosol_session') || '{}');
                if (currentSession.id && String(currentSession.id) === String(profObj.id)) {
                    currentSession.name = newName;
                    currentSession.email = newEmail;
                    currentSession.foto = profPhotoData || null;
                    sessionStorage.setItem('raiosol_session', JSON.stringify(currentSession));
                }

                showToast(`Profissional "${newName}" atualizado com sucesso!`, 'success');
                close();
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                console.error("Erro ao atualizar profissional no Firestore:", err);
                showToast("Erro ao atualizar profissional.", "error");
            }
        });

        // Trigger dynamic active class for transitions
        setTimeout(() => profModal.classList.add('active'), 10);
    }

    /** Populate the professional filter dropdown in reports */
    function populateReportProfFilter() {
        const select = document.getElementById('filterReportProfissional');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">Todos os Profissionais</option>' +
            professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        if (currentVal) select.value = currentVal;
    }

    /** Get filtered appointments based on report filter selections */
    function getFilteredReportAppts() {
        const profId = document.getElementById('filterReportProfissional')?.value || '';
        const dateStart = document.getElementById('filterReportDateStart')?.value || '';
        const dateEnd = document.getElementById('filterReportDateEnd')?.value || '';

        let filtered = [...appointments];

        if (profId) {
            filtered = filtered.filter(a => 
                String(a.professionalId) === String(profId) ||
                (a.isMutual && String(a.professionalId2) === String(profId))
            );
        }

        if (dateStart) {
            filtered = filtered.filter(a => a.date >= dateStart);
        }

        if (dateEnd) {
            filtered = filtered.filter(a => a.date <= dateEnd);
        }

        return filtered;
    }

    /** Update the individual professional report summary card */
    function updateIndividualReportCard(filteredAppts, selectedProfId) {
        const card = document.getElementById('individualReportCard');
        if (!card) return;

        if (!selectedProfId) {
            card.classList.add('hidden');
            return;
        }

        const prof = professionals.find(p => String(p.id) === String(selectedProfId));
        if (!prof) {
            card.classList.add('hidden');
            return;
        }

        const completed = filteredAppts.filter(a => a.status === 'Concluído');
        const pct = prof.percentual || 35;
        let totalFaturamento = 0;
        let comissao = 0;
        let studioShare = 0;
        completed.forEach(a => {
            if (a.isMutual) {
                totalFaturamento += a.servicePrice / 2;
                comissao += a.servicePrice * 0.25;
                studioShare += a.servicePrice * 0.25;
            } else {
                const price = a.servicePrice || 0;
                totalFaturamento += price;
                const c = price * (pct / 100);
                comissao += c;
                studioShare += (price - c);
            }
        });
        const uniqueClients = new Set(completed.map(a => a.client.trim().toLowerCase())).size;

        const dateStart = document.getElementById('filterReportDateStart')?.value || '';
        const dateEnd = document.getElementById('filterReportDateEnd')?.value || '';
        let periodText = '';
        if (dateStart && dateEnd) {
            periodText = `Período: ${formatDateBR(new Date(dateStart + 'T00:00:00'))} — ${formatDateBR(new Date(dateEnd + 'T00:00:00'))}`;
        } else if (dateStart) {
            periodText = `A partir de ${formatDateBR(new Date(dateStart + 'T00:00:00'))}`;
        } else if (dateEnd) {
            periodText = `Até ${formatDateBR(new Date(dateEnd + 'T00:00:00'))}`;
        } else {
            periodText = 'Todos os períodos';
        }

        document.getElementById('indivReportAvatar').textContent = prof.initials;
        document.getElementById('indivReportAvatar').style.background = `linear-gradient(135deg, ${prof.color || '#C9A84C'}, ${prof.color || '#C9A84C'}dd)`;
        document.getElementById('indivReportName').textContent = prof.name;
        document.getElementById('indivReportPeriod').textContent = periodText;
        document.getElementById('indivReportServicos').textContent = completed.length;
        document.getElementById('indivReportFaturamento').textContent = formatCurrencyBRL(totalFaturamento);
        document.getElementById('indivReportComissao').textContent = formatCurrencyBRL(comissao);
        document.getElementById('indivReportPct').textContent = pct;
        document.getElementById('indivReportStudio').textContent = formatCurrencyBRL(studioShare);
        document.getElementById('indivReportClientes').textContent = uniqueClients;

        card.classList.remove('hidden');
    }

    /** Reports Page (Admin consolidate or Employee breakdown) */
    async function renderReportsPage() {
        // Sempre busca dados frescos
        try {
            const [profs, appts] = await Promise.all([loadProfessionals(), loadAppointments()]);
            professionals = profs;
            appointments = appts;
        } catch(e) {
            console.warn('Aviso ao carregar relatórios:', e.message);
        }

        const adminStats = document.getElementById('adminFinancialStats');
        const employeeStats = document.getElementById('employeeFinancialStats');
        const titleEl = document.getElementById('relatoriosTitle');
        const subtitleEl = document.getElementById('relatoriosSubtitle');
        const filterSection = document.getElementById('reportsFilterSection');
        const filterBar = document.getElementById('reportsFilterBar');
        const tableTitle = document.getElementById('relatoriosTableTitle');
        const tableCount = document.getElementById('reportsTableCount');
        const thead = document.getElementById('reportsTableHead');
        const tbody = document.getElementById('reportsTableBody');

        populateReportProfFilter();
        const selectedProfId = document.getElementById('filterReportProfissional')?.value || '';


        if (session.role === 'admin') {
            if (adminStats) adminStats.classList.remove('hidden');
            if (employeeStats) employeeStats.classList.add('hidden');
            if (filterSection) filterSection.classList.remove('hidden');
            if (filterBar) filterBar.classList.remove('hidden');

            const filteredAppts = getFilteredReportAppts();
            const completed = filteredAppts.filter(a => a.status === 'Concluído');
            const grossBilling = completed.reduce((acc, appt) => acc + appt.servicePrice, 0);

            let totalPaidCommissions = 0;
            
            completed.forEach(appt => {
                if (appt.isMutual) {
                    totalPaidCommissions += appt.servicePrice * 0.50;
                } else {
                    const prof = professionals.find(p => String(p.id) === String(appt.professionalId))
                                 || professionals.find(p => p.name.toLowerCase() === appt.professionalName.toLowerCase());
                    const pct = prof ? prof.percentual || 35 : 35;
                    totalPaidCommissions += appt.servicePrice * (pct / 100);
                }
            });

            const netProfit = grossBilling - totalPaidCommissions;

            document.getElementById('valFaturamentoBruto').textContent = formatCurrencyBRL(grossBilling);
            document.getElementById('valTotalComissoes').textContent = formatCurrencyBRL(totalPaidCommissions);
            document.getElementById('valLucroLiquido').textContent = formatCurrencyBRL(netProfit);

            if (titleEl) {
                titleEl.textContent = selectedProfId
                    ? 'Relatório Individual do Profissional'
                    : 'Faturamento Consolidado do Studio';
            }
            if (subtitleEl) {
                subtitleEl.textContent = selectedProfId
                    ? 'Análise detalhada de serviços e comissões do profissional selecionado'
                    : 'Visão consolidada do faturamento do studio';
            }
            if (tableTitle) {
                tableTitle.textContent = selectedProfId
                    ? 'Histórico de Serviços Realizados pelo Profissional'
                    : 'Histórico Geral de Serviços Realizados';
            }
            if (tableCount) {
                tableCount.textContent = `${filteredAppts.length} ${filteredAppts.length === 1 ? 'registro' : 'registros'}`;
            }

            updateIndividualReportCard(filteredAppts, selectedProfId);

            if (thead) {
                const actionsHeader = session.role === 'admin' ? '<th class="th-actions-report" style="width: 60px; text-align: center;">Ações</th>' : '';
                thead.innerHTML = `
                    <tr>
                        <th>Serviço</th>
                        <th>Profissional</th>
                        <th>Cliente</th>
                        <th>Data</th>
                        <th>Valor Total</th>
                        <th>Repasse Profissional</th>
                        <th>Lucro Studio</th>
                        <th>Status</th>
                        ${actionsHeader}
                    </tr>
                `;
            }

            if (tbody) {
                const totalCols = session.role === 'admin' ? 9 : 8;
                if (filteredAppts.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align: center; color: #9E9E9E; padding: 40px 20px;">Nenhum agendamento encontrado para o filtro selecionado.</td></tr>`;
                    return;
                }

                tbody.innerHTML = filteredAppts.map(appt => {
                    let commValue = 0;
                    let studioShare = 0;
                    let profNameDisplay = appt.professionalName;
                    let initialsDisplay = appt.professionalInitials || 'PR';
                    let colorDisplay = appt.professionalColor || '#C9A84C';

                    if (appt.isMutual) {
                        commValue = appt.servicePrice * 0.50;
                        studioShare = appt.servicePrice * 0.50;
                        profNameDisplay = `${appt.professionalName} & ${appt.professionalName2} (Mútuo)`;
                        initialsDisplay = `${appt.professionalInitials || 'P1'}+${appt.professionalInitials2 || 'P2'}`;
                    } else {
                        const prof = professionals.find(p => String(p.id) === String(appt.professionalId))
                                     || professionals.find(p => p.name.toLowerCase() === appt.professionalName.toLowerCase());
                        const pct = prof ? prof.percentual || 35 : 35;
                        commValue = appt.servicePrice * (pct / 100);
                        studioShare = appt.servicePrice - commValue;
                    }

                    const statusClass = appt.status === 'Concluído' ? 'professional-item__status--ativo' : 
                                        appt.status === 'Cancelado' ? 'professional-item__status--inativo' : 'status-pending';

                    const actionsCell = session.role === 'admin'
                        ? `<td class="td-report-actions" style="text-align: center;">
                            <button class="btn-delete-report-appt" data-appt-id="${appt.id}" title="Excluir Registro do Histórico" style="background: none; border: none; color: var(--neutral-400); cursor: pointer; padding: 6px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--neutral-400)'">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                           </td>`
                        : '';

                    const statusBadge = `<span class="professional-item__status ${statusClass}" style="font-size: 14px; padding: 3px 8px; border-radius: 20px;">${appt.status || 'Agendado'}</span>`;
                    const dateStr = `${formatDateBR(new Date(appt.date + 'T00:00:00'))} às ${appt.timeStart}`;

                    return `
                        <tr class="tr-clickable"
                            data-appt-id="${appt.id}"
                            data-service="${appt.serviceName.replace(/"/g, '&quot;')}"
                            data-prof="${profNameDisplay.replace(/"/g, '&quot;')}"
                            data-client="${appt.client.replace(/"/g, '&quot;')}"
                            data-date="${dateStr.replace(/"/g, '&quot;')}"
                            data-total="${parseFloat(appt.servicePrice) === 0 ? 'A combinar' : formatCurrencyBRL(appt.servicePrice)}"
                            data-comm="${formatCurrencyBRL(commValue)}"
                            data-studio="${formatCurrencyBRL(studioShare)}"
                            data-status-class="${statusClass}"
                            data-status="${appt.status || 'Agendado'}">
                            <td class="td-report-service" style="font-weight: 600; color: var(--neutral-800);">${appt.serviceName}</td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="width: 22px; height: 22px; border-radius: 50%; background: ${colorDisplay}; color: #fff; font-size: 13px; font-weight: bold; display: flex; align-items: center; justify-content: center;">${initialsDisplay}</span>
                                    <span>${profNameDisplay}</span>
                                </div>
                            </td>
                            <td>${appt.client}</td>
                            <td>${dateStr}</td>
                            <td class="td-report-price" style="font-weight: 700; color: var(--neutral-800);">${parseFloat(appt.servicePrice) === 0 ? 'A combinar' : formatCurrencyBRL(appt.servicePrice)}</td>
                            <td class="td-report-comm" style="color: #FF9800; font-weight: 600;">${formatCurrencyBRL(commValue)}</td>
                            <td class="td-report-studio" style="color: #4CAF50; font-weight: 600;">${formatCurrencyBRL(studioShare)}</td>
                            <td class="td-report-status">${statusBadge}</td>
                            ${actionsCell}
                        </tr>
                    `;
                }).join('');

                // Attach delete button listeners (admin)
                if (session.role === 'admin') {
                    tbody.querySelectorAll('.btn-delete-report-appt').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const apptId = btn.dataset.apptId;
                            const apptObj = appointments.find(a => String(a.id) === String(apptId));
                            if (!apptObj) return;
                            showConfirmDialog({
                                title: 'Excluir do Histórico',
                                message: `Tem certeza que deseja excluir o serviço de <strong>${apptObj.client}</strong> (${apptObj.serviceName}) do histórico permanentemente?`,
                                confirmText: 'Excluir',
                                onConfirm: () => {
                                    appointments = appointments.filter(a => String(a.id) !== String(apptId));
                                    saveAppointments();
                                    showToast(`Registro de ${apptObj.client} excluído do histórico!`, 'success');
                                    renderReportsPage();
                                }
                            });
                        });
                    });
                }

                // Attach mobile row click handlers
                tbody.querySelectorAll('.tr-clickable').forEach(row => {
                    row.addEventListener('click', (e) => {
                        if (e.target.closest('.btn-delete-report-appt')) return;
                        if (window.innerWidth > 900) return;
                        const apptId = row.dataset.apptId;
                        const statusClass = row.dataset.statusClass || '';
                        const statusText = row.dataset.status || 'Agendado';
                        const actions = [];
                        if (session.role === 'admin') {
                            actions.push({
                                label: 'Excluir Registro',
                                style: 'mod-btn--danger',
                                icon: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
                                onClick: () => {
                                    const apptObj = appointments.find(a => String(a.id) === String(apptId));
                                    if (!apptObj) return;
                                    showConfirmDialog({
                                        title: 'Excluir do Histórico',
                                        message: `Excluir <strong>${apptObj.client}</strong> — ${apptObj.serviceName}?`,
                                        confirmText: 'Excluir',
                                        onConfirm: () => {
                                            appointments = appointments.filter(a => String(a.id) !== String(apptId));
                                            saveAppointments();
                                            showToast('Registro excluído!', 'success');
                                            renderReportsPage();
                                        }
                                    });
                                }
                            });
                        }
                        showMobileDetailSheet({
                            title: row.dataset.service || 'Serviço',
                            subtitle: `${row.dataset.date || ''}`,
                            sections: [
                                {
                                    label: 'Informações',
                                    fields: [
                                        { label: 'Profissional', value: row.dataset.prof || '—' },
                                        { label: 'Cliente', value: row.dataset.client || '—' },
                                        { label: 'Data', value: row.dataset.date || '—', fullWidth: true },
                                        { label: 'Status', value: `<span class="professional-item__status ${statusClass}" style="font-size: 14px;padding:3px 8px;border-radius:20px;">${statusText}</span>`, fullWidth: true },
                                    ]
                                },
                                {
                                    label: 'Valores',
                                    fields: [
                                        { label: 'Valor Total', value: row.dataset.total || '—' },
                                        { label: 'Repasse Prof.', value: row.dataset.comm || '—', color: '#FF9800' },
                                        { label: 'Lucro Studio', value: row.dataset.studio || '—', color: '#4CAF50' },
                                    ]
                                }
                            ],
                            actions
                        });
                    });
                });
            }
        } else {
            if (adminStats) adminStats.classList.add('hidden');
            if (employeeStats) employeeStats.classList.remove('hidden');
            if (filterSection) filterSection.classList.add('hidden');
            if (titleEl) titleEl.textContent = 'Minhas Comissões e Serviços';
            if (subtitleEl) subtitleEl.textContent = 'Demonstrativo completo dos seus serviços e ganhos';
            if (tableTitle) tableTitle.textContent = 'Serviços Realizados por Mim';

            const indivCard = document.getElementById('individualReportCard');
            if (indivCard) indivCard.classList.add('hidden');

            const myAppts = appointments.filter(a => 
                String(a.professionalId) === String(employeeProf.id) ||
                (a.isMutual && String(a.professionalId2) === String(employeeProf.id))
            );
            const myCompleted = myAppts.filter(a => a.status === 'Concluído');
            const commissionPercent = employeeProf.percentual || 30;
            
            let totalBilling = 0;
            let totalCommission = 0;
            myCompleted.forEach(appt => {
                if (appt.isMutual) {
                    totalBilling += appt.servicePrice / 2;
                    totalCommission += appt.servicePrice * 0.25;
                } else {
                    totalBilling += appt.servicePrice;
                    totalCommission += appt.servicePrice * (commissionPercent / 100);
                }
            });

            document.getElementById('valFaturamentoPessoal').textContent = formatCurrencyBRL(totalBilling);
            document.getElementById('valComissaoAcumulada').textContent = formatCurrencyBRL(totalCommission);
            document.getElementById('valServicosRealizados').textContent = myCompleted.length;

            if (tableCount) {
                tableCount.textContent = `${myAppts.length} ${myAppts.length === 1 ? 'registro' : 'registros'}`;
            }

            if (thead) {
                thead.innerHTML = `
                    <tr>
                        <th>Serviço</th>
                        <th>Cliente</th>
                        <th>Data</th>
                        <th>Valor Total</th>
                        <th>Minha Parte (${commissionPercent}%)</th>
                        <th>Parte do Studio (${100 - commissionPercent}%)</th>
                        <th>Status</th>
                    </tr>
                `;
            }

            if (tbody) {
                if (myAppts.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #9E9E9E; padding: 40px 20px;">Você ainda não possui agendamentos no histórico.</td></tr>';
                    return;
                }

                tbody.innerHTML = myAppts.map(appt => {
                    let priceVal = appt.servicePrice || 0;
                    let commValue = priceVal * (commissionPercent / 100);
                    let studioShare = priceVal - commValue;
                    let serviceNameDisplay = appt.serviceName;

                    if (appt.isMutual) {
                        priceVal = (appt.servicePrice || 0) / 2;
                        commValue = (appt.servicePrice || 0) * 0.25;
                        studioShare = (appt.servicePrice || 0) * 0.25;
                        serviceNameDisplay = `[Mútuo] ${appt.serviceName}`;
                    }

                    const statusClass = appt.status === 'Concluído' ? 'professional-item__status--ativo' : 
                                        appt.status === 'Cancelado' ? 'professional-item__status--inativo' : 'status-pending';
                    const statusBadge = `<span class="professional-item__status ${statusClass}" style="font-size: 14px; padding: 3px 8px; border-radius: 20px;">${appt.status || 'Agendado'}</span>`;
                    const dateStr = `${formatDateBR(new Date(appt.date + 'T00:00:00'))} às ${appt.timeStart}`;

                    return `
                        <tr class="tr-clickable"
                            data-service="${serviceNameDisplay.replace(/"/g,'&quot;')}"
                            data-client="${appt.client.replace(/"/g,'&quot;')}"
                            data-date="${dateStr}"
                            data-total="${priceVal === 0 ? 'A combinar' : formatCurrencyBRL(priceVal)}"
                            data-comm="${formatCurrencyBRL(commValue)}"
                            data-studio="${formatCurrencyBRL(studioShare)}"
                            data-status-class="${statusClass}"
                            data-status="${appt.status || 'Agendado'}">
                            <td class="td-report-service" style="font-weight: 600; color: var(--neutral-800);">${serviceNameDisplay}</td>
                            <td>${appt.client}</td>
                            <td>${dateStr}</td>
                            <td class="td-report-price" style="font-weight: 700; color: var(--neutral-800);">${priceVal === 0 ? 'A combinar' : formatCurrencyBRL(priceVal)}</td>
                            <td class="td-report-comm" style="color: #FF9800; font-weight: 600;">${formatCurrencyBRL(commValue)}</td>
                            <td class="td-report-studio" style="color: #4CAF50; font-weight: 600;">${formatCurrencyBRL(studioShare)}</td>
                            <td class="td-report-status">${statusBadge}</td>
                        </tr>
                    `;
                }).join('');

                // Attach mobile row click handlers
                tbody.querySelectorAll('.tr-clickable').forEach(row => {
                    row.addEventListener('click', () => {
                        if (window.innerWidth > 900) return;
                        const statusClass = row.dataset.statusClass || '';
                        const statusText = row.dataset.status || 'Agendado';
                        showMobileDetailSheet({
                            title: row.dataset.service || 'Serviço',
                            subtitle: row.dataset.date || '',
                            sections: [
                                {
                                    label: 'Informações',
                                    fields: [
                                        { label: 'Cliente', value: row.dataset.client || '—', fullWidth: true },
                                        { label: 'Data', value: row.dataset.date || '—', fullWidth: true },
                                        { label: 'Status', value: `<span class="professional-item__status ${statusClass}" style="font-size: 14px;padding:3px 8px;border-radius:20px;">${statusText}</span>`, fullWidth: true },
                                    ]
                                },
                                {
                                    label: 'Valores',
                                    fields: [
                                        { label: 'Valor Total', value: row.dataset.total || '—' },
                                        { label: 'Minha Parte', value: row.dataset.comm || '—', color: '#FF9800' },
                                        { label: 'Parte do Studio', value: row.dataset.studio || '—', color: '#4CAF50' },
                                    ]
                                }
                            ]
                        });
                    });
                });
            }
        }
    }

    // Set up report filter event listeners once
    function setupReportFilterListeners() {
        const btnApply = document.getElementById('btnApplyReportFilters');
        const btnClear = document.getElementById('btnClearReportFilters');

        if (btnApply) {
            btnApply.addEventListener('click', () => {
                renderReportsPage();
                showToast('Filtros aplicados com sucesso!', 'success');
            });
        }

        if (btnClear) {
            btnClear.addEventListener('click', () => {
                const profSelect = document.getElementById('filterReportProfissional');
                const dateStart = document.getElementById('filterReportDateStart');
                const dateEnd = document.getElementById('filterReportDateEnd');
                if (profSelect) profSelect.value = '';
                if (dateStart) dateStart.value = '';
                if (dateEnd) dateEnd.value = '';
                renderReportsPage();
                showToast('Filtros limpos.', 'info');
            });
        }
    }

    /** ===================================================
     *  CONTROLE DE MATERIAIS
     * =================================================== */

    // Profissional atualmente aberto no modal
    let _materialModalProf = null;

    async function renderMaterialsPage() {
        const grid = document.getElementById('materialsProfsGrid');
        if (!grid) return;

        // Carregar profissionais ativos
        let profs = [];
        try {
            profs = await apiRequest('/users?role=funcionario&status=ativo');
        } catch (e) {
            console.error("Erro ao carregar profissionais para materiais:", e);
        }

        // Carregar todas as retiradas para calcular contadores
        let allWithdrawals = [];
        try { allWithdrawals = await loadMaterials(); } catch (e) { /* silencioso */ }

        if (profs.length === 0) {
            grid.innerHTML = `<div class="materials-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;margin-bottom:12px;">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
                </svg>
                <p>Nenhum profissional ativo cadastrado.</p>
            </div>`;
            return;
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        const monthStr = new Date().toISOString().slice(0, 7);

        grid.innerHTML = profs.map(prof => {
            const profW = allWithdrawals.filter(w => w.profId === prof.id);
            const totalToday = profW.filter(w => w.date === todayStr).length;
            const totalMonth = profW.filter(w => w.date && w.date.startsWith(monthStr)).length;

            const avatarHTML = prof.avatar
                ? `<img src="${prof.avatar}" alt="${prof.name}" class="materials-card-avatar-img">`
                : `<div class="materials-card-avatar-initials" style="background:${prof.color || '#C9A84C'}">${prof.initials || prof.name.slice(0, 2).toUpperCase()}</div>`;

            return `
                <div class="materials-prof-card" data-prof-id="${prof.id}" role="button" tabindex="0" title="Ver retiradas de ${prof.name}">
                    <div class="materials-card-avatar-wrap">${avatarHTML}</div>
                    <div class="materials-card-info">
                        <span class="materials-card-name">${prof.name}</span>
                        <span class="materials-card-specialty">${prof.specialty || 'Profissional'}</span>
                    </div>
                    <div class="materials-card-stats">
                        <div class="materials-card-stat">
                            <span class="materials-card-stat-value">${totalToday}</span>
                            <span class="materials-card-stat-label">Hoje</span>
                        </div>
                        <div class="materials-card-stat-divider"></div>
                        <div class="materials-card-stat">
                            <span class="materials-card-stat-value">${totalMonth}</span>
                            <span class="materials-card-stat-label">Este mês</span>
                        </div>
                    </div>
                    <div class="materials-card-arrow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                </div>
            `;
        }).join('');

        // Eventos de clique nos cards
        grid.querySelectorAll('.materials-prof-card').forEach(card => {
            const profId = card.dataset.profId;
            const prof = profs.find(p => p.id === profId);
            const open = () => { if (prof) openMaterialModal(prof); };
            card.addEventListener('click', open);
            card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
        });
    }

    async function openMaterialModal(prof) {
        _materialModalProf = prof;
        const modal      = document.getElementById('materialModal');
        const nameEl     = document.getElementById('materialModalName');
        const specEl     = document.getElementById('materialModalSpecialty');
        const avatarEl   = document.getElementById('materialModalAvatar');
        const closeBtn   = document.getElementById('materialModalClose');
        const submitBtn  = document.getElementById('mfSubmitBtn');
        const dateInput  = document.getElementById('mfDate');
        if (!modal) return;

        // Preencher cabeçalho
        nameEl.textContent = prof.name;
        specEl.textContent = prof.specialty || 'Profissional';
        if (prof.avatar) {
            avatarEl.innerHTML = `<img src="${prof.avatar}" alt="${prof.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            avatarEl.style.background = '';
        } else {
            avatarEl.innerHTML = prof.initials || prof.name.slice(0, 2).toUpperCase();
            avatarEl.style.background = prof.color || '#C9A84C';
        }

        // Default: hoje
        dateInput.value = new Date().toISOString().slice(0, 10);
        document.getElementById('mfMaterial').value = '';
        document.getElementById('mfQty').value = '1';
        document.getElementById('mfUnit').value = 'un';
        document.getElementById('mfNote').value = '';

        // Exibir modal com animação
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => modal.classList.add('materials-modal-visible'));

        await renderMaterialHistory(prof.id);

        // Fechar modal
        const closeModal = () => {
            modal.classList.remove('materials-modal-visible');
            setTimeout(() => {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }, 280);
        };
        closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        // Registrar nova retirada
        submitBtn.onclick = async () => {
            const material = document.getElementById('mfMaterial').value.trim();
            const qty      = parseInt(document.getElementById('mfQty').value) || 1;
            const unit     = document.getElementById('mfUnit').value;
            const date     = document.getElementById('mfDate').value;
            const note     = document.getElementById('mfNote').value.trim();

            if (!material) { showToast('Informe o nome do material.', 'error'); document.getElementById('mfMaterial').focus(); return; }
            if (!date)     { showToast('Selecione a data.', 'error'); return; }

            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Registrando...';
            try {
                await saveMaterial({ profId: prof.id, profName: prof.name, material, qty, unit, date, note });
                showToast(`"${material}" registrado para ${prof.name}!`, 'success');
                document.getElementById('mfMaterial').value = '';
                document.getElementById('mfQty').value = '1';
                document.getElementById('mfNote').value = '';
                await renderMaterialHistory(prof.id);
                renderMaterialsPage(); // atualiza contadores
            } catch (err) {
                showToast('Erro: ' + (err.message || 'Falha ao registrar retirada.'), 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar`;
            }
        };
    }

    async function renderMaterialHistory(profId) {
        const container = document.getElementById('materialHistoryContainer');
        if (!container) return;
        container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--neutral-400);font-size:0.9rem;">Carregando histórico...</div>`;

        const withdrawals = await loadMaterials(profId);

        if (withdrawals.length === 0) {
            container.innerHTML = `<div class="materials-history-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;margin-bottom:8px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <p>Nenhuma retirada registrada ainda.</p>
            </div>`;
            return;
        }

        const fmtDate = (d) => { if (!d) return '-'; const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; };

        container.innerHTML = `
            <div class="materials-table-wrap">
                <table class="materials-table">
                    <thead><tr>
                        <th>Material</th><th>Qtd</th><th>Data</th><th>Observação</th><th></th>
                    </tr></thead>
                    <tbody>
                        ${withdrawals.map(w => `
                            <tr class="tr-clickable"
                                data-wid="${w.id}"
                                data-material="${w.material.replace(/"/g, '&quot;')}"
                                data-qty="${w.qty} ${w.unit}"
                                data-date="${fmtDate(w.date)}"
                                data-note="${(w.note || '—').replace(/"/g, '&quot;')}"
                                data-prof="${(w.profName || (_materialModalProf ? _materialModalProf.name : 'Profissional')).replace(/"/g, '&quot;')}">
                                <td><span class="materials-table-material">${w.material}</span></td>
                                <td><span class="materials-table-qty">${w.qty} ${w.unit}</span></td>
                                <td><span class="materials-table-date">${fmtDate(w.date)}</span></td>
                                <td><span class="materials-table-note">${w.note || '—'}</span></td>
                                <td>${session.role === 'admin' ? `<button class="materials-delete-btn" data-wid="${w.id}" title="Excluir">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>` : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        // Attach delete button listeners (admin)
        if (session.role === 'admin') {
            container.querySelectorAll('.materials-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    showConfirmDialog({
                        title: 'Excluir Retirada',
                        message: 'Tem certeza que deseja excluir este registro?',
                        confirmText: 'Excluir',
                        onConfirm: async () => {
                            try {
                                await deleteMaterial(btn.dataset.wid);
                                showToast('Retirada excluída.', 'success');
                                await renderMaterialHistory(profId);
                                renderMaterialsPage();
                            } catch (err) { showToast('Erro ao excluir.', 'error'); }
                        }
                    });
                });
            });
        }

        // Attach mobile row click handlers
        container.querySelectorAll('.tr-clickable').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.materials-delete-btn')) return;
                if (window.innerWidth > 900) return;

                const material = row.dataset.material;
                const qty = row.dataset.qty;
                const date = row.dataset.date;
                const note = row.dataset.note;
                const profName = row.dataset.prof;
                const wid = row.dataset.wid;

                const actions = [];
                if (session.role === 'admin') {
                    actions.push({
                        label: 'Excluir Registro',
                        style: 'mod-btn--danger',
                        icon: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
                        onClick: () => {
                            showConfirmDialog({
                                title: 'Excluir Retirada',
                                message: `Tem certeza que deseja excluir a retirada de <strong>${material}</strong> (${qty})?`,
                                confirmText: 'Excluir',
                                onConfirm: async () => {
                                    try {
                                        await deleteMaterial(wid);
                                        showToast('Retirada excluída.', 'success');
                                        await renderMaterialHistory(profId);
                                        renderMaterialsPage();
                                    } catch (err) { showToast('Erro ao excluir.', 'error'); }
                                }
                            });
                        }
                    });
                }

                showMobileDetailSheet({
                    title: material,
                    subtitle: `Retirada em ${date}`,
                    sections: [
                        {
                            label: 'Informações da Retirada',
                            fields: [
                                { label: 'Profissional', value: profName },
                                { label: 'Quantidade', value: qty },
                                { label: 'Data', value: date, fullWidth: true },
                                { label: 'Observação', value: note || '—', fullWidth: true }
                            ]
                        }
                    ],
                    actions
                });
            });
        });
    }

    /** Static import removed — all data comes from Firestore */
    async function importStaticAppointments() {
        // No-op: all appointments are managed via Firestore
        return;
    }

    /** Clear static inline calendar blocks so dynamic rendering loads role-filtered */
    function clearStaticCalendarBlocks() {
        const allStaticBlocks = document.querySelectorAll('.calendar-grid .appointment-block');
        allStaticBlocks.forEach(block => block.remove());
    }

    /** Cancel/Complete/Edit interactive actions inside Appointment Popover */
    function attachPopoverActions(popover, apptId) {
        const body = popover.querySelector('.popover-body');
        if (!body) return;

        // Check if there is already an active button panel
        if (body.querySelector('.popover-actions')) return;

        const apptObj = appointments.find(a => String(a.id) === String(apptId));
        if (!apptObj) return;

        const actionPanel = document.createElement('div');
        actionPanel.className = 'popover-actions';
        actionPanel.style.cssText = 'display: flex; gap: 8px; margin-top: 14px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 12px; flex-wrap: wrap;';

        const isCompletedOrCancelled = apptObj.status === 'Concluído' || apptObj.status === 'Cancelado';

        if (session.role === 'admin') {
            actionPanel.innerHTML = `
                <button class="btn btn-secondary pop-btn-edit" style="flex: 1; font-size: 13px; padding: 6px; border: 1px solid var(--gold-border); color: var(--gold-800); background: transparent; font-weight: 600; cursor: pointer;">EDITAR</button>
                <button class="btn btn-secondary pop-btn-cancel" style="flex: 1; font-size: 13px; padding: 6px; border: 1px solid #EF5350; color: #EF5350; background: transparent; font-weight: 600; cursor: pointer;" ${isCompletedOrCancelled ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>CANCELAR</button>
                <button class="btn btn-primary pop-btn-complete" style="flex: 1; font-size: 13px; padding: 6px; background: #4CAF50; border: none; color: #fff; font-weight: 600; cursor: pointer;" ${isCompletedOrCancelled ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>CONCLUIR</button>
            `;
        } else {
            // Employee view: can edit or cancel their own appointments
            actionPanel.innerHTML = `
                <button class="btn btn-secondary pop-btn-edit" style="flex: 1; font-size: 13px; padding: 6px; border: 1px solid var(--gold-border); color: var(--gold-800); background: transparent; font-weight: 600; cursor: pointer;">EDITAR</button>
                <button class="btn btn-secondary pop-btn-cancel" style="flex: 1; font-size: 13px; padding: 6px; border: 1px solid #EF5350; color: #EF5350; background: transparent; font-weight: 600; cursor: pointer;" ${isCompletedOrCancelled ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>CANCELAR</button>
            `;
        }

        body.appendChild(actionPanel);

        // Edit button handler
        const editBtn = actionPanel.querySelector('.pop-btn-edit');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closePopover();
                openAppointmentModal(null, null, null, null, apptObj.id);
            });
        }

        // Cancel button handler
        const cancelBtn = actionPanel.querySelector('.pop-btn-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isCompletedOrCancelled) return;
                showConfirmDialog({
                    title: 'Desmarcar Agendamento',
                    message: `Tem certeza que deseja desmarcar o agendamento de <strong>${apptObj.client}</strong> para o serviço de <strong>${apptObj.serviceName}</strong>?`,
                    confirmText: 'Desmarcar',
                    onConfirm: () => {
                        apptObj.status = 'Cancelado';
                        saveAppointments();
                        showToast(`Agendamento de ${apptObj.client} marcado como Cancelado`, 'warning');
                        closePopover();
                        renderAppointments();
                    }
                });
            });
        }

        // Complete button handler
        const completeBtn = actionPanel.querySelector('.pop-btn-complete');
        if (completeBtn) {
            completeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isCompletedOrCancelled) return;
                apptObj.status = 'Concluído';
                saveAppointments();
                showToast(`Serviço de ${apptObj.client} concluído com sucesso!`, 'success');
                closePopover();
                renderAppointments();
            });
        }
    }

    // Intercept popover show to attach actions
    const originalShowPopover = showAppointmentPopover;
    showAppointmentPopover = function(anchor, data) {
        originalShowPopover(anchor, data);
        if (activePopover && anchor.dataset.appointment) {
            attachPopoverActions(activePopover, anchor.dataset.appointment);
        }
    };

    /** Render professionals list dynamically on the right sidebar */
    async function renderRightSidebarProfessionals() {
        const list = document.querySelector('.right-sidebar .professionals-list');
        if (!list) return;

        // Busca dados frescos do banco
        try {
            professionals = await loadProfessionals();
            await syncRegisteredEmployees();
        } catch(e) {
            console.warn('Aviso ao carregar lista de profissionais:', e.message);
        }

        const countSpan = document.querySelector('.right-sidebar .right-panel-count');
        if (countSpan) {
            countSpan.textContent = `(${professionals.length} Ativo${professionals.length === 1 ? '' : 's'})`;
        }

        if (professionals.length === 0) {
            list.innerHTML = '<li style="color:#999;font-size: 15px;padding:8px 0;text-align:center;">Nenhum profissional ativo</li>';
            return;
        }

        list.innerHTML = professionals.map(p => {
            const avatarHTML = p.avatar
                ? `<img src="${p.avatar}" alt="${p.name}" class="professional-avatar-img">`
                : `<div class="professional-avatar" style="background: ${p.color}; color: #fff; width: 36px; height: 36px; font-size: 15px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold;">${p.initials}</div>`;
            
            return `
                <li class="professional-item">
                    ${avatarHTML}
                    <div class="professional-info">
                        <span class="professional-name">${p.name}</span>
                        <span class="professional-status-text">Ativo</span>
                    </div>
                    <div class="professional-check-badge">
                        <svg class="professional-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </div>
                </li>
            `;
        }).join('');
    }


    // ============================================
    // SECTION 19: INITIALIZATION
    // ============================================

    /** Set up topbar avatar photo upload */
    function setupTopbarAvatarUploadListener() {
        const topbarAvatar = document.querySelector('.topbar-user-avatar');
        if (!topbarAvatar) return;
        
        topbarAvatar.style.cursor = 'pointer';
        topbarAvatar.title = 'Clique para alterar sua foto de perfil';
        
        topbarAvatar.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64Data = ev.target.result;
                    
                    // 1. Update session in sessionStorage
                    session.foto = base64Data;
                    sessionStorage.setItem('raiosol_session', JSON.stringify(session));
                    
                    // 2. Persist to backend
                    apiRequest(`/users/${session.id}`, {
                        method: 'PUT',
                        body: {
                            avatar: base64Data
                        }
                    }).then(() => {
                        // Update in professionals local list if present
                        const profIndex = professionals.findIndex(p => String(p.id) === String(session.id));
                        if (profIndex !== -1) {
                            professionals[profIndex].avatar = base64Data;
                            professionals[profIndex].foto = base64Data;
                        }
                        
                        // 4. Dynamically update the top bar avatar element
                        topbarAvatar.innerHTML = `<img src="${base64Data}" alt="Foto ${session.name}" class="topbar-user-avatar-img" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                        topbarAvatar.style.display = 'block';
                        topbarAvatar.style.background = 'none';
                        
                        // 5. Update right sidebar and calendar views if appropriate
                        renderRightSidebarProfessionals();
                        renderCalendarGrid();
                        
                        showToast('Sua foto de perfil foi atualizada com sucesso!', 'success');
                    }).catch(err => {
                        console.error("Erro ao salvar foto de perfil no Firestore:", err);
                        showToast('Erro ao atualizar foto de perfil.', 'error');
                    });
                };
                reader.readAsDataURL(file);
            });
            
            document.body.appendChild(fileInput);
            fileInput.click();
            fileInput.remove();
        });
    }

    /** Setup dark mode toggle */
    function setupDarkModeToggle() {
        const darkModeBtn = document.getElementById('darkModeBtn');
        if (!darkModeBtn) return;

        // Apply theme immediately on load to prevent layout flashes
        const savedTheme = localStorage.getItem('raiosol_theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            document.documentElement.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
            document.documentElement.classList.remove('dark-mode');
        }

        darkModeBtn.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            document.documentElement.classList.toggle('dark-mode', isDark);
            localStorage.setItem('raiosol_theme', isDark ? 'dark' : 'light');
            showToast(isDark ? "Modo noite ativado!" : "Modo claro ativado!", "info");
        });
    }

    /** Set up settings page profile form submission */
    function setupProfileSettingsListener() {
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) return;

        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const nameInput = document.getElementById('profileName');
            const emailInput = document.getElementById('profileEmail');
            if (!nameInput || !emailInput) return;

            const newName = nameInput.value.trim();
            const newEmail = emailInput.value.trim();

            if (!newName) {
                showToast('O nome não pode ficar em branco', 'error');
                return;
            }
            if (!newEmail || (!newEmail.includes('@') && newEmail.toLowerCase().trim() !== 'deise.com')) {
                showToast('Informe um e-mail válido', 'error');
                return;
            }

            const oldEmail = session.email;
            const oldName = session.name;

            // 1. Update session in sessionStorage
            session.name = newName;
            session.email = newEmail;
            sessionStorage.setItem('raiosol_session', JSON.stringify(session));

            // 2. Update in backend
            apiRequest(`/users/${session.id}`, {
                method: 'PUT',
                body: {
                    name: newName,
                    email: newEmail
                }
            }).then(() => {
                // Update in professionals local list if present
                const profIndex = professionals.findIndex(p => String(p.id) === String(session.id));
                if (profIndex !== -1) {
                    professionals[profIndex].name = newName;
                    professionals[profIndex].email = newEmail;
                }

                // Update the Topbar displayed name
                const topbarName = document.querySelector('.topbar-user-name');
                if (topbarName) {
                    topbarName.textContent = session.role === 'admin' ? `Adm. ${newName}` : newName;
                }

                // Update calendar grid and sidebar
                renderCalendarGrid();
                renderRightSidebarProfessionals();

                showToast('Seus dados de perfil foram atualizados com sucesso!', 'success');
            }).catch(err => {
                console.error("Erro ao salvar dados do perfil no Firestore:", err);
                showToast('Erro ao salvar os dados do perfil.', 'error');
            });

            // 4. Update the avatar initials / top bar name display dynamically!
            const topBarName = document.querySelector('.topbar-user-name');
            if (topBarName) {
                topBarName.textContent = session.role === 'admin' ? `Adm. ${newName}` : newName;
            }

            const topBarAvatar = document.querySelector('.topbar-user-avatar');
            if (topBarAvatar) {
                if (session.foto) {
                    topBarAvatar.innerHTML = `<img src="${session.foto}" alt="Foto ${newName}" class="topbar-user-avatar-img" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                    topBarAvatar.style.background = 'none';
                    topBarAvatar.style.display = 'block';
                } else if (session.role === 'admin') {
                    topBarAvatar.innerHTML = `<img src="assets/admin-avatar.png" alt="Foto Adm. Deise Rose" class="topbar-user-avatar-img">`;
                    topBarAvatar.style.display = 'block';
                } else {
                    const words = newName.split(' ');
                    topBarAvatar.textContent = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
                    topBarAvatar.style.display = 'flex';
                }
            }

            showToast('Informações do perfil atualizadas com sucesso!', 'success');
        });
    }

    // ==========================================================================
    // SECTION 13: PAYOUTS, COMISSÕES & FATURAS PAGAS (PAYMENTS SYSTEM)
    // ==========================================================================

    let selectedPayoutProfId = null;
    let selectedPayoutPeriod = 'diario';
    let currentPayoutAppointments = [];

    async function loadPayouts() {
        try {
            return await apiRequest('/payouts');
        } catch (e) {
            console.error("Erro ao carregar faturas do backend:", e);
            return [];
        }
    }

    async function savePayouts(list) {
        try {
            await apiRequest('/payouts/sync', {
                method: 'POST',
                body: list
            });
        } catch (e) {
            console.error("Erro ao salvar faturas no backend:", e);
        }
    }


    function isDateInPeriod(apptDateStr, period) {
        if (!apptDateStr) return false;
        
        const parts = apptDateStr.split('-');
        if (parts.length !== 3) return false;
        const apptYear = parseInt(parts[0], 10);
        const apptMonth = parseInt(parts[1], 10) - 1;
        const apptDay = parseInt(parts[2], 10);
        
        const apptDate = new Date(apptYear, apptMonth, apptDay);
        apptDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = today - apptDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (period === 'diario') {
            const todayStr = toISODateString(today);
            return apptDateStr === todayStr;
        } else if (period === 'semanal') {
            // Semana Atual (Segunda a Domingo)
            const d1 = new Date(apptDate);
            const day1 = d1.getDay();
            const diff1 = (day1 === 0 ? -6 : 1) - day1;
            const monday1 = new Date(d1);
            monday1.setDate(d1.getDate() + diff1);
            monday1.setHours(0, 0, 0, 0);

            const d2 = new Date(today);
            const day2 = d2.getDay();
            const diff2 = (day2 === 0 ? -6 : 1) - day2;
            const monday2 = new Date(d2);
            monday2.setDate(d2.getDate() + diff2);
            monday2.setHours(0, 0, 0, 0);

            return monday1.getTime() === monday2.getTime();
        } else if (period === 'quinzenal') {
            // Últimos 15 dias (e agendamentos futuros completados dentro de 15 dias)
            return diffDays >= -15 && diffDays < 15;
        } else if (period === 'mensal') {
            // Aparece tudo (todos os concluídos pendentes)
            return true;
        }
        return false;
    }

    function getPeriodDateLabel(period) {
        const today = new Date();
        const formatDateStr = (d) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };
        
        if (period === 'diario') {
            return `Hoje: ${formatDateStr(today)}`;
        } else if (period === 'semanal') {
            const day = today.getDay();
            const diffToMonday = (day === 0 ? -6 : 1) - day;
            const monday = new Date(today);
            monday.setDate(today.getDate() + diffToMonday);
            
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            return `Semana Atual: ${formatDateStr(monday)} a ${formatDateStr(sunday)}`;
        } else if (period === 'quinzenal') {
            const pastDate = new Date();
            pastDate.setDate(today.getDate() - 14);
            return `Últimos 15 dias: ${formatDateStr(pastDate)} a ${formatDateStr(today)}`;
        } else if (period === 'mensal') {
            return `Período: Todos os agendamentos pendentes`;
        }
        return '';
    }

    async function renderPaymentsPage() {
        const session = JSON.parse(sessionStorage.getItem('raiosol_session') || '{}');
        const isAdmin = session.role === 'admin';
        
        if (isAdmin) {
            const adminPanel = document.getElementById('adminPaymentsPanel');
            const empPanel = document.getElementById('employeePaymentsPanel');
            if (adminPanel) adminPanel.classList.remove('hidden');
            if (empPanel) empPanel.classList.add('hidden');
            
            renderPayoutProfSelectGrid();
            
            if (selectedPayoutProfId) {
                renderProfessionalPayoutPanel(selectedPayoutProfId);
            } else {
                const placeholder = document.getElementById('payoutNoSelectionPlaceholder');
                const content = document.getElementById('payoutCalculatorContent');
                if (placeholder) placeholder.classList.remove('hidden');
                if (content) content.classList.add('hidden');
            }
        } else {
            const adminPanel = document.getElementById('adminPaymentsPanel');
            const empPanel = document.getElementById('employeePaymentsPanel');
            if (adminPanel) adminPanel.classList.add('hidden');
            if (empPanel) empPanel.classList.remove('hidden');
            
            const lblEmpPaymentsTitle = document.getElementById('lblEmpPaymentsTitle');
            if (lblEmpPaymentsTitle) {
                lblEmpPaymentsTitle.textContent = `Meus Recebimentos Autorizados — ${session.name}`;
            }
        }
        
        const payouts = await loadPayouts();
        renderPayoutHistoryTable(payouts, isAdmin, session);
    }

    function renderPayoutProfSelectGrid() {
        const container = document.getElementById('payoutProfSelectGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        professionals.forEach(prof => {
            const isSelected = String(prof.id) === String(selectedPayoutProfId);
            
            const item = document.createElement('div');
            item.className = `payout-prof-card ${isSelected ? 'active' : ''}`;
            item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                border-radius: var(--radius-md);
                border: 1px solid ${isSelected ? 'var(--gold-400)' : 'var(--neutral-200)'};
                background: ${isSelected ? 'rgba(201, 168, 76, 0.04)' : 'white'};
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            let avatarHTML = '';
            if (prof.foto) {
                avatarHTML = `<img src="${prof.foto}" alt="${prof.name}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--gold-300);">`;
            } else {
                const color = prof.color || getClientAvatarColor(prof.name);
                const initials = prof.initials || prof.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                avatarHTML = `<div style="width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${color}; color: white; font-weight: 700; font-size: 15px; border: 1.5px solid var(--gold-300);">${initials}</div>`;
            }
            
            item.innerHTML = `
                ${avatarHTML}
                <div style="flex: 1; min-width: 0;">
                     <h4 style="margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--neutral-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prof.name}</h4>
                     <span style="font-size: 0.9375rem; color: var(--neutral-500); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prof.cargo || 'Profissional'} | Comissão: ${prof.percentual || 35}%</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                selectedPayoutProfId = prof.id;
                renderPayoutProfSelectGrid();
                renderProfessionalPayoutPanel(prof.id);
            });
            
            container.appendChild(item);
        });
    }

    async function renderProfessionalPayoutPanel(profId) {
        const placeholder = document.getElementById('payoutNoSelectionPlaceholder');
        const content = document.getElementById('payoutCalculatorContent');
        if (placeholder) placeholder.classList.add('hidden');
        if (content) content.classList.remove('hidden');
        
        const prof = professionals.find(p => String(p.id) === String(profId));
        if (!prof) return;
        
        const calcAvatar = document.getElementById('payoutCalcAvalColor');
        const calcName = document.getElementById('payoutCalcProfName');
        const calcSpecialty = document.getElementById('payoutCalcProfSpecialty');
        
        if (calcAvatar) {
            const initials = prof.initials || prof.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const color = prof.color || getClientAvatarColor(prof.name);
            calcAvatar.style.background = color;
            calcAvatar.textContent = initials;
            if (prof.foto) {
                calcAvatar.innerHTML = `<img src="${prof.foto}" alt="${prof.name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
        if (calcName) calcName.textContent = prof.name;
        if (calcSpecialty) calcSpecialty.textContent = `${prof.cargo || 'Profissional'} | Comissão: ${prof.percentual || 35}%`;
        
        const dateLabel = document.getElementById('payoutPeriodDateLabel');
        if (dateLabel) {
            dateLabel.textContent = getPeriodDateLabel(selectedPayoutPeriod);
        }
        
        const periodBtns = document.querySelectorAll('.payout-period-btn');
        periodBtns.forEach(btn => {
            const period = btn.dataset.period;
            if (period === selectedPayoutPeriod) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Deep copy of completed, uninvoiced appointments to allow edit rollback before finalization
        // Load payouts synchronously to check invoicing status dynamically
        const allPayouts = await loadPayouts();

        const filteredAppts = appointments.filter(appt => {
            if (appt.status !== 'Concluído') return false;
            if (!isDateInPeriod(appt.date, selectedPayoutPeriod)) return false;

            const isPrimary = String(appt.professionalId) === String(profId);
            const isSecondary = appt.isMutual && String(appt.professionalId2) === String(profId);
            if (!isPrimary && !isSecondary) return false;

            // Check if this appointment has been invoiced for THIS professional in any payouts
            const alreadyInvoiced = allPayouts.some(p => 
                String(p.profId) === String(profId) && 
                p.services && p.services.some(s => String(s.id) === String(appt.id))
            );

            return !alreadyInvoiced;
        });
        
        currentPayoutAppointments = JSON.parse(JSON.stringify(filteredAppts));
        currentPayoutAppointments.forEach(a => {
            if (a.isMutual) {
                a.servicePrice = a.servicePrice / 2;
            }
        });
        
        const tbody = document.getElementById('payoutEditableTableBody');
        const btnFinalize = document.getElementById('btnFinalizePayout');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (currentPayoutAppointments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 30px; color: var(--neutral-500); font-style: italic;">
                        Nenhum serviço concluído pendente de faturamento para este período.
                    </td>
                </tr>
            `;
            if (btnFinalize) {
                btnFinalize.setAttribute('disabled', 'true');
                btnFinalize.style.opacity = '0.5';
                btnFinalize.style.cursor = 'not-allowed';
            }
            
            updatePayoutSummaries(0, 0, 0);
            return;
        }
        
        if (btnFinalize) {
            btnFinalize.removeAttribute('disabled');
            btnFinalize.style.opacity = '1';
            btnFinalize.style.cursor = 'pointer';
        }
        
        currentPayoutAppointments.forEach(appt => {
            const tr = document.createElement('tr');
            
            const apptDateParts = appt.date.split('-');
            const formattedApptDate = apptDateParts.length === 3 ? `${apptDateParts[2]}/${apptDateParts[1]}/${apptDateParts[0]}` : appt.date;
            
            const commRate = prof.percentual || 35;
            const apptPrice = appt.servicePrice || 0;
            const commVal = appt.isMutual ? apptPrice * 0.50 : apptPrice * (commRate / 100);
            const studioVal = apptPrice - commVal;
            const serviceNameDisplay = appt.isMutual ? `[Mútuo] ${appt.serviceName}` : appt.serviceName;
            
            tr.innerHTML = `
                <td class="td-calc-service" style="padding: 10px 12px; font-weight: 600; color: var(--neutral-800);">${serviceNameDisplay}</td>
                <td class="td-calc-client" style="padding: 10px 12px;">${appt.client}</td>
                <td class="td-calc-date" style="padding: 10px 12px;">${formattedApptDate}</td>
                <td class="td-calc-price" style="padding: 6px 12px; text-align: right;">
                    <input type="text" class="payout-price-input" data-appt-id="${appt.id}" value="${formatCurrencyBRL(apptPrice)}">
                </td>
                <td class="td-calc-comm payout-comm-col" style="padding: 10px 12px; text-align: right; font-weight: 600; color: #388E3C;">${formatCurrencyBRL(commVal)}</td>
                <td class="td-calc-studio payout-studio-col" style="padding: 10px 12px; text-align: right; font-weight: 600; color: #1976D2;">${formatCurrencyBRL(studioVal)}</td>
            `;
            
            const input = tr.querySelector('.payout-price-input');
            if (input) {
                input.addEventListener('input', (e) => {
                    let clean = e.target.value.replace(/[^\d]/g, '');
                    if (!clean) {
                        e.target.value = '';
                        return;
                    }
                    const num = parseFloat(clean) / 100;
                    e.target.value = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    
                    const targetAppt = currentPayoutAppointments.find(a => String(a.id) === String(appt.id));
                    if (targetAppt) {
                        targetAppt.servicePrice = num;
                    }
                    
                    const rowComm = appt.isMutual ? num * 0.50 : num * (commRate / 100);
                    const rowStudio = num - rowComm;
                    
                    const commCol = tr.querySelector('.payout-comm-col');
                    const studioCol = tr.querySelector('.payout-studio-col');
                    if (commCol) commCol.textContent = formatCurrencyBRL(rowComm);
                    if (studioCol) studioCol.textContent = formatCurrencyBRL(rowStudio);
                    
                    recalculatePayoutTotalSummary(commRate);
                });
                
                input.addEventListener('blur', (e) => {
                    if (e.target.value === 'R$\u00A00,00' || e.target.value === 'R$ 0,00' || !e.target.value) {
                        e.target.value = formatCurrencyBRL(0);
                        
                        const targetAppt = currentPayoutAppointments.find(a => String(a.id) === String(appt.id));
                        if (targetAppt) targetAppt.servicePrice = 0;
                        
                        const commCol = tr.querySelector('.payout-comm-col');
                        const studioCol = tr.querySelector('.payout-studio-col');
                        if (commCol) commCol.textContent = formatCurrencyBRL(0);
                        if (studioCol) studioCol.textContent = formatCurrencyBRL(0);
                        
                        recalculatePayoutTotalSummary(commRate);
                    }
                });
            }
            
            tbody.appendChild(tr);
        });
        
        recalculatePayoutTotalSummary(prof.percentual || 35);
    }

    function recalculatePayoutTotalSummary(commRate) {
        let totalBilling = 0;
        let totalCommission = 0;
        currentPayoutAppointments.forEach(appt => {
            const price = appt.servicePrice || 0;
            totalBilling += price;
            if (appt.isMutual) {
                totalCommission += price * 0.50;
            } else {
                totalCommission += price * (commRate / 100);
            }
        });
        const studioShare = totalBilling - totalCommission;
        updatePayoutSummaries(totalBilling, totalCommission, studioShare);
    }

    function updatePayoutSummaries(totalBilling, totalCommission, studioShare) {
        const valTotal = document.getElementById('valPayoutTotalBilling');
        const lblComm = document.getElementById('lblPayoutComissao');
        const valComm = document.getElementById('valPayoutComissao');
        const valStudio = document.getElementById('valPayoutStudioShare');
        
        if (valTotal) valTotal.textContent = formatCurrencyBRL(totalBilling);
        if (lblComm) lblComm.textContent = `Comissão`;
        if (valComm) valComm.textContent = formatCurrencyBRL(totalCommission);
        if (valStudio) valStudio.textContent = formatCurrencyBRL(studioShare);
    }

    function setupPayoutEventListeners() {
        const container = document.getElementById('page-pagamentos');
        if (!container) return;
        
        container.addEventListener('click', (e) => {
            const periodBtn = e.target.closest('.payout-period-btn');
            if (periodBtn) {
                selectedPayoutPeriod = periodBtn.dataset.period;
                if (selectedPayoutProfId) {
                    renderProfessionalPayoutPanel(selectedPayoutProfId);
                }
                return;
            }
            
            if (e.target.closest('#btnFinalizePayout')) {
                handleFinalizePayout();
                return;
            }
        });
    }

    async function handleFinalizePayout() {
        if (!selectedPayoutProfId) return;
        const prof = professionals.find(p => String(p.id) === String(selectedPayoutProfId));
        if (!prof) return;
        
        if (currentPayoutAppointments.length === 0) {
            showToast('Não há serviços realizados para faturar.', 'error');
            return;
        }
        
        const confirmMsg = `Deseja consolidar o faturamento de ${prof.name} referente ao período selecionado?\n\nTotal Faturado: ${document.getElementById('valPayoutTotalBilling').textContent}\nComissão Repasse: ${document.getElementById('valPayoutComissao').textContent}\n\nIsso gerará uma fatura paga e atualizará os preços finais dos agendamentos originais.`;
        if (!confirm(confirmMsg)) return;
        
        let totalBilling = 0;
        let totalCommission = 0;
        const servicesList = [];
        const payouts = await loadPayouts();
        const commRate = prof.percentual || 35;
        
        currentPayoutAppointments.forEach(appt => {
            const input = document.querySelector(`.payout-price-input[data-appt-id="${appt.id}"]`);
            let finalPrice = appt.servicePrice || 0;
            if (input) {
                const rawPrice = input.value.replace(/[^\d]/g, '');
                finalPrice = rawPrice ? parseFloat(rawPrice) / 100 : 0;
            }
            
            totalBilling += finalPrice;
            if (appt.isMutual) {
                totalCommission += finalPrice * 0.50;
            } else {
                totalCommission += finalPrice * (commRate / 100);
            }
            
            servicesList.push({
                id: appt.id,
                serviceName: appt.serviceName,
                client: appt.client,
                date: appt.date,
                originalPrice: appt.isMutual ? (appt.servicePrice * 2) : appt.servicePrice,
                finalPrice: finalPrice
            });
            
            const originalAppt = appointments.find(a => String(a.id) === String(appt.id));
            if (originalAppt) {
                originalAppt.servicePrice = finalPrice * (originalAppt.isMutual ? 2 : 1);
                
                if (originalAppt.isMutual) {
                    const otherProfId = String(originalAppt.professionalId) === String(prof.id) 
                        ? originalAppt.professionalId2 
                        : originalAppt.professionalId;
                    
                    const otherInvoiced = payouts.some(p => 
                        String(p.profId) === String(otherProfId) && 
                        p.services && p.services.some(s => String(s.id) === String(appt.id))
                    );
                    
                    if (otherInvoiced) {
                        originalAppt.payoutInvoiced = true;
                    }
                } else {
                    originalAppt.payoutInvoiced = true;
                }
            }
        });
        
        const studioShare = totalBilling - totalCommission;
        
        const newPayout = {
            id: `FAT-${Date.now()}`,
            date: toISODateString(new Date()),
            profId: prof.id,
            profName: prof.name,
            period: selectedPayoutPeriod,
            dateLabel: getPeriodDateLabel(selectedPayoutPeriod),
            grossBilling: totalBilling,
            commissionRate: commRate,
            commissionValue: totalCommission,
            studioShare: studioShare,
            status: 'Pago',
            services: servicesList
        };
        
        payouts.unshift(newPayout);
        await savePayouts(payouts);
        
        await saveAppointments();
        
        currentPayoutAppointments = [];
        showToast('Faturamento concluído e fatura consolidada!', 'success');
        
        await renderPaymentsPage();
        
        showPayoutInvoiceReceipt(newPayout);
    }

    function showPayoutInvoiceReceipt(payout) {
        const overlay = document.createElement('div');
        overlay.className = 'payout-receipt-overlay';
        
        let servicesMarkup = '';
        payout.services.forEach(s => {
            const dateParts = s.date.split('-');
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : s.date;
            servicesMarkup += `
                <div class="payout-receipt-service-row" style="margin-bottom: 6px;">
                    <span><strong>${s.serviceName}</strong> (${s.client} - ${formattedDate})</span>
                    <div class="payout-receipt-service-dots"></div>
                    <span>${formatCurrencyBRL(s.finalPrice)}</span>
                </div>
            `;
        });
        
        const formattedTotal = formatCurrencyBRL(payout.grossBilling);
        const formattedCommission = formatCurrencyBRL(payout.commissionValue);
        const formattedStudio = formatCurrencyBRL(payout.studioShare);
        
        overlay.innerHTML = `
            <div class="payout-receipt-container">
                <div class="payout-receipt-header-picot"></div>
                <div class="payout-receipt-body">
                    <div class="payout-receipt-paper">
                        <h2 class="payout-receipt-salon-title">Studio Raio do Sol</h2>
                        <div class="payout-receipt-salon-subtitle">Recibo Boutique — Fechamento</div>
                        
                        <div class="payout-receipt-stamp">PAGO</div>
                        
                        <div class="payout-receipt-meta-grid" style="margin-top: 10px;">
                            <div class="payout-receipt-meta-item"><strong>Fatura ID:</strong> ${payout.id}</div>
                            <div class="payout-receipt-meta-item" style="text-align: right;"><strong>Emissão:</strong> ${payout.date}</div>
                            <div class="payout-receipt-meta-item"><strong>Colaborador:</strong> ${payout.profName}</div>
                            <div class="payout-receipt-meta-item" style="text-align: right;"><strong>Período:</strong> ${payout.period.toUpperCase()}</div>
                        </div>
                        
                        <div class="payout-receipt-divider-dashed"></div>
                        
                        <div class="payout-receipt-section-title">Serviços Executados</div>
                        <div class="payout-receipt-services-list" style="margin-bottom: 20px;">
                            ${servicesMarkup}
                        </div>
                        
                        <div class="payout-receipt-divider-dashed"></div>
                        
                        <div class="payout-receipt-summary-grid">
                            <div class="payout-receipt-summary-row">
                                <span>Faturamento Bruto</span>
                                <span>${formattedTotal}</span>
                            </div>
                            <div class="payout-receipt-summary-row" style="color: #1976D2; font-weight: 500;">
                                <span>Comissão Retida Studio</span>
                                <span>- ${formattedStudio}</span>
                            </div>
                            <div class="payout-receipt-summary-row repasse-row">
                                <span>Líquido Repassado</span>
                                <span>${formattedCommission}</span>
                            </div>
                        </div>
                        
                        <div class="payout-receipt-divider-dashed"></div>
                        
                        <div class="payout-receipt-footer">
                            Obrigado pelo seu excelente trabalho!
                        </div>
                    </div>
                </div>
                <div class="payout-receipt-actions">
                    <button type="button" class="mod-btn mod-btn--gold" id="btnCloseReceipt" style="margin: 0;">FECHAR RECIBO</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        
        const closeBtn = overlay.querySelector('#btnCloseReceipt');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.remove();
                document.body.style.overflow = '';
            });
        }
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                document.body.style.overflow = '';
            }
        });
    }

    function renderPayoutHistoryTable(payouts, isAdmin, session) {
        const tbody = document.getElementById('payoutHistoryTableBody');
        const countLabel = document.getElementById('valPayoutsHistoryCount');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        let filteredPayouts = payouts;
        if (!isAdmin) {
            filteredPayouts = payouts.filter(p => {
                return String(p.profId) === String(employeeProf.id) || p.profName.toLowerCase() === session.name.toLowerCase();
            });
        }
        
        if (countLabel) {
            countLabel.textContent = `${filteredPayouts.length} fatura${filteredPayouts.length !== 1 ? 's' : ''} consolidada${filteredPayouts.length !== 1 ? 's' : ''}`;
        }
        
        if (filteredPayouts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${isAdmin ? 9 : 8}" style="text-align: center; padding: 24px; color: var(--neutral-500); font-style: italic;">
                        Nenhuma fatura consolidada encontrada.
                    </td>
                </tr>
            `;
            return;
        }

        filteredPayouts.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'tr-clickable';
            
            const billingStr = formatCurrencyBRL(p.grossBilling);
            const commStr = formatCurrencyBRL(p.commissionValue);
            const studioStr = formatCurrencyBRL(p.studioShare);
            
            let actionsHTML = `
                <button type="button" class="btn-view-payout-receipt" data-payout-id="${p.id}" style="background: none; border: none; color: var(--gold-600); cursor: pointer; font-weight: 600; font-size: 0.9375rem; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px; transition: color 0.15s ease;" title="Ver Recibo">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Recibo
                </button>
            `;
            
            if (isAdmin) {
                actionsHTML += `
                    <button type="button" class="btn-delete-payout-invoice" data-payout-id="${p.id}" style="background: none; border: none; color: var(--error); cursor: pointer; font-weight: 600; font-size: 0.9375rem; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px; transition: color 0.15s ease;" title="Excluir Fatura (Estornar)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        Excluir
                    </button>
                `;
            }
            
            tr.innerHTML = `
                <td class="td-payout-id" style="font-weight: 700; color: var(--neutral-800);">${p.id}</td>
                <td class="td-payout-date">${p.date}</td>
                <td class="td-payout-prof" style="font-weight: 600;">${p.profName}</td>
                <td class="td-payout-period"><span style="text-transform: capitalize; font-weight: 600; font-size: 0.875rem; background: var(--neutral-100); padding: 3px 8px; border-radius: var(--radius-sm); color: var(--neutral-700);">${p.period}</span></td>
                <td class="td-payout-total" style="font-weight: 600; color: var(--neutral-800);">${billingStr}</td>
                <td class="td-payout-comm" style="font-weight: 700; color: #388E3C;">${commStr}</td>
                <td class="td-payout-studio" style="font-weight: 700; color: #1976D2;">${studioStr}</td>
                <td class="td-payout-status">
                    <span style="font-size: 0.875rem; font-weight: 700; background: rgba(76, 175, 80, 0.1); color: #388E3C; padding: 4px 10px; border-radius: var(--radius-full); display: inline-block;">
                        ${p.status.toUpperCase()}
                    </span>
                </td>
                <td class="td-payout-actions" style="text-align: center; white-space: nowrap;">${actionsHTML}</td>
            `;
            
            const viewBtn = tr.querySelector('.btn-view-payout-receipt');
            if (viewBtn) {
                viewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showPayoutInvoiceReceipt(p);
                });
            }
            
            if (isAdmin) {
                const deleteBtn = tr.querySelector('.btn-delete-payout-invoice');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handleDeletePayoutInvoice(p.id);
                    });
                }
            }

            // Mobile: click on row opens detail sheet
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.btn-view-payout-receipt') || e.target.closest('.btn-delete-payout-invoice')) return;
                if (window.innerWidth > 900) return;

                const actions = [
                    {
                        label: 'Ver Recibo',
                        style: 'mod-btn--primary',
                        icon: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
                        onClick: () => showPayoutInvoiceReceipt(p)
                    }
                ];
                if (isAdmin) {
                    actions.push({
                        label: 'Excluir Fatura',
                        style: 'mod-btn--danger',
                        icon: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
                        onClick: () => handleDeletePayoutInvoice(p.id)
                    });
                }

                showMobileDetailSheet({
                    title: p.profName,
                    subtitle: `Fatura • ${p.date}`,
                    sections: [
                        {
                            label: 'Dados da Fatura',
                            fields: [
                                { label: 'Fatura ID', value: p.id, fullWidth: true },
                                { label: 'Data de Fechamento', value: p.date },
                                { label: 'Período', value: p.period },
                                { label: 'Status', value: `<span style="font-size:0.875rem;font-weight:700;background:rgba(76,175,80,0.12);color:#388E3C;padding:4px 10px;border-radius:20px;">${p.status.toUpperCase()}</span>`, fullWidth: true },
                            ]
                        },
                        {
                            label: 'Valores',
                            fields: [
                                { label: 'Faturamento Total', value: billingStr },
                                { label: 'Repasse Profissional', value: commStr, color: '#388E3C' },
                                { label: 'Parte do Studio', value: studioStr, color: '#1976D2' },
                            ]
                        }
                    ],
                    actions
                });
            });
            
            tbody.appendChild(tr);
        });
    }

    async function handleDeletePayoutInvoice(payoutId) {
        const confirmMsg = `Deseja realmente EXCLUIR e estornar esta fatura (${payoutId})?\n\nIsso reverterá os agendamentos consolidados de volta para o status "Não Faturado", permitindo que sejam faturados novamente em um novo período.`;
        if (!confirm(confirmMsg)) return;
        
        const payouts = await loadPayouts();
        const payoutIdx = payouts.findIndex(p => p.id === payoutId);
        if (payoutIdx === -1) {
            showToast('Fatura não encontrada.', 'error');
            return;
        }
        
        const payout = payouts[payoutIdx];
        
        let rollbackCount = 0;
        payout.services.forEach(s => {
            const originalAppt = appointments.find(a => String(a.id) === String(s.id));
            if (originalAppt) {
                originalAppt.payoutInvoiced = false;
                rollbackCount++;
            }
        });
        
        payouts.splice(payoutIdx, 1);
        await savePayouts(payouts);
        
        await saveAppointments();
        
        showToast(`Fatura excluída com sucesso! ${rollbackCount} serviços estornados.`, 'success');
        
        await renderPaymentsPage();
    }

    /** Run all initializations */
    async function init() {
        // 1. Immediately clear static placeholder values while Firebase loads
        document.querySelectorAll('.stat-card-value').forEach(el => { el.textContent = '...'; });

        // 2. Initialize date navigation display immediately so it works and looks loaded
        goToDate(currentDate);

        // 3. Clear static calendar blocks for dynamic roll view
        clearStaticCalendarBlocks();

        // 4. Render initial dynamic calendar grid structure (using current professionals if any, or empty)
        renderCalendarGrid();

        // 5. Sidebar Toggle Button (Inside the sidebar logo area) - Register immediately
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.innerWidth <= 768) {
                    closeSidebar();
                } else {
                    const layout = document.querySelector('.dashboard-layout');
                    if (layout) {
                        layout.classList.toggle('sidebar-collapsed');
                    }
                }
            });
        }

        // 6. Topbar Toggle (Hamburger) - Register immediately
        const topbarMenuToggle = document.getElementById('menuToggle');
        if (topbarMenuToggle) {
            topbarMenuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.innerWidth <= 768) {
                    // Mobile: open sliding drawer
                    openSidebar();
                } else {
                    // Desktop: toggle collapsed sidebar (60px icon-only mode)
                    const layout = document.querySelector('.dashboard-layout');
                    if (layout) {
                        layout.classList.toggle('sidebar-collapsed');
                    }
                }
            });
        }

        // 7. Page load animations
        animateSidebarEntrance();
        animateStatsCards();
        animateCalendarGrid();

        // 8. Update notification badge
        updateNotificationBadge();

        // 9. Set up event/filter listeners immediately so pages don't feel dead
        setupReportFilterListeners();
        setupPayoutEventListeners();
        setupProfileSettingsListener();
        setupTopbarAvatarUploadListener();
        setupDarkModeToggle();

        // 11. Async data loading from PostgreSQL
        try {
            const [profs, svcs, clis, appts] = await Promise.all([
                loadProfessionals(),
                loadServices(),
                loadClients(),
                loadAppointments()
            ]);
            professionals = profs;
            services = svcs;
            clients = clis;
            appointments = appts;

            // Recalculate client levels based on their actual appointment frequency
            recalculateClientLevels();

            // Sync with PostgreSQL profile to capture administrator photo and name updates dynamically
            try {
                const dbUser = await apiRequest(`/users/${session.id}`);
                if (dbUser) {
                    session.name = dbUser.name || session.name;
                    session.email = dbUser.email || session.email;
                    session.foto = dbUser.avatar || session.foto || null;
                    session.role = dbUser.role || session.role;
                    sessionStorage.setItem('raiosol_session', JSON.stringify(session));
                }
            } catch (e) {
                console.warn('Aviso: não foi possível sincronizar perfil do usuário:', e.message);
            }

            // Force employee photo upload if missing
            if (session.role === 'funcionario' && !session.foto) {
                showForceAvatarModal();
            }

            // Sync registered employees
            await syncRegisteredEmployees();

            // Setup view based on role (which needs loaded professionals to lock employee view)
            await setupRoleBasedView();

            // Render dynamic professionals list on right sidebar
            await renderRightSidebarProfessionals();

            // Populate filters first so we can read the default selected professional
            populateMainFilters();
            
            // Check if last appointment of today has passed to automatically advance the calendar to tomorrow
            checkAutoAdvanceDate();
            
            // Periodic check for auto-advance every 30 seconds
            setInterval(() => {
                checkAutoAdvanceDate(true);
            }, 30000);
            
            // Re-render the calendar grid and appointments with the default filter
            const filterProf = document.getElementById('filterProfissional');
            const initialProfId = filterProf ? filterProf.value : null;
            
            renderCalendarGrid(initialProfId);
            renderAppointments();

            // Garantia extra de renderização após carregamento (corrige o bug da agenda em branco)
            const forceRender = () => {
                const fProf = document.getElementById('filterProfissional');
                renderCalendarGrid(fProf ? fProf.value : null);
                renderAppointments();
            };
            setTimeout(forceRender, 100);
            setTimeout(forceRender, 400);
            setTimeout(forceRender, 1000);

            // Stats counter animation with actual loaded values
            initStatsAnimation();

            // Rebuild notifications list based on loaded appointments
            rebuildNotifications();

            // Inicia conexão com servidor para atualizações em tempo real (SSE)
            initRealTimeUpdates();

            console.log('%c✅ Dashboard inicializado com PostgreSQL', 'color: #4CAF50; font-size: 14px;');
            
        } catch (error) {
            console.error('Erro durante o carregamento do banco de dados:', error);
            showToast('Erro de conexão com o banco de dados. Verifique se o servidor está rodando.', 'error');
        }
    }

    // =====================================================================
    //  MOBILE: Bottom Sheet — toque na linha abre tela completa de detalhes
    // =====================================================================

    let _mobileSheetOverlay = null;
    let _mobileSheetPanel = null;

    function closeMobileDetailSheet() {
        if (_mobileSheetPanel) _mobileSheetPanel.classList.add('closing');
        if (_mobileSheetOverlay) _mobileSheetOverlay.classList.add('closing');
        setTimeout(() => {
            if (_mobileSheetOverlay) _mobileSheetOverlay.remove();
            if (_mobileSheetPanel) _mobileSheetPanel.remove();
            _mobileSheetOverlay = null;
            _mobileSheetPanel = null;
            document.body.style.overflow = '';
        }, 230);
    }

    /**
     * Abre o bottom sheet de detalhes no mobile.
     * @param {Object} config
     *   - title: string
     *   - subtitle: string (opcional)
     *   - avatarHtml: string HTML do avatar (opcional)
     *   - sections: Array<{ label?: string, fields: Array<{ label, value, color?, fullWidth? }> }>
     *   - actions: Array<{ label, icon?, style?, onClick }> (opcional)
     */
    function showMobileDetailSheet(config) {
        // Só funciona no mobile
        if (window.innerWidth > 900) return;

        // Fecha sheet anterior se existir
        if (_mobileSheetOverlay) closeMobileDetailSheet();

        document.body.style.overflow = 'hidden';

        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'mobile-sheet-overlay';
        overlay.addEventListener('click', closeMobileDetailSheet);

        // Panel
        const panel = document.createElement('div');
        panel.className = 'mobile-sheet-panel';

        // Build body content
        let sectionsHTML = '';
        (config.sections || []).forEach(section => {
            const sectionLabel = section.label
                ? `<div class="mobile-sheet-section-title">${section.label}</div>` : '';
            const fieldsHTML = (section.fields || []).map(f => `
                <div class="mobile-sheet-field${f.fullWidth ? ' full-width' : ''}">
                    <span class="mobile-sheet-field-label">${f.label}</span>
                    <span class="mobile-sheet-field-value" style="${f.color ? `color:${f.color}` : ''}">${f.value}</span>
                </div>
            `).join('');
            sectionsHTML += `
                <div class="mobile-sheet-section">
                    ${sectionLabel}
                    <div class="mobile-sheet-grid">${fieldsHTML}</div>
                </div>
                <div class="mobile-sheet-divider"></div>
            `;
        });

        // Actions HTML
        let actionsHTML = '';
        if (config.actions && config.actions.length > 0) {
            const btns = config.actions.map(a => `
                <button class="mod-btn ${a.style || 'mod-btn--secondary'}" data-action-label="${a.label}" style="font-size:0.9375rem; height:40px; padding: 0 12px; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
                    ${a.icon ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${a.icon}</svg>` : ''}
                    ${a.label}
                </button>
            `).join('');
            actionsHTML = `<div class="mobile-sheet-actions">${btns}</div>`;
        }

        // Avatar header area
        const avatarSection = config.avatarHtml
            ? `<div style="display:flex;align-items:center;gap:14px;padding:0 20px 12px 20px;">
                ${config.avatarHtml}
                <div>
                    <div class="mobile-sheet-title" style="border:none;padding:0;">${config.title}</div>
                    ${config.subtitle ? `<div class="mobile-sheet-subtitle">${config.subtitle}</div>` : ''}
                </div>
              </div>`
            : '';

        panel.innerHTML = `
            <div class="mobile-sheet-handle"></div>
            <div class="mobile-sheet-header">
                ${config.avatarHtml ? '' : `<div>
                    <div class="mobile-sheet-title">${config.title}</div>
                    ${config.subtitle ? `<div class="mobile-sheet-subtitle">${config.subtitle}</div>` : ''}
                </div>`}
                ${config.avatarHtml ? `<div style="flex:1;"></div>` : ''}
                <button class="mobile-sheet-close" aria-label="Fechar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            ${avatarSection}
            <div class="mobile-sheet-body">${sectionsHTML}</div>
            ${actionsHTML}
        `;

        // Attach close button
        panel.querySelector('.mobile-sheet-close').addEventListener('click', closeMobileDetailSheet);

        // Attach action button handlers
        if (config.actions) {
            panel.querySelectorAll('[data-action-label]').forEach(btn => {
                const label = btn.dataset.actionLabel;
                const action = config.actions.find(a => a.label === label);
                if (action && action.onClick) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        closeMobileDetailSheet();
                        setTimeout(() => action.onClick(), 250);
                    });
                }
            });
        }

        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        _mobileSheetOverlay = overlay;
        _mobileSheetPanel = panel;
    }

    // Run initialization
    init();

    // Redesenhar agenda ao redimensionar a janela para evitar quebras ou grids vazios
    window.addEventListener('resize', () => {
        const filterProf = document.getElementById('filterProfissional');
        renderCalendarGrid(filterProf ? filterProf.value : null);
        renderAppointments();
    });

    // ============================================
    // PLANILHA DE GASTOS
    // ============================================

    const GASTOS_COLLECTION = 'gastos';

    const CAT_COLORS = {
        'Moradia':      { bg: '#E3F2FD', text: '#1565C0', dot: '#1976D2' },
        'Alimentação':  { bg: '#E8F5E9', text: '#2E7D32', dot: '#388E3C' },
        'Transporte':   { bg: '#FFF3E0', text: '#E65100', dot: '#F57C00' },
        'Saúde':        { bg: '#FCE4EC', text: '#AD1457', dot: '#E91E63' },
        'Educação':     { bg: '#F3E5F5', text: '#6A1B9A', dot: '#9C27B0' },
        'Lazer':        { bg: '#E0F2F1', text: '#00695C', dot: '#009688' },
        'Vestuário':    { bg: '#FFF8E1', text: '#F57F17', dot: '#FFC107' },
        'Beleza':       { bg: '#F8BBD9', text: '#880E4F', dot: '#E91E63' },
        'Serviços':     { bg: '#E8EAF6', text: '#283593', dot: '#3F51B5' },
        'Outros':       { bg: '#ECEFF1', text: '#455A64', dot: '#607D8B' },
    };

    const BAR_PALETTE = [
        '#E53935','#1976D2','#388E3C','#F57C00','#9C27B0',
        '#009688','#FFC107','#E91E63','#3F51B5','#607D8B'
    ];

    let gastosData = [];

    async function loadGastos() {
        try {
            gastosData = await apiRequest('/gastos');
            const localRaw = localStorage.getItem('raiosol_gastos');
            if (localRaw) {
                const localList = JSON.parse(localRaw);
                if (Array.isArray(localList) && localList.length > 0) {
                    console.log(`[Migration] Enviando ${localList.length} gastos locais para o servidor...`);
                    for (const localGasto of localList) {
                        try {
                            await apiRequest('/gastos', {
                                method: 'POST',
                                body: localGasto
                            });
                        } catch(err) {
                            console.error('[Migration] Erro ao sincronizar gasto local:', err);
                        }
                    }
                    localStorage.removeItem('raiosol_gastos');
                    gastosData = await apiRequest('/gastos');
                }
            }
        } catch(e) {
            // fallback to localStorage
            try {
                gastosData = JSON.parse(localStorage.getItem('raiosol_gastos') || '[]');
            } catch { gastosData = []; }
        }
    }

    async function saveGastoFirestore(gasto) {
        try {
            const res = await apiRequest('/gastos', {
                method: 'POST',
                body: gasto
            });
            return res.id;
        } catch(e) {
            // fallback localStorage
            gastosData.unshift(gasto);
            localStorage.setItem('raiosol_gastos', JSON.stringify(gastosData));
            return gasto.id;
        }
    }

    async function deleteGastoFirestore(id) {
        try {
            await apiRequest(`/gastos/${id}`, {
                method: 'DELETE'
            });
        } catch(e) {
            gastosData = gastosData.filter(g => g.id !== id);
            localStorage.setItem('raiosol_gastos', JSON.stringify(gastosData));
        }
    }

    function fmtBRL(val) {
        return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtDateBR(dateStr) {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    function monthLabel(dateStr) {
        const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const [y, m] = dateStr.split('-');
        return `${months[parseInt(m,10)-1]} ${y}`;
    }

    function renderGastosSummary(data) {
        const now = new Date();
        const thisMes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const thisAno = String(now.getFullYear());

        const mesTotal  = data.filter(g => g.date.startsWith(thisMes)).reduce((s,g) => s + Number(g.valor), 0);
        const anoTotal  = data.filter(g => g.date.startsWith(thisAno)).reduce((s,g) => s + Number(g.valor), 0);

        // Biggest category (all time)
        const catMap = {};
        data.forEach(g => { catMap[g.categoria] = (catMap[g.categoria] || 0) + Number(g.valor); });
        const topCat = Object.entries(catMap).sort((a,b) => b[1]-a[1])[0];

        const elMes  = document.getElementById('gastosValorMes');
        const elAno  = document.getElementById('gastosValorAno');
        const elCat  = document.getElementById('gastosMaiorCategoria');
        const elQtd  = document.getElementById('gastosQtdTotal');
        if (elMes)  elMes.textContent  = fmtBRL(mesTotal);
        if (elAno)  elAno.textContent  = fmtBRL(anoTotal);
        if (elCat)  elCat.textContent  = topCat ? `${topCat[0]}` : '—';
        if (elQtd)  elQtd.textContent  = data.length;
    }

    function renderGastosList(data) {
        const container = document.getElementById('gastosListContainer');
        if (!container) return;

        if (!data.length) {
            container.innerHTML = '<p style="text-align:center;color:var(--neutral-400);padding:40px 0;">Nenhum gasto encontrado.</p>';
            return;
        }

        // Group by month
        const groups = {};
        data.forEach(g => {
            const mk = g.date.substring(0,7);
            if (!groups[mk]) groups[mk] = [];
            groups[mk].push(g);
        });

        const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));

        container.innerHTML = sortedKeys.map(mk => {
            const items = groups[mk];
            const total = items.reduce((s,g) => s + Number(g.valor), 0);
            const rows  = items.map(g => {
                const cc = CAT_COLORS[g.categoria] || CAT_COLORS['Outros'];
                return `
                <div class="gastos-item-row" data-gid="${g.id}">
                    <span class="gastos-item-cat-dot" style="background:${cc.dot};"></span>
                    <span class="gastos-item-desc" title="${g.descricao}">${g.descricao}</span>
                    <span class="gastos-item-cat-tag" style="background:${cc.bg};color:${cc.text};">${g.categoria}</span>
                    ${g.obs ? `<span class="gastos-item-date" style="color:var(--neutral-400);font-style:italic;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;" title="${g.obs}">${g.obs}</span>` : ''}
                    <span class="gastos-item-date">${fmtDateBR(g.date)}</span>
                    <span class="gastos-item-valor">${fmtBRL(g.valor)}</span>
                    <button class="gastos-item-del" data-gid="${g.id}" title="Excluir">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>`;
            }).join('');

            return `
            <div class="gastos-month-group">
                <div class="gastos-month-label">
                    <span>${monthLabel(mk + '-01')}</span>
                    <span class="gastos-month-total">${fmtBRL(total)}</span>
                </div>
                ${rows}
            </div>`;
        }).join('');

        // Delete listeners
        container.querySelectorAll('.gastos-item-del').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const gid = btn.dataset.gid;
                showConfirmDialog({
                    title: 'Excluir Gasto',
                    message: 'Tem certeza que deseja excluir este lançamento?',
                    confirmText: 'Excluir',
                    onConfirm: async () => {
                        await deleteGastoFirestore(gid);
                        gastosData = gastosData.filter(g => g.id !== gid);
                        renderGastosPage();
                        showToast('Gasto excluído.', 'success');
                    }
                });
            });
        });
    }

    function renderGastosRelatorio(data) {
        const container = document.getElementById('gastosRelatorioContainer');
        if (!container) return;

        if (!data.length) {
            container.innerHTML = '<p style="text-align:center;color:var(--neutral-400);padding:30px 0;">Adicione gastos para ver o relatório.</p>';
            return;
        }

        const catMap = {};
        data.forEach(g => { catMap[g.categoria] = (catMap[g.categoria] || 0) + Number(g.valor); });
        const total = Object.values(catMap).reduce((a,b)=>a+b, 0);
        const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);

        container.innerHTML = sorted.map(([cat, val], i) => {
            const pct = total > 0 ? Math.round((val/total)*100) : 0;
            const cc  = CAT_COLORS[cat] || CAT_COLORS['Outros'];
            const barColor = BAR_PALETTE[i % BAR_PALETTE.length];
            return `
            <div class="gastos-report-item">
                <div class="gastos-report-header">
                    <span class="gastos-report-cat">
                        <span style="width:10px;height:10px;border-radius:50%;background:${cc.dot};display:inline-block;flex-shrink:0;"></span>
                        ${cat}
                        <span class="gastos-report-pct">${pct}%</span>
                    </span>
                    <span class="gastos-report-val">${fmtBRL(val)}</span>
                </div>
                <div class="gastos-bar-track">
                    <div class="gastos-bar-fill" style="width:${pct}%;background:${barColor};"></div>
                </div>
            </div>`;
        }).join('');
    }

    function getFilteredGastos() {
        const mes = document.getElementById('gastosMesFiltro')?.value || '';
        const ano = document.getElementById('gastosAnoFiltro')?.value || '';
        const cat = document.getElementById('gatosCatFiltro')?.value || '';

        return gastosData.filter(g => {
            const [gy, gm] = g.date.split('-');
            if (ano && gy !== ano) return false;
            if (mes && gm !== mes) return false;
            if (cat && g.categoria !== cat) return false;
            return true;
        });
    }

    function populateGastosFilters() {
        const mesEl = document.getElementById('gastosMesFiltro');
        const anoEl = document.getElementById('gastosAnoFiltro');
        if (!mesEl || !anoEl) return;

        const anos = [...new Set(gastosData.map(g => g.date.split('-')[0]))].sort((a,b)=>b-a);
        const curAno = String(new Date().getFullYear());

        anoEl.innerHTML = anos.map(a => `<option value="${a}" ${a===curAno?'selected':''}>${a}</option>`).join('');
        if (!anos.includes(curAno)) {
            anoEl.innerHTML = `<option value="${curAno}">${curAno}</option>` + anoEl.innerHTML;
        }

        const monthNames = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        mesEl.innerHTML = '<option value="">Todos os meses</option>' +
            Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${String(m).padStart(2,'0')}">${monthNames[m]}</option>`).join('');

        // Preselect current month
        const curMes = String(new Date().getMonth()+1).padStart(2,'0');
        mesEl.value = curMes;
    }

    async function renderGastosPage() {
        if (session.role !== 'admin') {
            showToast('Acesso negado.', 'error');
            const agendaItem = document.querySelector('.sidebar-nav-item[data-page="agenda"]');
            if (agendaItem) agendaItem.click();
            return;
        }
        if (!gastosData.length) await loadGastos();

        populateGastosFilters();

        const filtered = getFilteredGastos();
        renderGastosSummary(gastosData); // summary always uses all data
        renderGastosList(filtered);
        renderGastosRelatorio(filtered);

        // Wire up filters
        ['gastosMesFiltro','gastosAnoFiltro','gatosCatFiltro'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.gwired) {
                el.dataset.gwired = '1';
                el.addEventListener('change', () => {
                    const f = getFilteredGastos();
                    renderGastosList(f);
                    renderGastosRelatorio(f);
                });
            }
        });

        // Set today's date as default
        const dateEl = document.getElementById('gastosData');
        if (dateEl && !dateEl.value) {
            dateEl.value = new Date().toISOString().split('T')[0];
        }

        // Money mask on valor
        const valorEl = document.getElementById('gastosValor');
        if (valorEl && !valorEl.dataset.gwired) {
            valorEl.dataset.gwired = '1';
            valorEl.addEventListener('input', function() {
                let v = this.value.replace(/\D/g,'');
                if (!v) { this.value = ''; return; }
                v = (parseInt(v,10) / 100).toFixed(2);
                this.value = v.replace('.',',');
            });
        }

        // Add button
        const addBtn = document.getElementById('gastosAddBtn');
        if (addBtn && !addBtn.dataset.gwired) {
            addBtn.dataset.gwired = '1';
            addBtn.addEventListener('click', async () => {
                const desc  = document.getElementById('gastosDescricao')?.value.trim();
                const cat   = document.getElementById('gastosCategoria')?.value;
                const valRaw = document.getElementById('gastosValor')?.value.replace(',','.').trim();
                const date  = document.getElementById('gastosData')?.value;
                const obs   = document.getElementById('gastosObs')?.value.trim();

                if (!desc) { showToast('Informe a descrição do gasto.', 'warning'); return; }
                if (!valRaw || isNaN(Number(valRaw)) || Number(valRaw) <= 0) { showToast('Informe um valor válido.', 'warning'); return; }
                if (!date)  { showToast('Informe a data do gasto.', 'warning'); return; }

                const gasto = {
                    id: generateUUID('gasto'),
                    descricao: desc,
                    categoria: cat,
                    valor: parseFloat(valRaw),
                    date: date,
                    obs: obs || '',
                    createdAt: new Date().toISOString()
                };

                addBtn.disabled = true;
                addBtn.textContent = 'Salvando...';
                try {
                    const savedId = await saveGastoFirestore(gasto);
                    gasto.id = savedId;
                    if (!gastosData.find(g => g.id === savedId)) gastosData.unshift(gasto);
                    showToast('Gasto adicionado!', 'success');

                    // Clear form
                    document.getElementById('gastosDescricao').value = '';
                    document.getElementById('gastosValor').value = '';
                    document.getElementById('gastosObs').value = '';

                    populateGastosFilters();
                    const f = getFilteredGastos();
                    renderGastosSummary(gastosData);
                    renderGastosList(f);
                    renderGastosRelatorio(f);
                } catch(e) {
                    showToast('Erro ao salvar gasto.', 'error');
                } finally {
                    addBtn.disabled = false;
                    addBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Adicionar Gasto';
                }
            });
        }
    }

    // ============================================
    // VALES DO FUNCIONÁRIO
    // ============================================

    const VALES_COLLECTION = 'vales';
    let valesData = [];

    function generateUUID(prefix = 'id') {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return prefix + '-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
    }

    async function loadVales() {
        try {
            valesData = await apiRequest('/vales');
            const localRaw = localStorage.getItem('raiosol_vales');
            if (localRaw) {
                const localList = JSON.parse(localRaw);
                if (Array.isArray(localList) && localList.length > 0) {
                    console.log(`[Migration] Enviando ${localList.length} vales locais para o servidor...`);
                    for (const localVale of localList) {
                        try {
                            await apiRequest('/vales', {
                                method: 'POST',
                                body: localVale
                            });
                        } catch(err) {
                            console.error('[Migration] Erro ao sincronizar vale local:', err);
                        }
                    }
                    localStorage.removeItem('raiosol_vales');
                    valesData = await apiRequest('/vales');
                }
            }
        } catch(e) {
            // fallback to localStorage
            try {
                valesData = JSON.parse(localStorage.getItem('raiosol_vales') || '[]');
            } catch { valesData = []; }
        }
    }

    async function saveValeFirestore(vale) {
        try {
            const res = await apiRequest('/vales', {
                method: 'POST',
                body: vale
            });
            return res.id;
        } catch(e) {
            // fallback localStorage
            valesData.unshift(vale);
            localStorage.setItem('raiosol_vales', JSON.stringify(valesData));
            return vale.id;
        }
    }

    async function deleteValeFirestore(id) {
        try {
            await apiRequest(`/vales/${id}`, {
                method: 'DELETE'
            });
        } catch(e) {
            valesData = valesData.filter(v => v.id !== id);
            localStorage.setItem('raiosol_vales', JSON.stringify(valesData));
        }
    }

    function getFilteredVales() {
        const funcId = document.getElementById('valeFuncFiltro')?.value || '';
        const mes = document.getElementById('valeMesFiltro')?.value || '';
        const ano = document.getElementById('valeAnoFiltro')?.value || '';

        return valesData.filter(v => {
            if (!v || typeof v.date !== 'string') return false;
            const [vy, vm] = v.date.split('-');
            if (funcId && String(v.funcionarioId) !== String(funcId)) return false;
            if (ano && vy !== ano) return false;
            if (mes && vm !== mes) return false;
            return true;
        });
    }

    function populateValesFilters() {
        const funcEl = document.getElementById('valeFuncFiltro');
        const mesEl = document.getElementById('valeMesFiltro');
        const anoEl = document.getElementById('valeAnoFiltro');
        if (!funcEl || !mesEl || !anoEl) return;

        // Populate employee filter
        const activeProfs = professionals.filter(p => p.status !== 'inativo');
        funcEl.innerHTML = '<option value="">Todos profissionais</option>' +
            activeProfs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        // Populate year filter
        const validVales = valesData.filter(v => v && typeof v.date === 'string');
        const anos = [...new Set(validVales.map(v => v.date.split('-')[0]))].sort((a,b)=>b-a);
        const curAno = String(new Date().getFullYear());
        anoEl.innerHTML = anos.map(a => `<option value="${a}" ${a===curAno?'selected':''}>${a}</option>`).join('');
        if (!anos.includes(curAno)) {
            anoEl.innerHTML = `<option value="${curAno}">${curAno}</option>` + anoEl.innerHTML;
        }

        // Populate month filter
        const monthNames = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        mesEl.innerHTML = '<option value="">Todos os meses</option>' +
            Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${String(m).padStart(2,'0')}">${monthNames[m]}</option>`).join('');
        
        // Preselect current month
        const curMes = String(new Date().getMonth()+1).padStart(2,'0');
        mesEl.value = curMes;
    }

    function renderValesSummary(data) {
        const elMes = document.getElementById('valesValorMes');
        const elTotal = document.getElementById('valesValorTotal');
        const elMaior = document.getElementById('valesMaiorRecebedor');
        const elQtd = document.getElementById('valesQtdTotal');

        if (!elMes || !elTotal || !elMaior || !elQtd) return;

        const curDate = new Date();
        const curY = String(curDate.getFullYear());
        const curM = String(curDate.getMonth() + 1).padStart(2, '0');

        let totalGeral = 0;
        let totalMes = 0;
        const totalPorFunc = {};

        data.forEach(v => {
            if (!v || typeof v.date !== 'string') return;
            const val = Number(v.valor) || 0;
            totalGeral += val;

            const [vy, vm] = v.date.split('-');
            if (vy === curY && vm === curM) {
                totalMes += val;
            }

            const name = v.funcionarioNome || 'Desconhecido';
            totalPorFunc[name] = (totalPorFunc[name] || 0) + val;
        });

        // Find maior recebedor
        let maiorNome = '—';
        let maiorVal = 0;
        Object.entries(totalPorFunc).forEach(([name, sum]) => {
            if (sum > maiorVal) {
                maiorVal = sum;
                maiorNome = name;
            }
        });

        elTotal.textContent = fmtBRL(totalGeral);
        elMes.textContent = fmtBRL(totalMes);
        elMaior.textContent = maiorVal > 0 ? `${maiorNome} (${fmtBRL(maiorVal)})` : '—';
        elMaior.style.fontSize = maiorVal > 0 ? '13px' : '15px';
        elQtd.textContent = data.length;
    }

    function renderValesList(data) {
        const container = document.getElementById('valesListContainer');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: var(--neutral-400); padding: 40px 0;">Nenhum vale encontrado para os filtros selecionados.</p>';
            return;
        }

        // Group by month
        const groups = {};
        data.forEach(v => {
            if (!v || typeof v.date !== 'string') return;
            const [y, m] = v.date.split('-');
            const key = `${y}-${m}`;
            if (!groups[key]) groups[key] = { items: [], total: 0 };
            groups[key].items.push(v);
            groups[key].total += Number(v.valor) || 0;
        });

        const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));
        const monthNames = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

        container.innerHTML = sortedKeys.map(key => {
            const [y, m] = key.split('-');
            const g = groups[key];
            const label = `${monthNames[parseInt(m,10)]} de ${y}`;

            const itemsHTML = g.items.map(v => {
                const prof = professionals.find(p => String(p.id) === String(v.funcionarioId));
                const profColor = prof ? prof.color : '#C9A84C';
                const initials = prof ? prof.initials : 'FN';
                const tagBg = profColor + '15'; // 15% opacity

                return `
                <div class="vales-item-row" data-vid="${v.id}">
                    <span class="vales-item-prof-dot" style="background:${profColor};"></span>
                    <span class="vales-item-desc" title="${v.funcionarioNome}${v.obs ? ` - ${v.obs}` : ''}">
                        <strong>${v.funcionarioNome}</strong>
                        ${v.obs ? `<span style="color:var(--neutral-400); font-weight:normal; margin-left: 8px;">(${v.obs})</span>` : ''}
                    </span>
                    <span class="vales-item-prof-tag" style="background:${tagBg}; color:${profColor};">${initials}</span>
                    <span class="vales-item-date">${fmtDateBR(v.date)}</span>
                    <span class="vales-item-valor">${fmtBRL(v.valor)}</span>
                    <button class="vales-item-del" data-vid="${v.id}" title="Excluir vale">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>`;
            }).join('');

            return `
            <div class="vales-month-group">
                <div class="vales-month-label">
                    <span>${label}</span>
                    <span class="vales-month-total">Total: ${fmtBRL(g.total)}</span>
                </div>
                <div class="vales-month-items">
                    ${itemsHTML}
                </div>
            </div>`;
        }).join('');

        // Wire delete buttons
        container.querySelectorAll('.vales-item-del').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.vid;
                const row = this.closest('.vales-item-row');
                showConfirmDialog({
                    title: 'Excluir Vale',
                    message: 'Tem certeza de que deseja excluir este vale?',
                    confirmText: 'Excluir',
                    onConfirm: async () => {
                        if (row) row.style.opacity = '0.5';
                        try {
                            await deleteValeFirestore(id);
                            valesData = valesData.filter(v => v.id !== id);
                            showToast('Vale excluído com sucesso!', 'success');

                            const f = getFilteredVales();
                            renderValesSummary(valesData);
                            renderValesList(f);
                            renderValesRelatorio(f);
                        } catch(e) {
                            showToast('Erro ao excluir vale.', 'error');
                            if (row) row.style.opacity = '1';
                        }
                    }
                });
            });
        });
    }

    function renderValesRelatorio(data) {
        const container = document.getElementById('valesRelatorioContainer');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: var(--neutral-400); padding: 30px 0;">Nenhum vale lançado no período.</p>';
            return;
        }

        const totals = {};
        let totalSum = 0;

        data.forEach(v => {
            const val = Number(v.valor) || 0;
            const name = v.funcionarioNome || 'Desconhecido';
            totals[name] = (totals[name] || 0) + val;
            totalSum += val;
        });

        const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]);

        container.innerHTML = sorted.map(([name, val]) => {
            const pct = totalSum > 0 ? Math.round((val / totalSum) * 100) : 0;
            const prof = professionals.find(p => p.name === name);
            const profColor = prof ? prof.color : 'var(--gold-400)';

            return `
            <div class="vales-report-item">
                <div class="vales-report-header">
                    <span class="vales-report-prof">
                        <span class="vales-item-prof-dot" style="background:${profColor}; width:6px; height:6px;"></span>
                        ${name}
                    </span>
                    <span class="vales-report-pct">${pct}%</span>
                    <span class="vales-report-val">${fmtBRL(val)}</span>
                </div>
                <div class="vales-bar-track">
                    <div class="vales-bar-fill" style="width: ${pct}%; background: ${profColor};"></div>
                </div>
            </div>`;
        }).join('');
    }

    async function renderValesPage() {
        if (session.role !== 'admin') {
            showToast('Acesso negado.', 'error');
            const agendaItem = document.querySelector('.sidebar-nav-item[data-page="agenda"]');
            if (agendaItem) agendaItem.click();
            return;
        }

        if (!professionals || professionals.length === 0) {
            try {
                professionals = await loadProfessionals();
            } catch (e) {
                console.error("Erro ao carregar profissionais sob demanda:", e);
            }
        }

        if (!valesData.length) {
            await loadVales();
        }

        // Populate Employee creation select
        const createSelect = document.getElementById('valeFuncionario');
        if (createSelect) {
            const activeProfs = professionals.filter(p => p.status !== 'inativo');
            createSelect.innerHTML = '<option value="">Selecione o profissional...</option>' +
                activeProfs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }

        populateValesFilters();

        const filtered = getFilteredVales();
        renderValesSummary(valesData); // summary always uses all data
        renderValesList(filtered);
        renderValesRelatorio(filtered);

        // Wire filters
        ['valeFuncFiltro','valeMesFiltro','valeAnoFiltro'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.vwired) {
                el.dataset.vwired = '1';
                el.addEventListener('change', () => {
                    const f = getFilteredVales();
                    renderValesList(f);
                    renderValesRelatorio(f);
                });
            }
        });

        // Set default date to today
        const dateEl = document.getElementById('valeData');
        if (dateEl && !dateEl.value) {
            dateEl.value = new Date().toISOString().split('T')[0];
        }

        // BRL Currency mask on value input
        const valorEl = document.getElementById('valeValor');
        if (valorEl && !valorEl.dataset.vwired) {
            valorEl.dataset.vwired = '1';
            valorEl.addEventListener('input', function() {
                let v = this.value.replace(/\D/g,'');
                if (!v) { this.value = ''; return; }
                v = (parseInt(v,10) / 100).toFixed(2);
                this.value = v.replace('.',',');
            });
        }

        // Add vale button
        const addBtn = document.getElementById('valeAddBtn');
        if (addBtn && !addBtn.dataset.vwired) {
            addBtn.dataset.vwired = '1';
            addBtn.addEventListener('click', async () => {
                const funcId = document.getElementById('valeFuncionario')?.value;
                const valRaw = document.getElementById('valeValor')?.value.replace(',','.').trim();
                const date = document.getElementById('valeData')?.value;
                const obs = document.getElementById('valeObs')?.value.trim();

                if (!funcId) { showToast('Selecione o profissional.', 'warning'); return; }
                if (!valRaw || isNaN(Number(valRaw)) || Number(valRaw) <= 0) { showToast('Informe um valor válido.', 'warning'); return; }
                if (!date) { showToast('Informe a data do adiantamento.', 'warning'); return; }

                const prof = professionals.find(p => String(p.id) === String(funcId));
                const funcName = prof ? prof.name : 'Desconhecido';

                const vale = {
                    id: generateUUID('vale'),
                    funcionarioId: funcId,
                    funcionarioNome: funcName,
                    valor: parseFloat(valRaw),
                    date: date,
                    obs: obs || '',
                    createdAt: new Date().toISOString()
                };

                addBtn.disabled = true;
                addBtn.textContent = 'Salvando...';
                try {
                    const savedId = await saveValeFirestore(vale);
                    vale.id = savedId;
                    if (!valesData.find(v => v.id === savedId)) valesData.unshift(vale);
                    showToast('Vale adicionado com sucesso!', 'success');

                    // Clear form
                    document.getElementById('valeValor').value = '';
                    document.getElementById('valeObs').value = '';

                    populateValesFilters();
                    const f = getFilteredVales();
                    renderValesSummary(valesData);
                    renderValesList(f);
                    renderValesRelatorio(f);
                } catch(e) {
                    showToast('Erro ao salvar vale.', 'error');
                } finally {
                    addBtn.disabled = false;
                    addBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Adicionar Vale';
                }
            });
        }
    }

    async function refreshActivePageData() {
        try {
            appointments = await loadAppointments();

            // 1. Agenda Page: re-render grid and calendar appointments
            const pageAgenda = document.getElementById('page-agenda');
            if (pageAgenda && !pageAgenda.classList.contains('hidden')) {
                const filterProf = document.getElementById('filterProfissional');
                const currentProfId = filterProf ? filterProf.value : null;
                renderCalendarGrid(currentProfId);
                renderAppointments();
                initStatsAnimation();
            }

            // 2. Relatorios Page: re-render reports
            const pageRelatorios = document.getElementById('page-relatorios');
            if (pageRelatorios && !pageRelatorios.classList.contains('hidden')) {
                renderReportsPage();
            }

            // 3. Pagamentos Page: re-render payouts
            const pagePagamentos = document.getElementById('page-pagamentos');
            if (pagePagamentos && !pagePagamentos.classList.contains('hidden')) {
                renderPaymentsPage();
            }

            // 4. Rebuild notifications bell/list
            rebuildNotifications();
        } catch (e) {
            console.error("[SSE] Erro ao atualizar os dados em tempo real:", e);
        }
    }

    function initRealTimeUpdates() {
        const sseUrl = `${API_BASE_URL}/live-updates`;
        console.log(`[SSE] Conectando ao serviço de atualizações em tempo real em: ${sseUrl}`);
        const eventSource = new EventSource(sseUrl);

        eventSource.onmessage = (event) => {
            if (event.data === 'refresh') {
                console.log('[SSE] Sinal de atualização recebido do servidor. Recarregando dados...');
                refreshActivePageData();
            }
        };

        eventSource.onerror = (error) => {
            console.warn('[SSE] Erro ou desconexão no canal de tempo real. Reconectando automaticamente...', error);
        };
    }

    // ============================================================
    // ABA DE MASSAGEM — Pacotes, Sessões, Acompanhamento Corporal
    // Visível apenas para Admin e Georgiana Francine
    // ============================================================

    let massagePackages = [];
    let massageCurrentFilter = 'ativos';

    async function renderMassagemPage() {
        const listEl = document.getElementById('massagePackagesList');
        if (!listEl) return;

        listEl.innerHTML = `<div style="text-align:center;padding:40px;color:#9C27B0;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <p style="margin-top:12px;font-size:14px;font-weight:600;">Carregando pacotes...</p>
        </div>`;

        try {
            massagePackages = await apiRequest('/massage-packages');
        } catch (e) {
            massagePackages = [];
        }

        // Update summary stats
        updateMassageSummary();

        // Setup filter tabs
        const filterBar = document.getElementById('massageFilterBar');
        if (filterBar) {
            filterBar.querySelectorAll('.massage-filter-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBar.querySelectorAll('.massage-filter-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    massageCurrentFilter = btn.dataset.filter;
                    renderMassagePackagesList();
                });
            });
            // Set correct active tab
            filterBar.querySelectorAll('.massage-filter-tab').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === massageCurrentFilter);
            });
        }

        // New package button
        const btnNew = document.getElementById('btnNovoPacoteMassagem');
        if (btnNew) {
            const newBtn = btnNew.cloneNode(true);
            btnNew.parentNode.replaceChild(newBtn, btnNew);
            newBtn.addEventListener('click', () => openMassagePackageModal());
        }

        renderMassagePackagesList();
    }

    function updateMassageSummary() {
        const ativos = massagePackages.filter(p => p.status === 'ativo');
        const totalPendingSessions = ativos.reduce((sum, p) => sum + Math.max(0, p.totalSessions - p.completedSessions), 0);
        const totalRevenue = massagePackages.reduce((sum, p) => sum + (p.price || 0), 0);
        const thisMonth = new Date().toISOString().slice(0, 7);
        const atendidosMes = massagePackages.filter(p => {
            if (!p.createdAt) return false;
            return String(p.createdAt).slice(0, 7) === thisMonth;
        }).length;

        const el = id => document.getElementById(id);
        if (el('massageAtivosCount')) el('massageAtivosCount').textContent = ativos.length;
        if (el('massageSessoesPendentes')) el('massageSessoesPendentes').textContent = totalPendingSessions;
        if (el('massageFaturamento')) el('massageFaturamento').textContent = `R$ ${totalRevenue.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if (el('massageAtendidosMes')) el('massageAtendidosMes').textContent = atendidosMes;
    }

    function renderMassagePackagesList() {
        const listEl = document.getElementById('massagePackagesList');
        if (!listEl) return;

        let filtered = massagePackages;
        if (massageCurrentFilter === 'ativos') filtered = massagePackages.filter(p => p.status === 'ativo');
        else if (massageCurrentFilter === 'inativos') filtered = massagePackages.filter(p => p.status === 'inativo');

        if (filtered.length === 0) {
            const label = massageCurrentFilter === 'ativos' ? 'ativos' : massageCurrentFilter === 'inativos' ? 'inativos' : '';
            listEl.innerHTML = `<div class="massage-empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9C27B0" stroke-width="1.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                <h3>Nenhum pacote ${label} encontrado</h3>
                <p>Clique em "Novo Pacote" para registrar o primeiro pacote de massagem.</p>
            </div>`;
            return;
        }

        listEl.innerHTML = filtered.map(pkg => {
            const pct = pkg.totalSessions > 0 ? Math.min(100, Math.round((pkg.completedSessions / pkg.totalSessions) * 100)) : 0;
            const remaining = Math.max(0, pkg.totalSessions - pkg.completedSessions);
            const paymentClass = `payment-${pkg.paymentStatus}`;
            const paymentLabel = {pago: '✅ Pago Total', parcial: '⚠️ Parcial', pendente: '❌ Pendente'}[pkg.paymentStatus] || pkg.paymentStatus;

            return `
            <div class="massage-pkg-card ${pkg.status}" data-pkg-id="${pkg.id}">
                <div class="massage-pkg-card-header">
                    <div>
                        <p class="massage-pkg-client-name">${pkg.clientName}</p>
                        <p class="massage-pkg-type">💆 ${pkg.massageType} · ${pkg.sessionDuration} min</p>
                    </div>
                    <span class="massage-pkg-status-badge ${pkg.status}">${pkg.status === 'ativo' ? '🟢 ATIVO' : '⚫ INATIVO'}</span>
                </div>
                <div class="massage-pkg-card-body">
                    <div class="massage-progress-section">
                        <div class="massage-progress-label">
                            <span class="massage-progress-text">Progresso das Sessões</span>
                            <span class="massage-progress-count">${pkg.completedSessions}/${pkg.totalSessions} — ${remaining} restante${remaining !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="massage-progress-bar-bg">
                            <div class="massage-progress-bar-fill" style="width:${pct}%"></div>
                        </div>
                    </div>
                    <div class="massage-pkg-info-row">
                        <div class="massage-pkg-info-item">
                            <span class="massage-pkg-info-label">Valor do Pacote</span>
                            <span class="massage-pkg-info-value price">R$ ${(pkg.price||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                        </div>
                        <div class="massage-pkg-info-item">
                            <span class="massage-pkg-info-label">Pagamento</span>
                            <span class="massage-pkg-info-value ${paymentClass}">${paymentLabel}</span>
                        </div>
                        ${pkg.clientPhone ? `<div class="massage-pkg-info-item"><span class="massage-pkg-info-label">Telefone</span><span class="massage-pkg-info-value">${pkg.clientPhone}</span></div>` : ''}
                        ${pkg.notes ? `<div class="massage-pkg-info-item"><span class="massage-pkg-info-label">Obs.</span><span class="massage-pkg-info-value" style="font-size:12px;font-weight:500;">${pkg.notes}</span></div>` : ''}
                    </div>
                </div>
                <div class="massage-pkg-card-footer">
                    <button class="massage-pkg-btn massage-pkg-btn-details" data-action="details" data-pkg-id="${pkg.id}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Ver Detalhes
                    </button>
                    ${pkg.status === 'ativo' ? `<button class="massage-pkg-btn massage-pkg-btn-session" data-action="quick-session" data-pkg-id="${pkg.id}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Sessão
                    </button>` : ''}
                    <button class="massage-pkg-btn massage-pkg-btn-delete" data-action="delete" data-pkg-id="${pkg.id}" title="Excluir">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>`;
        }).join('');

        // Attach events
        listEl.querySelectorAll('[data-action="details"]').forEach(btn => {
            btn.addEventListener('click', () => openMassageDetailPanel(btn.dataset.pkgId));
        });
        listEl.querySelectorAll('[data-action="quick-session"]').forEach(btn => {
            btn.addEventListener('click', () => openMassageSessionModal(btn.dataset.pkgId));
        });
        listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const pkg = massagePackages.find(p => p.id === btn.dataset.pkgId);
                if (!pkg) return;
                showConfirmDialog({
                    title: 'Excluir Pacote',
                    message: `Tem certeza que deseja excluir o pacote de <strong>${pkg.clientName}</strong>? Todas as sessões e medidas serão perdidas.`,
                    confirmText: 'Excluir',
                    onConfirm: async () => {
                        try {
                            await apiRequest(`/massage-packages/${pkg.id}`, { method: 'DELETE' });
                            massagePackages = massagePackages.filter(p => p.id !== pkg.id);
                            updateMassageSummary();
                            renderMassagePackagesList();
                            showToast('Pacote excluído.', 'warning');
                        } catch (e) {
                            showToast('Erro ao excluir pacote.', 'error');
                        }
                    }
                });
            });
        });
    }

    // ——— Modal: Novo / Editar Pacote ———
    function openMassagePackageModal(pkgId = null) {
        const pkg = pkgId ? massagePackages.find(p => p.id === pkgId) : null;
        const isEdit = !!pkg;

        const overlay = document.createElement('div');
        overlay.className = 'massage-modal-overlay';
        overlay.innerHTML = `
        <div class="massage-modal">
            <h3 class="massage-modal-title">${isEdit ? '✏️ Editar Pacote' : '💆 Novo Pacote de Massagem'}</h3>
            <div class="massage-modal-grid">
                <div class="massage-form-group full-col">
                    <label class="massage-form-label">Nome do Cliente *</label>
                    <input class="massage-form-input" id="mpkgClientName" type="text" placeholder="Nome completo do paciente" value="${pkg ? pkg.clientName : ''}">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Telefone / WhatsApp</label>
                    <input class="massage-form-input" id="mpkgClientPhone" type="text" placeholder="(00) 00000-0000" value="${pkg ? pkg.clientPhone : ''}">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Tipo de Massagem *</label>
                    <select class="massage-form-select" id="mpkgMassageType">
                        ${['Modeladora', 'Relaxante', 'Drenagem Linfática', 'Redutora', 'Esportiva', 'Pedras Quentes', 'Bambuterapia', 'Cromoterapia', 'Reflexologia', 'Shiatsu', 'Outro'].map(t =>
                            `<option value="${t}" ${pkg && pkg.massageType === t ? 'selected' : ''}>${t}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Duração da Sessão (min)</label>
                    <input class="massage-form-input" id="mpkgDuration" type="number" min="15" step="15" value="${pkg ? pkg.sessionDuration : 60}">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Nº de Sessões no Pacote *</label>
                    <input class="massage-form-input" id="mpkgTotalSessions" type="number" min="1" value="${pkg ? pkg.totalSessions : 10}">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Valor Total (R$) *</label>
                    <input class="massage-form-input" id="mpkgPrice" type="number" min="0" step="0.01" placeholder="0,00" value="${pkg ? pkg.price : ''}">
                </div>
                <div class="massage-form-group full-col">
                    <label class="massage-form-label">Status do Pagamento</label>
                    <select class="massage-form-select" id="mpkgPaymentStatus">
                        <option value="pago" ${pkg && pkg.paymentStatus === 'pago' ? 'selected' : ''}>✅ Pago Total</option>
                        <option value="parcial" ${pkg && pkg.paymentStatus === 'parcial' ? 'selected' : ''}>⚠️ Pago Parcialmente</option>
                        <option value="pendente" ${(!pkg || pkg.paymentStatus === 'pendente') ? 'selected' : ''}>❌ Pagamento Pendente</option>
                    </select>
                </div>
                <div class="massage-form-group full-col">
                    <label class="massage-form-label">Observações Gerais</label>
                    <textarea class="massage-form-textarea" id="mpkgNotes" placeholder="Anotações sobre o paciente, contraindicações, preferências...">${pkg ? pkg.notes : ''}</textarea>
                </div>
            </div>
            <div class="massage-modal-actions">
                <button class="massage-modal-btn-cancel" id="mpkgBtnCancel">Cancelar</button>
                <button class="massage-modal-btn-save" id="mpkgBtnSave">${isEdit ? 'Salvar Alterações' : 'Criar Pacote'}</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        overlay.querySelector('#mpkgBtnCancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#mpkgBtnSave').addEventListener('click', async () => {
            const clientName = overlay.querySelector('#mpkgClientName').value.trim();
            const massageType = overlay.querySelector('#mpkgMassageType').value;
            const price = parseFloat(overlay.querySelector('#mpkgPrice').value) || 0;
            const totalSessions = parseInt(overlay.querySelector('#mpkgTotalSessions').value) || 1;
            if (!clientName) { showToast('Informe o nome do cliente.', 'error'); return; }

            const saveBtn = overlay.querySelector('#mpkgBtnSave');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            const payload = {
                id: pkg ? pkg.id : null,
                clientName,
                clientPhone: overlay.querySelector('#mpkgClientPhone').value.trim(),
                massageType,
                sessionDuration: parseInt(overlay.querySelector('#mpkgDuration').value) || 60,
                totalSessions,
                completedSessions: pkg ? pkg.completedSessions : 0,
                price,
                paymentStatus: overlay.querySelector('#mpkgPaymentStatus').value,
                status: pkg ? pkg.status : 'ativo',
                notes: overlay.querySelector('#mpkgNotes').value.trim()
            };

            try {
                const result = await apiRequest('/massage-packages', { method: 'POST', body: payload });
                overlay.remove();
                massagePackages = await apiRequest('/massage-packages');
                updateMassageSummary();
                renderMassagePackagesList();
                showToast(isEdit ? 'Pacote atualizado!' : 'Pacote criado com sucesso!', 'success');
            } catch (e) {
                showToast('Erro ao salvar pacote: ' + (e.message || ''), 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Pacote';
            }
        });
    }

    // ——— Modal: Registrar Sessão ———
    function openMassageSessionModal(pkgId, onSaved) {
        const pkg = massagePackages.find(p => p.id === pkgId);
        if (!pkg) return;

        const today = new Date().toISOString().slice(0, 10);
        let selectedStars = 5;

        const overlay = document.createElement('div');
        overlay.className = 'massage-modal-overlay';
        overlay.innerHTML = `
        <div class="massage-modal" style="max-width:440px;">
            <h3 class="massage-modal-title">📋 Registrar Sessão</h3>
            <p style="margin:-14px 0 18px;font-size:13px;color:#9C27B0;font-weight:600;">Paciente: ${pkg.clientName}</p>
            <div class="massage-modal-grid" style="grid-template-columns:1fr;">
                <div class="massage-form-group">
                    <label class="massage-form-label">Data da Sessão *</label>
                    <input class="massage-form-input" id="msessDate" type="date" value="${today}">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Observações da Sessão</label>
                    <textarea class="massage-form-textarea" id="msessObs" placeholder="Áreas trabalhadas, reações do paciente, resultados observados..."></textarea>
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Satisfação do Paciente</label>
                    <div class="massage-star-rating" id="msessStars">
                        ${[1,2,3,4,5].map(i => `<button class="massage-star-btn ${i <= 5 ? 'active' : ''}" data-star="${i}">★</button>`).join('')}
                    </div>
                </div>
            </div>
            <div class="massage-modal-actions">
                <button class="massage-modal-btn-cancel" id="msessBtnCancel">Cancelar</button>
                <button class="massage-modal-btn-save" id="msessBtnSave">Registrar Sessão</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Star rating
        overlay.querySelectorAll('.massage-star-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedStars = parseInt(btn.dataset.star);
                overlay.querySelectorAll('.massage-star-btn').forEach(b => {
                    b.classList.toggle('active', parseInt(b.dataset.star) <= selectedStars);
                });
            });
        });

        overlay.querySelector('#msessBtnCancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#msessBtnSave').addEventListener('click', async () => {
            const sessionDate = overlay.querySelector('#msessDate').value;
            if (!sessionDate) { showToast('Informe a data da sessão.', 'error'); return; }

            const saveBtn = overlay.querySelector('#msessBtnSave');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            try {
                const result = await apiRequest('/massage-sessions', {
                    method: 'POST',
                    body: {
                        packageId: pkgId,
                        sessionDate,
                        observations: overlay.querySelector('#msessObs').value.trim(),
                        satisfaction: selectedStars
                    }
                });

                // Update local state
                const pkgLocal = massagePackages.find(p => p.id === pkgId);
                if (pkgLocal) {
                    pkgLocal.completedSessions = result.completedSessions;
                    pkgLocal.status = result.status;
                }

                overlay.remove();
                updateMassageSummary();
                renderMassagePackagesList();
                showToast('Sessão registrada com sucesso!', 'success');
                if (onSaved) onSaved();
            } catch (e) {
                showToast('Erro ao registrar sessão.', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Registrar Sessão';
            }
        });
    }

    // ——— Modal: Registrar Medidas Corporais ———
    function openMassageBodyTrackingModal(pkgId, onSaved) {
        const pkg = massagePackages.find(p => p.id === pkgId);
        if (!pkg) return;
        const today = new Date().toISOString().slice(0, 10);

        const overlay = document.createElement('div');
        overlay.className = 'massage-modal-overlay';
        overlay.innerHTML = `
        <div class="massage-modal" style="max-width:560px;">
            <h3 class="massage-modal-title">📏 Registrar Medidas Corporais</h3>
            <p style="margin:-14px 0 18px;font-size:13px;color:#9C27B0;font-weight:600;">Paciente: ${pkg.clientName}</p>
            <div class="massage-modal-grid">
                <div class="massage-form-group full-col">
                    <label class="massage-form-label">Data da Avaliação *</label>
                    <input class="massage-form-input" id="mtrackDate" type="date" value="${today}">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Peso (kg)</label>
                    <input class="massage-form-input" id="mtrackWeight" type="number" min="0" step="0.1" placeholder="Ex: 68.5">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Altura (cm)</label>
                    <input class="massage-form-input" id="mtrackHeight" type="number" min="0" step="0.5" placeholder="Ex: 165">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Cintura (cm)</label>
                    <input class="massage-form-input" id="mtrackWaist" type="number" min="0" step="0.5" placeholder="Ex: 72.0">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Abdômen (cm)</label>
                    <input class="massage-form-input" id="mtrackAbdomen" type="number" min="0" step="0.5" placeholder="Ex: 85.0">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Quadril (cm)</label>
                    <input class="massage-form-input" id="mtrackHip" type="number" min="0" step="0.5" placeholder="Ex: 98.0">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Coxa Direita (cm)</label>
                    <input class="massage-form-input" id="mtrackThighR" type="number" min="0" step="0.5" placeholder="Ex: 55.0">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Coxa Esquerda (cm)</label>
                    <input class="massage-form-input" id="mtrackThighL" type="number" min="0" step="0.5" placeholder="Ex: 55.0">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Braço Direito (cm)</label>
                    <input class="massage-form-input" id="mtrackArmR" type="number" min="0" step="0.5" placeholder="Ex: 28.0">
                </div>
                <div class="massage-form-group">
                    <label class="massage-form-label">Braço Esquerdo (cm)</label>
                    <input class="massage-form-input" id="mtrackArmL" type="number" min="0" step="0.5" placeholder="Ex: 28.0">
                </div>
                <div class="massage-form-group full-col">
                    <label class="massage-form-label">Observações (Estado da Pele, Retenção Hídrica, etc.)</label>
                    <textarea class="massage-form-textarea" id="mtrackNotes" placeholder="Ex: Celulite grau 2 na região glútea, retenção hídrica moderada nas pernas..."></textarea>
                </div>
            </div>
            <div class="massage-modal-actions">
                <button class="massage-modal-btn-cancel" id="mtrackBtnCancel">Cancelar</button>
                <button class="massage-modal-btn-save" id="mtrackBtnSave">Salvar Medidas</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
        overlay.querySelector('#mtrackBtnCancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#mtrackBtnSave').addEventListener('click', async () => {
            const measureDate = overlay.querySelector('#mtrackDate').value;
            if (!measureDate) { showToast('Informe a data da avaliação.', 'error'); return; }

            const parseVal = id => {
                const v = parseFloat(overlay.querySelector(id).value);
                return isNaN(v) ? null : v;
            };

            const saveBtn = overlay.querySelector('#mtrackBtnSave');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            try {
                await apiRequest('/massage-body-tracking', {
                    method: 'POST',
                    body: {
                        packageId: pkgId,
                        measureDate,
                        weight: parseVal('#mtrackWeight'),
                        height: parseVal('#mtrackHeight'),
                        waist: parseVal('#mtrackWaist'),
                        abdomen: parseVal('#mtrackAbdomen'),
                        hip: parseVal('#mtrackHip'),
                        thighR: parseVal('#mtrackThighR'),
                        thighL: parseVal('#mtrackThighL'),
                        armR: parseVal('#mtrackArmR'),
                        armL: parseVal('#mtrackArmL'),
                        notes: overlay.querySelector('#mtrackNotes').value.trim()
                    }
                });
                overlay.remove();
                showToast('Medidas registradas com sucesso!', 'success');
                if (onSaved) onSaved();
            } catch (e) {
                showToast('Erro ao salvar medidas.', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar Medidas';
            }
        });
    }

    // ——— Detail Panel ———
    async function openMassageDetailPanel(pkgId) {
        const pkg = massagePackages.find(p => p.id === pkgId);
        if (!pkg) return;

        // Remove any existing detail panel
        document.querySelectorAll('.massage-detail-overlay').forEach(el => el.remove());

        const pct = pkg.totalSessions > 0 ? Math.min(100, Math.round((pkg.completedSessions / pkg.totalSessions) * 100)) : 0;
        const remaining = Math.max(0, pkg.totalSessions - pkg.completedSessions);
        const paymentLabel = {pago: '✅ Pago Total', parcial: '⚠️ Pago Parcialmente', pendente: '❌ Pagamento Pendente'}[pkg.paymentStatus] || pkg.paymentStatus;

        const overlay = document.createElement('div');
        overlay.className = 'massage-detail-overlay';
        overlay.innerHTML = `
        <div class="massage-detail-panel">
            <div class="massage-detail-header">
                <div class="massage-detail-header-top">
                    <div>
                        <p class="massage-detail-client">${pkg.clientName}</p>
                        <p class="massage-detail-type">💆 ${pkg.massageType} · ${pkg.sessionDuration} min por sessão</p>
                    </div>
                    <button class="massage-detail-close" id="massageDetailClose">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="massage-detail-progress-row">
                    <div class="massage-detail-progress-bar-bg">
                        <div class="massage-detail-progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="massage-detail-progress-label">${pkg.completedSessions}/${pkg.totalSessions} sessões</span>
                </div>
            </div>
            <div class="massage-detail-body">
                <!-- Info Grid -->
                <div class="massage-detail-section">
                    <h4 class="massage-detail-section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Informações do Pacote
                    </h4>
                    <div class="massage-detail-info-grid">
                        <div class="massage-detail-info-item"><div class="info-label">Sessões Restantes</div><div class="info-value" style="color:#9C27B0;">${remaining}</div></div>
                        <div class="massage-detail-info-item"><div class="info-label">Valor do Pacote</div><div class="info-value" style="color:#4CAF50;">R$ ${(pkg.price||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
                        <div class="massage-detail-info-item"><div class="info-label">Pagamento</div><div class="info-value" style="font-size:12px;">${paymentLabel}</div></div>
                        ${pkg.clientPhone ? `<div class="massage-detail-info-item"><div class="info-label">Telefone</div><div class="info-value">${pkg.clientPhone}</div></div>` : ''}
                        <div class="massage-detail-info-item"><div class="info-label">Status</div><div class="info-value">${pkg.status === 'ativo' ? '🟢 Ativo' : '⚫ Inativo'}</div></div>
                        <div class="massage-detail-info-item">
                            <div class="info-label">Ações</div>
                            <button class="massage-add-btn massage-add-btn-primary" id="detailBtnEdit" style="font-size:11px;padding:6px 12px;margin-top:2px;">✏️ Editar Pacote</button>
                        </div>
                    </div>
                    ${pkg.notes ? `<div style="margin-top:10px;padding:10px 14px;background:rgba(156,39,176,0.06);border-radius:10px;font-size:13px;color:var(--text-secondary,#666);">📝 ${pkg.notes}</div>` : ''}
                </div>

                <!-- Sessions Section -->
                <div class="massage-detail-section" id="detailSessionsSection">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid rgba(156,39,176,0.12);">
                        <h4 class="massage-detail-section-title" style="margin:0;border:none;padding:0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Sessões Realizadas
                        </h4>
                        ${pkg.status === 'ativo' ? `<button class="massage-add-btn massage-add-btn-primary" id="detailBtnAddSession">+ Registrar Sessão</button>` : ''}
                    </div>
                    <div class="massage-session-timeline" id="detailSessionsList">
                        <div style="text-align:center;padding:20px;color:#9C27B0;font-size:13px;">Carregando sessões...</div>
                    </div>
                </div>

                <!-- Body Tracking Section -->
                <div class="massage-detail-section" id="detailBodySection">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid rgba(156,39,176,0.12);">
                        <h4 class="massage-detail-section-title" style="margin:0;border:none;padding:0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            Acompanhamento Corporal
                        </h4>
                        <button class="massage-add-btn massage-add-btn-success" id="detailBtnAddMeasure">+ Registrar Medidas</button>
                    </div>
                    <div id="detailBodyContent">
                        <div style="text-align:center;padding:20px;color:#9C27B0;font-size:13px;">Carregando medidas...</div>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Close button
        overlay.querySelector('#massageDetailClose').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        // Edit button
        overlay.querySelector('#detailBtnEdit').addEventListener('click', () => {
            overlay.remove();
            openMassagePackageModal(pkgId);
        });

        // Add session button
        const addSessionBtn = overlay.querySelector('#detailBtnAddSession');
        if (addSessionBtn) {
            addSessionBtn.addEventListener('click', () => {
                openMassageSessionModal(pkgId, () => {
                    loadDetailSessions(pkgId, overlay);
                    // Refresh progress bar
                    const p = massagePackages.find(x => x.id === pkgId);
                    if (p) {
                        const pct2 = p.totalSessions > 0 ? Math.min(100, Math.round((p.completedSessions / p.totalSessions) * 100)) : 0;
                        const fill = overlay.querySelector('.massage-detail-progress-bar-fill');
                        if (fill) fill.style.width = pct2 + '%';
                        const lbl = overlay.querySelector('.massage-detail-progress-label');
                        if (lbl) lbl.textContent = `${p.completedSessions}/${p.totalSessions} sessões`;
                    }
                });
            });
        }

        // Add measure button
        overlay.querySelector('#detailBtnAddMeasure').addEventListener('click', () => {
            openMassageBodyTrackingModal(pkgId, () => loadDetailBodyTracking(pkgId, overlay));
        });

        // Load data
        await loadDetailSessions(pkgId, overlay);
        await loadDetailBodyTracking(pkgId, overlay);
    }

    async function loadDetailSessions(pkgId, panelEl) {
        const listEl = panelEl.querySelector('#detailSessionsList');
        if (!listEl) return;
        try {
            const sessions = await apiRequest(`/massage-sessions/${pkgId}`);
            if (sessions.length === 0) {
                listEl.innerHTML = `<p style="text-align:center;color:var(--text-secondary,#888);font-size:13px;padding:20px;">Nenhuma sessão registrada ainda.</p>`;
                return;
            }
            listEl.innerHTML = sessions.map((s, i) => {
                const stars = [1,2,3,4,5].map(n => `<span class="massage-session-star ${n <= (s.satisfaction||5) ? '' : 'empty'}">★</span>`).join('');
                const dateFmt = s.sessionDate ? s.sessionDate.split('-').reverse().join('/') : '—';
                return `<div class="massage-session-item">
                    <div class="massage-session-number">${sessions.length - i}</div>
                    <div class="massage-session-content">
                        <div class="massage-session-date">📅 ${dateFmt}</div>
                        ${s.observations ? `<div class="massage-session-obs">${s.observations}</div>` : '<div class="massage-session-obs" style="color:#bbb;">Sem observações</div>'}
                        <div class="massage-session-stars">${stars}</div>
                    </div>
                    <button class="massage-session-delete" data-sess-id="${s.id}" title="Excluir sessão">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>`;
            }).join('');

            listEl.querySelectorAll('.massage-session-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    showConfirmDialog({
                        title: 'Excluir Sessão',
                        message: 'Tem certeza que deseja excluir esta sessão registrada?',
                        confirmText: 'Excluir',
                        onConfirm: async () => {
                            try {
                                const result = await apiRequest(`/massage-sessions/${btn.dataset.sessId}`, { method: 'DELETE' });
                                const pkgLocal = massagePackages.find(p => p.id === pkgId);
                                if (pkgLocal && result) {
                                    pkgLocal.completedSessions = Math.max(0, pkgLocal.completedSessions - 1);
                                    pkgLocal.status = pkgLocal.completedSessions >= pkgLocal.totalSessions ? 'inativo' : 'ativo';
                                }
                                await loadDetailSessions(pkgId, panelEl);
                                updateMassageSummary();
                                renderMassagePackagesList();
                                showToast('Sessão excluída.', 'warning');
                            } catch (e) {
                                showToast('Erro ao excluir sessão.', 'error');
                            }
                        }
                    });
                });
            });
        } catch (e) {
            listEl.innerHTML = `<p style="color:#EF5350;font-size:13px;text-align:center;padding:20px;">Erro ao carregar sessões.</p>`;
        }
    }

    async function loadDetailBodyTracking(pkgId, panelEl) {
        const contentEl = panelEl.querySelector('#detailBodyContent');
        if (!contentEl) return;
        try {
            const records = await apiRequest(`/massage-body-tracking/${pkgId}`);

            if (records.length === 0) {
                contentEl.innerHTML = `<p style="text-align:center;color:var(--text-secondary,#888);font-size:13px;padding:20px;">Nenhuma medida registrada ainda. Registre a avaliação inicial!</p>`;
                return;
            }

            // Table
            const fields = [
                { key: 'weight', label: 'Peso (kg)' },
                { key: 'waist', label: 'Cintura (cm)' },
                { key: 'abdomen', label: 'Abdômen (cm)' },
                { key: 'hip', label: 'Quadril (cm)' },
                { key: 'thighR', label: 'Coxa D (cm)' },
                { key: 'thighL', label: 'Coxa E (cm)' },
                { key: 'armR', label: 'Braço D (cm)' },
                { key: 'armL', label: 'Braço E (cm)' }
            ];

            // IMC calculation helper
            const calcImc = (r) => {
                if (r.weight && r.height) {
                    const hm = r.height / 100;
                    return (r.weight / (hm * hm)).toFixed(1);
                }
                return null;
            };

            const delta = (curr, prev, field) => {
                if (curr[field] === null || curr[field] === undefined) return '—';
                if (prev === null || prev[field] === null || prev[field] === undefined) return `<span>${curr[field]}</span>`;
                const diff = curr[field] - prev[field];
                if (Math.abs(diff) < 0.05) return `<span>${curr[field]} <span class="massage-delta-same">=</span></span>`;
                // For weight/measurements, less is generally better
                const isImprovement = diff < 0;
                const cls = isImprovement ? 'massage-delta-pos' : 'massage-delta-neg';
                const arrow = diff > 0 ? '▲' : '▼';
                return `<span>${curr[field]} <span class="${cls}">${arrow}${Math.abs(diff).toFixed(1)}</span></span>`;
            };

            let tableHTML = `<div class="massage-tracking-table-wrap"><table class="massage-tracking-table"><thead><tr>
                <th>Medida</th>
                ${records.map((r, i) => {
                    const d = r.measureDate ? r.measureDate.split('-').reverse().join('/') : '—';
                    return `<th>${d}${i === 0 ? ' <span style="color:#9C27B0;font-size:9px;">INICIAL</span>' : ''}</th>`;
                }).join('')}
                <th></th>
            </tr></thead><tbody>`;

            fields.forEach(f => {
                tableHTML += `<tr><td>${f.label}</td>`;
                records.forEach((r, i) => {
                    const prev = i > 0 ? records[i-1] : null;
                    tableHTML += `<td>${delta(r, prev, f.key)}</td>`;
                });
                tableHTML += `<td></td></tr>`;
            });

            // IMC row
            tableHTML += `<tr><td>IMC</td>`;
            records.forEach(r => {
                const imc = calcImc(r);
                let imcLabel = '';
                if (imc) {
                    const v = parseFloat(imc);
                    imcLabel = v < 18.5 ? '(Abaixo do peso)' : v < 25 ? '(Normal)' : v < 30 ? '(Sobrepeso)' : '(Obesidade)';
                }
                tableHTML += `<td>${imc ? `${imc} <span style="font-size:10px;color:#9E9E9E;">${imcLabel}</span>` : '—'}</td>`;
            });
            tableHTML += `<td></td></tr>`;

            // Delete row
            tableHTML += `<tr><td style="color:var(--text-secondary,#888);font-weight:500;">Excluir</td>`;
            records.forEach(r => {
                tableHTML += `<td><button class="massage-track-delete" data-track-id="${r.id}" title="Excluir esta medição">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button></td>`;
            });
            tableHTML += `<td></td></tr>`;
            tableHTML += `</tbody></table></div>`;

            // Sparkline charts for key metrics
            const chartsData = [
                { key: 'weight', label: 'Peso (kg)', color: '#9C27B0' },
                { key: 'abdomen', label: 'Abdômen (cm)', color: '#E91E63' },
                { key: 'waist', label: 'Cintura (cm)', color: '#FF9800' },
                { key: 'hip', label: 'Quadril (cm)', color: '#2196F3' },
                { key: 'thighR', label: 'Coxa D (cm)', color: '#4CAF50' },
                { key: 'armR', label: 'Braço D (cm)', color: '#FF5722' }
            ].filter(c => records.some(r => r[c.key] !== null && r[c.key] !== undefined));

            let chartsHTML = '';
            if (records.length >= 2 && chartsData.length > 0) {
                chartsHTML = `<div class="massage-charts-grid">` +
                chartsData.map(c => {
                    const vals = records.map(r => r[c.key]).filter(v => v !== null && v !== undefined);
                    if (vals.length < 2) return '';
                    const min = Math.min(...vals);
                    const max = Math.max(...vals);
                    const range = max - min || 1;
                    const w = 200; const h = 70; const pad = 8;
                    const pts = vals.map((v, i) => {
                        const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
                        const y = h - pad - ((v - min) / range) * (h - pad * 2);
                        return `${x},${y}`;
                    }).join(' ');
                    const firstLast = vals.length >= 2 ? (vals[vals.length-1] - vals[0]).toFixed(1) : null;
                    const diffLabel = firstLast !== null ? (parseFloat(firstLast) > 0 ? `<span style="color:#EF5350;">▲ +${firstLast}</span>` : `<span style="color:#4CAF50;">▼ ${firstLast}</span>`) : '';
                    return `<div class="massage-chart-container">
                        <div class="massage-chart-title">${c.label} ${diffLabel}</div>
                        <svg class="massage-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                            <defs><linearGradient id="grad_${c.key}" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="${c.color}" stop-opacity="0.3"/>
                                <stop offset="100%" stop-color="${c.color}" stop-opacity="0.02"/>
                            </linearGradient></defs>
                            <polyline points="${pts}" fill="none" stroke="${c.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
                            ${vals.map((v, i) => {
                                const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
                                const y = h - pad - ((v - min) / range) * (h - pad * 2);
                                return `<circle cx="${x}" cy="${y}" r="3.5" fill="${c.color}" stroke="#fff" stroke-width="1.5"/>`;
                            }).join('')}
                        </svg>
                        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-secondary,#888);margin-top:4px;">
                            <span>${records[0].measureDate ? records[0].measureDate.split('-').reverse().join('/') : ''}</span>
                            <span>${records[records.length-1].measureDate ? records[records.length-1].measureDate.split('-').reverse().join('/') : ''}</span>
                        </div>
                    </div>`;
                }).join('') + `</div>`;
            }

            // Notes from records
            const notesHTML = records.filter(r => r.notes).map(r => {
                const d = r.measureDate ? r.measureDate.split('-').reverse().join('/') : '—';
                return `<div style="padding:8px 12px;background:rgba(156,39,176,0.05);border-radius:8px;margin-top:8px;font-size:12px;color:var(--text-secondary,#666);">
                    <strong style="color:#9C27B0;">${d}:</strong> ${r.notes}
                </div>`;
            }).join('');

            contentEl.innerHTML = tableHTML + chartsHTML + (notesHTML ? `<div style="margin-top:12px;">${notesHTML}</div>` : '');

            // Delete tracking record
            contentEl.querySelectorAll('.massage-track-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    showConfirmDialog({
                        title: 'Excluir Medição',
                        message: 'Tem certeza que deseja excluir esta avaliação corporal?',
                        confirmText: 'Excluir',
                        onConfirm: async () => {
                            try {
                                await apiRequest(`/massage-body-tracking/${btn.dataset.trackId}`, { method: 'DELETE' });
                                await loadDetailBodyTracking(pkgId, panelEl);
                                showToast('Medição excluída.', 'warning');
                            } catch (e) {
                                showToast('Erro ao excluir medição.', 'error');
                            }
                        }
                    });
                });
            });
        } catch (e) {
            contentEl.innerHTML = `<p style="color:#EF5350;font-size:13px;text-align:center;padding:20px;">Erro ao carregar medidas corporais.</p>`;
        }
    }

});

