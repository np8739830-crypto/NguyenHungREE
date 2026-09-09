/* ===================================
   DASHBOARD CMS - NGUYÊN HÙNG
   AdminLTE Classic Style - JavaScript
   =================================== */

document.addEventListener('DOMContentLoaded', function() {

    // Legacy templates are retained for their visual design, but navigation is
    // always routed through Express MVC endpoints rather than /admin/html.
    const legacyRoutes = {
        'bangdieukhien.html': '/admin',
        'sanpham.html': '/admin/products',
        'banhang.html': '/admin/orders',
        'khachhang.html': '/admin/customers',
        'cauhinh.html': '/admin/information',
        'hinhanh.html': '/admin/images',
        'hotro.html': '/admin/support',
        'lienhe.html': '/admin/contacts',
        'nhanvien.html': '/admin/technicians',
        'cauhinhthongtin.html': '/admin/information'
    };

    document.querySelectorAll('a[href]').forEach(function(link) {
        const href = link.getAttribute('href');
        if (legacyRoutes[href]) link.setAttribute('href', legacyRoutes[href]);
    });

    // Each submenu owns one MVC page; a hash selects its existing visual tab.
    document.querySelectorAll('.submenu li a[data-section]').forEach(function(link) {
        const parent = link.closest('.has-submenu');
        const mainLink = parent && parent.querySelector('.nav-link');
        const baseRoute = mainLink && mainLink.getAttribute('href');
        if (baseRoute && baseRoute.startsWith('/admin')) {
            link.setAttribute('href', `${baseRoute}#${link.getAttribute('data-section')}`);
        }
    });

    document.querySelectorAll('.btn-logout').forEach(function(link) {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const form = document.createElement('form');
            form.method = 'post';
            form.action = '/admin/logout';
            document.body.appendChild(form);
            form.submit();
        });
    });

    // The legacy Dashboard contains detail buttons for the service list. Point
    // them to the actual Admin resource instead of a dead '#'.
    if (window.location.pathname === '/admin') {
        document.querySelectorAll('.btn-detail[href="#"]').forEach(function(link) {
            link.setAttribute('href', '/admin/products#sanpham');
        });
    }

    // ===== SIDEBAR TOGGLE (Mobile & Desktop) =====
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('mainSidebar');
    const wrapper = document.querySelector('.wrapper');
    let isCollapsed = false;

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.innerWidth < 992) {
                sidebar.classList.toggle('open');
            } else {
                isCollapsed = !isCollapsed;
                wrapper.classList.toggle('sidebar-collapsed', isCollapsed);
            }
        });

        // Close sidebar on click outside (mobile)
        document.addEventListener('click', function(e) {
            if (window.innerWidth < 992 && sidebar) {
                const isClickInside = sidebar.contains(e.target) || toggleBtn.contains(e.target);
                if (!isClickInside && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }

    // ===== SUBMENU TOGGLE (expand/collapse) =====
    const hasSubmenuItems = document.querySelectorAll('.has-submenu');
    hasSubmenuItems.forEach(function(item) {
        const navLink = item.querySelector('.nav-link');
        if (navLink) {
            navLink.addEventListener('click', function(e) {
                if (item.classList.contains('rbac-menu')) {
                    e.preventDefault();
                    item.classList.toggle('expanded');
                    navLink.setAttribute('aria-expanded', String(item.classList.contains('expanded')));
                    return;
                }

                // If the click is on the arrow icon specifically, toggle submenu
                if (e.target.classList.contains('arrow') || e.target.closest('.arrow')) {
                    e.preventDefault();
                    e.stopPropagation();
                    item.classList.toggle('expanded');
                    return;
                }

                // If the click is on the main link text (not arrow), follow the link
                // The link's href will navigate the page normally
            });
        }
    });

    // ===== SECTION SWITCHING HELPER =====
    function switchSection(sectionName, icon, linkElement) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(function(s) {
            s.classList.remove('active-section');
        });

        // Show target section
        const target = document.getElementById('section-' + sectionName);
        if (target) {
            target.classList.add('active-section');
        }

        // Update submenu active state (within the same parent submenu)
        if (linkElement) {
            var parentSubmenu = linkElement.closest('.submenu');
            if (parentSubmenu) {
                parentSubmenu.querySelectorAll('li').forEach(function(li) {
                    li.classList.remove('sub-active');
                });
                linkElement.parentElement.classList.add('sub-active');
            }
        }

        // Update content header title
        const headerTitle = document.querySelector('.content-header h1');
        if (headerTitle) {
            headerTitle.innerHTML = icon + ' ' + linkElement.textContent.trim();
        }

        // Init chart if on baocaodoanhthu section
        if (sectionName === 'baocaodoanhthu') {
            initRevenueChart();
        }
    }

    // ===== SECTION SWITCHING (sanpham, banhang, khachhang) =====
    const currentPage = window.location.pathname.split('/').pop();
    const isSanpham = currentPage === 'products';
    const isBanhang = currentPage === 'orders';
    const isKhachhang = currentPage === 'customers';

    // Determine which submenu item to auto-expand
    if (isSanpham) {
        var sanphamMenu = document.querySelector('.nav-item.has-submenu.active');
        if (sanphamMenu) {
            sanphamMenu.classList.add('expanded');
        }
    } else if (isBanhang) {
        var banhangMenu = document.querySelector('.nav-item.has-submenu.active');
        if (banhangMenu) {
            banhangMenu.classList.add('expanded');
        }
    } else if (isKhachhang) {
        var khachhangMenu = document.querySelector('.nav-item.has-submenu.active');
        if (khachhangMenu) {
            khachhangMenu.classList.add('expanded');
        }
    }

    // Handle all submenu item clicks (works on all pages)
    var allSubmenuLinks = document.querySelectorAll('.submenu li a');
    allSubmenuLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            // Let links to another MVC route or query variant navigate normally.
            // Review subpages share /admin/reviews but use ?type=customer/technician,
            // so comparing only pathname would incorrectly keep the old dataset.
            if (this.pathname && (
                this.pathname !== window.location.pathname ||
                this.search !== window.location.search
            )) return;
            e.preventDefault();

            var sectionName = this.getAttribute('data-section');
            if (!sectionName) {
                var text = this.textContent.trim().toLowerCase()
                    .replace(/\s+/g, '')
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                sectionName = text;
            }

            var icon = '<i class="fa-solid fa-box"></i>';
            if (currentPage === 'orders') {
                icon = '<i class="fa-solid fa-cart-shopping"></i>';
            } else if (currentPage === 'customers') {
                icon = '<i class="fa-solid fa-users"></i>';
            }

            switchSection(sectionName, icon, this);
        });
    });

    // Auto-select section from URL hash
    if (window.location.hash) {
        var hash = window.location.hash.replace('#', '');
        var targetLink = document.querySelector('.submenu li a[data-section="' + hash + '"]');
        if (targetLink) {
            targetLink.click();
        }
    }

    // ===== REVENUE CHART (Reusable function) =====
    let chartInstance = null;

    window.initRevenueChart = function() {
        const canvas = document.getElementById('revenueChart');
        if (!canvas || typeof Chart === 'undefined') return;

        // Destroy previous chart instance if exists
        if (chartInstance) {
            chartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(30, 58, 95, 0.55)');
        gradient.addColorStop(0.5, 'rgba(42, 82, 152, 0.25)');
        gradient.addColorStop(1, 'rgba(42, 82, 152, 0.02)');

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [
                    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
                    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
                ],
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: [
                        85000000, 92000000, 78000000, 105000000, 120000000, 145000000,
                        168000000, 192000000, 175000000, 210000000, 235000000, 280000000
                    ],
                    backgroundColor: gradient,
                    borderColor: '#1e3a5f',
                    borderWidth: 3,
                    pointBackgroundColor: '#1e3a5f',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    fill: true,
                    tension: 0.35,
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { family: 'Roboto', size: 13 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1a2d47',
                        titleFont: { family: 'Roboto', size: 13 },
                        bodyFont: { family: 'Roboto', size: 13 },
                        padding: 12,
                        cornerRadius: 6,
                        callbacks: {
                            label: function(context) {
                                return ' Doanh thu: ' + context.parsed.y.toLocaleString('vi-VN') + '₫';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: true, color: 'rgba(0, 0, 0, 0.05)', drawBorder: false },
                        ticks: { font: { family: 'Roboto', size: 11 }, color: '#6c757d' }
                    },
                    y: {
                        grid: { display: true, color: 'rgba(0, 0, 0, 0.06)', drawBorder: false },
                        ticks: {
                            font: { family: 'Roboto', size: 11 },
                            color: '#6c757d',
                            callback: function(value) {
                                return (value / 1000000).toFixed(0) + 'tr';
                            }
                        }
                    }
                }
            }
        });
    };

    // Auto-init chart if revenueChart exists on page (bangdieukhien.html)
    if (document.getElementById('revenueChart')) {
        initRevenueChart();
    }

    // ===== CONFIG TABS (cauhinh.html) =====
    const configTabs = document.querySelectorAll('.config-tab');
    if (configTabs.length > 0) {
        configTabs.forEach(function(tab) {
            tab.addEventListener('click', function(e) {
                e.preventDefault();

                // 1. Deactivate all tabs
                configTabs.forEach(function(t) {
                    t.classList.remove('active');
                });

                // 2. Activate clicked tab
                this.classList.add('active');

                // 3. Hide all config sections
                const tabName = this.getAttribute('data-tab');
                document.querySelectorAll('.config-section').forEach(function(s) {
                    s.classList.remove('active-section');
                });

                // 4. Show target section
                var targetSection = document.getElementById('config-' + tabName);
                if (targetSection) {
                    targetSection.classList.add('active-section');
                }

                // 5. Update content header title
                var headerTitle = document.querySelector('.content-header h1');
                if (headerTitle) {
                    headerTitle.innerHTML = this.innerHTML;
                }

                // Update URL hash without scrolling
                history.pushState(null, '', '#config-' + tabName);
            });
        });

        // Auto-open tab from URL hash on page load
        if (window.location.hash) {
            var hashTab = window.location.hash.replace('#config-', '');
            var targetTab = document.querySelector('.config-tab[data-tab="' + hashTab + '"]');
            if (targetTab) {
                targetTab.click();
            }
        }
    }

});

// ===== SERVICE MANAGEMENT (/admin/products) =====
document.addEventListener('DOMContentLoaded', function() {
    const createForm = document.getElementById('createServiceForm');
    const editModal = document.getElementById('serviceEditModal');
    const editForm = document.getElementById('editServiceForm');

    if (!createForm || !editModal || !editForm) return;

    function imageUrl(value) {
        const source = (value || '').trim();
        if (!source) return '';
        return /^(?:https?:)?\/\//i.test(source) || source.startsWith('/') ? source : `/images/${source.replace(/^\.\//, '')}`;
    }

    function updatePreview(key) {
        const input = document.querySelector(`[data-image-input="${key}"]`);
        const preview = document.querySelector(`[data-image-preview="${key}"]`);
        if (!input || !preview) return;

        const image = preview.querySelector('img');
        const selectedFile = input.files && input.files[0];
        const currentImage = key === 'edit' ? editForm.elements.current_image.value : '';
        const src = selectedFile ? URL.createObjectURL(selectedFile) : imageUrl(currentImage);
        image.hidden = true;
        image.removeAttribute('src');
        if (!src) return;

        image.onload = function() {
            image.hidden = false;
            if (selectedFile) URL.revokeObjectURL(src);
        };
        image.onerror = function() { image.hidden = true; image.removeAttribute('src'); };
        image.src = src;
    }

    ['create', 'edit'].forEach(function(key) {
        const input = document.querySelector(`[data-image-input="${key}"]`);
        if (input) input.addEventListener('change', function() { updatePreview(key); });
    });

    createForm.addEventListener('reset', function() {
        window.setTimeout(function() { updatePreview('create'); }, 0);
    });

    function closeModal() {
        editModal.hidden = true;
        editModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('service-modal-open');
    }

    function openModal(service) {
        editForm.action = `/admin/products/${service.id}`;
        ['name', 'slug', 'icon', 'price_range', 'sort_order', 'status', 'description', 'full_description'].forEach(function(field) {
            const control = editForm.elements[field];
            if (control) control.value = service[field] ?? '';
        });
        editForm.elements.current_image.value = service.image || '';
        editForm.elements.service_image.value = '';
        updatePreview('edit');
        editModal.hidden = false;
        editModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('service-modal-open');
        window.setTimeout(function() { editForm.elements.name.focus(); }, 0);
    }

    document.querySelectorAll('[data-edit-service]').forEach(function(button) {
        button.addEventListener('click', function() {
            const row = button.closest('tr[data-service]');
            if (!row) return;
            try { openModal(JSON.parse(row.dataset.service)); } catch (error) { console.error('Không thể tải dữ liệu dịch vụ.', error); }
        });
    });

    document.querySelectorAll('[data-close-service-modal]').forEach(function(button) {
        button.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && !editModal.hidden) closeModal();
    });

    document.querySelectorAll('.service-delete-form').forEach(function(form) {
        form.addEventListener('submit', function(event) {
            if (!window.confirm('Bạn có chắc muốn xóa dịch vụ này? Hành động này không thể hoàn tác.')) event.preventDefault();
        });
    });

    const search = document.getElementById('serviceSearch');
    const rows = Array.from(document.querySelectorAll('#serviceListBody tr'));
    const emptyState = document.getElementById('serviceEmptyState');
    if (search) {
        search.addEventListener('input', function() {
            const term = search.value.trim().toLocaleLowerCase('vi-VN');
            let visible = 0;
            rows.forEach(function(row) {
                const match = row.dataset.serviceName.includes(term);
                row.hidden = !match;
                if (match) visible += 1;
            });
            emptyState.hidden = visible !== 0;
        });
    }
});

// ===== BOOKING MANAGEMENT (/admin/bookings) =====
document.addEventListener('DOMContentLoaded', function () {

    const modals = Array.from(document.querySelectorAll('.booking-modal'));
    const imageViewer = document.createElement('div');
    imageViewer.className = 'booking-image-viewer';
    imageViewer.hidden = true;
    imageViewer.innerHTML = '<button class="booking-image-viewer__close" type="button" aria-label="Đóng ảnh"><i class="fa-solid fa-xmark"></i></button><img alt="Ảnh thiết bị phóng lớn">';
    document.body.appendChild(imageViewer);

    function closeImageViewer() {
        imageViewer.hidden = true;
        imageViewer.querySelector('img').removeAttribute('src');
    }

    document.querySelectorAll('[data-booking-image]').forEach(function (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            imageViewer.querySelector('img').src = link.href;
            imageViewer.hidden = false;
            imageViewer.querySelector('.booking-image-viewer__close').focus();
        });
    });

    imageViewer.addEventListener('click', function (event) {
        if (event.target === imageViewer || event.target.closest('.booking-image-viewer__close')) closeImageViewer();
    });

    function closeModal(modal) {
        if (!modal) return;

        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
    }

    function closeAllModals() {
        modals.forEach(function (modal) {
            closeModal(modal);
        });

        document.body.classList.remove('service-modal-open');
    }

    function openModal(id) {
        const modal = document.getElementById(id);

        if (!modal) {
            console.error('Không tìm thấy booking modal:', id);
            return;
        }

        closeAllModals();

        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('service-modal-open');

        const dialog = modal.querySelector('.booking-modal__dialog');
        if (dialog) dialog.scrollTop = 0;

        setTimeout(function () {
            const target = modal.querySelector(
                'select, input:not([type="hidden"]), textarea'
            );

            if (target) {
                target.focus();
            }
        }, 50);
    }

    // =========================
    // MỞ MODAL
    // =========================

    document.querySelectorAll('[data-open-booking-modal]')
        .forEach(function (button) {

            button.addEventListener('click', function (event) {

                // Chỉ ngăn nút mở modal, không ảnh hưởng form
                event.preventDefault();

                const modalId = button.dataset.openBookingModal;

                openModal(modalId);
            });
        });

    // =========================
    // ĐÓNG MODAL
    // =========================

    document.querySelectorAll('[data-close-booking-modal]')
        .forEach(function (button) {

            button.addEventListener('click', function (event) {

                event.preventDefault();

                const modal = button.closest('.booking-modal');

                closeModal(modal);

                if (!document.querySelector('.booking-modal:not([hidden])')) {
                    document.body.classList.remove('service-modal-open');
                }
            });
        });

    // =========================
    // ESC ĐỂ ĐÓNG MODAL
    // =========================

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !imageViewer.hidden) {
            closeImageViewer();
            return;
        }

        if (event.key === 'Escape') {
            closeAllModals();
        }

    });

    // =========================
    // FORMAT GIÁ
    // =========================

    function formatCurrency(value) {

        const amount = Number(
            String(value || '').replace(/[^0-9]/g, '')
        );

        if (!Number.isFinite(amount) || amount <= 0) {
            return '';
        }

        return amount.toLocaleString('vi-VN') + ' ₫';
    }

    document.querySelectorAll('input[name="estimated_cost"]')
        .forEach(function (input) {

            const field = input.closest('.form-field');

            const hint = field
                ? field.querySelector('[data-booking-cost-hint]')
                : null;

            function updateHint() {

                if (hint) {
                    hint.textContent = formatCurrency(input.value);
                }
            }

            input.addEventListener('input', updateHint);

            updateHint();
        });

    // =========================
    // SUBMIT FORM
    // =========================

    document.querySelectorAll('.booking-update-form')
        .forEach(function (form) {

            form.addEventListener('submit', function (event) {

                console.log('BOOKING FORM SUBMIT');

                console.log('Action:', form.action);

                console.log('Method:', form.method);

                const scheduledDateInput =
                    form.querySelector('input[name="scheduled_date"]');

                console.log(
                    'scheduled_date gửi lên backend:',
                    scheduledDateInput ? scheduledDateInput.value : ''
                );

                // QUAN TRỌNG:
                // Không dùng event.preventDefault()
                // Form sẽ submit bình thường về Express.

                const saveButton =
                    form.querySelector('[data-booking-save]');

                if (saveButton) {

                    saveButton.disabled = true;

                    const label =
                        saveButton.querySelector('span');

                    if (label) {
                        label.textContent = 'Đang lưu...';
                    }

                    const icon =
                        saveButton.querySelector('i');

                    if (icon) {
                        icon.className =
                            'fa-solid fa-spinner fa-spin';
                    }
                }

                form.classList.add('is-submitting');
            });
        });

});
