/* ============================================
   ĐIỆN LẠNH NGUYỄN HÙNG - JavaScript
   Brand: Red #ED1C24 | Blue #292D8F
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // One canonical public-site header. Every public HTML page only provides
    // #siteHeader, so navigation and account UI cannot drift between pages.
    const siteHeader = document.getElementById('siteHeader');
    if (siteHeader) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        const safeReturnTo = encodeURIComponent(returnTo.startsWith('/') ? returnTo : '/');
        siteHeader.outerHTML = `
            <header class="header header--shared" id="header" data-auth-state="loading">
                <div class="header__container">
                    <a href="/" class="header__logo" aria-label="Điện Máy Nguyên Hùng - Trang chủ">
                        <div class="header__logo-img"><img src="/images/logo.png" alt="Logo Điện Máy Nguyên Hùng"></div>
                        <div class="header__logo-text"><span class="header__logo-brand">ĐIỆN MÁY</span><strong>NGUYÊN HÙNG</strong></div>
                    </a>
                    <nav class="header__nav" id="headerNav" aria-label="Điều hướng chính">
                        <ul class="header__menu">
                            <li><a href="/" class="header__menu-link" data-nav="home">Trang chủ</a></li>
                            <li><a href="/services" class="header__menu-link" data-nav="services">Dịch vụ</a></li>
                            <li><a href="/pricing" class="header__menu-link" data-nav="pricing">Bảng giá</a></li>
                            <li><a href="/about" class="header__menu-link" data-nav="about">Giới thiệu</a></li>
                            <li><a href="/news" class="header__menu-link" data-nav="news">Tin tức</a></li>
                            <li><a href="/contact" class="header__menu-link" data-nav="contact">Liên hệ</a></li>
                            <li><a href="/danh-gia" class="header__menu-link" data-nav="reviews">Đánh giá</a></li>
                        </ul>
                        <div class="header__nav-auth">
                            <a class="btn btn--auth btn--auth-login" href="/login?returnTo=${safeReturnTo}">Đăng nhập</a>
                            <a class="btn btn--auth btn--auth-register" href="/register?returnTo=${safeReturnTo}">Đăng ký</a>
                        </div>
                    </nav>
                    <div class="header__actions">
                        <a href="/booking" class="btn btn--primary header__booking"><i class="fas fa-calendar-check"></i><span>Đặt lịch ngay</span></a>
                        <div class="header__auth">
                            <a class="btn btn--auth btn--auth-login" href="/login?returnTo=${safeReturnTo}">Đăng nhập</a>
                            <a class="btn btn--auth btn--auth-register" href="/register?returnTo=${safeReturnTo}">Đăng ký</a>
                        </div>
                        <div class="header__user" id="headerUser">
                            <div class="header__user-avatar"><i class="fas fa-user" aria-hidden="true"></i></div>
                            <span class="header__user-name"></span>
                            <span class="header__user-arrow"><i class="fas fa-chevron-down"></i></span>
                            <div class="header__user-dropdown" role="menu">
                                <button class="header__user-dropdown-item" type="button"><i class="fas fa-user"></i> Thông tin cá nhân</button>
                                <button class="header__user-dropdown-item" type="button"><i class="fas fa-calendar-alt"></i> Lịch sử đặt lịch</button>
                                <div class="header__user-dropdown-divider"></div>
                                <button class="header__user-dropdown-item header__user-dropdown-item--logout" id="btnLogout" type="button"><i class="fas fa-sign-out-alt"></i> Đăng xuất</button>
                            </div>
                        </div>
                        <button class="header__toggle" id="menuToggle" type="button" aria-label="Mở menu"><span></span><span></span><span></span></button>
                    </div>
                </div>
            </header>`;
    }

    // Match the auth client when this static site is previewed from a port
    // other than the Express server.
    const localPreview = window.location.protocol !== 'file:' && window.location.port !== '5000';
    const apiHost = window.location.hostname || 'localhost';
    const apiBase = localPreview || window.location.protocol === 'file:' ? `http://${apiHost}:5000` : '';

    // ============ 1. ACTIVE NAV LINK ============
    const currentPath = window.location.pathname || '/';
    const menuLinks = document.querySelectorAll('.header__menu-link');

    menuLinks.forEach(link => {
        const href = link.getAttribute('href');
        const isHome = href === '/' && (currentPath === '/' || currentPath === '/index.html' || currentPath === '/trang-chu.html');
        const isSection = href !== '/' && (currentPath === href || currentPath.startsWith(`${href}/`));
        const isLegacyPage = currentPath === `${href}.html`;
        if (isHome || isSection || isLegacyPage) {
            link.classList.add('active');
        }
    });

    // ============ 2. MOBILE MENU TOGGLE ============
    const menuToggle = document.getElementById('menuToggle');
    const headerNav = document.getElementById('headerNav');

    if (menuToggle && headerNav) {
        const closeMobileMenu = () => {
            menuToggle.classList.remove('active');
            headerNav.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        };

        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-controls', 'headerNav');
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            headerNav.classList.toggle('open');
            const isOpen = headerNav.classList.contains('open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        menuLinks.forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });

        document.addEventListener('click', (e) => {
            if (!headerNav.contains(e.target) && !menuToggle.contains(e.target)) {
                closeMobileMenu();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMobileMenu();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 1180) closeMobileMenu();
        });
    }

    // ============ 3. HEADER SCROLL EFFECT ============
    const header = document.getElementById('header');

    window.addEventListener('scroll', () => {
        if (!header) return;
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // ============ 4. BACK TO TOP BUTTON ============
    const backToTop = document.getElementById('backToTop');

    if (backToTop) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 500) {
                backToTop.classList.add('show');
            } else {
                backToTop.classList.remove('show');
            }
        });

        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ============ 5. SCROLL REVEAL ANIMATION ============
    function initScrollReveal() {
        const revealElements = document.querySelectorAll(
            '.service-card, .quick-info__card, .process__step, .testimonial-card, ' +
            '.news-card, .about-value__card, .about-team__card, .contact-info__card'
        );

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal', 'visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        revealElements.forEach((el) => {
            el.classList.add('reveal');
            revealObserver.observe(el);
        });
    }

    initScrollReveal();

    // Keep text fields when an unauthenticated user is asked to sign in.
    const requestFormStorageKey = form => `pending-request-form:${window.location.pathname}:${form.id}`;
    const saveRequestForm = form => {
        const values = {};
        form.querySelectorAll('input:not([type="file"]), select, textarea').forEach(field => {
            if (field.name) values[field.name] = field.value;
        });
        localStorage.setItem(requestFormStorageKey(form), JSON.stringify(values));
    };
    const restoreRequestForm = form => {
        try {
            const values = JSON.parse(localStorage.getItem(requestFormStorageKey(form)) || '{}');
            Object.entries(values).forEach(([name, value]) => {
                const field = form.querySelector(`[name="${CSS.escape(name)}"]`);
                if (field) field.value = value;
            });
        } catch (_) {
            localStorage.removeItem(requestFormStorageKey(form));
        }
    };
    const clearSavedRequestForm = form => localStorage.removeItem(requestFormStorageKey(form));
    const showLoginRequiredDialog = form => {
        saveRequestForm(form);
        document.getElementById('loginRequiredDialog')?.remove();
        const dialog = document.createElement('div');
        dialog.id = 'loginRequiredDialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'loginRequiredTitle');
        dialog.innerHTML = '<div class="login-required-dialog__backdrop"><section class="login-required-dialog__panel"><h2 id="loginRequiredTitle" class="login-required-dialog__title">Bạn cần đăng nhập để gửi yêu cầu.</h2><p class="login-required-dialog__message">Thông tin bạn đã nhập sẽ được giữ lại.</p><div class="login-required-dialog__actions"><button type="button" data-login-required-cancel class="login-required-dialog__button login-required-dialog__button--cancel">Hủy</button><button type="button" data-login-required-login class="login-required-dialog__button login-required-dialog__button--login">Đăng nhập</button></div></section></div>';
        document.body.appendChild(dialog);
        dialog.querySelector('[data-login-required-cancel]').addEventListener('click', () => dialog.remove());
        dialog.querySelector('[data-login-required-login]').addEventListener('click', () => {
            const returnTo = `${window.location.pathname}${window.location.search}`;
            window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        });
    };

    // ============ 6. CONTACT FORM HANDLING ============
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        const formSuccess = document.getElementById('formSuccess');
        restoreRequestForm(contactForm);

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const focusFirstInvalidField = () => {
                const invalidField = contactForm.querySelector('.form-control.error:not([disabled])');
                if (!invalidField) return;

                const stickyHeader = document.querySelector('.header');
                const headerHeight = stickyHeader?.getBoundingClientRect().height || 0;
                const fieldTop = invalidField.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({
                    top: Math.max(0, fieldTop - headerHeight - 24),
                    behavior: 'smooth'
                });
                window.setTimeout(() => invalidField.focus({ preventScroll: true }), 350);
            };

            let isValid = true;
            const fields = contactForm.querySelectorAll('.form-control');

            fields.forEach(field => {
                const errorEl = field.closest('.form-group').querySelector('.form-error');
                if (field.hasAttribute('required') && !field.value.trim()) {
                    field.classList.add('error');
                    if (errorEl) errorEl.classList.add('show');
                    isValid = false;
                } else if (field.type === 'email' && field.value.trim()) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(field.value.trim())) {
                        field.classList.add('error');
                        if (errorEl) {
                            errorEl.textContent = 'Email không hợp lệ';
                            errorEl.classList.add('show');
                        }
                        isValid = false;
                    } else {
                        field.classList.remove('error');
                        if (errorEl) errorEl.classList.remove('show');
                    }
                } else if (field.name === 'phone' && field.value.trim()) {
                    const phoneRegex = /(0[3|5|7|8|9])+([0-9]{8})\b/;
                    if (!phoneRegex.test(field.value.trim())) {
                        field.classList.add('error');
                        if (errorEl) {
                            errorEl.textContent = 'Số điện thoại không hợp lệ';
                            errorEl.classList.add('show');
                        }
                        isValid = false;
                    } else {
                        field.classList.remove('error');
                        if (errorEl) errorEl.classList.remove('show');
                    }
                } else {
                    field.classList.remove('error');
                    if (errorEl) errorEl.classList.remove('show');
                }
            });

            if (!isValid) {
                focusFirstInvalidField();
                return;
            }

            if (isValid) {
                try {
                    const response = await fetch(`${apiBase}${contactForm.action}`, {
                        method: contactForm.method,
                        credentials: 'include',
                        headers: { Accept: 'application/json' },
                        body: new FormData(contactForm)
                    });
                    const body = await response.json().catch(() => ({}));
                    if (response.status === 401) {
                        showLoginRequiredDialog(contactForm);
                        return;
                    }
                    if (!response.ok) throw new Error(body.message || body.error || 'Không thể gửi yêu cầu liên hệ.');
                    contactForm.reset();
                    clearSavedRequestForm(contactForm);
                    contactForm.style.display = 'none';
                    const contactRequestCode = document.getElementById('contactRequestCode');
                    if (contactRequestCode && body.requestCode) {
                        contactRequestCode.querySelector('strong').textContent = body.requestCode;
                        contactRequestCode.hidden = false;
                    }
                    const contactSuccessMessage = document.getElementById('contactSuccessMessage');
                    if (contactSuccessMessage && body.telegramStatus === 'pending') {
                        contactSuccessMessage.textContent = body.message;
                    }
                    if (formSuccess) formSuccess.classList.add('show');
                } catch (error) {
                    alert(error.message);
                    focusFirstInvalidField();
                }
            }
        });

        // Clear errors on input
        contactForm.querySelectorAll('.form-control').forEach(field => {
            field.addEventListener('input', () => {
                field.classList.remove('error');
                const errorEl = field.closest('.form-group').querySelector('.form-error');
                if (errorEl) errorEl.classList.remove('show');
            });
        });
    }

    // ============ 7. BOOKING FORM HANDLING ============
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        const bookingSuccess = document.getElementById('bookingSuccess');
        const bookingFormWrapper = document.getElementById('bookingFormWrapper');
        const bookingTechniciansSection = document.querySelector('.booking-technicians-section');
        restoreRequestForm(bookingForm);
        const technicianSelect = document.getElementById('booking-technician');
        const appointmentDate = document.getElementById('booking-date');
        const appointmentTime = document.getElementById('booking-time');
        const technicianInfo = document.getElementById('bookingTechnicianInfo');
        const slotWarning = document.getElementById('bookingSlotWarning');
        const submitButton = bookingForm.querySelector('[type="submit"]');
        let technicians = [];
        let availabilityRequest = 0;
        let slotsReady = false;
        const workingSlots = Array.from(appointmentTime?.options || [])
            .map(option => option.value)
            .filter(Boolean);

        const renderTimeSlots = (slots, selectedValue = '') => {
            if (!appointmentTime) return;
            appointmentTime.innerHTML = '<option value="">Chọn giờ hẹn</option>' + slots.map(slot =>
                `<option value="${slot}">${slot}</option>`
            ).join('');
            if (slots.includes(selectedValue)) appointmentTime.value = selectedValue;
        };

        const parseTimeSlot = value => {
            const match = String(value || '').match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
            if (!match) return null;
            const start = Number(match[1]) * 60 + Number(match[2]);
            const end = Number(match[3]) * 60 + Number(match[4]);
            return start < end ? { start, end } : null;
        };

        const calculateAvailableSlots = bookings => workingSlots.filter(slot => {
            const requested = parseTimeSlot(slot);
            return !bookings.some(booking => {
                const occupied = parseTimeSlot(booking.appointment_time || booking.booking_time || booking.scheduled_time);
                return requested && occupied && requested.start < occupied.end && occupied.start < requested.end;
            });
        });

        const loadAvailableSlots = async () => {
            const technicianId = technicianSelect?.value;
            const selectedDate = appointmentDate?.value;
            const previousTime = appointmentTime?.value || '';
            const requestId = ++availabilityRequest;
            slotsReady = false;
            console.log('Ngày chọn:', selectedDate || '');
            console.log('Technician ID:', technicianId || '');
            if (!technicianId || !selectedDate) {
                renderTimeSlots(workingSlots, previousTime);
                if (appointmentTime) appointmentTime.disabled = false;
                if (slotWarning) slotWarning.hidden = true;
                if (submitButton) submitButton.disabled = false;
                return;
            }
            if (appointmentTime) {
                appointmentTime.disabled = true;
                appointmentTime.innerHTML = '<option value="">Đang kiểm tra khung giờ...</option>';
            }
            if (submitButton) submitButton.disabled = true;
            try {
                const params = new URLSearchParams({ technician_id: technicianId, appointment_date: selectedDate });
                const response = await fetch(`${apiBase}/api/bookings/availability?${params}`, { credentials: 'include', headers: { Accept: 'application/json' } });
                const body = await response.json().catch(() => ({}));
                if (requestId !== availabilityRequest) return;
                if (!response.ok) throw new Error(body.message || 'Không thể kiểm tra lịch kỹ thuật viên.');
                const bookings = Array.isArray(body.bookings) ? body.bookings : null;
                let slots;
                if (bookings) {
                    slots = calculateAvailableSlots(bookings);
                } else if (Array.isArray(body.availableSlots)) {
                    slots = body.availableSlots.filter(slot => workingSlots.includes(slot));
                } else if (Array.isArray(body.slots)) {
                    slots = body.slots.filter(slot => workingSlots.includes(slot));
                } else {
                    throw new Error('API kiểm tra lịch chưa trả dữ liệu khung giờ. Vui lòng khởi động lại backend.');
                }
                console.log('Booking:', bookings || []);
                console.log('Available slots:', slots);
                if (!slots.length) {
                    if (appointmentTime) {
                        appointmentTime.innerHTML = '<option value="">Không còn khung giờ trống</option>';
                        appointmentTime.disabled = true;
                    }
                    if (slotWarning) {
                        slotWarning.hidden = false;
                        slotWarning.textContent = 'Kỹ thuật viên này đã kín lịch trong ngày đã chọn. Vui lòng chọn kỹ thuật viên hoặc ngày khác.';
                    }
                    if (submitButton) submitButton.disabled = true;
                    return;
                }
                renderTimeSlots(slots, previousTime);
                if (appointmentTime) appointmentTime.disabled = false;
                if (slotWarning) slotWarning.hidden = true;
                if (submitButton) submitButton.disabled = false;
                slotsReady = true;
            } catch (error) {
                if (requestId !== availabilityRequest) return;
                if (appointmentTime) {
                    appointmentTime.innerHTML = '<option value="">Không thể tải khung giờ</option>';
                    appointmentTime.disabled = true;
                }
                if (slotWarning) {
                    slotWarning.hidden = false;
                    slotWarning.textContent = error.message;
                }
                if (submitButton) submitButton.disabled = true;
            }
        };

        if (technicianSelect) {
            fetch(`${apiBase}/api/technicians`, { credentials: 'include', headers: { Accept: 'application/json' } })
                .then(response => response.json())
                .then(body => {
                    technicians = body.technicians || [];
                    technicianSelect.innerHTML = '<option value="">Chọn kỹ thuật viên</option>' + technicians.map(technician =>
                        `<option value="${technician.id}">${technician.fullName} — ${technician.specialty || ''}</option>`
                    ).join('');
                    technicianSelect.disabled = !technicians.length;
                    if (!technicians.length) technicianSelect.innerHTML = '<option value="">Chưa có kỹ thuật viên đang làm việc</option>';
                    restoreRequestForm(bookingForm);
                    loadAvailableSlots();
                })
                .catch(() => { technicianSelect.innerHTML = '<option value="">Không tải được kỹ thuật viên</option>'; });
            technicianSelect.addEventListener('change', () => {
                const technician = technicians.find(item => String(item.id) === technicianSelect.value);
                if (technicianInfo) technicianInfo.textContent = technician ? `${technician.specialty || ''} · ${technician.experience || ''}`.replace(/^ · | · $/g, '') : '';
                loadAvailableSlots();
            });
        }
        appointmentDate?.addEventListener('change', loadAvailableSlots);

        const techniciansGrid = document.getElementById('bookingTechniciansGrid');
        const technicianNotice = document.getElementById('bookingTechnicianNotice');
        const escapeText = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&gt;', '>': '&lt;', "'": '&#39;', '"': '&quot;' })[char]);
        if (techniciansGrid) {
            fetch(`${apiBase}/api/technicians/public`, { credentials: 'include', headers: { Accept: 'application/json' } })
                .then(response => response.json())
                .then(body => {
                    const publicTechnicians = body.technicians || [];
                    if (!publicTechnicians.length) {
                        techniciansGrid.innerHTML = '<p class="booking-technicians-empty">Hiện chưa có kỹ thuật viên khả dụng.</p>';
                        return;
                    }
                    techniciansGrid.innerHTML = publicTechnicians.map(technician => `<article class="booking-technician-card"><img src="${escapeText(technician.avatar || '/images/logo.png')}" alt="${escapeText(technician.fullName)}" class="booking-technician-card__avatar"><div class="booking-technician-card__body"><h3>${escapeText(technician.fullName)}</h3><p><i class="fas fa-phone"></i> ${escapeText(technician.phone)}</p>${technician.specialty ? `<p><i class="fas fa-screwdriver-wrench"></i> ${escapeText(technician.specialty)}</p>` : ''}${technician.experience ? `<p><i class="fas fa-briefcase"></i> ${escapeText(technician.experience)}</p>` : ''}<span class="booking-technician-card__status">${escapeText(technician.status)}</span><button type="button" class="booking-technician-card__select" data-technician-id="${technician.id}" data-technician-name="${escapeText(technician.fullName)}">Chọn kỹ thuật viên</button></div></article>`).join('');
                    techniciansGrid.querySelectorAll('[data-technician-id]').forEach(button => button.addEventListener('click', () => {
                        if (technicianSelect) {
                            technicianSelect.value = button.dataset.technicianId;
                            technicianSelect.dispatchEvent(new Event('change'));
                        }
                        document.getElementById('bookingFormWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        if (technicianNotice) technicianNotice.textContent = `Đã chọn kỹ thuật viên ${button.dataset.technicianName}.`;
                    }));
                })
                .catch(() => { techniciansGrid.innerHTML = '<p class="booking-technicians-empty">Hiện chưa có kỹ thuật viên khả dụng.</p>'; });
        }

        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const focusFirstInvalidField = () => {
                const invalidField = bookingForm.querySelector('.form-control.error:not([disabled])');
                if (!invalidField) return;

                const stickyHeader = document.querySelector('.header');
                const headerHeight = stickyHeader?.getBoundingClientRect().height || 0;
                const fieldTop = invalidField.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({
                    top: Math.max(0, fieldTop - headerHeight - 24),
                    behavior: 'smooth'
                });
                window.setTimeout(() => invalidField.focus({ preventScroll: true }), 350);
            };

            let isValid = true;
            if (technicianSelect?.value && appointmentDate?.value && !slotsReady) {
                if (slotWarning) {
                    slotWarning.hidden = false;
                    slotWarning.textContent = 'Vui lòng chờ hệ thống kiểm tra khung giờ còn trống.';
                }
                isValid = false;
            }
            const fields = bookingForm.querySelectorAll('.form-control');

            fields.forEach(field => {
                const errorEl = field.closest('.form-group')?.querySelector('.form-error');
                if (field.hasAttribute('required') && !field.value.trim()) {
                    field.classList.add('error');
                    if (errorEl) errorEl.classList.add('show');
                    isValid = false;
                } else if (field.name === 'phone' && field.value.trim()) {
                    const phoneRegex = /(0[3|5|7|8|9])+([0-9]{8})\b/;
                    if (!phoneRegex.test(field.value.trim())) {
                        field.classList.add('error');
                        if (errorEl) {
                            errorEl.textContent = 'Số điện thoại không hợp lệ';
                            errorEl.classList.add('show');
                        }
                        isValid = false;
                    } else {
                        field.classList.remove('error');
                        if (errorEl) errorEl.classList.remove('show');
                    }
                } else {
                    field.classList.remove('error');
                    if (errorEl) errorEl.classList.remove('show');
                }
            });

            if (!isValid) {
                focusFirstInvalidField();
                return;
            }

            if (isValid) {
                try {
                    const response = await fetch(`${apiBase}${bookingForm.action}`, {
                        method: bookingForm.method,
                        credentials: 'include',
                        headers: { Accept: 'application/json' },
                        body: new FormData(bookingForm)
                    });
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        if (response.status === 401) {
                            showLoginRequiredDialog(bookingForm);
                            return;
                        }
                        if (Array.isArray(body.fields)) {
                            body.fields.forEach(fieldName => {
                                const field = bookingForm.querySelector(`[name="${fieldName}"]`);
                                if (!field) return;
                                field.classList.add('error');
                                const errorEl = field.closest('.form-group')?.querySelector('.form-error');
                                if (errorEl) {
                                    errorEl.textContent = body.fieldErrors?.[fieldName] || errorEl.textContent;
                                    errorEl.classList.add('show');
                                }
                            });
                        }
                        throw new Error(body.message || body.error || 'Không thể gửi yêu cầu đặt lịch');
                    }
                    bookingForm.reset();
                    clearSavedRequestForm(bookingForm);
                    bookingForm.style.display = 'none';
                    const bookingRequestCode = document.getElementById('bookingRequestCode');
                    if (bookingRequestCode && body.requestCode) {
                        bookingRequestCode.querySelector('strong').textContent = body.requestCode;
                        bookingRequestCode.hidden = false;
                    }
                    const bookingSuccessMessage = document.getElementById('bookingSuccessMessage');
                    if (bookingSuccessMessage && body.telegramStatus === 'pending') {
                        bookingSuccessMessage.textContent = body.message;
                    }
                    if (bookingSuccess) {
                        bookingSuccess.classList.add('show');
                        bookingTechniciansSection?.setAttribute('hidden', '');
                        requestAnimationFrame(() => {
                            bookingFormWrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            bookingSuccess.focus({ preventScroll: true });
                        });
                    }
                } catch (error) {
                    alert(error.message);
                    focusFirstInvalidField();
                }
            }
        });

        bookingForm.querySelectorAll('.form-control').forEach(field => {
            field.addEventListener('input', () => {
                field.classList.remove('error');
                const errorEl = field.closest('.form-group').querySelector('.form-error');
                if (errorEl) errorEl.classList.remove('show');
            });
        });
    }

    // ============ 8. COUNTER ANIMATION (enhanced with data-target) ============
    function initCounterAnimation() {
        const counters = document.querySelectorAll('.about-stat__number, .brand-intro__stat-number');
        if (!counters.length) return;

        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = parseInt(el.getAttribute('data-target')) || parseInt(el.textContent.replace(/[^0-9]/g, ''));
                    if (isNaN(target)) { counterObserver.unobserve(el); return; }

                    const suffix = el.textContent.includes('%') ? '%' :
                        el.textContent.includes('.') ? '.' + el.textContent.split('.')[1] : '+';
                    let current = 0;
                    const increment = Math.ceil(target / 50);
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            current = target;
                            clearInterval(timer);
                        }
                        el.textContent = current + suffix;
                    }, 30);

                    counterObserver.unobserve(el);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => counterObserver.observe(counter));
    }

    initCounterAnimation();

    // ============ 9. FAQ ACCORDION ============
    function initFAQ() {
        document.addEventListener('click', event => {
            const question = event.target.closest('.faq__question');
            if (!question) return;

            const faq = question.closest('.faq');
            const answer = question.nextElementSibling;
            const isActive = question.classList.contains('active');
            if (!faq || !answer) return;

            faq.querySelectorAll('.faq__question').forEach(item => {
                item.classList.remove('active');
                item.setAttribute('aria-expanded', 'false');
                item.nextElementSibling.classList.remove('open');
            });

            if (!isActive) {
                question.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
                answer.classList.add('open');
            }
        });
    }

    initFAQ();

    // ============ 10. TESTIMONIALS SLIDER ============
    function initTestimonialSlider() {
        const track = document.getElementById('testimonialTrack');
        const prevBtn = document.getElementById('testimonialPrev');
        const nextBtn = document.getElementById('testimonialNext');
        const dotsContainer = document.getElementById('testimonialDots');
        if (!track || !dotsContainer) return;

        const slides = track.querySelectorAll('.testimonials-slider__slide');
        const totalSlides = slides.length;
        let currentIndex = 0;
        let autoPlayInterval;

        // Create dots
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'testimonials-slider__dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Chuyển đến đánh giá ${i + 1}`);
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });

        const dots = dotsContainer.querySelectorAll('.testimonials-slider__dot');

        function goToSlide(index) {
            currentIndex = index;
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        function nextSlide() {
            goToSlide((currentIndex + 1) % totalSlides);
        }

        function prevSlide() {
            goToSlide((currentIndex - 1 + totalSlides) % totalSlides);
        }

        function startAutoPlay() {
            stopAutoPlay();
            autoPlayInterval = setInterval(nextSlide, 4000);
        }

        function stopAutoPlay() {
            if (autoPlayInterval) {
                clearInterval(autoPlayInterval);
                autoPlayInterval = null;
            }
        }

        if (prevBtn) prevBtn.addEventListener('click', () => {
            prevSlide();
            startAutoPlay();
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            nextSlide();
            startAutoPlay();
        });

        // Pause on hover
        track.addEventListener('mouseenter', stopAutoPlay);
        track.addEventListener('mouseleave', startAutoPlay);

        startAutoPlay();
    }

    initTestimonialSlider();

    // ============ 11. ENHANCED SCROLL REVEAL (new variant selectors) ============
    function initScrollRevealEnhanced() {
        // Observe all reveal elements including variants
        const revealElements = document.querySelectorAll(
            '.reveal, .reveal--left, .reveal--right, .reveal--zoom, ' +
            '.service-card, .quick-info__card, .process__step, .testimonial-card, ' +
            '.news-card, .about-value__card, .about-team__card, .contact-info__card, ' +
            '.testimonials-slider__slide, .faq__item, .brands-grid__item, ' +
            '.work-process__step, .timeline__item'
        );

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        revealElements.forEach((el) => {
            // Add base reveal class if not already present
            if (!el.classList.contains('reveal') &&
                !el.classList.contains('reveal--left') &&
                !el.classList.contains('reveal--right') &&
                !el.classList.contains('reveal--zoom')) {
                el.classList.add('reveal');
            }
            revealObserver.observe(el);
        });
    }

    // Override original initScrollReveal with enhanced version
    // We call the enhanced version instead
    initScrollRevealEnhanced();

    // ============ 12. NEWS EXPAND / COLLAPSE ============
    function initNewsExpand() {
        const expandBtns = document.querySelectorAll('.btn-expand');
        if (!expandBtns.length) return;

        expandBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();

                const card = btn.closest('.news-card');
                if (!card) return;

                const expandEl = card.querySelector('.news-card__expand');
                const isOpen = card.classList.contains('expanded');

                // Close any other open cards
                document.querySelectorAll('.news-card.expanded').forEach(openCard => {
                    if (openCard !== card) {
                        openCard.classList.remove('expanded');
                        const openBtn = openCard.querySelector('.btn-expand');
                        if (openBtn) {
                            openBtn.innerHTML = 'Đọc thêm <i class="fas fa-arrow-right"></i>';
                            openBtn.classList.remove('active');
                        }
                    }
                });

                if (isOpen) {
                    // Close
                    card.classList.remove('expanded');
                    btn.innerHTML = 'Đọc thêm <i class="fas fa-arrow-right"></i>';
                    btn.classList.remove('active');
                } else {
                    // Open
                    card.classList.add('expanded');
                    btn.innerHTML = 'Thu gọn <i class="fas fa-chevron-up"></i>';
                    btn.classList.add('active');

                    // Smooth scroll to keep card in view
                    setTimeout(() => {
                        const cardRect = card.getBoundingClientRect();
                        const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 76;
                        if (cardRect.bottom > window.innerHeight || cardRect.top < headerH) {
                            const scrollTarget = card.offsetTop - headerH - 20;
                            window.scrollTo({
                                top: scrollTarget,
                                behavior: 'smooth'
                            });
                        }
                    }, 50);
                }
            });
        });
    }

    initNewsExpand();

    // ============ 13. AUTH SYSTEM (Login/Register Modals) ============
    const headerAuth = document.querySelector('.header__auth');
    const headerUser = document.getElementById('headerUser');

    // Password visibility controls stay attached when switching auth modals.
    document.querySelectorAll('.auth-modal input[type="password"]').forEach(input => {
        if (input.closest('.auth-password-field')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'auth-password-field';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'auth-password-toggle';
        toggle.setAttribute('aria-label', 'Hiện mật khẩu');
        toggle.setAttribute('aria-pressed', 'false');
        toggle.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
        wrapper.appendChild(toggle);
    });
    document.addEventListener('click', event => {
        const toggle = event.target.closest('.auth-password-toggle');
        if (!toggle) return;
        const input = toggle.closest('.auth-password-field')?.querySelector('input');
        if (!input) return;
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        toggle.setAttribute('aria-label', visible ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
        toggle.setAttribute('aria-pressed', String(!visible));
        toggle.querySelector('i').className = visible ? 'fas fa-eye' : 'fas fa-eye-slash';
        input.focus({ preventScroll: true });
    });

    function openAuthModal(type) {
        const overlay = document.getElementById(type + 'Overlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Reset forms
            const form = overlay.querySelector('form');
            if (form) form.style.display = '';
            const success = overlay.querySelector('.auth-modal__success');
            if (success) success.classList.remove('show');
            const error = overlay.querySelector('.auth-modal__error');
            if (error) error.classList.remove('show');
            overlay.querySelectorAll('.auth-password-field').forEach(wrapper => {
                const input = wrapper.querySelector('input');
                const toggle = wrapper.querySelector('.auth-password-toggle');
                if (!input || !toggle) return;
                input.type = 'password';
                toggle.setAttribute('aria-label', 'Hiện mật khẩu');
                toggle.setAttribute('aria-pressed', 'false');
                toggle.querySelector('i').className = 'fas fa-eye';
            });
        }
    }

    function closeAuthModal(type) {
        const overlay = document.getElementById(type + 'Overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function closeAllAuthModals() {
        document.querySelectorAll('.auth-overlay').forEach(o => {
            o.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    const authTarget = new URLSearchParams(window.location.search).get('auth');
    if (authTarget === 'login' || authTarget === 'register') {
        openAuthModal(authTarget);
    }

    // Open modal via data-auth buttons
    document.querySelectorAll('[data-auth]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const type = btn.getAttribute('data-auth');
            openAuthModal(type);
            // Close mobile nav if open
            if (headerNav && headerNav.classList.contains('open')) {
                menuToggle.classList.remove('active');
                headerNav.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    });

    // Close modal via close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-close');
            closeAuthModal(type);
        });
    });

    // Close modal on overlay click (outside modal)
    document.querySelectorAll('.auth-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Close with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllAuthModals();
        }
    });

    // Switch between login/register
    document.querySelectorAll('[data-switch]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-switch');
            // Close all first
            document.querySelectorAll('.auth-overlay').forEach(o => o.classList.remove('active'));
            // Open target
            openAuthModal(target);
        });
    });

    // Authentication requests are handled by backend.js; keep this legacy demo handler disabled.
    const loginForm = document.getElementById('loginForm');
    if (false && loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            const errorEl = document.getElementById('loginError');

            if (!username || !password) {
                errorEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
                errorEl.classList.add('show');
                return;
            }

            // Simulate login - always succeeds for demo
            errorEl.classList.remove('show');

            // Show success, then redirect to logged in state
            loginForm.style.display = 'none';
            const successEl = document.getElementById('loginSuccess');
            if (successEl) successEl.classList.add('show');

            setTimeout(() => {
                closeAuthModal('login');

                // Update UI to logged-in state
                if (headerAuth) headerAuth.style.display = 'none';
                if (headerUser) {
                    headerUser.classList.add('is-logged-in');
                    const nameEl = headerUser.querySelector('.header__user-name');
                    if (nameEl) nameEl.textContent = username;
                    const avatarEl = headerUser.querySelector('.header__user-avatar');
                    if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();
                }

                // Reset form for next time
                loginForm.style.display = '';
                if (successEl) successEl.classList.remove('show');
                document.getElementById('loginUsername').value = '';
                document.getElementById('loginPassword').value = '';
            }, 1200);
        });
    }

    // Registration requests are handled by backend.js; keep this legacy demo handler disabled.
    const registerForm = document.getElementById('registerForm');
    if (false && registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirm').value;
            const errorEl = document.getElementById('registerError');

            if (!name || !phone || !password || !confirm) {
                errorEl.textContent = 'Vui lòng điền đầy đủ thông tin bắt buộc';
                errorEl.classList.add('show');
                return;
            }

            if (password.length < 6) {
                errorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự';
                errorEl.classList.add('show');
                return;
            }

            if (password !== confirm) {
                errorEl.textContent = 'Mật khẩu xác nhận không khớp';
                errorEl.classList.add('show');
                return;
            }

            const phoneRegex = /(0[3|5|7|8|9])+([0-9]{8})\b/;
            if (!phoneRegex.test(phone)) {
                errorEl.textContent = 'Số điện thoại không hợp lệ';
                errorEl.classList.add('show');
                return;
            }

            errorEl.classList.remove('show');

            // Show success
            registerForm.style.display = 'none';
            const successEl = document.getElementById('registerSuccess');
            if (successEl) successEl.classList.add('show');

            setTimeout(() => {
                closeAuthModal('register');

                // Switch to login modal
                openAuthModal('login');

                // Pre-fill login with phone
                document.getElementById('loginUsername').value = phone;
                document.getElementById('loginPassword').value = '';

                // Reset register form
                registerForm.style.display = '';
                if (successEl) successEl.classList.remove('show');
                registerForm.reset();
            }, 1500);
        });
    }

    // User avatar dropdown toggle
    if (headerUser) {
        headerUser.addEventListener('click', (e) => {
            // Don't toggle if clicking dropdown items
            if (e.target.closest('.header__user-dropdown')) return;
            headerUser.classList.toggle('active');
            headerUser.setAttribute('aria-expanded', String(headerUser.classList.contains('active')));
        });

        headerUser.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.header__user-dropdown')) {
                e.preventDefault();
                headerUser.classList.toggle('active');
                headerUser.setAttribute('aria-expanded', String(headerUser.classList.contains('active')));
            }
            if (e.key === 'Escape') {
                headerUser.classList.remove('active');
                headerUser.setAttribute('aria-expanded', 'false');
            }
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!headerUser.contains(e.target)) {
                headerUser.classList.remove('active');
                headerUser.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Logout is handled by backend.js so the server session is destroyed too.
    const btnLogout = document.getElementById('btnLogout');
    if (false && btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.stopPropagation();
            if (headerUser) {
                headerUser.classList.remove('is-logged-in', 'active');
            }
            if (headerAuth) {
                headerAuth.style.display = '';
            }
        });
    }

    // ============ 14. AUTH ON MOBILE NAV - close menu when clicking auth ============
    document.querySelectorAll('.header__nav-auth .btn--auth').forEach(btn => {
        btn.addEventListener('click', () => {
            if (headerNav && headerNav.classList.contains('open')) {
                menuToggle.classList.remove('active');
                headerNav.classList.remove('open');
            }
        });
    });

}); // End DOMContentLoaded
