import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// GUNAKAN FIREBASE CONFIG YANG SAMA DENGAN ADMIN
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

document.addEventListener('DOMContentLoaded', () => {

    // --- AUTENTIKASI ---
    document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
        try { await signInWithPopup(auth, provider); } 
        catch (error) { document.getElementById('loginError').innerText = error.message; }
    });

    document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            document.getElementById('loginScreen').style.display = "none";
            document.getElementById('appContent').style.display = "flex";
            document.querySelector('.user-name').innerText = user.displayName;
            
            // Load Data
            loadHarga();
            loadKas();
            loadStok();
        } else {
            document.getElementById('loginScreen').style.display = "flex";
            document.getElementById('appContent').style.display = "none";
        }
    });

    // --- UI & NAVIGASI MOBILE ---
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
    
    // --- FORMAT RUPIAH ---
    function formatRupiah(angka) {
        return new Intl.NumberFormat('id-ID').format(angka);
    }
    document.querySelectorAll('.price-input').forEach(input => {
        input.addEventListener('input', function() {
            let val = this.value.replace(/[^,\d]/g, '');
            this.value = formatRupiah(val);
        });
    });

    // --- 1. LOAD HARGA (Dari Admin) ---
    async function loadHarga() {
        const docSnap = await getDoc(doc(db, "settings", "harga"));
        if (docSnap.exists() && docSnap.data().jual) {
            const jual = docSnap.data().jual.refill;
            document.getElementById('harga3kg').innerText = "Rp " + formatRupiah(jual['3kg'] || 0);
            document.getElementById('harga5kg').innerText = "Rp " + formatRupiah(jual['5kg'] || 0);
            document.getElementById('harga12kg').innerText = "Rp " + formatRupiah(jual['12kg'] || 0);
            document.getElementById('priceLastUpdate').innerText = new Date(docSnap.data().lastUpdated).toLocaleString('id-ID');
        }
    }

    // --- 2. BUKU KAS PRIBADI ---
    document.getElementById('btnAddKas').addEventListener('click', () => {
        document.getElementById('formKas').reset();
        document.getElementById('modalKas').style.display = "flex";
    });

    document.getElementById('formKas').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nominal = parseInt(document.getElementById('kasNominal').value.replace(/\./g, ''));
        const data = {
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
        const q = query(collection(db, "buku_kas"), orderBy("tanggal", "desc"));
        const snapshot = await getDocs(q);
        let totalMasuk = 0, totalKeluar = 0;
        const listKas = document.getElementById('listKas');
        listKas.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            const isMasuk = data.tipe === 'masuk';
            if(isMasuk) totalMasuk += data.nominal; else totalKeluar += data.nominal;

            listKas.innerHTML += `
                <div class="list-item">
                    <div class="list-item-left">
                        <h4>${data.keterangan}</h4>
                        <p>${new Date(data.tanggal).toLocaleDateString('id-ID')}</p>
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

    // --- 3. MUTASI STOK INTERNAL ---
    document.getElementById('btnAddStok').addEventListener('click', () => {
        document.getElementById('formStok').reset();
        document.getElementById('modalStok').style.display = "flex";
    });

    document.getElementById('formStok').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            tabung: document.getElementById('stokTabung').value,
            tipe: document.getElementById('stokTipe').value,
            jumlah: parseInt(document.getElementById('stokJumlah').value),
            tanggal: new Date().toISOString()
        };
        await addDoc(collection(db, "mutasi_stok"), data);
        closeModal('modalStok');
        loadStok();
    });

    async function loadStok() {
        const q = query(collection(db, "mutasi_stok"), orderBy("tanggal", "desc"));
        const snapshot = await getDocs(q);
        const listStok = document.getElementById('listStok');
        listStok.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            const isMasuk = data.tipe === 'masuk';
            let tabungLabel = data.tabung === '3kg' ? '3 KG' : data.tabung === '5kg' ? '5.5 KG' : '12 KG';

            listStok.innerHTML += `
                <div class="list-item">
                    <div class="list-item-left">
                        <h4>Tabung ${tabungLabel}</h4>
                        <p>${new Date(data.tanggal).toLocaleString('id-ID')}</p>
                    </div>
                    <div class="list-item-right ${isMasuk ? 'text-blue' : 'text-danger'}">
                        ${isMasuk ? 'MASUK' : 'KELUAR'} ${data.jumlah} Tbg
                    </div>
                </div>
            `;
        });
    }
});