import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, query, where, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
    
    // --- FITUR LOGOUT DENGAN MODAL ---
    // Ubah pemanggilan ID dari btnLogout menjadi btnLogoutItem (yg ada di dropdown menu)
    const btnLogoutItem = document.getElementById('btnLogoutItem');
    const modalLogout = document.getElementById('modalLogout');
    const btnBatalLogout = document.getElementById('btnBatalLogout');
    const btnKonfirmLogout = document.getElementById('btnKonfirmLogout');

    if (btnLogoutItem && modalLogout) {
        btnLogoutItem.addEventListener('click', () => {
            document.getElementById('overflowDropdown').classList.remove('show'); // Tutup menu saat diklik
            modalLogout.style.display = 'flex';
        });
        btnBatalLogout.addEventListener('click', () => modalLogout.style.display = 'none');
        btnKonfirmLogout.addEventListener('click', () => {
            signOut(auth).then(() => {
                modalLogout.style.display = 'none';
            }).catch((error) => console.error("Gagal logout:", error));
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            document.getElementById('loginScreen').style.display = "none";
            document.getElementById('appContent').style.display = "flex";
            document.querySelector('.user-name').innerText = user.displayName;
            loadHarga();
            loadKas();
            loadStokInfo();
        } else {
            currentUserUid = null;
            document.getElementById('loginScreen').style.display = "flex";
            document.getElementById('appContent').style.display = "none";
        }
    });

    // --- FITUR OVERFLOW MENU (TITIK TIGA) ---
    const btnOverflowMenu = document.getElementById('btnOverflowMenu');
    const overflowDropdown = document.getElementById('overflowDropdown');
    
    if (btnOverflowMenu && overflowDropdown) {
        // Toggle menu saat diklik
        btnOverflowMenu.addEventListener('click', (e) => {
            e.stopPropagation(); // Cegah merambat ke document
            overflowDropdown.classList.toggle('show');
        });

        // Tutup menu saat user klik di luar area kotak
        document.addEventListener('click', (e) => {
            if (!overflowDropdown.contains(e.target) && !btnOverflowMenu.contains(e.target)) {
                overflowDropdown.classList.remove('show');
            }
        });
    }

    // --- FITUR GANTI TEMA DARI MENU DROP-DOWN ---
    const themeItem = document.getElementById('themeToggleItem');
    const themeIcon = themeItem ? themeItem.querySelector('i') : null;

    if (localStorage.getItem('lpg_theme') === 'light') {
        document.body.classList.add('light-theme');
        if (themeIcon) { themeIcon.classList.remove('fa-sun'); themeIcon.classList.add('fa-moon'); }
    }

    if (themeItem) {
        themeItem.addEventListener('click', (e) => {
            e.preventDefault();
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            
            localStorage.setItem('lpg_theme', isLight ? 'light' : 'dark');
            
            if (isLight) {
                themeIcon.classList.remove('fa-sun'); themeIcon.classList.add('fa-moon');
            } else {
                themeIcon.classList.remove('fa-moon'); themeIcon.classList.add('fa-sun');
            }
            
            // Tutup dropdown setelah ditekan
            overflowDropdown.classList.remove('show');
        });
    }

    // --- FITUR SHARE APLIKASI ---
    const btnShareApp = document.getElementById('btnShareApp');
    if (btnShareApp) {
        btnShareApp.addEventListener('click', async () => {
            const shareData = {
                title: 'Pangkalan LPG Hasmawati',
                text: 'Pesan gas LPG secara online dengan mudah dan cepat tanpa perlu antre di Pangkalan Hasmawati.',
                url: window.location.href // Akan mengambil URL aplikasi saat ini (misal link hosting Anda)
            };
            
            try {
                if (navigator.share) {
                    await navigator.share(shareData); // Fitur native share HP (WhatsApp, dll)
                } else {
                    // Fallback jika dibuka di browser desktop lama
                    navigator.clipboard.writeText(shareData.url);
                    alert("Link aplikasi berhasil disalin ke clipboard!");
                }
            } catch (err) {
                console.error("Gagal melakukan share:", err);
            }
        });
    }

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

    // --- 1. LOAD HARGA GAS (REAL-TIME) ---
    function loadHarga() {
        onSnapshot(doc(db, "settings", "harga"), (docSnap) => {
            if (docSnap.exists() && docSnap.data().jual) {
                const jual = docSnap.data().jual.refill;
                
                hargaSekarang['3kg'] = jual['3kg'] || 0;
                hargaSekarang['5kg'] = jual['5kg'] || 0;
                hargaSekarang['12kg'] = jual['12kg'] || 0;
                
                document.getElementById('harga3kg').innerText = "Rp " + formatRupiah(hargaSekarang['3kg']);
                document.getElementById('harga5kg').innerText = "Rp " + formatRupiah(hargaSekarang['5kg']);
                document.getElementById('harga12kg').innerText = "Rp " + formatRupiah(hargaSekarang['12kg']);
                // document.getElementById('priceLastUpdate').innerText = formatTgl(docSnap.data().lastUpdated);
                
                hitungTotalPesanan();
            }
        }, (error) => {
            console.error("Gagal mendengarkan perubahan harga:", error);
        });
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
    
    // Variabel Global untuk menyimpan stok real-time
    let stokSekarangAdmin = { '3kg': 0, '5kg': 0, '12kg': 0 };

    // Validasi Input NIK Real-Time (Hanya Angka & 16 Digit)
    const orderNik = document.getElementById('orderNik');
    const nikError = document.getElementById('nikError');

    if (orderNik) {
        orderNik.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, ''); // Buang semua huruf/karakter selain angka
            
            if (this.value.length > 0 && this.value.length !== 16) {
                nikError.style.display = 'block';
                nikError.innerText = "NIK harus persis 16 digit angka.";
                this.style.borderColor = "var(--danger-color)";
            } else {
                nikError.style.display = 'none';
                this.style.borderColor = "var(--border-color)";
            }
        });
    }

    // Load Stok dari Admin & Update UI Tombol Plus-Minus serta Halaman Harga
    function loadStokInfo() {
        onSnapshot(doc(db, "settings", "inventaris"), (docSnap) => {
            // Ambil elemen HTML di halaman Harga
            const elStokHarga3kg = document.getElementById('stokHarga3kg');
            const elStokHarga5kg = document.getElementById('stokHarga5kg');
            const elStokHarga12kg = document.getElementById('stokHarga12kg');
            
            if (docSnap.exists()) {
                const dataInv = docSnap.data();

                // Mengambil waktu pembaruan dari data stok
                const elPriceLastUpdate = document.getElementById('priceLastUpdate');
                if (elPriceLastUpdate && dataInv.lastUpdated) {
                    elPriceLastUpdate.innerText = formatTgl(dataInv.lastUpdated);
                }

                // Simpan stok ke memori lokal
                stokSekarangAdmin['3kg'] = parseInt(dataInv['3kg'] || 0, 10);
                stokSekarangAdmin['5kg'] = parseInt(dataInv['5kg'] || 0, 10);
                stokSekarangAdmin['12kg'] = parseInt(dataInv['12kg'] || 0, 10);
                
                // Fungsi bantuan untuk mengubah teks & warna stok
                const updateTampilanStok = (elemen, jumlahStok) => {
                    if (!elemen) return;
                    if (jumlahStok <= 0) {
                        elemen.classList.remove('text-blue');
                        elemen.classList.add('text-danger');
                        elemen.innerText = "HABIS";
                    } else {
                        elemen.classList.add('text-blue');
                        elemen.classList.remove('text-danger');
                        elemen.innerText = jumlahStok + " TBG";
                    }
                };

                // Update tampilan stok di halaman "Harga"
                updateTampilanStok(elStokHarga3kg, stokSekarangAdmin['3kg']);
                updateTampilanStok(elStokHarga5kg, stokSekarangAdmin['5kg']);
                updateTampilanStok(elStokHarga12kg, stokSekarangAdmin['12kg']);

                updateQtyUI();
            }
        }, (error) => {
            console.error("Gagal mendengarkan data stok:", error);
        });
    }

    // --- LOGIKA TOMBOL PLUS MINUS ---
    const btnMinQty = document.getElementById('btnMinQty');
    const btnAddQty = document.getElementById('btnAddQty');
    const orderJumlah = document.getElementById('orderJumlah');
    const orderJenis = document.getElementById('orderJenis');
    const stokWarning = document.getElementById('stokWarning');
    const btnSubmitPesanan = document.getElementById('btnSubmitPesanan');

    function updateQtyUI() {
        if (!orderJumlah || !orderJenis) return;

        const jenis = orderJenis.value;
        const maxStok = stokSekarangAdmin[jenis] || 0;
        let currentQty = parseInt(orderJumlah.value) || 0;

        if (maxStok <= 0) {
            // Jika Habis: Kunci di 0
            orderJumlah.value = 0;
            btnMinQty.disabled = true;
            btnAddQty.disabled = true;
            btnMinQty.style.opacity = "0.5";
            btnAddQty.style.opacity = "0.5";
            stokWarning.innerText = `Stok ${jenis.toUpperCase()} saat ini HABIS.`;
            stokWarning.style.display = "block";
            btnSubmitPesanan.disabled = true;
            btnSubmitPesanan.style.opacity = "0.5";
        } else {
            // Jika Tersedia: Aktifkan input
            btnSubmitPesanan.disabled = false;
            btnSubmitPesanan.style.opacity = "1";

            if (currentQty === 0) currentQty = 1; // Minimal 1 jika ada stok
            if (currentQty > maxStok) currentQty = maxStok; // Jangan lewat batas stok
            
            orderJumlah.value = currentQty;

            // Kontrol Nyala/Mati tombol Plus Minus
            btnMinQty.disabled = currentQty <= 1;
            btnMinQty.style.opacity = currentQty <= 1 ? "0.5" : "1";
            
            btnAddQty.disabled = currentQty >= maxStok;
            btnAddQty.style.opacity = currentQty >= maxStok ? "0.5" : "1";
            
            if(currentQty >= maxStok) {
                stokWarning.innerText = `Batas maksimal pesanan (${maxStok} Tabung).`;
                stokWarning.style.display = "block";
            } else {
                stokWarning.style.display = "none";
            }
        }
        hitungTotalPesanan();
    }

    // Trigger Perubahan saat Jenis Tabung Dipilih
    if (orderJenis) orderJenis.addEventListener('change', () => {
        const jenis = orderJenis.value;
        const nikGroup = document.getElementById('nikGroup');
        const orderNikInput = document.getElementById('orderNik');

        if (jenis === '3kg') {
            // Tampilkan dan Wajibkan NIK untuk 3kg
            nikGroup.style.display = 'block';
            orderNikInput.required = true;
        } else {
            // Sembunyikan dan Hapus Kewajiban NIK untuk 5.5kg & 12kg
            nikGroup.style.display = 'none';
            orderNikInput.required = false;
            orderNikInput.value = ''; // Kosongkan nilainya
            document.getElementById('nikError').style.display = 'none';
            orderNikInput.style.borderColor = "var(--border-color)";
        }

        orderJumlah.value = 0; // Paksa reset jumlah saat ganti tabung
        updateQtyUI();
    });

    if (btnAddQty) btnAddQty.addEventListener('click', () => {
        const jenis = orderJenis.value;
        const maxStok = stokSekarangAdmin[jenis] || 0;
        let currentQty = parseInt(orderJumlah.value) || 0;
        if (currentQty < maxStok) {
            orderJumlah.value = currentQty + 1;
            updateQtyUI();
        }
    });

    if (btnMinQty) btnMinQty.addEventListener('click', () => {
        let currentQty = parseInt(orderJumlah.value) || 0;
        if (currentQty > 1) {
            orderJumlah.value = currentQty - 1;
            updateQtyUI();
        }
    });

    function hitungTotalPesanan() {
        const elTotal = document.getElementById('orderTotal');
        if(!orderJenis || !orderJumlah || !elTotal) return 0;
        
        const jenis = orderJenis.value;
        const jumlah = parseInt(orderJumlah.value) || 0;
        const total = (hargaSekarang[jenis] || 0) * jumlah;
        
        elTotal.innerText = "Rp " + formatRupiah(total);
        return total;
    }

    // --- PROSES SUBMIT PESANAN ---
    const formPesanan = document.getElementById('formPesanan');
    if(formPesanan) {
        formPesanan.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nama = document.getElementById('orderNama').value.trim();
            const nik = document.getElementById('orderNik').value.trim();
            const jenis = document.getElementById('orderJenis').value;
            const jumlah = parseInt(document.getElementById('orderJumlah').value) || 0;
            const totalHarga = hitungTotalPesanan();

            // 1. Validasi Keamanan NIK KTP (Hanya Berlaku untuk Gas 3kg)
            let finalNik = nik;
            
            if (jenis === '3kg') {
                if (nik.length !== 16) {
                    alert("Pemesanan Gagal: NIK KTP harus persis 16 digit angka untuk gas 3 kg.");
                    return;
                }
                
                // Validasi format angka bulan & tanggal lahir di KTP
                const dd = parseInt(nik.substring(6, 8), 10);
                const mm = parseInt(nik.substring(8, 10), 10);
                if (mm < 1 || mm > 12) {
                    alert("Pemesanan Gagal: NIK tidak sesuai standar (Kode Bulan Lahir salah).");
                    return;
                }
                const isValidHari = (dd >= 1 && dd <= 31) || (dd >= 41 && dd <= 71);
                if (!isValidHari) {
                    alert("Pemesanan Gagal: NIK tidak sesuai standar (Kode Tanggal Lahir salah).");
                    return;
                }
            } else {
                // Jika 5.5kg atau 12kg, ubah NIK menjadi tanda strip agar rapi di WA dan Database
                finalNik = "-";
            }

            // 2. Validasi Stok
            if (jumlah <= 0 || jumlah > (stokSekarangAdmin[jenis] || 0)) {
                alert("Pesanan ditolak: Jumlah pesanan tidak valid atau stok telah habis.");
                return;
            }

            try {
                // Simpan ke Antrean
                await addDoc(collection(db, "antrean_pesanan"), {
                    userId: currentUserUid,
                    namaLengkap: nama,
                    nikKtp: finalNik,
                    jenisTabung: jenis,
                    jumlahTabung: jumlah,
                    totalHarga: totalHarga,
                    statusPesanan: "Menunggu",
                    tanggalOrder: serverTimestamp() 
                });

                // Kirim Notifikasi Admin
                const jenisLabel = jenis === '3kg' ? '3 kg' : jenis === '5kg' ? '5.5 kg' : '12 kg';
                await addDoc(collection(db, "notifikasi"), {
                    judul: "Pesanan Masuk (Antrean)",
                    pesan: `Pesanan baru: ${jumlah} tabung ${jenisLabel} dari ${nama}`,
                    isRead: false,
                    timestamp: serverTimestamp()
                });

                orderJumlah.value = 1;
                updateQtyUI();

                const pesanWa = `Halo Admin Pangkalan, saya ingin memesan gas:\n\n*Nama:* ${nama}\n*NIK:* ${finalNik}\n*Pesanan:* ${jumlah} Tabung Refill ${jenisLabel}\n*Total Bayar:* Rp ${formatRupiah(totalHarga)}\n\nMohon konfirmasi pesanan saya. Terima kasih.`;
                const waUrl = `https://wa.me/${nomorWaAdmin}?text=${encodeURIComponent(pesanWa)}`;
                
                window.location.href = waUrl; 

            } catch (error) {
                console.error("Gagal membuat pesanan:", error);
                alert("Terjadi kesalahan saat memproses pesanan.");
            }
        });
    }

    // ==========================================
    // FITUR PWA (SERVICE WORKER, INSTALL & UPDATE)
    // ==========================================

    let deferredPrompt;
    const installBtn = document.getElementById('pwaInstallBtn');
    const updateBanner = document.getElementById('pwaUpdateBanner');
    const updateBtn = document.getElementById('pwaUpdateBtn');

    // 1. Logika Tombol Install
    window.addEventListener('beforeinstallprompt', (e) => {
        // Mencegah browser langsung memunculkan pop-up bawaan
        e.preventDefault();
        deferredPrompt = e;
        
        // Munculkan tombol Install yang nempel di kanan
        if(installBtn) installBtn.style.display = 'flex';
    });

    if(installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt(); // Munculkan pop-up install
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('User menginstal aplikasi');
                }
                deferredPrompt = null;
                installBtn.style.display = 'none'; // Sembunyikan tombol setelah di-install
            }
        });
    }

    // 2. Registrasi Service Worker & Deteksi Update
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((registration) => {
                console.log('Service Worker Terdaftar:', registration);

                // Deteksi jika ada update Service Worker (Versi baru)
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        // Jika ada pekerja (worker) baru yang menunggu, berarti ada update
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            if(updateBanner) updateBanner.style.display = 'flex';
                            
                            // Jika tombol update ditekan
                            if (updateBtn) {
                                updateBtn.onclick = () => {
                                    // Sembunyikan banner saat ditekan agar terlihat ada respons
                                    updateBanner.style.display = 'none'; 
                                    updateBtn.innerHTML = "Memperbarui...";
                                    
                                    // Paksa service worker baru untuk aktif
                                    newWorker.postMessage({ action: 'skipWaiting' });
                                };
                            }
                        }
                    });
                });
            }).catch((err) => {
                console.log('Gagal mendaftarkan Service Worker:', err);
            });
        });

        // Refresh halaman secara otomatis saat versi baru berhasil diaktifkan
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                window.location.reload();
                refreshing = true;
            }
        });
    }
}); // End DOMContentLoaded