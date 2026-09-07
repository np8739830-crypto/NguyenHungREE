(function() {
    'use strict';
    const form = document.getElementById('reviewForm');
    const list = document.getElementById('reviewsList');
    if (!form || !list) return;

    let csrfToken = '';
    const ratingLabels = { 1: 'Rất không hài lòng', 2: 'Chưa hài lòng', 3: 'Bình thường', 4: 'Hài lòng', 5: 'Rất hài lòng' };
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    const formatDate = value => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
    const stars = rating => Array.from({ length: 5 }, (_, index) => `<i class="${index < rating ? 'fa-solid' : 'fa-regular'} fa-star"></i>`).join('');

    function showNotice(message, type) {
        const notice = document.getElementById('reviewNotice');
        notice.hidden = false;
        notice.className = `reviews-notice reviews-notice--${type}`;
        notice.textContent = message;
        notice.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function parseResponse(response) {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Không thể xử lý yêu cầu.');
        return data;
    }

    async function loadMeta() {
        const data = await fetch('/reviews/meta', { credentials: 'same-origin' }).then(parseResponse);
        csrfToken = data.csrfToken;
        const service = document.getElementById('reviewService');
        (data.services || []).forEach(item => service.insertAdjacentHTML('beforeend', `<option value="${Number(item.id)}">${escapeHtml(item.name)}</option>`));
    }

    async function loadReviews() {
        try {
            const data = await fetch('/reviews', { credentials: 'same-origin' }).then(parseResponse);
            if (!data.reviews.length) {
                list.innerHTML = '<div class="reviews-empty"><i class="fa-regular fa-comment-dots"></i><h3>Chưa có đánh giá</h3><p>Hãy là người đầu tiên chia sẻ trải nghiệm của bạn với Điện Máy Nguyên Hùng.</p></div>';
                return;
            }
            list.innerHTML = data.reviews.map(review => `<article class="review-real-card"><div class="review-real-card__head"><div class="review-real-card__avatar" aria-hidden="true">${escapeHtml(review.name.charAt(0).toUpperCase())}</div><div><h3>${escapeHtml(review.name)}</h3><div class="review-real-card__stars" aria-label="${Number(review.rating)} trên 5 sao">${stars(Number(review.rating))}</div></div><time datetime="${escapeHtml(review.created_at)}">${formatDate(review.created_at)}</time></div><p class="review-real-card__content">${escapeHtml(review.content)}</p>${review.service_name ? `<div class="review-real-card__service"><i class="fa-solid fa-screwdriver-wrench"></i>${escapeHtml(review.service_name)}</div>` : ''}</article>`).join('');
        } catch (error) {
            list.innerHTML = `<div class="reviews-empty reviews-empty--error"><i class="fa-solid fa-circle-exclamation"></i><h3>Không tải được đánh giá</h3><p>${escapeHtml(error.message)}</p></div>`;
        }
    }

    const content = document.getElementById('reviewContent');
    content.addEventListener('input', () => { document.getElementById('reviewCharacterCount').textContent = content.value.length; });

    const ratingStatus = document.getElementById('ratingStatus');
    const ratingInputs = [...form.querySelectorAll('input[name="rating"]')];
    const ratingLabelsElements = [...form.querySelectorAll('.review-rating__stars label')];
    const showRatingStatus = value => { ratingStatus.textContent = value ? `${value}/5 – ${ratingLabels[value]}` : ''; };
    const selectedRating = () => form.querySelector('input[name="rating"]:checked')?.value || '';
    ratingInputs.forEach(input => input.addEventListener('change', () => showRatingStatus(input.value)));
    ratingLabelsElements.forEach(label => {
        const value = label.htmlFor.replace('rating-', '');
        label.addEventListener('mouseenter', () => showRatingStatus(value));
        label.addEventListener('mouseleave', () => showRatingStatus(selectedRating()));
    });

    const setFieldError = (control, message) => {
        const error = control.closest('.form-group')?.querySelector('.form-error');
        if (error) error.textContent = message;
    };

    form.addEventListener('submit', async event => {
        event.preventDefault();
        form.querySelectorAll('.form-error').forEach(element => { element.textContent = ''; });
        const data = Object.fromEntries(new FormData(form).entries());
        let valid = true;
        if (!data.name?.trim()) { setFieldError(form.elements.name, 'Vui lòng nhập họ và tên.'); valid = false; }
        if (!/^(?:0(?:3|5|7|8|9)\d{8}|[^\s@]+@[^\s@]+\.[^\s@]+)$/i.test(data.contact || '')) { setFieldError(form.elements.contact, 'Nhập số điện thoại hoặc email hợp lệ.'); valid = false; }
        if (!data.rating) { document.getElementById('ratingError').textContent = 'Vui lòng chọn từ 1 đến 5 sao.'; valid = false; }
        if (!data.content?.trim()) { content.parentElement.querySelector('.form-error').textContent = 'Vui lòng nhập nội dung đánh giá.'; valid = false; }
        if (!valid) return;

        const button = document.getElementById('reviewSubmit');
        button.disabled = true;
        button.classList.add('is-loading');
        try {
            const result = await fetch('/reviews', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(data) }).then(parseResponse);
            form.reset();
            document.getElementById('reviewCharacterCount').textContent = '0';
            showRatingStatus('');
            showNotice(result.message, 'success');
        } catch (error) { showNotice(error.message, 'error'); }
        finally { button.disabled = false; button.classList.remove('is-loading'); }
    });

    const revealItems = document.querySelectorAll('.reviews-reveal');
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        }), { threshold: 0.12 });
        revealItems.forEach(item => revealObserver.observe(item));
    } else {
        revealItems.forEach(item => item.classList.add('is-visible'));
    }

    Promise.all([loadMeta(), loadReviews()]).catch(error => showNotice(error.message, 'error'));
})();
