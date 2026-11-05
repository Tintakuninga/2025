import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// [FIREBASE CONFIG]
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

// --- VARIABEL GLOBAL ---
let currentUserUid = null;
let hargaSekarang = { '3kg': 0, '5kg': 0, '12kg': 0 };

// PENTING: Ganti dengan Nomor WhatsApp Anda yang diawali kode negara 62 (Tanpa + atau 0)
const nomorWaAdmin = "6282291582220"; 

document.addEventListener('DOMContentLoaded', () => {

    // Helper: Format Tanggal
    function formatTgl(isoString) {
        if (!isoString) return "-";
        const d = new Date(isoString);
        const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        const day = d.getDate();
        const month = bulan[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day} ${month} ${year}, ${hours}:${minutes}`;
    }

    // Helper: Format Rupiah
    function formatRupiah(angka) { 
        return new Intl.NumberFormat('id-ID').format(angka); 
    }

    // --- AUTENTIKASI ---
    document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
        try { await signInWithPopup(auth, provider); } 
        catch (error) { document.getElementById('loginError').innerText = error.message; }
    });
    
    document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            document.getElementById('loginScreen').style.display = "none";
            document.getElementById('appContent').style.display = "flex";
            document.querySelector('.user-name').innerText = user.displayName;
            
            // Isi otomatis nama di form pemesanan
            const inputNama = document.getElementById('orderNama');
            if(inputNama) inputNama.value = user.displayName;
            
            // Load Data Utama
            loadHarga();
            loadKas();
            loadStokInfo();
        } else {
            currentUserUid = null;
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

    window.closeModal = (id) => {
        const modal = document.getElementById(id);
        if(modal) modal.style.display = "none";
    };
    
    document.querySelectorAll('.price-input').forEach(input => {
        input.addEventListener('input', function() {
            let val = this.value.replace(/[^,\d]/g, '');
            this.value = formatRupiah(val);
        });
    });

    // --- 1. LOAD HARGA GAS ---
    async function loadHarga() {
        try {
            const docSnap = await getDoc(doc(db, "settings", "harga"));
            if (docSnap.exists() && docSnap.data().jual) {
                const jual = docSnap.data().jual.refill;
                
                // Simpan harga ke memori global untuk kalkulasi Order
                hargaSekarang['3kg'] = jual['3kg'] || 0;
                hargaSekarang['5kg'] = jual['5kg'] || 0;
                hargaSekarang['12kg'] = jual['12kg'] || 0;
                
                // Tampilkan ke UI Harga
                document.getElementById('harga3kg').innerText = "Rp " + formatRupiah(hargaSekarang['3kg']);
                document.getElementById('harga5kg').innerText = "Rp " + formatRupiah(hargaSekarang['5kg']);
                document.getElementById('harga12kg').innerText = "Rp " + formatRupiah(hargaSekarang['12kg']);
                document.getElementById('priceLastUpdate').innerText = formatTgl(docSnap.data().lastUpdated);
                
                hitungTotalPesanan(); // Hitung ulang total order jika harga berubah
            }
        } catch(e) { console.error("Error load harga:", e); }
    }

    // --- 2. BUKU KAS PRIBADI ---
    const btnAddKas = document.getElementById('btnAddKas');
    if(btnAddKas) {
        btnAddKas.addEventListener('click', () => {
            document.getElementById('formKas').reset();
            document.getElementById('modalKas').style.display = "flex";
        });
    }

    const formKas = document.getElementById('formKas');
    if(formKas) {
        formKas.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nominalStr = document.getElementById('kasNominal').value.replace(/\./g, '');
            const nominal = parseInt(nominalStr) || 0;
            
            const data = {
                userId: currentUserUid,
                tipe: document.getElementById('kasTipe').value,
                nominal: nominal,
                keterangan: document.getElementById('kasKet').value,
                tanggal: new Date().toISOString()
            };
            
            await addDoc(collection(db, "buku_kas"), data);
            closeModal('modalKas');
            loadKas();
        });
    }

    async function loadKas() {
        if (!currentUserUid) return;
        try {
            const q = query(collection(db, "buku_kas"), where("userId", "==", currentUserUid));
            const snapshot = await getDocs(q);
            
            let docsData = [];
            snapshot.forEach(doc => docsData.push(doc.data()));
            docsData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

            let totalMasuk = 0, totalKeluar = 0;
            const listKas = document.getElementById('listKas');
            if(listKas) listKas.innerHTML = '';

            docsData.forEach(data => {
                const isMasuk = data.tipe === 'masuk';
                if(isMasuk) totalMasuk += data.nominal; else totalKeluar += data.nominal;

                if(listKas) {
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
                }
            });
            
            document.getElementById('totalMasuk').innerText = "Rp " + formatRupiah(totalMasuk);
            document.getElementById('totalKeluar').innerText = "Rp " + formatRupiah(totalKeluar);
            document.getElementById('saldoBersih').innerText = "Rp " + formatRupiah(totalMasuk - totalKeluar);
        } catch(e) { console.error("Error load kas:", e); }
    }

    // --- 3. FITUR PEMESANAN GAS & WA ---
    
    // Load Stok Tersedia dari Admin
    async function loadStokInfo() {
        try {
            const docSnap = await getDoc(doc(db, "settings", "stok"));
            if (docSnap.exists()) {
                const elStok3kg = document.getElementById('infoStok3kg');
                if(elStok3kg) elStok3kg.innerText = (docSnap.data()['3kg'] || 0) + " TBG";
            } else {
                const elStok3kg = document.getElementById('infoStok3kg');
                if(elStok3kg) elStok3kg.innerText = "Belum ada data";
            }
        } catch(e) { console.error("Error load stok info:", e); }
    }

    // Kalkulasi Harga Otomatis di Form
    function hitungTotalPesanan() {
        const elJenis = document.getElementById('orderJenis');
        const elJumlah = document.getElementById('orderJumlah');
        const elTotal = document.getElementById('orderTotal');
        
        if(!elJenis || !elJumlah || !elTotal) return 0;
        
        const jenis = elJenis.value;
        const jumlah = parseInt(elJumlah.value) || 0;
        const total = (hargaSekarang[jenis] || 0) * jumlah;
        
        elTotal.innerText = "Rp " + formatRupiah(total);
        return total;
    }

    // Trigger Perhitungan saat User ubah Jenis / Jumlah
    const orderJenis = document.getElementById('orderJenis');
    if(orderJenis) orderJenis.addEventListener('change', hitungTotalPesanan);
    
    const orderJumlah = document.getElementById('orderJumlah');
    if(orderJumlah) orderJumlah.addEventListener('input', hitungTotalPesanan);

    // Proses Submit Pesanan
    const formPesanan = document.getElementById('formPesanan');
    if(formPesanan) {
        formPesanan.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nama = document.getElementById('orderNama').value;
            const nik = document.getElementById('orderNik').value;
            const jenis = document.getElementById('orderJenis').value;
            const jumlah = parseInt(document.getElementById('orderJumlah').value) || 1;
            const totalHarga = hitungTotalPesanan();

            try {
                // 1. Simpan ke database (Antrean Pesanan Admin)
                await addDoc(collection(db, "antrean_pesanan"), {
                    userId: currentUserUid,
                    namaLengkap: nama,
                    nikKtp: nik,
                    jenisTabung: jenis,
                    jumlahTabung: jumlah,
                    totalHarga: totalHarga,
                    statusPesanan: "Menunggu",
                    tanggalOrder: serverTimestamp() 
                });

                // 2. Format Pesan WhatsApp & Redirect
                const jenisLabel = jenis === '3kg' ? '3 kg' : jenis === '5kg' ? '5.5 kg' : '12 kg';
                const pesanWa = `Halo Admin Pangkalan, saya ingin memesan gas:\n\n*Nama:* ${nama}\n*NIK:* ${nik}\n*Pesanan:* ${jumlah} Tabung Refill ${jenisLabel}\n*Total Bayar:* Rp ${formatRupiah(totalHarga)}\n\nMohon konfirmasi pesanan saya. Terima kasih.`;
                
                const waUrl = `https://wa.me/${nomorWaAdmin}?text=${encodeURIComponent(pesanWa)}`;
                window.open(waUrl, '_blank');

                // 3. Reset Jumlah ke default (1)
                document.getElementById('orderJumlah').value = 1;
                hitungTotalPesanan();

            } catch (error) {
                console.error("Gagal membuat pesanan:", error);
                alert("Terjadi kesalahan saat memproses pesanan.");
            }
        });
    }
});