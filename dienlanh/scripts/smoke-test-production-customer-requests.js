'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const { query, requestD1 } = require('../config/database');
const origin = 'https://linhkienchinhhang.com.vn';
const stamp = Date.now();
const email = `customer-request-${stamp}@example.invalid`;
const phone = `09${String(stamp).slice(-8)}`;
const password = 'Customer-Test-2026!';
let userId;
let bookingId;
let contactId;

async function json(response) {
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 500) }; }
    return { status: response.status, body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function main() {
    try {
        const registered = await json(await fetch(`${origin}/auth/register`, {
            method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ name: 'Customer Request Smoke', email, phone, password })
        }));
        if (registered.status !== 201) throw new Error(`Register HTTP ${registered.status}: ${JSON.stringify(registered.body)}`);
        userId = registered.body.id;

        const loggedIn = await json(await fetch(`${origin}/auth/login`, {
            method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ email, password })
        }));
        if (loggedIn.status !== 200 || !loggedIn.cookie) throw new Error(`Login HTTP ${loggedIn.status}: ${JSON.stringify(loggedIn.body)}`);
        const cookie = loggedIn.cookie;
        console.log('PASS customer register/login/session');

        const contactForm = new FormData();
        Object.entries({ name: 'Customer Request Smoke', phone, email, subject: 'khac', message: `Kiem tra lien he tren ten mien ${stamp}` })
            .forEach(([key, value]) => contactForm.append(key, value));
        const contact = await json(await fetch(`${origin}/contact`, { method: 'POST', headers: { accept: 'application/json', cookie }, body: contactForm }));
        if (contact.status !== 201) throw new Error(`Contact HTTP ${contact.status}: ${JSON.stringify(contact.body)}`);
        contactId = contact.body.id;
        console.log(`PASS contact saved id=${contactId} code=${contact.body.requestCode} telegram=${contact.body.telegramStatus}`);

        const technicians = await json(await fetch(`${origin}/api/technicians/public`, { headers: { accept: 'application/json', cookie } }));
        const technician = technicians.body.technicians?.[0];
        if (!technician) throw new Error(`No public technician: HTTP ${technicians.status} ${JSON.stringify(technicians.body)}`);
        const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const availability = await json(await fetch(`${origin}/api/bookings/availability?technician_id=${technician.id}&appointment_date=${date}`, { headers: { accept: 'application/json', cookie } }));
        const slot = availability.body.availableSlots?.[0];
        if (!slot) throw new Error(`No available slot: HTTP ${availability.status} ${JSON.stringify(availability.body)}`);
        const bookingForm = new FormData();
        Object.entries({ fullname: 'Customer Request Smoke', phone, email, address: 'Dia chi kiem tra tam thoi',
            device_type: 'may-lanh', service_type: 'sua-chua', technician_id: String(technician.id), booking_date: date,
            booking_time: slot, description: `Kiem tra dat lich tren ten mien ${stamp}` })
            .forEach(([key, value]) => bookingForm.append(key, value));
        const booking = await json(await fetch(`${origin}/booking`, { method: 'POST', headers: { accept: 'application/json', cookie }, body: bookingForm }));
        if (booking.status !== 201) throw new Error(`Booking HTTP ${booking.status}: ${JSON.stringify(booking.body)}`);
        bookingId = booking.body.id;
        console.log(`PASS booking saved id=${bookingId} code=${booking.body.requestCode} telegram=${booking.body.telegramStatus}`);

        const [bookingHistory, contactHistory] = await Promise.all([
            json(await fetch(`${origin}/account/api/bookings`, { headers: { accept: 'application/json', cookie } })),
            json(await fetch(`${origin}/account/api/contacts`, { headers: { accept: 'application/json', cookie } }))
        ]);
        const historyBooking = bookingHistory.body.bookings?.find(item => Number(item.id) === Number(bookingId));
        const historyContact = contactHistory.body.contacts?.find(item => Number(item.id) === Number(contactId));
        if (bookingHistory.status !== 200 || !historyBooking) throw new Error(`Booking history missing: HTTP ${bookingHistory.status} ${JSON.stringify(bookingHistory.body)}`);
        if (contactHistory.status !== 200 || !historyContact) throw new Error(`Contact history missing: HTTP ${contactHistory.status} ${JSON.stringify(contactHistory.body)}`);
        if (historyBooking.request_code !== booking.body.requestCode) throw new Error('Booking request code differs in history');
        if (historyContact.request_code !== contact.body.requestCode) throw new Error('Contact request code differs in history');
        console.log('PASS account transaction history contains booking and contact');

        const [bookingDetail, contactDetail] = await Promise.all([
            json(await fetch(`${origin}/account/api/bookings/${bookingId}`, { headers: { accept: 'application/json', cookie } })),
            json(await fetch(`${origin}/account/api/contacts/${contactId}`, { headers: { accept: 'application/json', cookie } }))
        ]);
        if (bookingDetail.status !== 200 || Number(bookingDetail.body.booking?.id) !== Number(bookingId)) throw new Error(`Booking detail failed: ${JSON.stringify(bookingDetail)}`);
        if (contactDetail.status !== 200 || Number(contactDetail.body.contact?.id) !== Number(contactId)) throw new Error(`Contact detail failed: ${JSON.stringify(contactDetail)}`);
        console.log('PASS account transaction detail endpoints');

        if (contact.body.telegramStatus !== 'sent' || booking.body.telegramStatus !== 'sent') {
            throw new Error(`Telegram notification pending: contact=${contact.body.telegramStatus}, booking=${booking.body.telegramStatus}`);
        }
        console.log('PASS Telegram accepted both notifications');
    } finally {
        if (bookingId) {
            await query("DELETE FROM request_images WHERE request_type='booking' AND request_id=@id", { id: bookingId }).catch(() => {});
            await query('DELETE FROM bookings WHERE id=@id', { id: bookingId }).catch(() => {});
        }
        if (contactId) {
            await query("DELETE FROM request_images WHERE request_type='contact' AND request_id=@id", { id: contactId }).catch(() => {});
            await query('DELETE FROM contacts WHERE id=@id', { id: contactId }).catch(() => {});
        }
        await requestD1('DELETE FROM app_sessions WHERE data LIKE ?', [`%${email}%`]).catch(() => {});
        if (userId) await query('DELETE FROM users WHERE id=@id', { id: userId }).catch(() => {});
    }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
