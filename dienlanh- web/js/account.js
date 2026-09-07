document.addEventListener('DOMContentLoaded', () => {
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    const formatDate = value => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa cập nhật';
    const formatMoney = value => value === null || value === undefined ? 'Chưa có' : `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
    const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đang xử lý', in_progress: 'Đang xử lý', completed: 'Hoàn thành', cancelled: 'Đã hủy' };

    async function fetchAccount(path, options = {}) {
        const response = await fetch(path, { ...options, cache: 'no-store', credentials: 'include', headers: { Accept: 'application/json', ...(options.headers || {}) } });
        if (response.status === 401) {
            window.location.assign('/?auth=login');
            throw new Error('Vui lòng đăng nhập để tiếp tục.');
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Không thể tải dữ liệu.');
        return body;
    }

    // Dùng ảnh từ tài khoản; nếu chưa có ảnh thì dùng biểu tượng người dùng trung tính.
    function profileAvatar(user) {
        if (user && user.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== '') {
            return `<img src="${escapeHtml(user.avatar)}" alt="Ảnh đại diện của ${escapeHtml(user.name)}">`;
        }
        return '<i class="fas fa-user" aria-hidden="true"></i>';
    }

    function installAvatarFallbacks(scope) {
        scope.querySelectorAll('.account-avatar img').forEach(image => {
            image.addEventListener('error', () => {
                const avatar = image.closest('.account-avatar');
                if (avatar) avatar.innerHTML = '<i class="fas fa-user" aria-hidden="true"></i>';
            }, { once: true });
        });
    }

    function renderProfile(user, message = '') {
        const page = document.getElementById('profilePage');
        if (!page) return;

        // Cập nhật thông tin và avatar trên Header
        const headerName = document.querySelector('#headerUser .header__user-name');
        const headerAvatar = document.querySelector('#headerUser .header__user-avatar');
        if (headerName) headerName.textContent = user.name || '';
        if (headerAvatar) {
            headerAvatar.innerHTML = profileAvatar(user);
        }

        page.innerHTML = `${message ? `<p class="account-notice account-notice--success">${escapeHtml(message)}</p>` : ''}<div class="account-card"><div class="account-card__head"><div class="account-avatar">${profileAvatar(user)}</div><div class="account-card__identity"><h2>${escapeHtml(user.name)}</h2><p>Tài khoản khách hàng</p></div><button class="btn btn--primary account-card__edit" type="button" id="editProfileButton"><i class="fas fa-pen"></i> Chỉnh sửa thông tin</button></div><dl class="account-details"><div><dt><i class="fas fa-user"></i> Họ tên</dt><dd>${escapeHtml(user.name)}</dd></div><div><dt><i class="fas fa-envelope"></i> Email</dt><dd>${escapeHtml(user.email || 'Chưa cập nhật')}</dd></div><div><dt><i class="fas fa-phone"></i> Số điện thoại</dt><dd>${escapeHtml(user.phone || 'Chưa cập nhật')}</dd></div><div><dt><i class="fas fa-location-dot"></i> Địa chỉ</dt><dd>${escapeHtml(user.address || 'Chưa cập nhật')}</dd></div><div><dt><i class="fas fa-calendar-check"></i> Ngày đăng ký</dt><dd>${escapeHtml(formatDate(user.created_at))}</dd></div><div><dt><i class="fas fa-shield-check"></i> Trạng thái tài khoản</dt><dd><span class="account-status"><i class="fas fa-circle-check"></i> Đang hoạt động</span></dd></div></dl></div>`;
        installAvatarFallbacks(page);
        page.querySelector('#editProfileButton').addEventListener('click', () => renderProfileForm(user));
    }

    function renderProfileForm(user) {
        const page = document.getElementById('profilePage');
        if (!page) return;
        page.innerHTML = `<div class="account-card"><div class="account-card__head"><div class="account-avatar" id="avatarPreview">${profileAvatar(user)}</div><div><h2>Chỉnh sửa thông tin</h2><p>Cập nhật thông tin liên hệ của bạn</p></div></div><form id="profileForm" class="account-form" novalidate><p class="account-notice" id="profileFormNotice" hidden></p><div class="form-row"><div class="form-group"><label for="profileName">Họ và tên <span class="required">*</span></label><input class="form-control" id="profileName" name="name" maxlength="100" value="${escapeHtml(user.name)}" required><span class="form-error"></span></div><div class="form-group"><label for="profilePhone">Số điện thoại <span class="required">*</span></label><input class="form-control" id="profilePhone" name="phone" inputmode="numeric" maxlength="10" value="${escapeHtml(user.phone)}" required><span class="form-error"></span></div></div><div class="form-row"><div class="form-group"><label>Email</label><input class="form-control" value="${escapeHtml(user.email || '')}" readonly></div><div class="form-group"><label>Ngày tạo tài khoản</label><input class="form-control" value="${escapeHtml(formatDate(user.created_at))}" readonly></div></div><div class="form-group"><label for="profileAddress">Địa chỉ</label><input class="form-control" id="profileAddress" name="address" maxlength="300" value="${escapeHtml(user.address || '')}" placeholder="Nhập địa chỉ của bạn"></div><div class="form-group"><label for="profileAvatar">Ảnh đại diện</label><input class="form-control" id="profileAvatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small class="account-form__hint">PNG, JPG, WEBP hoặc GIF, tối đa 2 MB.</small></div><div class="form-submit account-form__actions"><button class="btn btn--outline-cyan" type="button" id="cancelProfileEdit">Hủy</button><button class="btn btn--primary" type="submit" id="saveProfileButton"><i class="fas fa-save"></i> Lưu thay đổi</button></div></form></div>`;
        
        const form = page.querySelector('#profileForm');
        installAvatarFallbacks(page);
        const notice = page.querySelector('#profileFormNotice');
        const showError = (input, text) => { input.classList.add('error'); input.parentElement.querySelector('.form-error')?.replaceChildren(text); input.parentElement.querySelector('.form-error')?.classList.add('show'); };
        const clearErrors = () => form.querySelectorAll('.form-control').forEach(input => { input.classList.remove('error'); input.parentElement.querySelector('.form-error')?.classList.remove('show'); });
        
        page.querySelector('#cancelProfileEdit').addEventListener('click', () => renderProfile(user));
        page.querySelector('#profileAvatar').addEventListener('change', event => {
            const file = event.target.files[0];
            if (!file) return;
            if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 2 * 1024 * 1024) { 
                event.target.value = ''; 
                notice.hidden = false; 
                notice.textContent = 'Ảnh phải có định dạng PNG, JPG, WEBP hoặc GIF và không quá 2 MB.'; 
                notice.className = 'account-notice account-notice--error'; 
                return; 
            }
            const preview = page.querySelector('#avatarPreview'); 
            preview.innerHTML = ''; 
            const image = document.createElement('img'); 
            image.src = URL.createObjectURL(file); 
            image.alt = 'Ảnh đại diện mới'; 
            preview.append(image);
        });

        form.addEventListener('submit', async event => {
            event.preventDefault(); 
            clearErrors(); 
            notice.hidden = true;
            const name = form.name.value.trim(); 
            const phone = form.phone.value.trim();
            let valid = true;
            if (!name) { showError(form.name, 'Vui lòng nhập họ và tên.'); valid = false; }
            if (!/^0(?:3|5|7|8|9)\d{8}$/.test(phone)) { showError(form.phone, 'Số điện thoại không hợp lệ.'); valid = false; }
            if (!valid) return;

            const saveButton = page.querySelector('#saveProfileButton'); 
            saveButton.disabled = true;
            try {
                const result = await fetchAccount('/account/api/profile', {
                    method: 'PUT',
                    body: new FormData(form)
                });
                const refreshed = await fetchAccount('/account/api/profile');
                renderProfile(refreshed.user, result.message);
            } catch (error) { 
                notice.hidden = false; 
                notice.textContent = error.message; 
                notice.className = 'account-notice account-notice--error'; 
            } finally { 
                saveButton.disabled = false; 
            }
        });
    }

    const contactStatusLabels = { new: 'Đã tiếp nhận', read: 'Đang xử lý', replied: 'Đã xử lý', closed: 'Đã đóng' };
    const contactSubjectLabels = {
        'su-may-lanh': 'Sửa máy lạnh', 've-sinh-may-lanh': 'Vệ sinh máy lạnh',
        'su-tu-lanh': 'Sửa tủ lạnh', 'su-may-giat': 'Sửa máy giặt',
        'su-may-nuoc-nong': 'Sửa máy nước nóng', other: 'Khác'
    };
    const formatHistoryDate = value => value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '—';
    const formatHistoryTime = value => value ? new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) : '—';
    const friendlySubject = value => contactSubjectLabels[value] || String(value || 'Khác').replace(/-/g, ' ').replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase('vi-VN'));
    const compactText = (value, length = 58) => String(value || '').length > length ? `${String(value).slice(0, length).trim()}…` : String(value || '—');

    function renderHistory(bookings, contacts) {
        const page = document.getElementById('bookingHistoryPage');
        if (!page) return;
        bookings.forEach(booking => {
            booking.service_type = booking.service_name || booking.service_type || 'Dịch vụ';
            booking.device_type = booking.device_name || booking.device_type || 'Thiết bị';
        });

        const bookingRows = bookings.length ? bookings.map(booking => `<tr>
            <td data-label="Mã đơn"><strong class="history-code">${escapeHtml(booking.request_code || `#${booking.id}`)}</strong></td>
            <td data-label="Ngày đặt"><strong>${escapeHtml(formatHistoryDate(booking.created_at))}</strong></td>
            <td data-label="Thời gian đặt"><strong>${escapeHtml(formatHistoryTime(booking.created_at))}</strong></td>
            <td data-label="Dịch vụ / Thiết bị"><strong>${escapeHtml(booking.service_type)}</strong><small>${escapeHtml(booking.device_type)}</small></td>
            <td data-label="Lịch hẹn"><strong>${escapeHtml(formatHistoryDate(booking.booking_date))}</strong><small>${escapeHtml(booking.booking_time || '—')}</small></td>
            <td data-label="Trạng thái"><span class="booking-status booking-status--${escapeHtml(booking.status)}">${escapeHtml(statusLabels[booking.status] || booking.status)}</span></td>
            <td data-label="Thao tác"><button type="button" class="account-detail-button" data-booking-id="${booking.id}"><i class="fas fa-eye"></i> Xem chi tiết</button></td>
        </tr>`).join('') : `<tr class="history-empty-row"><td colspan="7">Bạn chưa có lịch đặt nào. <a href="/booking">Đặt lịch ngay</a></td></tr>`;

        const contactRows = contacts.length ? contacts.map(contact => `<tr>
            <td data-label="Mã liên hệ"><strong class="history-code">${escapeHtml(contact.request_code)}</strong></td>
            <td data-label="Ngày gửi"><strong>${escapeHtml(formatHistoryDate(contact.created_at))}</strong></td>
            <td data-label="Thời gian gửi"><strong>${escapeHtml(formatHistoryTime(contact.created_at))}</strong></td>
            <td data-label="Chủ đề"><strong>${escapeHtml(friendlySubject(contact.subject))}</strong></td>
            <td data-label="Nội dung"><span class="history-message">${escapeHtml(compactText(contact.message))}</span></td>
            <td data-label="Trạng thái"><span class="contact-history-status contact-history-status--${escapeHtml(contact.status)}">${escapeHtml(contactStatusLabels[contact.status] || contact.status)}</span></td>
            <td data-label="Thao tác"><button type="button" class="account-detail-button" data-contact-id="${contact.id}"><i class="fas fa-eye"></i> Xem chi tiết</button></td>
        </tr>`).join('') : `<tr class="history-empty-row"><td colspan="7">Bạn chưa gửi liên hệ nào. <a href="/contact">Gửi liên hệ</a></td></tr>`;

        page.innerHTML = `<div class="history-sections">
            <section class="account-card history-card"><div class="account-card__head"><div class="history-heading-icon history-heading-icon--booking"><i class="fas fa-calendar-check"></i></div><div><h2>Lịch đặt của bạn</h2><p>${bookings.length} lịch đặt</p></div></div><div class="account-table-wrap"><table class="account-table history-table"><thead><tr><th>Mã đơn</th><th>Ngày đặt</th><th>Thời gian đặt</th><th>Dịch vụ / Thiết bị</th><th>Lịch hẹn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${bookingRows}</tbody></table></div><div id="bookingDetail" class="booking-detail" hidden></div></section>
            <section class="account-card history-card"><div class="account-card__head"><div class="history-heading-icon history-heading-icon--contact"><i class="fas fa-envelope"></i></div><div><h2>Lịch sử liên hệ</h2><p>${contacts.length} liên hệ</p></div></div><div class="account-table-wrap"><table class="account-table history-table"><thead><tr><th>Mã liên hệ</th><th>Ngày gửi</th><th>Thời gian gửi</th><th>Chủ đề</th><th>Nội dung</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${contactRows}</tbody></table></div><div id="contactDetail" class="booking-detail" hidden></div></section>
        </div>`;

        page.querySelectorAll('[data-booking-id]').forEach(button => button.addEventListener('click', async () => {
            const detail = page.querySelector('#bookingDetail');
            try {
                const { booking } = await fetchAccount(`/account/api/bookings/${button.dataset.bookingId}`);
                const service = booking.service_name || booking.service_type || 'Dịch vụ';
                const device = booking.device_name || booking.device_type || 'Thiết bị';
                const images = (booking.images || []).map((image, index) => `<a href="/attachments/${image.id}" target="_blank" rel="noopener"><img src="/attachments/${image.id}" alt="Ảnh thiết bị ${index + 1}"></a>`).join('');
                const hasActualCost = booking.actual_cost !== null && booking.actual_cost !== undefined;
                const displayedCost = hasActualCost ? booking.actual_cost : booking.estimated_cost;
                const costLabel = hasActualCost ? 'Chi phí thực tế' : 'Chi phí dự kiến';
                detail.hidden = false;
                detail.innerHTML = `<h3>Chi tiết lịch đặt ${escapeHtml(booking.request_code || `#${booking.id}`)}</h3><div class="history-detail-grid"><p><strong>Dịch vụ</strong>${escapeHtml(service)}</p><p><strong>Thiết bị</strong>${escapeHtml(device)}</p><p><strong>Ngày đặt</strong>${escapeHtml(formatHistoryDate(booking.created_at))} · ${escapeHtml(formatHistoryTime(booking.created_at))}</p><p><strong>Lịch hẹn</strong>${escapeHtml(formatHistoryDate(booking.booking_date))} · ${escapeHtml(booking.booking_time || '—')}</p><p><strong>Địa chỉ</strong>${escapeHtml(booking.address)}</p><p><strong>Trạng thái</strong>${escapeHtml(statusLabels[booking.status] || booking.status)}</p><p><strong>${costLabel}</strong>${escapeHtml(formatMoney(displayedCost))}</p><p class="history-detail-full"><strong>Mô tả</strong>${escapeHtml(booking.description)}</p></div>${images ? `<p><strong>Hình ảnh thiết bị:</strong></p><div class="request-image-gallery">${images}</div>` : ''}`;
                detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (error) { window.alert(error.message); }
        }));

        page.querySelectorAll('[data-contact-id]').forEach(button => button.addEventListener('click', async () => {
            const detail = page.querySelector('#contactDetail');
            try {
                const { contact } = await fetchAccount(`/account/api/contacts/${button.dataset.contactId}`);
                const images = (contact.images || []).map((image, index) => `<a href="/attachments/${image.id}" target="_blank" rel="noopener"><img src="/attachments/${image.id}" alt="Ảnh liên hệ ${index + 1}"></a>`).join('');
                detail.hidden = false;
                detail.innerHTML = `<h3>Chi tiết liên hệ ${escapeHtml(contact.request_code)}</h3><div class="history-detail-grid"><p><strong>Họ tên</strong>${escapeHtml(contact.name)}</p><p><strong>Số điện thoại</strong>${escapeHtml(contact.phone)}</p>${contact.email ? `<p><strong>Email</strong>${escapeHtml(contact.email)}</p>` : ''}<p><strong>Ngày gửi</strong>${escapeHtml(formatHistoryDate(contact.created_at))} · ${escapeHtml(formatHistoryTime(contact.created_at))}</p><p><strong>Chủ đề</strong>${escapeHtml(friendlySubject(contact.subject))}</p><p><strong>Trạng thái</strong>${escapeHtml(contactStatusLabels[contact.status] || contact.status)}</p><p class="history-detail-full"><strong>Nội dung</strong>${escapeHtml(contact.message)}</p></div>${images ? `<p><strong>Hình ảnh đính kèm:</strong></p><div class="request-image-gallery">${images}</div>` : ''}`;
                detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (error) { window.alert(error.message); }
        }));
    }

    const profilePage = document.getElementById('profilePage');
    if (profilePage) {
        fetchAccount('/account/api/profile')
            .then(({ user }) => renderProfile(user))
            .catch(error => {
                profilePage.innerHTML = `<p class="account-page__error">${escapeHtml(error.message)}</p>`;
            });
    }

    const bookingPage = document.getElementById('bookingHistoryPage');
    if (bookingPage) {
        Promise.all([fetchAccount('/account/api/bookings'), fetchAccount('/account/api/contacts')])
            .then(([{ bookings }, { contacts }]) => renderHistory(bookings, contacts))
            .catch(error => {
                bookingPage.innerHTML = `<p class="account-page__error">${escapeHtml(error.message)}</p>`;
            });
    }
});
