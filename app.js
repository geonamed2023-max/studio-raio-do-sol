import { apiRequest } from "./api-config.js";

/* ============================================
   STUDIO RAIO DO SOL - Application Logic
   Login, Register, Forgot Password
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
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

    // ===== DOM Elements =====
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');

    // Navigation links
    const goToRegister = document.getElementById('goToRegister');
    const goToLogin = document.getElementById('goToLogin');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // Modals
    const successModal = document.getElementById('successModal');
    const forgotModal = document.getElementById('forgotModal');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const forgotCancelBtn = document.getElementById('forgotCancelBtn');

    // Toggle password buttons
    const toggleLoginPassword = document.getElementById('toggleLoginPassword');
    const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');

    // Password strength
    const registerPassword = document.getElementById('registerPassword');
    const passwordStrength = document.getElementById('passwordStrength');

    // Phone input
    const registerPhone = document.getElementById('registerPhone');

    // Avatar / Profile photo elements
    const registerAvatarFile = document.getElementById('registerAvatarFile');
    const avatarUploadContainer = document.getElementById('avatarUploadContainer');
    const avatarPreviewPlaceholder = document.getElementById('avatarPreviewPlaceholder');
    const registerAvatarPreview = document.getElementById('registerAvatarPreview');
    let selectedAvatarBase64 = null;

    // ===== Initialize Particles =====
    createParticles();

    // ===== Screen Navigation =====
    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        switchScreen(loginScreen, registerScreen);
    });

    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchScreen(registerScreen, loginScreen);
    });

    function switchScreen(from, to) {
        from.classList.add('screen-exit');
        setTimeout(() => {
            from.classList.add('hidden');
            from.classList.remove('screen-exit');
            to.classList.remove('hidden');
            to.classList.add('screen-enter');
            setTimeout(() => {
                to.classList.remove('screen-enter');
            }, 500);
        }, 300);
    }

    // ===== Toggle Password Visibility =====
    function setupPasswordToggle(toggleBtn, inputId) {
        if (!toggleBtn) return;
        toggleBtn.addEventListener('click', () => {
            const input = document.getElementById(inputId);
            const eyeOpen = toggleBtn.querySelector('.eye-open');
            const eyeClosed = toggleBtn.querySelector('.eye-closed');

            if (input.type === 'password') {
                input.type = 'text';
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
            } else {
                input.type = 'password';
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
            }
        });
    }

    setupPasswordToggle(toggleLoginPassword, 'loginPassword');
    setupPasswordToggle(toggleRegisterPassword, 'registerPassword');

    // ===== Phone Mask =====
    if (registerPhone) {
        registerPhone.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            if (value.length > 6) {
                value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
            } else if (value.length > 2) {
                value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
            } else if (value.length > 0) {
                value = `(${value}`;
            }

            e.target.value = value;
        });
    }

    // ===== Avatar File Selection & Preview =====
    if (registerAvatarFile) {
        registerAvatarFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            clearError('registerAvatarFile', 'registerAvatarError');
            
            if (!file) {
                selectedAvatarBase64 = null;
                registerAvatarPreview.src = '';
                registerAvatarPreview.classList.add('hidden');
                avatarPreviewPlaceholder.classList.remove('hidden');
                avatarUploadContainer.classList.remove('has-image');
                return;
            }

            if (!file.type.startsWith('image/')) {
                showError('registerAvatarFile', 'registerAvatarError', 'Escolha um arquivo de imagem.');
                selectedAvatarBase64 = null;
                registerAvatarPreview.src = '';
                registerAvatarPreview.classList.add('hidden');
                avatarPreviewPlaceholder.classList.remove('hidden');
                avatarUploadContainer.classList.remove('has-image');
                return;
            }

            // Limit image size to 2MB to avoid huge database payload
            if (file.size > 2 * 1024 * 1024) {
                showError('registerAvatarFile', 'registerAvatarError', 'A imagem deve ter no máximo 2MB.');
                selectedAvatarBase64 = null;
                registerAvatarPreview.src = '';
                registerAvatarPreview.classList.add('hidden');
                avatarPreviewPlaceholder.classList.remove('hidden');
                avatarUploadContainer.classList.remove('has-image');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                selectedAvatarBase64 = event.target.result;
                registerAvatarPreview.src = selectedAvatarBase64;
                registerAvatarPreview.classList.remove('hidden');
                avatarPreviewPlaceholder.classList.add('hidden');
                avatarUploadContainer.classList.add('has-image');
            };
            reader.readAsDataURL(file);
        });
    }

    // ===== Password Strength Meter =====
    if (registerPassword) {
        registerPassword.addEventListener('input', () => {
            updatePasswordStrength(registerPassword.value);
        });
    }

    function updatePasswordStrength(password) {
        const bars = passwordStrength.querySelectorAll('.strength-bar');
        const strengthText = document.getElementById('strengthText');
        let score = 0;

        // Reset
        bars.forEach(bar => bar.className = 'strength-bar');
        strengthText.className = 'strength-text';
        strengthText.textContent = '';

        if (password.length === 0) return;

        // Calculate score
        if (password.length >= 6) score++;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        // Map score to strength level
        let level, text;
        if (score <= 1) {
            level = 'weak';
            text = 'Fraca';
        } else if (score <= 3) {
            level = 'medium';
            text = 'Média';
        } else {
            level = 'strong';
            text = 'Forte';
        }

        // Update bars
        const activeBars = level === 'weak' ? 1 : level === 'medium' ? 2 : 4;
        for (let i = 0; i < activeBars && i < bars.length; i++) {
            bars[i].classList.add(level);
        }

        strengthText.classList.add(level);
        strengthText.textContent = text;
    }

    // ===== Form Validation =====
    function validateEmail(email) {
        if (email.toLowerCase().trim() === 'deise.com') return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function showError(inputId, errorId, message) {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        input.classList.add('error');
        error.textContent = message;
        error.classList.add('visible');

        // Shake animation
        input.closest('.input-wrapper').style.animation = 'shake 0.4s ease';
        setTimeout(() => {
            input.closest('.input-wrapper').style.animation = '';
        }, 400);
    }

    function clearError(inputId, errorId) {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        input.classList.remove('error');
        error.textContent = '';
        error.classList.remove('visible');
    }

    // Add shake animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
        }
    `;
    document.head.appendChild(style);

    // Clear errors on input
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('input', () => {
            const errorEl = input.closest('.form-group').querySelector('.form-error');
            if (errorEl && errorEl.classList.contains('visible')) {
                input.classList.remove('error');
                errorEl.textContent = '';
                errorEl.classList.remove('visible');
            }
        });
    });

    // ===== Login Form Submission =====
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let isValid = true;

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        // Clear previous errors
        clearError('loginEmail', 'loginEmailError');
        clearError('loginPassword', 'loginPasswordError');

        // Validate email
        if (!email) {
            showError('loginEmail', 'loginEmailError', 'Informe seu e-mail');
            isValid = false;
        } else if (!validateEmail(email)) {
            showError('loginEmail', 'loginEmailError', 'E-mail inválido');
            isValid = false;
        }

        // Validate password
        if (!password) {
            showError('loginPassword', 'loginPasswordError', 'Informe sua senha');
            isValid = false;
        }

        if (!isValid) return;

        const btn = document.getElementById('loginBtn');
        btn.classList.add('loading');

        try {
            const res = await apiRequest('/auth/login', {
                method: 'POST',
                body: { email, password }
            });

            const dbUser = res.user;
            sessionStorage.setItem('raiosol_token', res.token);

            let adminFoto = null;
            if (dbUser.role === 'admin') {
                const savedAdmin = JSON.parse(localStorage.getItem('raiosol_admin_profile') || 'null');
                if (savedAdmin) {
                    dbUser.name = savedAdmin.name || dbUser.name;
                    dbUser.email = savedAdmin.email || dbUser.email;
                    adminFoto = savedAdmin.foto || null;
                }
            }

            sessionStorage.setItem('raiosol_session', JSON.stringify({
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role,
                foto: adminFoto || dbUser.avatar || null,
                loginAt: new Date().toISOString()
            }));

            showToast('Login realizado com sucesso! Redirecionando...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1200);

        } catch (err) {
            console.error(err);
            showToast(err.message || 'Erro ao realizar login', 'error');
        } finally {
            btn.classList.remove('loading');
        }

    });

    // ===== Register Form Submission =====
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let isValid = true;

        const name = document.getElementById('registerName').value.trim();
        const phone = document.getElementById('registerPhone').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        // Clear previous errors
        clearError('registerName', 'registerNameError');
        clearError('registerPhone', 'registerPhoneError');
        clearError('registerEmail', 'registerEmailError');
        clearError('registerPassword', 'registerPasswordError');
        clearError('registerConfirmPassword', 'registerConfirmPasswordError');
        if (registerAvatarFile) {
            clearError('registerAvatarFile', 'registerAvatarError');
        }

        // Validate avatar / profile photo
        if (!selectedAvatarBase64) {
            showError('registerAvatarFile', 'registerAvatarError', 'A foto de perfil é obrigatória');
            isValid = false;
        }

        // Validate name
        if (!name) {
            showError('registerName', 'registerNameError', 'Informe seu nome completo');
            isValid = false;
        } else if (name.length < 3) {
            showError('registerName', 'registerNameError', 'Nome deve ter pelo menos 3 caracteres');
            isValid = false;
        }

        // Validate phone
        const phoneDigits = phone.replace(/\D/g, '');
        if (!phone) {
            showError('registerPhone', 'registerPhoneError', 'Informe seu telefone');
            isValid = false;
        } else if (phoneDigits.length < 10) {
            showError('registerPhone', 'registerPhoneError', 'Telefone inválido');
            isValid = false;
        }

        // Validate email
        if (!email) {
            showError('registerEmail', 'registerEmailError', 'Informe seu e-mail');
            isValid = false;
        } else if (!validateEmail(email)) {
            showError('registerEmail', 'registerEmailError', 'E-mail inválido');
            isValid = false;
        }

        // Validate password
        if (!password) {
            showError('registerPassword', 'registerPasswordError', 'Crie uma senha');
            isValid = false;
        } else if (password.length < 6) {
            showError('registerPassword', 'registerPasswordError', 'Senha deve ter pelo menos 6 caracteres');
            isValid = false;
        }

        // Validate confirm password
        if (!confirmPassword) {
            showError('registerConfirmPassword', 'registerConfirmPasswordError', 'Confirme sua senha');
            isValid = false;
        } else if (password !== confirmPassword) {
            showError('registerConfirmPassword', 'registerConfirmPasswordError', 'As senhas não coincidem');
            isValid = false;
        }

        if (!isValid) return;

        const btn = document.getElementById('registerBtn');
        btn.classList.add('loading');

        try {
            await apiRequest('/auth/register', {
                method: 'POST',
                body: { name, email, password, phone, avatar: selectedAvatarBase64 }
            });

            // Show success modal
            successModal.classList.remove('hidden');

            // Reset form
            registerForm.reset();
            passwordStrength.querySelectorAll('.strength-bar').forEach(bar => bar.className = 'strength-bar');
            document.getElementById('strengthText').textContent = '';

            // Reset avatar upload preview and state
            selectedAvatarBase64 = null;
            if (registerAvatarPreview) {
                registerAvatarPreview.src = '';
                registerAvatarPreview.classList.add('hidden');
            }
            if (avatarPreviewPlaceholder) {
                avatarPreviewPlaceholder.classList.remove('hidden');
            }
            if (avatarUploadContainer) {
                avatarUploadContainer.classList.remove('has-image');
            }
        } catch (err) {
            console.error(err);
            if (err.message && err.message.includes('cadastrado')) {
                showError('registerEmail', 'registerEmailError', 'Este e-mail já está cadastrado');
            } else {
                showToast('Erro ao criar cadastro: ' + err.message, 'error');
            }
        } finally {
            btn.classList.remove('loading');
        }

    });

    // ===== Success Modal OK =====
    modalOkBtn.addEventListener('click', () => {
        successModal.classList.add('hidden');
        switchScreen(registerScreen, loginScreen);
    });

    // ===== Forgot Password =====
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotModal.classList.remove('hidden');
    });

    forgotCancelBtn.addEventListener('click', () => {
        forgotModal.classList.add('hidden');
        forgotForm.reset();
        clearError('forgotEmail', 'forgotEmailError');
    });

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value.trim();

        clearError('forgotEmail', 'forgotEmailError');

        if (!email) {
            showError('forgotEmail', 'forgotEmailError', 'Informe seu e-mail');
            return;
        }

        if (!validateEmail(email)) {
            showError('forgotEmail', 'forgotEmailError', 'E-mail inválido');
            return;
        }

        const btn = document.getElementById('forgotSubmitBtn');
        btn.classList.add('loading');

        try {
            // Mock recovery email
            forgotModal.classList.add('hidden');
            forgotForm.reset();
            showToast('Instruções de recuperação enviadas para seu e-mail!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Erro ao enviar e-mail de recuperação: ' + err.message, 'error');
        } finally {
            btn.classList.remove('loading');
        }

    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
    });

    // ===== Toast Notification =====
    function showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Icon based on type
        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });

        // Auto dismiss
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // ===== Local Storage Helpers =====
    function getUsers() {
        try {
            return JSON.parse(localStorage.getItem('raiosol_users') || '[]');
        } catch {
            return [];
        }
    }

    // ===== Create Floating Particles =====
    function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;

        const colors = [
            'rgba(201, 168, 76, 0.4)',
            'rgba(184, 148, 45, 0.3)',
            'rgba(255, 218, 106, 0.35)',
            'rgba(201, 168, 76, 0.25)',
        ];

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';

            const size = Math.random() * 4 + 2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const duration = Math.random() * 15 + 10;
            const delay = Math.random() * 10;

            particle.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                left: ${left}%;
                animation-duration: ${duration}s;
                animation-delay: ${delay}s;
            `;

            container.appendChild(particle);
        }
    }

    // ===== Initialize demo admin user hint =====
    console.log('%c🌟 Studio Raio do Sol - Sistema de Agendamento', 'color: #C9A84C; font-size: 16px; font-weight: bold;');
    console.log('%cAdmin Demo: deise.com / deise.com', 'color: #757575; font-size: 12px;');
});
