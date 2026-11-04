import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// [MASUKKAN FIREBASE CONFIG ANDA DI SINI SEPERTI BIASA]
const firebaseConfig = {
    apiKey: "AIzaSyBviMbX_-VMr7RkObmsqN_6Y2skAOdIQkQ",
    authDomain: "logbook-map-43835.firebaseapp.com",
    projectId: "logbook-map-43835",
    storageBucket: "logbook-map-43835.firebasestorage.app",
    messagingSenderId: "278957351659",
    appId: "1:278957351659:web:5005eba610fc14c7c614ae"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Variabel Global untuk UID User
let currentUserUid = null;

document.addEventListener('DOMContentLoaded', () => {

    // Fungsi Format Tanggal Khusus (11 Nov 2026, 14:30)
    function formatTgl(isoString) {
        const d = new Date(isoString);
        const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        const day = d.getDate();
        const month = bulan[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day} ${month} ${year}, ${hours}:${minutes}`;
    }

    // --- AUTENTIKASI ---
    document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
        try { await signInWithPopup(auth, provider); } 
        catch (error) { document.getElementById('loginError').innerText = error.message; }
    });
    document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid; // Simpan UID agar data terpisah per akun
            document.getElementById('loginScreen').style.display = "none";
            document.getElementById('appContent').style.display = "flex";
            document.querySelector('.user-name').innerText = user.displayName;
            
            loadHarga();
            loadKas();
            loadStok();
        } else {
            currentUserUid = null;
            document.getElementById('loginScreen').style.display = "flex";
            document.getElementById('appContent').style.display = "none";
        }
    });

    // --- UI & NAVIGASI MOBILE (Sama Seperti Sebelumnya) ---
    const themeBtn = document.getElementById('themeToggle');
    if (localStorage.getItem('lpg_theme') === 'light') document.body.classList.add('light-theme');
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('lpg_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });

    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const sections = document.querySelectorAll('.page-section');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === target) sec.classList.add('active');
            });
        });
    });

    window.closeModal = (id) => document.getElementById(id).style.display = "none";
    
    function formatRupiah(angka) { return new Intl.NumberFormat('id-ID').format(angka); }
    document.querySelectorAll('.price-input').forEach(input => {
        input.addEventListener('input', function() {
            let val = this.value.replace(/[^,\d]/g, '');
            this.value = formatRupiah(val);
        });
    });

    // --- 1. LOAD HARGA ---
    async function loadHarga() {
        const docSnap = await getDoc(doc(db, "settings", "harga"));
        if (docSnap.exists() && docSnap.data().jual) {
            const jual = docSnap.data().jual.refill;
            document.getElementById('harga3kg').innerText = "Rp " + formatRupiah(jual['3kg'] || 0);
            document.getElementById('harga5kg').innerText = "Rp " + formatRupiah(jual['5kg'] || 0);
            document.getElementById('harga12kg').innerText = "Rp " + formatRupiah(jual['12kg'] || 0);
            document.getElementById('priceLastUpdate').innerText = formatTgl(docSnap.data().lastUpdated);
        }
    }

    // --- 2. BUKU KAS (Data Tersendiri Per User) ---
    document.getElementById('btnAddKas').addEventListener('click', () => {
        document.getElementById('formKas').reset();
        document.getElementById('modalKas').style.display = "flex";
    });

    document.getElementById('formKas').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nominal = parseInt(document.getElementById('kasNominal').value.replace(/\./g, ''));
        const data = {
            userId: currentUserUid, // IDENTIFIKASI PEMILIK DATA
            tipe: document.getElementById('kasTipe').value,
            nominal: nominal,
            keterangan: document.getElementById('kasKet').value,
            tanggal: new Date().toISOString()
        };
        await addDoc(collection(db, "buku_kas"), data);
        closeModal('modalKas');
        loadKas();
    });

    async function loadKas() {
        if (!currentUserUid) return;
        // Ambil data HANYA milik user yang sedang login
        const q = query(collection(db, "buku_kas"), where("userId", "==", currentUserUid));
        const snapshot = await getDocs(q);
        
        let docsData = [];
        snapshot.forEach(doc => docsData.push(doc.data()));
        // Sortir data terbaru ke atas (Client-side sorting agar tidak repot buat Index Firebase)
        docsData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

        let totalMasuk = 0, totalKeluar = 0;
        const listKas = document.getElementById('listKas');
        listKas.innerHTML = '';

        docsData.forEach(data => {
            const isMasuk = data.tipe === 'masuk';
            if(isMasuk) totalMasuk += data.nominal; else totalKeluar += data.nominal;

            listKas.innerHTML += `
                <div class="list-item">
                    <div class="list-item-left">
                        <h4>${data.keterangan}</h4>
                        <p>${formatTgl(data.tanggal)}</p>
                    </div>
                    <div class="list-item-right ${isMasuk ? 'text-green' : 'text-danger'}">
                        ${isMasuk ? '+' : '-'} Rp ${formatRupiah(data.nominal)}
                    </div>
                </div>
            `;
        });
        document.getElementById('totalMasuk').innerText = "Rp " + formatRupiah(totalMasuk);
        document.getElementById('totalKeluar').innerText = "Rp " + formatRupiah(totalKeluar);
        document.getElementById('saldoBersih').innerText = "Rp " + formatRupiah(totalMasuk - totalKeluar);
    }

    // --- 3. MUTASI STOK (Data Tersendiri Per User) ---
    document.getElementById('btnAddStok').addEventListener('click', () => {
        document.getElementById('formStok').reset();
        document.getElementById('modalStok').style.display = "flex";
    });

    document.getElementById('formStok').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tipeInput = document.getElementById('stokTipe').value;
        const tabungInput = document.getElementById('stokTabung').value;
        const jumlahInput = parseInt(document.getElementById('stokJumlah').value);
        
        const data = {
            userId: currentUserUid, // IDENTIFIKASI PEMILIK DATA
            tabung: tabungInput,
            tipe: tipeInput,
            jumlah: jumlahInput,
            tanggal: new Date().toISOString()
        };
        
        // 1. Simpan data mutasi stok
        await addDoc(collection(db, "mutasi_stok"), data);

        // 2. --- TAMBAHAN BARU: KIRIM NOTIFIKASI KE ADMIN ---
        try {
            const userName = document.querySelector('.user-name').innerText || "User";
            const tabungLabel = tabungInput === '3kg' ? '3 kg' : tabungInput === '5kg' ? '5.5 kg' : '12 kg';
            const jenisMutasi = tipeInput === 'masuk' ? 'menambahkan' : 'mengeluarkan';

            await addDoc(collection(db, "notifikasi"), {
                judul: "Info Mutasi Stok Baru",
                pesan: `${userName} ${jenisMutasi} ${jumlahInput} tabung ${tabungLabel}.`,
                isRead: false,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Gagal mengirim notifikasi admin: ", error);
        }
        // ----------------------------------------------------

        closeModal('modalStok');
        loadStok();
    });

    async function loadStok() {
        if (!currentUserUid) return;
        // Ambil data HANYA milik user yang sedang login
        const q = query(collection(db, "mutasi_stok"), where("userId", "==", currentUserUid));
        const snapshot = await getDocs(q);

        let docsData = [];
        snapshot.forEach(doc => docsData.push(doc.data()));
        // Sortir data terbaru ke atas
        docsData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

        const listStok = document.getElementById('listStok');
        listStok.innerHTML = '';

        docsData.forEach(data => {
            const isMasuk = data.tipe === 'masuk';
            let tabungLabel = data.tabung === '3kg' ? '3 kg' : data.tabung === '5kg' ? '5.5 kg' : '12 kg';

            listStok.innerHTML += `
                <div class="list-item">
                    <div class="list-item-left">
                        <h4>Tabung ${tabungLabel}</h4>
                        <p>${formatTgl(data.tanggal)}</p>
                    </div>
                    <div class="list-item-right ${isMasuk ? 'text-blue' : 'text-danger'}">
                        ${isMasuk ? 'MASUK' : 'KELUAR'} ${data.jumlah} TBG
                    </div>
                </div>
            `;
        });
    }
});